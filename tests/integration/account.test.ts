import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant, SECRET } from "../helpers/db";
import { login, createSession, validateSession, getActor } from "@/lib/services/auth";
import { acceptInvitation, createInvitation } from "@/lib/services/tenants";
import {
  beginTotpSetup,
  changePassword,
  confirmTotpSetup,
  createPasswordReset,
  disableTotp,
  pendingLoginToken,
  readPendingLoginToken,
  redeemPasswordReset,
  verifySecondFactor,
  logoutOtherSessions,
} from "@/lib/services/account";
import { currentStep, totpCode } from "@/lib/auth/totp";
import type { Actor } from "@/lib/auth/permissions";

let h: DbHandle;
let admin: Actor;
let editorId: string;
const PW = "sehr-sicheres-passwort-123";

beforeAll(async () => {
  h = await freshDb();
  ({ admin } = await makeTenant(h, "konto"));
  const t = await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "" });
  editorId = (await acceptInvitation(h.db, t, { email: "ed@konto.test", displayName: "Ed", password: "editor-passwort-123" })).userId;
});
afterAll(async () => h.close());

describe("Zwei-Faktor-Anmeldung", () => {
  let secret: string;
  let recovery: string[];
  it("Einrichtung erfordert gültigen Code und liefert Wiederherstellungscodes", async () => {
    ({ secret } = await beginTotpSetup(h.db, SECRET, admin.userId));
    await expect(confirmTotpSetup(h.db, SECRET, admin.userId, "000000")).rejects.toThrow(/nicht korrekt/);
    recovery = await confirmTotpSetup(h.db, SECRET, admin.userId, totpCode(secret, currentStep()));
    expect(recovery).toHaveLength(8);
  });
  it("Login mit Passwort allein erzeugt KEINE Sitzung", async () => {
    const r = await login(h.db, SECRET, { email: "admin@konto.test", password: PW, ip: "1.1.1.1" });
    expect(r.kind).toBe("second-factor");
  });
  it("Zwischen-Token ist signiert und läuft ab", () => {
    const t = pendingLoginToken(SECRET, admin.userId);
    expect(readPendingLoginToken(SECRET, t)).toBe(admin.userId);
    expect(readPendingLoginToken(SECRET, t.replace(admin.userId, editorId))).toBeNull();
    expect(readPendingLoginToken(SECRET, t, Date.now() + 6 * 60_000)).toBeNull();
  });
  it("Code ist nur einmal verwendbar, Wiederherstellungscode ebenfalls", async () => {
    const now = Date.now() + 90_000; // anderer Zeitschritt als bei der Einrichtung
    const code = totpCode(secret, currentStep(now));
    expect(await verifySecondFactor(h.db, SECRET, admin.userId, code, now)).toBe("totp");
    await expect(verifySecondFactor(h.db, SECRET, admin.userId, code, now)).rejects.toThrow(/nicht korrekt/);
    expect(await verifySecondFactor(h.db, SECRET, admin.userId, recovery[0].toUpperCase(), now)).toBe("recovery");
    await expect(verifySecondFactor(h.db, SECRET, admin.userId, recovery[0], now)).rejects.toThrow(/nicht korrekt/);
  });
  it("sperrt nach 5 falschen Codes", async () => {
    // 1 Fehlversuch aus dem vorigen Test + 4 = 5 → der 6. wird gesperrt
    for (let i = 0; i < 4; i++) await expect(verifySecondFactor(h.db, SECRET, admin.userId, "111111")).rejects.toThrow(/nicht korrekt/);
    await expect(verifySecondFactor(h.db, SECRET, admin.userId, "111111")).rejects.toThrow(/Zu viele/);
  });
  it("Ausschalten erfordert das Passwort", async () => {
    await expect(disableTotp(h.db, admin.userId, "falsch")).rejects.toThrow(/Passwort/);
    await disableTotp(h.db, admin.userId, PW);
    const r = await login(h.db, SECRET, { email: "admin@konto.test", password: PW, ip: "1.1.1.2" });
    expect(r.kind).toBe("session");
  });
});

describe("Passwort ändern und zurücksetzen", () => {
  it("Passwortänderung prüft das alte Passwort und beendet andere Sitzungen", async () => {
    const keep = await createSession(h.db, editorId);
    const other = await createSession(h.db, editorId);
    await expect(changePassword(h.db, editorId, "falsch", "neues-passwort-12345", keep)).rejects.toThrow(/aktuelle Passwort/);
    await changePassword(h.db, editorId, "editor-passwort-123", "neues-passwort-12345", keep);
    expect(await validateSession(h.db, keep)).not.toBeNull();
    expect(await validateSession(h.db, other)).toBeNull();
    const r = await login(h.db, SECRET, { email: "ed@konto.test", password: "neues-passwort-12345", ip: "2.2.2.2" });
    expect(r.kind).toBe("session");
    const third = await createSession(h.db, editorId);
    await logoutOtherSessions(h.db, editorId, keep);
    expect(await validateSession(h.db, third)).toBeNull();
  });
  it("Admin-Link setzt Passwort zurück, ist einmalig und beendet alle Sitzungen", async () => {
    const s = await createSession(h.db, editorId);
    const token = await createPasswordReset(h.db, admin, editorId, { resetTotp: true });
    await redeemPasswordReset(h.db, token, "zurueckgesetzt-12345");
    expect(await validateSession(h.db, s)).toBeNull();
    await expect(redeemPasswordReset(h.db, token, "nochmal-123456789")).rejects.toThrow(/ungültig/);
    const r = await login(h.db, SECRET, { email: "ed@konto.test", password: "zurueckgesetzt-12345", ip: "3.3.3.3" });
    expect(r.kind).toBe("session");
  });
  it("Redakteure dürfen keine Links erzeugen; fremde Mandanten nicht; geteilte Konten nicht", async () => {
    const editor = (await getActor(h.db, editorId, admin.tenantId))!;
    await expect(createPasswordReset(h.db, editor, admin.userId, { resetTotp: false })).rejects.toThrow(/Berechtigung/);
    const other = await makeTenant(h, "konto-b");
    await expect(createPasswordReset(h.db, other.admin, editorId, { resetTotp: false })).rejects.toThrow(/nicht gefunden/);
    // Ed tritt zusätzlich Betriebsrat B bei → A darf Ed nicht mehr zurücksetzen (Kontoübernahme in B verhindern)
    const inv = await createInvitation(h.db, other.admin, { role: "editor", canPublish: false, note: "" });
    await acceptInvitation(h.db, inv, { email: "ed@konto.test", displayName: "Ed", password: "zurueckgesetzt-12345" });
    await expect(createPasswordReset(h.db, admin, editorId, { resetTotp: false })).rejects.toThrow(/anderen Betriebsrat/);
  });
});
