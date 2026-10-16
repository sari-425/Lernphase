import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant } from "../helpers/db";
import {
  archiveMessage,
  createMessage,
  deleteMessage,
  getVisibleMessage,
  listVisibleMessages,
  publishMessage,
  revertToDraft,
  submitForReview,
  updateMessage,
  withdrawMessage,
  addAttachment,
  getAttachmentForReader,
  messageRequiresStaffAccess,
  dashboardStats,
} from "@/lib/services/messages";
import { acceptInvitation, createInvitation, updateMember, removeMember } from "@/lib/services/tenants";
import { getActor } from "@/lib/services/auth";
import type { Actor } from "@/lib/auth/permissions";
import type { Tenant } from "@/lib/db/schema";
import { attachments, messages, pushDispatches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let h: DbHandle;
let tenant: Tenant;
let admin: Actor;
let editor: Actor;

const input = (over: Record<string, unknown> = {}) => ({
  title: "Einladung zur Betriebsversammlung",
  body: "Die nächste Betriebsversammlung findet am Donnerstag statt.",
  categoryId: null,
  priority: "normal" as const,
  visibility: "public" as const,
  publishAt: null,
  expiresAt: null,
  linkUrl: null,
  pushEnabled: false,
  pushTitle: "",
  pushBody: "",
  ...over,
});

const ANON = { staff: false, council: false };
const STAFF = { staff: true, council: false };
const COUNCIL = { staff: false, council: true };

beforeAll(async () => {
  h = await freshDb();
  ({ tenant, admin } = await makeTenant(h, "workflow"));
  const token = await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "Redaktion" });
  const { userId } = await acceptInvitation(h.db, token, { email: "redaktion@workflow.test", displayName: "Rita Redaktion", password: "redaktion-passwort-1" });
  editor = (await getActor(h.db, userId, tenant.id))!;
});
afterAll(async () => h.close());

describe("Einladungen und Rollen", () => {
  it("Einladung ist nur einmal verwendbar", async () => {
    const token = await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "" });
    await acceptInvitation(h.db, token, { email: "einmal@workflow.test", displayName: "Einmal", password: "einmal-passwort-12" });
    await expect(acceptInvitation(h.db, token, { email: "zweimal@workflow.test", displayName: "Zweimal", password: "zweimal-passwort-1" })).rejects.toThrow(/ungültig|bereits/);
  });
  it("abgelaufene Einladung wird abgelehnt", async () => {
    const past = new Date(Date.now() - 80 * 3600_000);
    const token = await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "" }, past);
    await expect(acceptInvitation(h.db, token, { email: "spaet@workflow.test", displayName: "Spät", password: "spaet-passwort-123" })).rejects.toThrow(/abgelaufen/);
  });
  it("Redakteur kann kein Team verwalten", async () => {
    await expect(createInvitation(h.db, editor, { role: "admin", canPublish: true, note: "" })).rejects.toThrow(/Berechtigung/);
    await expect(updateMember(h.db, editor, editor.userId, { role: "admin", canPublish: true })).rejects.toThrow(/Berechtigung/);
  });
  it("Der letzte Administrator kann nicht entfernt oder herabgestuft werden", async () => {
    await expect(removeMember(h.db, admin, admin.userId)).rejects.toThrow(/letzte Administrator/);
    await expect(updateMember(h.db, admin, admin.userId, { role: "editor", canPublish: true })).rejects.toThrow(/mindestens ein Administrator/);
  });
});

describe("Erstellen und Veröffentlichen", () => {
  it("neue Mitteilungen sind Entwürfe und für niemanden außerhalb des Gremiums sichtbar", async () => {
    const m = await createMessage(h.db, editor, input());
    expect(m.status).toBe("draft");
    expect(await getVisibleMessage(h.db, tenant.id, m.id, ANON)).toBeNull();
    expect(await getVisibleMessage(h.db, tenant.id, m.id, COUNCIL)).toBeNull();
  });

  it("Redakteur ohne Recht kann nicht veröffentlichen, aber zur Freigabe einreichen", async () => {
    const m = await createMessage(h.db, editor, input());
    await expect(publishMessage(h.db, editor, m.id, { confirmPublic: true })).rejects.toThrow(/Berechtigung/);
    await submitForReview(h.db, editor, m.id);
    const { message } = await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    expect(message.status).toBe("published");
  });

  it("öffentliche Veröffentlichung erfordert ausdrückliche Bestätigung", async () => {
    const m = await createMessage(h.db, admin, input());
    await expect(publishMessage(h.db, admin, m.id)).rejects.toThrow(/ausdrücklich/);
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    expect(await getVisibleMessage(h.db, tenant.id, m.id, ANON)).not.toBeNull();
  });

  it("Hinweise auf personenbezogene Daten müssen bestätigt werden", async () => {
    const m = await createMessage(h.db, admin, input({ visibility: "staff", body: "Kollege X ist krankgeschrieben, Kontakt: x@firma.de" }));
    await expect(publishMessage(h.db, admin, m.id)).rejects.toThrow(/vertraulichen/);
    await publishMessage(h.db, admin, m.id, { confirmSensitive: true });
  });

  it("Sichtbarkeit: öffentlich / Belegschaft / Gremium", async () => {
    const pub = await createMessage(h.db, admin, input({ title: "P" }));
    const staff = await createMessage(h.db, admin, input({ title: "S", visibility: "staff" }));
    const council = await createMessage(h.db, admin, input({ title: "C", visibility: "council" }));
    await publishMessage(h.db, admin, pub.id, { confirmPublic: true });
    await publishMessage(h.db, admin, staff.id);
    await publishMessage(h.db, admin, council.id);
    const ids = async (a: typeof ANON) => (await listVisibleMessages(h.db, tenant.id, a, { limit: 100 })).map((x) => x.id);
    expect(await ids(ANON)).toContain(pub.id);
    expect(await ids(ANON)).not.toContain(staff.id);
    expect(await ids(ANON)).not.toContain(council.id);
    expect(await ids(STAFF)).toContain(staff.id);
    expect(await ids(STAFF)).not.toContain(council.id);
    expect(await ids(COUNCIL)).toContain(council.id);
    expect(await messageRequiresStaffAccess(h.db, tenant.id, staff.id)).toBe(true);
    expect(await messageRequiresStaffAccess(h.db, tenant.id, council.id)).toBe(false);
  });

  it("geplante Veröffentlichung wird erst zum Zeitpunkt sichtbar", async () => {
    const at = new Date(Date.now() + 3600_000);
    const m = await createMessage(h.db, admin, input({ publishAt: at }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    expect(await getVisibleMessage(h.db, tenant.id, m.id, ANON)).toBeNull();
    expect(await getVisibleMessage(h.db, tenant.id, m.id, ANON, new Date(at.getTime() + 1000))).not.toBeNull();
    const stats = await dashboardStats(h.db, admin);
    expect(stats.scheduled).toBeGreaterThanOrEqual(1);
  });

  it("abgelaufene Mitteilungen wandern ins Archiv", async () => {
    const exp = new Date(Date.now() + 1000);
    const m = await createMessage(h.db, admin, input({ title: "Läuft ab", expiresAt: exp }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    const later = new Date(Date.now() + 5000);
    const current = await listVisibleMessages(h.db, tenant.id, ANON, { now: later, limit: 100 });
    const archive = await listVisibleMessages(h.db, tenant.id, ANON, { now: later, scope: "archive", limit: 100 });
    expect(current.some((x) => x.id === m.id)).toBe(false);
    expect(archive.some((x) => x.id === m.id)).toBe(true);
  });

  it("Suche findet Titel und Inhalt, Sonderzeichen sind sicher", async () => {
    const m = await createMessage(h.db, admin, input({ title: "Schichtplan Oktober", body: "Neue Regeln 100% gültig" }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    expect((await listVisibleMessages(h.db, tenant.id, ANON, { q: "schichtplan" })).some((x) => x.id === m.id)).toBe(true);
    expect((await listVisibleMessages(h.db, tenant.id, ANON, { q: "100%" })).some((x) => x.id === m.id)).toBe(true);
    expect((await listVisibleMessages(h.db, tenant.id, ANON, { q: "%" })).some((x) => x.id === m.id)).toBe(true);
    expect((await listVisibleMessages(h.db, tenant.id, ANON, { q: "' OR 1=1 --" })).length).toBe(0);
  });
});

describe("Archivieren, Zurückziehen, Löschen", () => {
  it("Archivierte Mitteilungen bleiben im Archiv auffindbar", async () => {
    const m = await createMessage(h.db, admin, input({ title: "Archiv-Test" }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await archiveMessage(h.db, admin, m.id);
    const cur = await listVisibleMessages(h.db, tenant.id, ANON, { limit: 100 });
    const arc = await listVisibleMessages(h.db, tenant.id, ANON, { scope: "archive", limit: 100 });
    expect(cur.some((x) => x.id === m.id)).toBe(false);
    expect(arc.some((x) => x.id === m.id)).toBe(true);
  });

  it("Zurückgezogene Mitteilungen sind sofort nirgends mehr sichtbar und ausstehende Pushes werden verworfen", async () => {
    const m = await createMessage(h.db, admin, input({ pushEnabled: true, publishAt: new Date(Date.now() + 60_000) }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await withdrawMessage(h.db, admin, m.id);
    expect(await getVisibleMessage(h.db, tenant.id, m.id, COUNCIL, new Date(Date.now() + 120_000))).toBeNull();
    const [d] = await h.db.select().from(pushDispatches).where(eq(pushDispatches.messageId, m.id));
    expect(d.status).toBe("skipped");
  });

  it("Redakteur ohne Recht darf veröffentlichte Mitteilungen nicht ändern oder archivieren", async () => {
    const m = await createMessage(h.db, admin, input());
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await expect(updateMessage(h.db, editor, m.id, input({ title: "geändert" }))).rejects.toThrow(/Berechtigung/);
    await expect(archiveMessage(h.db, editor, m.id)).rejects.toThrow(/Berechtigung/);
    await expect(withdrawMessage(h.db, editor, m.id)).rejects.toThrow(/Berechtigung/);
    await expect(revertToDraft(h.db, editor, m.id)).rejects.toThrow(/Berechtigung/);
  });

  it("veröffentlichte Mitteilung kann nicht nachträglich öffentlich gemacht werden", async () => {
    const m = await createMessage(h.db, admin, input({ visibility: "staff" }));
    await publishMessage(h.db, admin, m.id);
    await expect(updateMessage(h.db, admin, m.id, input({ visibility: "public" }))).rejects.toThrow(/nachträglich/);
  });

  it("Endgültiges Löschen entfernt Mitteilung, Anhänge und Versandauftrag (nur Admin)", async () => {
    const m = await createMessage(h.db, admin, input({ pushEnabled: true }));
    const att = await addAttachment(h.db, admin, m.id, { name: "x.pdf", data: Buffer.from("%PDF-1.4 x") });
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await expect(deleteMessage(h.db, editor, m.id)).rejects.toThrow(/Berechtigung/);
    await deleteMessage(h.db, admin, m.id);
    expect(await h.db.select().from(messages).where(eq(messages.id, m.id))).toHaveLength(0);
    expect(await h.db.select().from(attachments).where(eq(attachments.id, att))).toHaveLength(0);
    expect(await h.db.select().from(pushDispatches).where(eq(pushDispatches.messageId, m.id))).toHaveLength(0);
  });
});

describe("Anhänge", () => {
  it("lehnt unerlaubte Dateitypen und zu große Dateien ab", async () => {
    const m = await createMessage(h.db, admin, input());
    await expect(addAttachment(h.db, admin, m.id, { name: "a.pdf", data: Buffer.from("<html>") })).rejects.toThrow(/Nur PDF/);
    await expect(addAttachment(h.db, admin, m.id, { name: "a.pdf", data: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(5 * 1024 * 1024)]) })).rejects.toThrow(/zu groß/);
  });
  it("Anhang eines Entwurfs ist für Beschäftigte nicht abrufbar, Anhang einer internen Mitteilung auch nicht", async () => {
    const draft = await createMessage(h.db, admin, input());
    const a1 = await addAttachment(h.db, admin, draft.id, { name: "d.pdf", data: Buffer.from("%PDF-1.4") });
    expect(await getAttachmentForReader(h.db, tenant.id, a1, STAFF)).toBeNull();
    expect(await getAttachmentForReader(h.db, tenant.id, a1, COUNCIL, { editor: true })).not.toBeNull();

    const internal = await createMessage(h.db, admin, input({ visibility: "council" }));
    const a2 = await addAttachment(h.db, admin, internal.id, { name: "i.pdf", data: Buffer.from("%PDF-1.4") });
    await publishMessage(h.db, admin, internal.id);
    expect(await getAttachmentForReader(h.db, tenant.id, a2, ANON)).toBeNull();
    expect(await getAttachmentForReader(h.db, tenant.id, a2, STAFF)).toBeNull();
  });
});
