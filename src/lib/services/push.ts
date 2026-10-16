import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import {
  messages,
  pushDispatches,
  pushSubscriptions,
  tenants,
  type PushDispatch,
  type Tenant,
} from "@/lib/db/schema";
import { sha256 } from "@/lib/auth/crypto";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { AppError, invalid, notFound } from "@/lib/errors";
import type { PushSender } from "@/lib/push/sender";
import { PushSendError } from "@/lib/push/sender";
import { audit } from "./audit";

export const DEFAULT_PUSH_TITLE = "Neue Information des Betriebsrats";
export const URGENT_PUSH_TITLE = "Wichtige Information des Betriebsrats";
export const DEFAULT_PUSH_BODY = "Es gibt eine neue Mitteilung. Jetzt die vollständige Mitteilung lesen.";
/** Ein Abo wird nach dieser Zeit ohne Lebenszeichen gelöscht (Speicherbegrenzung). */
export const SUBSCRIPTION_RETENTION_DAYS = 180;
export const MAX_FAILURES = 5;
const MAX_SUBSCRIPTIONS_PER_TENANT = 50_000;

const day = (d: Date) => d.toISOString().slice(0, 10);

// ---------- Abonnement (Beschäftigte, anonym) ----------

export interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  categoryIds: string[] | null;
  onlyImportant: boolean;
}

export async function subscribe(
  db: DB,
  tenant: Tenant,
  input: SubscribeInput,
  opts: { staffAccess: boolean; now?: Date },
) {
  const now = opts.now ?? new Date();
  const endpointHash = sha256(input.endpoint);
  const values = {
    tenantId: tenant.id,
    endpointHash,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    categoryIds: input.categoryIds && input.categoryIds.length ? input.categoryIds : null,
    onlyImportant: input.onlyImportant,
    staffAccess: opts.staffAccess,
    staffAccessVersion: opts.staffAccess ? tenant.staffAccessVersion : null,
    createdOn: day(now),
    lastSeenOn: day(now),
    failureCount: 0,
  };
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.tenantId, tenant.id), eq(pushSubscriptions.endpointHash, endpointHash)));
  if (!existing) {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.tenantId, tenant.id));
    if ((cnt?.n ?? 0) >= MAX_SUBSCRIPTIONS_PER_TENANT) {
      throw new AppError("RATE_LIMITED", "Die maximale Anzahl an Push-Abonnements ist erreicht.");
    }
  }
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [pushSubscriptions.tenantId, pushSubscriptions.endpointHash],
      set: {
        p256dh: values.p256dh,
        auth: values.auth,
        categoryIds: values.categoryIds,
        onlyImportant: values.onlyImportant,
        staffAccess: values.staffAccess,
        staffAccessVersion: values.staffAccessVersion,
        lastSeenOn: values.lastSeenOn,
        failureCount: 0,
      },
    });
}

export async function unsubscribe(db: DB, tenantId: string, endpoint: string) {
  const r = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpointHash, sha256(endpoint))))
    .returning({ id: pushSubscriptions.id });
  return r.length > 0;
}

export async function getSubscriptionPrefs(db: DB, tenantId: string, endpoint: string) {
  const [s] = await db
    .select({ categoryIds: pushSubscriptions.categoryIds, onlyImportant: pushSubscriptions.onlyImportant, staffAccess: pushSubscriptions.staffAccess })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpointHash, sha256(endpoint))));
  return s ?? null;
}

export async function countSubscriptions(db: DB, tenantId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.tenantId, tenantId));
  return r?.n ?? 0;
}

// ---------- Versandaufträge ----------

/**
 * Legt den (einzigen) Versandauftrag für eine Mitteilung an.
 * Die UNIQUE-Einschränkung auf message_id verhindert doppelte Aufträge – auch bei
 * Doppelklick, parallelen Anfragen oder erneutem Planer-Lauf.
 */
export async function enqueueDispatch(
  db: DB,
  tenantId: string,
  messageId: string,
  triggeredBy: string | null,
  now = new Date(),
): Promise<{ created: boolean; dispatch: PushDispatch | null }> {
  const [m] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)));
  if (!m) throw notFound("Mitteilung nicht gefunden.");
  if (m.visibility === "council") throw invalid("Interne Gremiums-Mitteilungen werden nicht per Push versendet.");
  if (m.status !== "published") throw invalid("Push ist nur für veröffentlichte Mitteilungen möglich.");
  if (m.expiresAt && m.expiresAt <= now) throw invalid("Die Mitteilung ist bereits abgelaufen.");
  const notBefore = m.publishAt && m.publishAt > now ? m.publishAt : now;
  const inserted = await db
    .insert(pushDispatches)
    .values({ tenantId, messageId, triggeredBy, notBefore, createdAt: now })
    .onConflictDoNothing({ target: pushDispatches.messageId })
    .returning();
  if (inserted.length) return { created: true, dispatch: inserted[0] };
  const [existing] = await db.select().from(pushDispatches).where(eq(pushDispatches.messageId, messageId));
  return { created: false, dispatch: existing ?? null };
}

/** Push gezielt auslösen (Administratoren / Redakteure mit Veröffentlichungsrecht). */
export async function triggerPush(db: DB, actor: Actor, messageId: string, now = new Date()) {
  assertCan(actor, "push.send");
  await db
    .update(messages)
    .set({ pushEnabled: true })
    .where(and(eq(messages.id, messageId), eq(messages.tenantId, actor.tenantId)));
  const res = await enqueueDispatch(db, actor.tenantId, messageId, actor.userId, now);
  if (!res.created) {
    throw new AppError("CONFLICT", "Für diese Mitteilung wurde bereits eine Push-Benachrichtigung ausgelöst. Ein erneuter Versand ist nicht vorgesehen.");
  }
  await audit(db, actor, "push.trigger", messageId);
  return res.dispatch!;
}

/** Planer: für fällige, geplante Mitteilungen mit aktiviertem Push Aufträge anlegen. */
export async function enqueueDueScheduled(db: DB, now = new Date()) {
  const due = await db
    .select({ id: messages.id, tenantId: messages.tenantId })
    .from(messages)
    .leftJoin(pushDispatches, eq(pushDispatches.messageId, messages.id))
    .where(
      and(
        eq(messages.status, "published"),
        eq(messages.pushEnabled, true),
        inArray(messages.visibility, ["public", "staff"]),
        lte(messages.publishAt, now),
        // nichts nachträglich pushen, was älter als 24 h ist
        gte(messages.publishAt, new Date(now.getTime() - 24 * 60 * 60_000)),
        or(isNull(messages.expiresAt), sql`${messages.expiresAt} > ${now}`),
        isNull(pushDispatches.id),
      ),
    )
    .limit(100);
  let created = 0;
  for (const d of due) {
    const r = await enqueueDispatch(db, d.tenantId, d.id, null, now);
    if (r.created) created++;
  }
  return created;
}

export interface DispatchConfig {
  maxPerTenantPerDay: number;
  minIntervalMinutes: number;
  appUrl: string;
}

function buildPayload(
  m: { id: string; title: string; priority: string; pushTitle: string; pushBody: string },
  tenantSlug: string,
) {
  const title = m.pushTitle || (m.priority === "urgent" ? URGENT_PUSH_TITLE : DEFAULT_PUSH_TITLE);
  const body = m.pushBody || DEFAULT_PUSH_BODY;
  return {
    title,
    body,
    url: `/b/${tenantSlug}/mitteilungen/${m.id}`,
    tag: `brd-${m.id}`,
  };
}

/** Prüft die Versandbegrenzung je Betriebsrat. Gibt einen späteren Zeitpunkt zurück, falls nötig. */
async function throttleUntil(db: DB, tenantId: string, priority: string, cfg: DispatchConfig, now: Date) {
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const recent = await db
    .select({ startedAt: pushDispatches.startedAt })
    .from(pushDispatches)
    .where(
      and(
        eq(pushDispatches.tenantId, tenantId),
        inArray(pushDispatches.status, ["sending", "done", "failed"]),
        gte(pushDispatches.startedAt, since),
      ),
    )
    .orderBy(asc(pushDispatches.startedAt));
  if (recent.length >= cfg.maxPerTenantPerDay) {
    return new Date(recent[0].startedAt!.getTime() + 24 * 60 * 60_000 + 1000);
  }
  if (priority !== "urgent" && cfg.minIntervalMinutes > 0 && recent.length) {
    const last = recent[recent.length - 1].startedAt!;
    const next = new Date(last.getTime() + cfg.minIntervalMinutes * 60_000);
    if (next > now) return next;
  }
  return null;
}

export interface DispatchReport {
  dispatchId: string;
  status: PushDispatch["status"];
  targetCount: number;
  acceptedCount: number;
  failedCount: number;
  removedCount: number;
  deferredUntil?: Date;
}

/**
 * Arbeitet fällige Versandaufträge ab.
 * Ein Auftrag wird atomar von "pending" auf "sending" gesetzt (Claim). Nur wer den
 * Claim gewinnt, versendet – so kann derselbe Auftrag nie zweimal laufen.
 */
export async function processDispatches(
  db: DB,
  sender: PushSender,
  cfg: DispatchConfig,
  now = new Date(),
  maxJobs = 10,
): Promise<DispatchReport[]> {
  const reports: DispatchReport[] = [];

  // Hängengebliebene Aufträge (z. B. Absturz während des Versands) NICHT erneut senden,
  // sondern als fehlgeschlagen markieren – lieber kein Push als ein doppelter.
  await db
    .update(pushDispatches)
    .set({ status: "failed", finishedAt: now, note: "Versand abgebrochen (Zeitüberschreitung)" })
    .where(and(eq(pushDispatches.status, "sending"), lt(pushDispatches.startedAt, new Date(now.getTime() - 30 * 60_000))));

  for (let i = 0; i < maxJobs; i++) {
    const [candidate] = await db
      .select({ id: pushDispatches.id })
      .from(pushDispatches)
      .where(and(eq(pushDispatches.status, "pending"), lte(pushDispatches.notBefore, now)))
      .orderBy(asc(pushDispatches.notBefore))
      .limit(1);
    if (!candidate) break;

    const [job] = await db
      .select({
        dispatch: pushDispatches,
        message: messages,
        tenant: tenants,
      })
      .from(pushDispatches)
      .innerJoin(messages, eq(messages.id, pushDispatches.messageId))
      .innerJoin(tenants, eq(tenants.id, pushDispatches.tenantId))
      .where(eq(pushDispatches.id, candidate.id));
    if (!job) continue;
    const { message: m, tenant } = job;

    // Veröffentlichung wurde nach hinten verschoben → Auftrag mitverschieben
    if (m.status === "published" && m.publishAt && m.publishAt > now) {
      await db
        .update(pushDispatches)
        .set({ notBefore: m.publishAt })
        .where(and(eq(pushDispatches.id, candidate.id), eq(pushDispatches.status, "pending")));
      reports.push({ dispatchId: candidate.id, status: "pending", targetCount: 0, acceptedCount: 0, failedCount: 0, removedCount: 0, deferredUntil: m.publishAt });
      continue;
    }
    // Mitteilung inzwischen nicht mehr sichtbar? → Auftrag verwerfen
    const visible = m.status === "published" && m.visibility !== "council" && (!m.expiresAt || m.expiresAt > now);
    if (!visible) {
      await db
        .update(pushDispatches)
        .set({ status: "skipped", finishedAt: now, note: "Mitteilung nicht (mehr) sichtbar" })
        .where(and(eq(pushDispatches.id, candidate.id), eq(pushDispatches.status, "pending")));
      reports.push({ dispatchId: candidate.id, status: "skipped", targetCount: 0, acceptedCount: 0, failedCount: 0, removedCount: 0 });
      continue;
    }

    const deferred = await throttleUntil(db, tenant.id, m.priority, cfg, now);
    if (deferred) {
      await db
        .update(pushDispatches)
        .set({ notBefore: deferred, note: "Versandbegrenzung: verschoben" })
        .where(and(eq(pushDispatches.id, candidate.id), eq(pushDispatches.status, "pending")));
      reports.push({ dispatchId: candidate.id, status: "pending", targetCount: 0, acceptedCount: 0, failedCount: 0, removedCount: 0, deferredUntil: deferred });
      continue;
    }

    // Atomarer Claim
    const claimed = await db
      .update(pushDispatches)
      .set({ status: "sending", startedAt: now })
      .where(and(eq(pushDispatches.id, candidate.id), eq(pushDispatches.status, "pending")))
      .returning({ id: pushDispatches.id });
    if (!claimed.length) continue;

    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.tenantId, tenant.id));
    const targets = subs.filter((s) => {
      if (m.visibility === "staff" && !(s.staffAccess && s.staffAccessVersion === tenant.staffAccessVersion)) return false;
      if (s.onlyImportant && m.priority === "normal") return false;
      if (s.categoryIds && s.categoryIds.length && (!m.categoryId || !s.categoryIds.includes(m.categoryId))) return false;
      return true;
    });

    const payload = JSON.stringify(buildPayload(m, tenant.slug));
    const opts = {
      ttlSeconds: m.priority === "urgent" ? 4 * 24 * 3600 : 2 * 24 * 3600,
      urgency: (m.priority === "normal" ? "normal" : "high") as "normal" | "high",
      // gleiche Mitteilung ersetzt sich beim Push-Dienst selbst (zusätzlicher Duplikatschutz)
      topic: m.id.replace(/-/g, "").slice(0, 32),
    };

    let accepted = 0;
    let failed = 0;
    let removed = 0;
    const BATCH = 25;
    for (let b = 0; b < targets.length; b += BATCH) {
      const batch = targets.slice(b, b + BATCH);
      const results = await Promise.allSettled(
        batch.map((s) => sender.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, opts)),
      );
      for (let k = 0; k < results.length; k++) {
        const r = results[k];
        const s = batch[k];
        if (r.status === "fulfilled" && r.value.statusCode >= 200 && r.value.statusCode < 300) {
          accepted++;
          if (s.failureCount > 0) {
            await db.update(pushSubscriptions).set({ failureCount: 0 }).where(eq(pushSubscriptions.id, s.id));
          }
          continue;
        }
        const code = r.status === "rejected" ? (r.reason instanceof PushSendError ? r.reason.statusCode : 0) : r.value.statusCode;
        if (code === 404 || code === 410) {
          // Abo existiert beim Push-Dienst nicht mehr → sofort löschen
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          removed++;
        } else {
          failed++;
          if (s.failureCount + 1 >= MAX_FAILURES) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
            removed++;
          } else {
            await db
              .update(pushSubscriptions)
              .set({ failureCount: s.failureCount + 1 })
              .where(eq(pushSubscriptions.id, s.id));
          }
        }
      }
    }

    const status = targets.length > 0 && accepted === 0 && failed > 0 ? "failed" : "done";
    await db
      .update(pushDispatches)
      .set({
        status,
        finishedAt: new Date(),
        targetCount: targets.length,
        acceptedCount: accepted,
        failedCount: failed,
        removedCount: removed,
        note: targets.length === 0 ? "Keine passenden Abonnements" : "",
      })
      .where(eq(pushDispatches.id, candidate.id));
    reports.push({ dispatchId: candidate.id, status, targetCount: targets.length, acceptedCount: accepted, failedCount: failed, removedCount: removed });
  }
  return reports;
}

export async function listDispatches(db: DB, actor: Actor, limit = 30) {
  assertCan(actor, "message.read_internal");
  return db
    .select({
      id: pushDispatches.id,
      status: pushDispatches.status,
      createdAt: pushDispatches.createdAt,
      startedAt: pushDispatches.startedAt,
      finishedAt: pushDispatches.finishedAt,
      notBefore: pushDispatches.notBefore,
      targetCount: pushDispatches.targetCount,
      acceptedCount: pushDispatches.acceptedCount,
      failedCount: pushDispatches.failedCount,
      removedCount: pushDispatches.removedCount,
      note: pushDispatches.note,
      messageId: pushDispatches.messageId,
      messageTitle: messages.title,
    })
    .from(pushDispatches)
    .innerJoin(messages, eq(messages.id, pushDispatches.messageId))
    .where(eq(pushDispatches.tenantId, actor.tenantId))
    .orderBy(desc(pushDispatches.createdAt))
    .limit(limit);
}

export async function purgeSubscriptions(db: DB, now = new Date()) {
  const cutoff = new Date(now.getTime() - SUBSCRIPTION_RETENTION_DAYS * 24 * 60 * 60_000);
  const r = await db
    .delete(pushSubscriptions)
    .where(or(lt(pushSubscriptions.lastSeenOn, day(cutoff)), gte(pushSubscriptions.failureCount, MAX_FAILURES)))
    .returning({ id: pushSubscriptions.id });
  return r.length;
}

export async function purgeDispatches(db: DB, olderThan: Date) {
  await db
    .delete(pushDispatches)
    .where(and(inArray(pushDispatches.status, ["done", "failed", "skipped"]), lt(pushDispatches.createdAt, olderThan)));
}
