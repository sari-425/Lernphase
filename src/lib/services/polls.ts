import { and, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { DB } from "@/lib/db/client";
import { pollVotes, polls, type Poll } from "@/lib/db/schema";
import { hmac } from "@/lib/auth/crypto";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { AppError, invalid, notFound } from "@/lib/errors";
import type { PollInput } from "@/lib/validation/schemas";
import { audit } from "./audit";
import { allowedVisibilities, isUuid, type Access } from "./messages";

/**
 * Umfragen = anonymes, unverbindliches Stimmungsbild.
 * - Keine Personendaten, keine IP.
 * - "Eine Stimme pro Gerät": HMAC aus zufälligem Geräte-Cookie + Umfrage. Nach Ende
 *   der Umfrage wird auch dieser Wert gelöscht – übrig bleiben nur Zählungen.
 * - Mehrfachabstimmung mit mehreren Geräten/Browsern ist NICHT ausgeschlossen
 *   (deshalb ausdrücklich kein Ersatz für Wahlen oder Beschlüsse).
 */

export const newDeviceToken = () => randomBytes(24).toString("base64url");

const toOptions = (labels: string[]) => labels.map((label, i) => ({ id: `o${i + 1}`, label }));

export function isPollOpen(p: Pick<Poll, "status" | "closesAt">, now = new Date()) {
  return p.status === "open" && (!p.closesAt || p.closesAt > now);
}

async function loadOwn(db: DB, actor: Actor, id: string) {
  if (!isUuid(id)) throw notFound("Umfrage nicht gefunden.");
  const [p] = await db.select().from(polls).where(and(eq(polls.id, id), eq(polls.tenantId, actor.tenantId)));
  if (!p) throw notFound("Umfrage nicht gefunden.");
  return p;
}

export async function createPoll(db: DB, actor: Actor, input: PollInput) {
  assertCan(actor, "message.create");
  const [p] = await db
    .insert(polls)
    .values({
      tenantId: actor.tenantId,
      question: input.question,
      description: input.description,
      options: toOptions(input.options),
      visibility: input.visibility,
      closesAt: input.closesAt,
      resultsPublic: input.resultsPublic,
      createdBy: actor.userId,
    })
    .returning();
  await audit(db, actor, "poll.create", p.id);
  return p;
}

export async function updatePoll(db: DB, actor: Actor, id: string, input: PollInput) {
  assertCan(actor, "message.edit");
  const p = await loadOwn(db, actor, id);
  if (p.status !== "draft") throw invalid("Eine gestartete Umfrage kann nicht mehr geändert werden (sonst wären bisherige Stimmen verfälscht).");
  await db
    .update(polls)
    .set({ question: input.question, description: input.description, options: toOptions(input.options), visibility: input.visibility, closesAt: input.closesAt, resultsPublic: input.resultsPublic })
    .where(eq(polls.id, id));
  await audit(db, actor, "poll.update", id);
}

export async function openPoll(db: DB, actor: Actor, id: string, opts: { confirmPublic?: boolean; now?: Date } = {}) {
  assertCan(actor, "message.publish");
  const now = opts.now ?? new Date();
  const p = await loadOwn(db, actor, id);
  if (p.status !== "draft") throw invalid("Die Umfrage wurde bereits gestartet.");
  if (p.visibility === "public" && !opts.confirmPublic) {
    throw invalid("Bitte bestätigen Sie, dass jede Person mit dem Link teilnehmen kann.");
  }
  if (p.closesAt && p.closesAt <= now) throw invalid("Das Enddatum liegt in der Vergangenheit.");
  await db.update(polls).set({ status: "open", openedAt: now }).where(eq(polls.id, id));
  await audit(db, actor, "poll.open", id);
}

export async function closePoll(db: DB, actor: Actor, id: string, now = new Date()) {
  assertCan(actor, "message.publish");
  const p = await loadOwn(db, actor, id);
  if (p.status !== "open") throw invalid("Die Umfrage läuft nicht.");
  await db.update(polls).set({ status: "closed", closedAt: now }).where(eq(polls.id, id));
  await db.update(pollVotes).set({ voterHash: null }).where(eq(pollVotes.pollId, id));
  await audit(db, actor, "poll.close", id);
}

export async function deletePoll(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.delete");
  await loadOwn(db, actor, id);
  await db.delete(polls).where(and(eq(polls.id, id), eq(polls.tenantId, actor.tenantId)));
  await audit(db, actor, "poll.delete", id);
}

export interface PollResults {
  total: number;
  counts: Record<string, number>;
}

export async function pollResults(db: DB, pollId: string): Promise<PollResults> {
  const rows = await db
    .select({ optionId: pollVotes.optionId, n: sql<number>`count(*)::int` })
    .from(pollVotes)
    .where(eq(pollVotes.pollId, pollId))
    .groupBy(pollVotes.optionId);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    counts[r.optionId] = r.n;
    total += r.n;
  }
  return { total, counts };
}

export async function listPollsForEditor(db: DB, actor: Actor) {
  assertCan(actor, "message.read_internal");
  const list = await db.select().from(polls).where(eq(polls.tenantId, actor.tenantId)).orderBy(desc(polls.createdAt)).limit(100);
  return Promise.all(list.map(async (p) => ({ ...p, results: await pollResults(db, p.id) })));
}

export async function getPollForEditor(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.read_internal");
  const p = await loadOwn(db, actor, id);
  return { ...p, results: await pollResults(db, p.id) };
}

// ---------- Teilnahme (Beschäftigte) ----------

function voterHash(secret: string, pollId: string, deviceToken: string) {
  return hmac(secret, `vote|${pollId}|${deviceToken}`);
}

export async function listVisiblePolls(db: DB, tenantId: string, access: Access, now = new Date()) {
  const vis = allowedVisibilities(access).filter((v) => v !== "council");
  return db
    .select()
    .from(polls)
    .where(and(eq(polls.tenantId, tenantId), inArray(polls.visibility, vis), inArray(polls.status, ["open", "closed"])))
    .orderBy(desc(polls.openedAt))
    .limit(30)
    .then((rows) => rows.map((p) => ({ ...p, isOpen: isPollOpen(p, now) })));
}

export async function hasVoted(db: DB, secret: string, pollId: string, deviceToken: string | undefined) {
  if (!deviceToken) return false;
  const [v] = await db
    .select({ id: pollVotes.id })
    .from(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.voterHash, voterHash(secret, pollId, deviceToken))))
    .limit(1);
  return Boolean(v);
}

export async function vote(
  db: DB,
  secret: string,
  input: { tenantId: string; pollId: string; optionId: string; deviceToken: string; access: Access },
  now = new Date(),
) {
  if (!isUuid(input.pollId)) throw notFound("Umfrage nicht gefunden.");
  const [p] = await db.select().from(polls).where(and(eq(polls.id, input.pollId), eq(polls.tenantId, input.tenantId)));
  const vis = allowedVisibilities(input.access);
  if (!p || p.status === "draft" || !vis.includes(p.visibility)) throw notFound("Umfrage nicht gefunden.");
  if (!isPollOpen(p, now)) throw invalid("Diese Umfrage ist beendet.");
  if (!p.options.some((o) => o.id === input.optionId)) throw invalid("Bitte eine Antwort auswählen.");
  const inserted = await db
    .insert(pollVotes)
    .values({ pollId: p.id, voterHash: voterHash(secret, p.id, input.deviceToken), optionId: input.optionId })
    .onConflictDoNothing()
    .returning({ id: pollVotes.id });
  if (!inserted.length) throw new AppError("CONFLICT", "Von diesem Gerät wurde bereits abgestimmt.");
}

/** Löschfrist: nach Ablauf/Ende verbleiben nur anonyme Zählungen. */
export async function anonymizeEndedPolls(db: DB, now = new Date()) {
  const ended = await db
    .select({ id: polls.id })
    .from(polls)
    .where(or(eq(polls.status, "closed"), and(eq(polls.status, "open"), lte(polls.closesAt, now))));
  if (!ended.length) return 0;
  const r = await db
    .update(pollVotes)
    .set({ voterHash: null })
    .where(and(inArray(pollVotes.pollId, ended.map((e) => e.id)), isNotNull(pollVotes.voterHash)))
    .returning({ id: pollVotes.id });
  return r.length;
}
