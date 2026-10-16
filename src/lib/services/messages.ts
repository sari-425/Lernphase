import { and, desc, eq, gt, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import {
  attachments,
  categories,
  messages,
  pushDispatches,
  type Message,
  type MessageStatus,
  type Visibility,
} from "@/lib/db/schema";
import { assertCan, can, type Actor } from "@/lib/auth/permissions";
import { AppError, invalid, notFound } from "@/lib/errors";
import { checkSensitive } from "@/lib/content/sensitive-check";
import type { MessageInput } from "@/lib/validation/schemas";
import { audit } from "./audit";
import { enqueueDispatch } from "./push";

/** Was darf der aktuelle Leser sehen? */
export interface Access {
  staff: boolean; // Belegschafts-Zugangscode eingegeben
  council: boolean; // angemeldetes Mitglied DIESES Betriebsrats
}

export const PUBLIC_ACCESS: Access = { staff: false, council: false };

export function allowedVisibilities(access: Access): Visibility[] {
  const v: Visibility[] = ["public"];
  if (access.staff || access.council) v.push("staff");
  if (access.council) v.push("council");
  return v;
}

// ---------- Lesen (Beschäftigte) ----------

function liveCondition(now: Date): SQL {
  return and(
    eq(messages.status, "published"),
    lte(messages.publishAt, now),
    or(isNull(messages.expiresAt), gt(messages.expiresAt, now)),
  )!;
}

function archiveCondition(now: Date): SQL {
  return or(
    eq(messages.status, "archived"),
    and(eq(messages.status, "published"), lte(messages.expiresAt, now)),
  )!;
}

export interface ListOptions {
  categoryId?: string | null;
  q?: string;
  scope?: "current" | "archive" | "all";
  limit?: number;
  offset?: number;
  now?: Date;
}

export type MessageListItem = Pick<
  Message,
  "id" | "title" | "body" | "priority" | "visibility" | "publishAt" | "expiresAt" | "status" | "categoryId"
> & { categoryName: string | null };

const listColumns = {
  id: messages.id,
  title: messages.title,
  body: messages.body,
  priority: messages.priority,
  visibility: messages.visibility,
  publishAt: messages.publishAt,
  expiresAt: messages.expiresAt,
  status: messages.status,
  categoryId: messages.categoryId,
  categoryName: categories.name,
};

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function listVisibleMessages(db: DB, tenantId: string, access: Access, opts: ListOptions = {}) {
  const now = opts.now ?? new Date();
  const scope = opts.scope ?? "current";
  const conds: SQL[] = [
    eq(messages.tenantId, tenantId),
    inArray(messages.visibility, allowedVisibilities(access)),
    scope === "current"
      ? liveCondition(now)
      : scope === "archive"
        ? archiveCondition(now)
        : or(liveCondition(now), archiveCondition(now))!,
  ];
  if (opts.categoryId) conds.push(eq(messages.categoryId, opts.categoryId));
  const q = opts.q?.trim().slice(0, 100);
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conds.push(sql`(${messages.title} ILIKE ${pattern} OR ${messages.body} ILIKE ${pattern})`);
  }
  const rows = await db
    .select(listColumns)
    .from(messages)
    .leftJoin(categories, eq(categories.id, messages.categoryId))
    .where(and(...conds))
    .orderBy(
      ...(scope === "current"
        ? [sql`CASE ${messages.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END`, desc(messages.publishAt)]
        : [desc(messages.publishAt)]),
    )
    .limit(Math.min(opts.limit ?? 30, 100))
    .offset(opts.offset ?? 0);
  return rows as MessageListItem[];
}

export async function getVisibleMessage(db: DB, tenantId: string, id: string, access: Access, now = new Date()) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ ...listColumns, linkUrl: messages.linkUrl, updatedAt: messages.updatedAt })
    .from(messages)
    .leftJoin(categories, eq(categories.id, messages.categoryId))
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.id, id),
        inArray(messages.visibility, allowedVisibilities(access)),
        or(liveCondition(now), archiveCondition(now)),
      ),
    )
    .limit(1);
  if (!row) return null;
  const files = await db
    .select({ id: attachments.id, filename: attachments.filename, size: attachments.size, mimeType: attachments.mimeType })
    .from(attachments)
    .where(and(eq(attachments.messageId, id), eq(attachments.tenantId, tenantId)));
  return { ...row, attachments: files };
}

/** Gibt es eine Mitteilung, die der Leser NICHT sehen darf (z. B. Belegschaft)? Für einen Hinweis statt 404. */
export async function messageRequiresStaffAccess(db: DB, tenantId: string, id: string, now = new Date()) {
  if (!isUuid(id)) return false;
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.id, id),
        eq(messages.visibility, "staff"),
        or(liveCondition(now), archiveCondition(now)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function countByCategory(db: DB, tenantId: string, access: Access, now = new Date()) {
  return db
    .select({ categoryId: messages.categoryId, n: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        inArray(messages.visibility, allowedVisibilities(access)),
        or(liveCondition(now), archiveCondition(now)),
      ),
    )
    .groupBy(messages.categoryId);
}

// ---------- Redaktion ----------

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function loadOwn(db: DB, actor: Actor, id: string) {
  if (!isUuid(id)) throw notFound("Mitteilung nicht gefunden.");
  const [m] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.tenantId, actor.tenantId)))
    .limit(1);
  if (!m) throw notFound("Mitteilung nicht gefunden.");
  return m;
}

async function assertCategory(db: DB, tenantId: string, categoryId: string | null) {
  if (!categoryId) return;
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)));
  if (!c) throw invalid("Unbekannte Kategorie.");
}

export async function getMessageForEditor(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.read_internal");
  const m = await loadOwn(db, actor, id);
  const files = await db
    .select({ id: attachments.id, filename: attachments.filename, size: attachments.size, mimeType: attachments.mimeType })
    .from(attachments)
    .where(and(eq(attachments.messageId, id), eq(attachments.tenantId, actor.tenantId)));
  const [dispatch] = await db.select().from(pushDispatches).where(eq(pushDispatches.messageId, id));
  return { message: m, attachments: files, dispatch: dispatch ?? null };
}

export async function listForEditor(
  db: DB,
  actor: Actor,
  opts: { status?: MessageStatus | "scheduled" | "all"; limit?: number; now?: Date } = {},
) {
  assertCan(actor, "message.read_internal");
  const now = opts.now ?? new Date();
  const conds: SQL[] = [eq(messages.tenantId, actor.tenantId)];
  if (opts.status === "scheduled") {
    conds.push(eq(messages.status, "published"), gt(messages.publishAt, now));
  } else if (opts.status && opts.status !== "all") {
    conds.push(eq(messages.status, opts.status));
  }
  return db
    .select({
      ...listColumns,
      updatedAt: messages.updatedAt,
      pushEnabled: messages.pushEnabled,
      dispatchStatus: pushDispatches.status,
      dispatchAccepted: pushDispatches.acceptedCount,
    })
    .from(messages)
    .leftJoin(categories, eq(categories.id, messages.categoryId))
    .leftJoin(pushDispatches, eq(pushDispatches.messageId, messages.id))
    .where(and(...conds))
    .orderBy(desc(messages.updatedAt))
    .limit(Math.min(opts.limit ?? 50, 200));
}

function toColumns(input: MessageInput) {
  return {
    title: input.title,
    body: input.body,
    categoryId: input.categoryId,
    priority: input.priority,
    visibility: input.visibility,
    publishAt: input.publishAt,
    expiresAt: input.expiresAt,
    linkUrl: input.linkUrl,
    pushEnabled: input.visibility === "council" ? false : input.pushEnabled,
    pushTitle: input.pushTitle,
    pushBody: input.pushBody,
  };
}

export async function createMessage(db: DB, actor: Actor, input: MessageInput, now = new Date()) {
  assertCan(actor, "message.create");
  await assertCategory(db, actor.tenantId, input.categoryId);
  const [m] = await db
    .insert(messages)
    .values({
      ...toColumns(input),
      tenantId: actor.tenantId,
      status: "draft",
      createdBy: actor.userId,
      updatedBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await audit(db, actor, "message.create", m.id);
  return m;
}

/**
 * Bearbeiten: Entwürfe und eingereichte Mitteilungen dürfen alle Redakteure ändern.
 * Bereits veröffentlichte/archivierte Mitteilungen nur mit Veröffentlichungsrecht,
 * denn eine Änderung daran ist faktisch eine neue Veröffentlichung.
 */
export async function updateMessage(db: DB, actor: Actor, id: string, input: MessageInput, now = new Date()) {
  assertCan(actor, "message.edit");
  const m = await loadOwn(db, actor, id);
  if (!["draft", "review"].includes(m.status)) {
    assertCan(actor, "message.publish");
    if (m.status === "published" && m.visibility !== input.visibility && input.visibility === "public") {
      throw invalid("Der Bereich einer veröffentlichten Mitteilung kann nicht nachträglich auf „öffentlich“ erweitert werden. Bitte als Entwurf zurücksetzen und erneut veröffentlichen.");
    }
  }
  await assertCategory(db, actor.tenantId, input.categoryId);
  const [updated] = await db
    .update(messages)
    .set({ ...toColumns(input), updatedBy: actor.userId, updatedAt: now })
    .where(and(eq(messages.id, id), eq(messages.tenantId, actor.tenantId)))
    .returning();
  await audit(db, actor, "message.update", id);
  return updated;
}

export async function submitForReview(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.edit");
  const m = await loadOwn(db, actor, id);
  if (m.status !== "draft") throw invalid("Nur Entwürfe können zur Freigabe eingereicht werden.");
  await db.update(messages).set({ status: "review", updatedAt: new Date() }).where(eq(messages.id, m.id));
  await audit(db, actor, "message.submit", id);
}

export interface PublishOptions {
  confirmPublic?: boolean;
  confirmSensitive?: boolean;
  now?: Date;
}

export interface PublishCheck {
  needsPublicConfirmation: boolean;
  sensitiveWarnings: ReturnType<typeof checkSensitive>;
}

export function publishCheck(m: Pick<Message, "title" | "body" | "visibility" | "pushTitle" | "pushBody">): PublishCheck {
  return {
    needsPublicConfirmation: m.visibility === "public",
    sensitiveWarnings:
      m.visibility === "council" ? [] : checkSensitive([m.title, m.body, m.pushTitle, m.pushBody].join("\n")),
  };
}

/**
 * Veröffentlichen (sofort oder geplant). Erfordert:
 *  - Recht "message.publish"
 *  - bei öffentlichem Bereich: ausdrückliche Bestätigung
 *  - bei Hinweisen auf personenbezogene/vertrauliche Inhalte: ausdrückliche Bestätigung
 */
export async function publishMessage(db: DB, actor: Actor, id: string, opts: PublishOptions = {}) {
  assertCan(actor, "message.publish");
  const now = opts.now ?? new Date();
  const m = await loadOwn(db, actor, id);
  if (!["draft", "review", "archived"].includes(m.status)) {
    throw invalid("Diese Mitteilung ist bereits veröffentlicht oder wurde zurückgezogen.");
  }
  const check = publishCheck(m);
  if (check.needsPublicConfirmation && !opts.confirmPublic) {
    throw new AppError("VALIDATION", "Bitte bestätigen Sie ausdrücklich, dass diese Mitteilung öffentlich abrufbar sein soll.");
  }
  if (check.sensitiveWarnings.length > 0 && !opts.confirmSensitive) {
    throw new AppError("VALIDATION", "Bitte prüfen und bestätigen Sie die Hinweise zu möglicherweise vertraulichen Inhalten.");
  }
  const publishAt = m.publishAt && m.publishAt > now ? m.publishAt : now;
  if (m.expiresAt && m.expiresAt <= publishAt) throw invalid("Der Ablaufzeitpunkt liegt vor der Veröffentlichung.");
  const [updated] = await db
    .update(messages)
    .set({ status: "published", publishAt, publishedBy: actor.userId, updatedAt: now, updatedBy: actor.userId })
    .where(and(eq(messages.id, id), eq(messages.tenantId, actor.tenantId)))
    .returning();
  await audit(db, actor, publishAt > now ? "message.schedule" : "message.publish", id, {
    visibility: m.visibility,
    publishAt: publishAt.toISOString(),
  });
  let dispatchCreated = false;
  if (updated.pushEnabled && updated.visibility !== "council") {
    const r = await enqueueDispatch(db, actor.tenantId, id, actor.userId, now);
    dispatchCreated = r.created;
  }
  return { message: updated, dispatchCreated };
}

export async function archiveMessage(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.archive");
  const m = await loadOwn(db, actor, id);
  if (m.status !== "published") throw invalid("Nur veröffentlichte Mitteilungen können archiviert werden.");
  await db.update(messages).set({ status: "archived", updatedAt: new Date(), updatedBy: actor.userId }).where(eq(messages.id, id));
  await audit(db, actor, "message.archive", id);
}

/** Zurückziehen: sofort für niemanden mehr sichtbar; ausstehender Push wird verworfen. */
export async function withdrawMessage(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.archive");
  const m = await loadOwn(db, actor, id);
  if (!["published", "archived"].includes(m.status)) throw invalid("Nur veröffentlichte Mitteilungen können zurückgezogen werden.");
  await db.update(messages).set({ status: "withdrawn", updatedAt: new Date(), updatedBy: actor.userId }).where(eq(messages.id, id));
  await db
    .update(pushDispatches)
    .set({ status: "skipped", note: "Mitteilung zurückgezogen", finishedAt: new Date() })
    .where(and(eq(pushDispatches.messageId, id), eq(pushDispatches.status, "pending")));
  await audit(db, actor, "message.withdraw", id);
}

export async function revertToDraft(db: DB, actor: Actor, id: string) {
  const m = await loadOwn(db, actor, id);
  if (m.status === "review") {
    assertCan(actor, "message.edit");
  } else {
    assertCan(actor, "message.archive");
  }
  if (m.status === "draft") return;
  await db.update(messages).set({ status: "draft", updatedAt: new Date(), updatedBy: actor.userId }).where(eq(messages.id, id));
  await audit(db, actor, "message.revert_draft", id);
}

/** Endgültiges Löschen inklusive Anhängen und Versandprotokoll (nur Administratoren). */
export async function deleteMessage(db: DB, actor: Actor, id: string) {
  assertCan(actor, "message.delete");
  await loadOwn(db, actor, id);
  await db.delete(messages).where(and(eq(messages.id, id), eq(messages.tenantId, actor.tenantId)));
  await audit(db, actor, "message.delete", id);
}

/** Redakteure ohne Veröffentlichungsrecht dürfen Push-Einstellungen vorbereiten, aber nicht auslösen. */
export function canTriggerPush(actor: Actor) {
  return can(actor, "push.send");
}

// ---------- Anhänge ----------

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;

const SIGNATURES: Array<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

/** Dateityp wird anhand des Inhalts (Magic Bytes) bestimmt – nicht anhand von Name oder Browser-Angabe. */
export function detectFileType(data: Buffer) {
  return SIGNATURES.find((s) => s.test(data)) ?? null;
}

export function sanitizeFilename(name: string, ext: string) {
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `${base || "anhang"}.${ext}`;
}

export async function addAttachment(db: DB, actor: Actor, messageId: string, file: { name: string; data: Buffer }) {
  assertCan(actor, "message.edit");
  const m = await loadOwn(db, actor, messageId);
  if (!["draft", "review"].includes(m.status)) assertCan(actor, "message.publish");
  if (file.data.length === 0) throw invalid("Die Datei ist leer.");
  if (file.data.length > MAX_ATTACHMENT_BYTES) throw invalid("Die Datei ist zu groß (maximal 5 MB).");
  const type = detectFileType(file.data);
  if (!type) throw invalid("Nur PDF-, PNG- und JPEG-Dateien sind erlaubt.");
  const [cnt] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attachments)
    .where(eq(attachments.messageId, messageId));
  if ((cnt?.n ?? 0) >= MAX_ATTACHMENTS) throw invalid(`Höchstens ${MAX_ATTACHMENTS} Anhänge pro Mitteilung.`);
  const [a] = await db
    .insert(attachments)
    .values({
      tenantId: actor.tenantId,
      messageId,
      filename: sanitizeFilename(file.name, type.ext),
      mimeType: type.mime,
      size: file.data.length,
      data: file.data,
    })
    .returning({ id: attachments.id });
  await audit(db, actor, "attachment.add", messageId);
  return a.id;
}

export async function removeAttachment(db: DB, actor: Actor, attachmentId: string) {
  assertCan(actor, "message.edit");
  if (!isUuid(attachmentId)) throw notFound();
  const [a] = await db
    .select({ messageId: attachments.messageId })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.tenantId, actor.tenantId)));
  if (!a) throw notFound("Anhang nicht gefunden.");
  const m = await loadOwn(db, actor, a.messageId);
  if (!["draft", "review"].includes(m.status)) assertCan(actor, "message.publish");
  await db.delete(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.tenantId, actor.tenantId)));
  await audit(db, actor, "attachment.remove", a.messageId);
}

/**
 * Anhang ausliefern – er erbt IMMER die Sichtbarkeit seiner Mitteilung.
 * Redaktionsmitglieder dürfen auch Anhänge von Entwürfen sehen (Vorschau).
 */
export async function getAttachmentForReader(
  db: DB,
  tenantId: string,
  attachmentId: string,
  access: Access,
  opts: { editor?: boolean; now?: Date } = {},
) {
  if (!isUuid(attachmentId)) return null;
  const [a] = await db
    .select({
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      data: attachments.data,
      messageId: attachments.messageId,
    })
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.tenantId, tenantId)));
  if (!a) return null;
  if (opts.editor && access.council) return a;
  const visible = await getVisibleMessage(db, tenantId, a.messageId, access, opts.now);
  return visible ? a : null;
}

export async function dashboardStats(db: DB, actor: Actor, now = new Date()) {
  assertCan(actor, "message.read_internal");
  const rows = await db
    .select({ status: messages.status, n: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.tenantId, actor.tenantId))
    .groupBy(messages.status);
  const [sched] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.tenantId, actor.tenantId), eq(messages.status, "published"), gt(messages.publishAt, now)));
  const stats = { draft: 0, review: 0, published: 0, scheduled: sched?.n ?? 0, archived: 0, withdrawn: 0 };
  for (const r of rows) stats[r.status] += r.n;
  stats.published -= stats.scheduled;
  return stats;
}

