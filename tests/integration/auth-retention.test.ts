import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant, SECRET } from "../helpers/db";
import { createSession, destroySession, login, validateSession, SESSION_IDLE_MS } from "@/lib/services/auth";
import { removeMember, createInvitation, acceptInvitation, deleteTenant } from "@/lib/services/tenants";
import { runRetention } from "@/lib/services/maintenance";
import { subscribe } from "@/lib/services/push";
import { createMessage } from "@/lib/services/messages";
import { invitations, messages, pushSubscriptions, rateLimitEvents, sessions, users, tenants } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/permissions";
import type { Tenant } from "@/lib/db/schema";

let h: DbHandle;
let tenant: Tenant;
let admin: Actor;
const PW = "sehr-sicheres-passwort-123";

beforeAll(async () => {
  h = await freshDb();
  ({ tenant, admin } = await makeTenant(h, "auth"));
});
afterAll(async () => h.close());

describe("Anmeldung und Sitzungen", () => {
  it("meldet mit korrekten Daten an und speichert nur den Hash des Tokens", async () => {
    const r = await login(h.db, SECRET, { email: "ADMIN@auth.test ", password: PW, ip: "10.0.0.1" });
    if (r.kind !== "session") throw new Error("erwartet Sitzung");
    const rows = await h.db.select().from(sessions);
    expect(rows.some((x) => x.idHash === r.token)).toBe(false);
    expect((await validateSession(h.db, r.token))?.email).toBe("admin@auth.test");
  });

  it("gibt bei falschem Passwort und unbekannter E-Mail dieselbe Meldung", async () => {
    await expect(login(h.db, SECRET, { email: "admin@auth.test", password: "falsch", ip: "10.0.0.2" })).rejects.toThrow("E-Mail-Adresse oder Passwort ist falsch.");
    await expect(login(h.db, SECRET, { email: "niemand@auth.test", password: "falsch", ip: "10.0.0.2" })).rejects.toThrow("E-Mail-Adresse oder Passwort ist falsch.");
  });

  it("sperrt nach 5 Fehlversuchen pro E-Mail – auch für das richtige Passwort", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(login(h.db, SECRET, { email: "admin@auth.test", password: "falsch" + i, ip: `10.1.0.${i}` })).rejects.toThrow();
    }
    await expect(login(h.db, SECRET, { email: "admin@auth.test", password: PW, ip: "10.1.1.1" })).rejects.toThrow(/Zu viele/);
    // gespeichert wird nur ein HMAC, keine Klartext-IP/E-Mail
    const keys = (await h.db.select().from(rateLimitEvents)).map((r) => r.key).join(" ");
    expect(keys).not.toContain("admin@auth.test");
    expect(keys).not.toContain("10.1.0.1");
  });

  it("ungültige, abgelaufene und inaktive Sitzungen werden abgelehnt", async () => {
    expect(await validateSession(h.db, undefined)).toBeNull();
    expect(await validateSession(h.db, "x".repeat(43))).toBeNull();
    const token = await createSession(h.db, admin.userId);
    const later = new Date(Date.now() + SESSION_IDLE_MS + 60_000);
    expect(await validateSession(h.db, token, later)).toBeNull();
    const t2 = await createSession(h.db, admin.userId);
    await destroySession(h.db, t2);
    expect(await validateSession(h.db, t2)).toBeNull();
  });
});

describe("Löschkonzept", () => {
  it("entfernt abgelaufene Sitzungen, alte Ratenbegrenzungen, Einladungen und veraltete Push-Abos", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 200 * 24 * 3600_000);
    await createSession(h.db, admin.userId, old);
    await h.db.insert(rateLimitEvents).values({ key: "x", createdAt: old });
    await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "" }, old);
    await subscribe(h.db, tenant, { endpoint: "https://push.example/alt", keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) }, categoryIds: null, onlyImportant: false }, { staffAccess: false, now: old });
    await subscribe(h.db, tenant, { endpoint: "https://push.example/neu", keys: { p256dh: "p".repeat(40), auth: "a".repeat(16) }, categoryIds: null, onlyImportant: false }, { staffAccess: false, now });
    const res = await runRetention(h.db, now);
    expect(res.removedSubs).toBe(1);
    expect((await h.db.select().from(pushSubscriptions)).map((s) => s.endpoint)).toEqual(["https://push.example/neu"]);
    expect((await h.db.select().from(rateLimitEvents).where(eq(rateLimitEvents.key, "x")))).toHaveLength(0);
    expect((await h.db.select().from(sessions)).every((s) => s.expiresAt > now)).toBe(true);
    expect((await h.db.select().from(invitations)).every((i) => i.expiresAt > new Date(now.getTime() - 7 * 24 * 3600_000))).toBe(true);
  });

  it("Entfernen eines Mitglieds löscht dessen Konto und Sitzungen, wenn keine weitere Mitgliedschaft besteht", async () => {
    const token = await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "" });
    const { userId } = await acceptInvitation(h.db, token, { email: "weg@auth.test", displayName: "Weg", password: "weg-passwort-12345" });
    const sess = await createSession(h.db, userId);
    await removeMember(h.db, admin, userId);
    expect(await h.db.select().from(users).where(eq(users.id, userId))).toHaveLength(0);
    expect(await validateSession(h.db, sess)).toBeNull();
  });

  it("Löschen eines Mandanten entfernt alle zugehörigen Daten", async () => {
    const other = await makeTenant(h, "loeschen");
    await createMessage(h.db, other.admin, { title: "x", body: "y", categoryId: null, priority: "normal", visibility: "council", publishAt: null, expiresAt: null, linkUrl: null, pushEnabled: false, pushTitle: "", pushBody: "" });
    await deleteTenant(h.db, other.tenant.id);
    expect(await h.db.select().from(tenants).where(eq(tenants.id, other.tenant.id))).toHaveLength(0);
    expect(await h.db.select().from(messages).where(eq(messages.tenantId, other.tenant.id))).toHaveLength(0);
    expect(await h.db.select().from(users).where(eq(users.email, "admin@loeschen.test"))).toHaveLength(0);
    // anderer Mandant unberührt
    expect(await h.db.select().from(tenants).where(eq(tenants.id, tenant.id))).toHaveLength(1);
  });
});
