import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant } from "../helpers/db";
import { startFakePushService } from "../helpers/fake-push-service";
import { createWebPushSender, type PushSender } from "@/lib/push/sender";
import {
  countSubscriptions,
  DEFAULT_PUSH_TITLE,
  enqueueDispatch,
  enqueueDueScheduled,
  processDispatches,
  sendTestPush,
  subscribe,
  triggerPush,
  unsubscribe,
} from "@/lib/services/push";
import { createMessage, publishMessage, withdrawMessage } from "@/lib/services/messages";
import { listCategories } from "@/lib/services/directory";
import { setStaffAccessCode, getTenantBySlug } from "@/lib/services/tenants";
import { pushDispatches, pushSubscriptions, type Tenant } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/permissions";

let h: DbHandle;
let tenant: Tenant;
let admin: Actor;
let svc: Awaited<ReturnType<typeof startFakePushService>>;
let sender: PushSender;
const vapid = webpush.generateVAPIDKeys();
const cfg = { maxPerTenantPerDay: 100, minIntervalMinutes: 0, appUrl: "https://app.test" };

const input = (over: Record<string, unknown> = {}) => ({
  title: "Betriebsversammlung am Donnerstag",
  body: "Inhalt mit vertraulicher Tagesordnung",
  categoryId: null,
  priority: "normal" as const,
  visibility: "public" as const,
  publishAt: null,
  expiresAt: null,
  linkUrl: null,
  pushEnabled: true,
  pushTitle: "",
  pushBody: "",
  ...over,
});

beforeAll(async () => {
  h = await freshDb();
  ({ tenant, admin } = await makeTenant(h, "push-test"));
  svc = await startFakePushService(vapid.publicKey);
  sender = createWebPushSender({ publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: "mailto:test@example.org" }, svc.agent);
});
afterAll(async () => {
  await svc.close();
  await h.close();
});
beforeEach(async () => {
  await h.db.delete(pushSubscriptions);
  svc.received.length = 0;
});

async function sub(name: string, opts: { status?: number; categoryIds?: string[] | null; onlyImportant?: boolean; staff?: boolean } = {}) {
  const c = svc.newClient(name, opts.status);
  const t = (await getTenantBySlug(h.db, tenant.slug))!;
  await subscribe(h.db, t, { endpoint: c.endpoint, keys: c.keys, categoryIds: opts.categoryIds ?? null, onlyImportant: opts.onlyImportant ?? false }, { staffAccess: opts.staff ?? false });
  return c;
}

describe("Push-Versand Ende-zu-Ende (echte Verschlüsselung, lokaler Push-Dienst)", () => {
  it("versendet nach Veröffentlichung eine verschlüsselte, neutrale Nachricht mit gültiger VAPID-Signatur", async () => {
    await sub("geraet1");
    const m = await createMessage(h.db, admin, input());
    const r = await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    expect(r.dispatchCreated).toBe(true);
    const reports = await processDispatches(h.db, sender, cfg);
    expect(reports[0]).toMatchObject({ status: "done", targetCount: 1, acceptedCount: 1 });
    expect(svc.received).toHaveLength(1);
    const got = svc.received[0];
    expect(got.vapidValid).toBe(true);
    expect(got.headers["content-encoding"]).toBe("aes128gcm");
    expect(got.headers["ttl"]).toBeDefined();
    const payload = JSON.parse(got.payload);
    expect(payload.title).toBe(DEFAULT_PUSH_TITLE);
    expect(payload.url).toBe(`/b/${tenant.slug}/mitteilungen/${m.id}`);
    // Standard: keine Inhalte der Mitteilung auf dem Sperrbildschirm
    expect(got.payload).not.toContain("vertraulicher");
    expect(got.payload).not.toContain("Donnerstag");
  });

  it("verwendet einen eigenen neutralen Push-Text, wenn angegeben", async () => {
    await sub("geraet-text");
    const m = await createMessage(h.db, admin, input({ pushTitle: "Betriebsrat informiert", pushBody: "Bitte die App öffnen." }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await processDispatches(h.db, sender, cfg);
    const payload = JSON.parse(svc.received[0].payload);
    expect(payload).toMatchObject({ title: "Betriebsrat informiert", body: "Bitte die App öffnen." });
  });

  it("verhindert doppelten Versand (Doppelklick, parallele Planer-Läufe)", async () => {
    await sub("geraet-dup");
    const m = await createMessage(h.db, admin, input());
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    const again = await enqueueDispatch(h.db, tenant.id, m.id, admin.userId);
    expect(again.created).toBe(false);
    await expect(triggerPush(h.db, admin, m.id)).rejects.toThrow(/bereits/);
    await enqueueDueScheduled(h.db);
    // zwei parallele Verarbeitungen
    await Promise.all([processDispatches(h.db, sender, cfg), processDispatches(h.db, sender, cfg)]);
    await processDispatches(h.db, sender, cfg);
    expect(svc.received.filter((x) => x.path === "/push/geraet-dup")).toHaveLength(1);
    const rows = await h.db.select().from(pushDispatches).where(eq(pushDispatches.messageId, m.id));
    expect(rows).toHaveLength(1);
  });

  it("löscht abgelaufene Abos (404/410) und zählt Fehler bei anderen Fehlern", async () => {
    await sub("ok");
    await sub("weg", { status: 410 });
    await sub("unbekannt", { status: 404 });
    await sub("kaputt", { status: 500 });
    const m = await createMessage(h.db, admin, input());
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    const [rep] = await processDispatches(h.db, sender, cfg);
    expect(rep).toMatchObject({ targetCount: 4, acceptedCount: 1, removedCount: 2, failedCount: 1, status: "done" });
    expect(await countSubscriptions(h.db, tenant.id)).toBe(2);
    const rows = await h.db.select().from(pushSubscriptions);
    expect(rows.find((r) => r.endpoint.endsWith("/kaputt"))?.failureCount).toBe(1);
  });

  it("nicht erreichbarer Push-Dienst führt zu Status 'failed', nicht zu Absturz", async () => {
    const t = (await getTenantBySlug(h.db, tenant.slug))!;
    await subscribe(h.db, t, { endpoint: "https://127.0.0.1:1/push/nirgends", keys: svc.newClient("dummy").keys, categoryIds: null, onlyImportant: false }, { staffAccess: false });
    const m = await createMessage(h.db, admin, input());
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    const [rep] = await processDispatches(h.db, sender, cfg);
    expect(rep.status).toBe("failed");
    expect(rep.failedCount).toBe(1);
  });

  it("berücksichtigt Kategorien und 'nur wichtige' Einstellungen", async () => {
    const cats = await listCategories(h.db, tenant.id);
    const [c1, c2] = cats;
    await sub("alle");
    await sub("nur-c1", { categoryIds: [c1.id] });
    await sub("nur-wichtig", { onlyImportant: true });
    const m = await createMessage(h.db, admin, input({ categoryId: c2.id }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await processDispatches(h.db, sender, cfg);
    expect(svc.received.map((r) => r.path).sort()).toEqual(["/push/alle"]);
    svc.received.length = 0;
    const urgent = await createMessage(h.db, admin, input({ categoryId: c1.id, priority: "urgent" }));
    await publishMessage(h.db, admin, urgent.id, { confirmPublic: true });
    await processDispatches(h.db, sender, cfg);
    expect(svc.received.map((r) => r.path).sort()).toEqual(["/push/alle", "/push/nur-c1", "/push/nur-wichtig"]);
    expect(svc.received[0].headers["urgency"]).toBe("high");
  });

  it("Belegschafts-Mitteilungen gehen nur an Geräte mit gültigem Belegschafts-Zugang", async () => {
    await setStaffAccessCode(h.db, admin, "Belegschaft-2026");
    await sub("ohne-zugang");
    await sub("mit-zugang", { staff: true });
    const m = await createMessage(h.db, admin, input({ visibility: "staff" }));
    await publishMessage(h.db, admin, m.id, { confirmSensitive: true });
    await processDispatches(h.db, sender, cfg);
    expect(svc.received.map((r) => r.path)).toEqual(["/push/mit-zugang"]);
    // Nach Codewechsel ist der alte Zugang ungültig
    await setStaffAccessCode(h.db, admin, "Neuer-Code-2026");
    svc.received.length = 0;
    const m2 = await createMessage(h.db, admin, input({ visibility: "staff" }));
    await publishMessage(h.db, admin, m2.id, { confirmSensitive: true });
    await processDispatches(h.db, sender, cfg);
    expect(svc.received).toHaveLength(0);
  });

  it("interne Gremiums-Mitteilungen werden nie gepusht", async () => {
    await sub("x");
    const m = await createMessage(h.db, admin, input({ visibility: "council", pushEnabled: false }));
    const r = await publishMessage(h.db, admin, m.id);
    expect(r.dispatchCreated).toBe(false);
    await expect(triggerPush(h.db, admin, m.id)).rejects.toThrow(/Gremiums/);
  });

  it("geplante Mitteilungen werden erst zum Veröffentlichungszeitpunkt gepusht", async () => {
    await sub("geplant");
    const at = new Date(Date.now() + 10 * 60_000);
    const m = await createMessage(h.db, admin, input({ publishAt: at }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await processDispatches(h.db, sender, cfg);
    expect(svc.received).toHaveLength(0);
    await processDispatches(h.db, sender, cfg, new Date(at.getTime() + 1000));
    expect(svc.received).toHaveLength(1);
  });

  it("zurückgezogene Mitteilungen werden nicht mehr gepusht", async () => {
    await sub("zurueck");
    const m = await createMessage(h.db, admin, input({ publishAt: new Date(Date.now() + 60_000) }));
    await publishMessage(h.db, admin, m.id, { confirmPublic: true });
    await withdrawMessage(h.db, admin, m.id);
    await processDispatches(h.db, sender, cfg, new Date(Date.now() + 120_000));
    expect(svc.received).toHaveLength(0);
  });

  it("begrenzt die Versandhäufigkeit pro Betriebsrat", async () => {
    const other = await makeTenant(h, "push-limit");
    const c = svc.newClient("limit");
    await subscribe(h.db, other.tenant, { endpoint: c.endpoint, keys: c.keys, categoryIds: null, onlyImportant: false }, { staffAccess: false });
    const limited = { ...cfg, maxPerTenantPerDay: 1000, minIntervalMinutes: 30 };
    const a = await createMessage(h.db, other.admin, input());
    const b = await createMessage(h.db, other.admin, input());
    await publishMessage(h.db, other.admin, a.id, { confirmPublic: true });
    await publishMessage(h.db, other.admin, b.id, { confirmPublic: true });
    const reports = await processDispatches(h.db, sender, limited);
    expect(reports.filter((r) => r.status === "done")).toHaveLength(1);
    const deferred = reports.find((r) => r.deferredUntil);
    expect(deferred).toBeDefined();
    expect(svc.received).toHaveLength(1);
    // Tageslimit
    const daily = { ...cfg, maxPerTenantPerDay: 1, minIntervalMinutes: 0 };
    const again = await processDispatches(h.db, sender, daily, new Date(Date.now() + 60 * 60_000));
    expect(again[0].deferredUntil!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
  });

  it("Abmeldung entfernt das Abo sofort", async () => {
    const c = await sub("abmelden");
    expect(await unsubscribe(h.db, tenant.id, c.endpoint)).toBe(true);
    expect(await countSubscriptions(h.db, tenant.id)).toBe(0);
    expect(await unsubscribe(h.db, tenant.id, c.endpoint)).toBe(false);
  });

  it("speichert ein Gerät nur einmal (erneutes Abonnieren aktualisiert)", async () => {
    const c = await sub("doppelt");
    const t = (await getTenantBySlug(h.db, tenant.slug))!;
    await subscribe(h.db, t, { endpoint: c.endpoint, keys: c.keys, categoryIds: null, onlyImportant: true }, { staffAccess: false });
    expect(await countSubscriptions(h.db, tenant.id)).toBe(1);
    const [row] = await h.db.select().from(pushSubscriptions);
    expect(row.onlyImportant).toBe(true);
    // keine IP, kein Name, keine Uhrzeit – nur Tagesdatum
    expect(Object.keys(row)).not.toContain("ip");
    expect(row.lastSeenOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("Test-Push geht nur an genau das angefragte Gerät und meldet abgelaufene Abos", async () => {
    const mine = await sub("mein-geraet");
    await sub("anderes-geraet");
    expect(await sendTestPush(h.db, sender, tenant, mine.endpoint)).toBe(201);
    expect(svc.received.map((r) => r.path)).toEqual(["/push/mein-geraet"]);
    expect(JSON.parse(svc.received[0].payload).title).toContain("Test");
    await expect(sendTestPush(h.db, sender, tenant, "https://push.example/unbekannt")).rejects.toThrow(/nicht angemeldet/);
    svc.setStatus("mein-geraet", 410);
    await expect(sendTestPush(h.db, sender, tenant, mine.endpoint)).rejects.toThrow(/neu aktivieren/);
    expect(await countSubscriptions(h.db, tenant.id)).toBe(1);
  });
});
