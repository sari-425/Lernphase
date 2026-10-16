import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant, SECRET } from "../helpers/db";
import {
  createMessage,
  deleteMessage,
  getMessageForEditor,
  getVisibleMessage,
  listForEditor,
  listVisibleMessages,
  publishMessage,
  updateMessage,
  addAttachment,
  getAttachmentForReader,
} from "@/lib/services/messages";
import { createContact, listCategories, updateCategory, deleteContact, listContacts } from "@/lib/services/directory";
import { getActor, login } from "@/lib/services/auth";
import { listTeam, removeMember, staffAccessToken, hasStaffAccess, setStaffAccessCode, getTenantBySlug } from "@/lib/services/tenants";
import { enqueueDispatch, subscribe, triggerPush } from "@/lib/services/push";
import { listAudit } from "@/lib/services/audit";
import type { Actor } from "@/lib/auth/permissions";
import type { Tenant } from "@/lib/db/schema";

let h: DbHandle;
let A: { tenant: Tenant; admin: Actor };
let B: { tenant: Tenant; admin: Actor };

const input = (over: Record<string, unknown> = {}) => ({
  title: "Mitteilung",
  body: "Inhalt",
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

beforeAll(async () => {
  h = await freshDb();
  A = await makeTenant(h, "betrieb-a");
  B = await makeTenant(h, "betrieb-b");
});
afterAll(async () => h.close());

describe("Mandantentrennung", () => {
  it("Mitteilungen eines Betriebsrats erscheinen nie bei einem anderen", async () => {
    const m = await createMessage(h.db, A.admin, input({ title: "Nur A" }));
    await publishMessage(h.db, A.admin, m.id, { confirmPublic: true });
    const listB = await listVisibleMessages(h.db, B.tenant.id, { staff: true, council: true });
    expect(listB.find((x) => x.id === m.id)).toBeUndefined();
    expect(await getVisibleMessage(h.db, B.tenant.id, m.id, { staff: true, council: true })).toBeNull();
    const listA = await listVisibleMessages(h.db, A.tenant.id, { staff: false, council: false });
    expect(listA.find((x) => x.id === m.id)).toBeDefined();
  });

  it("Administrator B kann Mitteilungen von A weder lesen, ändern, veröffentlichen noch löschen", async () => {
    const m = await createMessage(h.db, A.admin, input({ title: "Entwurf A", visibility: "council" }));
    await expect(getMessageForEditor(h.db, B.admin, m.id)).rejects.toThrow(/nicht gefunden/);
    await expect(updateMessage(h.db, B.admin, m.id, input({ title: "gekapert" }))).rejects.toThrow(/nicht gefunden/);
    await expect(publishMessage(h.db, B.admin, m.id, { confirmPublic: true })).rejects.toThrow(/nicht gefunden/);
    await expect(deleteMessage(h.db, B.admin, m.id)).rejects.toThrow(/nicht gefunden/);
    expect((await listForEditor(h.db, B.admin)).some((x) => x.id === m.id)).toBe(false);
    const still = await getMessageForEditor(h.db, A.admin, m.id);
    expect(still.message.title).toBe("Entwurf A");
  });

  it("Ein Mitglied von A hat in B keine Rolle", async () => {
    expect(await getActor(h.db, A.admin.userId, B.tenant.id)).toBeNull();
  });

  it("Kategorien, Kontakte und Team sind mandantengetrennt", async () => {
    const catsA = await listCategories(h.db, A.tenant.id);
    await expect(updateCategory(h.db, B.admin, catsA[0].id, { name: "gekapert", sortOrder: 0 })).rejects.toThrow(/nicht gefunden/);
    const c = await createContact(h.db, A.admin, { name: "Erika Muster", roleTitle: "Vorsitz", phone: "", email: "", location: "", availability: "", sortOrder: 0 });
    await deleteContact(h.db, B.admin, c.id); // darf nichts bewirken
    expect((await listContacts(h.db, A.tenant.id)).some((x) => x.id === c.id)).toBe(true);
    expect((await listContacts(h.db, B.tenant.id)).length).toBe(0);
    const teamB = await listTeam(h.db, B.admin);
    expect(teamB.members.map((m) => m.userId)).not.toContain(A.admin.userId);
    await expect(removeMember(h.db, B.admin, A.admin.userId)).rejects.toThrow(/nicht gefunden/);
  });

  it("Fremde Kategorien können keiner Mitteilung zugeordnet werden", async () => {
    const catsB = await listCategories(h.db, B.tenant.id);
    await expect(createMessage(h.db, A.admin, input({ categoryId: catsB[0].id }))).rejects.toThrow(/Unbekannte Kategorie/);
  });

  it("Push kann nicht für Mitteilungen eines anderen Mandanten ausgelöst werden", async () => {
    const m = await createMessage(h.db, A.admin, input());
    await publishMessage(h.db, A.admin, m.id, { confirmPublic: true });
    await expect(triggerPush(h.db, B.admin, m.id)).rejects.toThrow(/nicht gefunden/);
    await expect(enqueueDispatch(h.db, B.tenant.id, m.id, null)).rejects.toThrow(/nicht gefunden/);
  });

  it("Anhänge sind nur über den eigenen Mandanten abrufbar", async () => {
    const m = await createMessage(h.db, A.admin, input());
    const attId = await addAttachment(h.db, A.admin, m.id, { name: "a.pdf", data: Buffer.from("%PDF-1.4 test") });
    await publishMessage(h.db, A.admin, m.id, { confirmPublic: true });
    expect(await getAttachmentForReader(h.db, A.tenant.id, attId, { staff: false, council: false })).not.toBeNull();
    expect(await getAttachmentForReader(h.db, B.tenant.id, attId, { staff: true, council: true }, { editor: true })).toBeNull();
  });

  it("Belegschafts-Zugang von A gilt nicht für B", async () => {
    await setStaffAccessCode(h.db, A.admin, "Code-A-12345");
    await setStaffAccessCode(h.db, B.admin, "Code-B-12345");
    const ta = (await getTenantBySlug(h.db, "betrieb-a"))!;
    const tb = (await getTenantBySlug(h.db, "betrieb-b"))!;
    const tokenA = staffAccessToken(SECRET, ta);
    expect(hasStaffAccess(SECRET, ta, tokenA)).toBe(true);
    expect(hasStaffAccess(SECRET, tb, tokenA)).toBe(false);
  });

  it("Push-Abos eines Mandanten werden nicht für andere verwendet", async () => {
    await subscribe(h.db, A.tenant, { endpoint: "https://push.example/a1", keys: { p256dh: "x".repeat(40), auth: "y".repeat(16) }, categoryIds: null, onlyImportant: false }, { staffAccess: false });
    // gleicher Endpunkt bei B ist ein eigenes, unabhängiges Abo
    await subscribe(h.db, B.tenant, { endpoint: "https://push.example/a1", keys: { p256dh: "x".repeat(40), auth: "y".repeat(16) }, categoryIds: null, onlyImportant: false }, { staffAccess: false });
    const { countSubscriptions } = await import("@/lib/services/push");
    expect(await countSubscriptions(h.db, A.tenant.id)).toBe(1);
    expect(await countSubscriptions(h.db, B.tenant.id)).toBe(1);
  });

  it("Änderungsprotokoll zeigt nur Einträge des eigenen Mandanten", async () => {
    const logB = await listAudit(h.db, B.admin);
    const logA = await listAudit(h.db, A.admin);
    expect(logA.length).toBeGreaterThan(0);
    const idsA = new Set(logA.map((x) => x.id));
    expect(logB.some((x) => idsA.has(x.id))).toBe(false);
  });

  it("Anmeldung ist mandantenunabhängig, Rechte aber nicht", async () => {
    const { user } = await login(h.db, SECRET, { email: "admin@betrieb-a.test", password: "sehr-sicheres-passwort-123", ip: "1.2.3.4" });
    expect(await getActor(h.db, user.id, A.tenant.id)).not.toBeNull();
    expect(await getActor(h.db, user.id, B.tenant.id)).toBeNull();
  });
});
