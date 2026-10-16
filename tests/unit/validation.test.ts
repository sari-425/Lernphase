import { describe, expect, it } from "vitest";
import { messageInputSchema, pushSubscriptionSchema, slugSchema } from "@/lib/validation/schemas";
import { detectFileType, sanitizeFilename } from "@/lib/services/messages";
import { hashSecret, setHashCostForTests, verifySecret } from "@/lib/auth/crypto";

setHashCostForTests(2 ** 10);

const base = { title: "Betriebsversammlung", body: "Text", visibility: "public" };

describe("Eingabevalidierung", () => {
  it("verlangt eine ausdrückliche Wahl des Veröffentlichungsbereichs", () => {
    const r = messageInputSchema.safeParse({ title: "Titel", body: "Text" });
    expect(r.success).toBe(false);
  });
  it("lehnt Push für interne Gremiums-Mitteilungen ab", () => {
    const r = messageInputSchema.safeParse({ ...base, visibility: "council", pushEnabled: true });
    expect(r.success).toBe(false);
  });
  it("lehnt Ablauf vor Veröffentlichung ab", () => {
    const r = messageInputSchema.safeParse({ ...base, publishAt: "2030-01-02T10:00", expiresAt: "2030-01-01T10:00" });
    expect(r.success).toBe(false);
  });
  it("lehnt javascript:-Links ab", () => {
    expect(messageInputSchema.safeParse({ ...base, linkUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(messageInputSchema.safeParse({ ...base, linkUrl: "https://example.org" }).success).toBe(true);
  });
  it("begrenzt Titellänge", () => {
    expect(messageInputSchema.safeParse({ ...base, title: "x".repeat(161) }).success).toBe(false);
  });
  it("prüft Kurzadressen", () => {
    expect(slugSchema.safeParse("gruener-systemtechnik").success).toBe(true);
    expect(slugSchema.safeParse("../etc").success).toBe(false);
    expect(slugSchema.safeParse("-abc").success).toBe(false);
  });
  it("akzeptiert nur HTTPS-Push-Endpunkte", () => {
    const keys = { p256dh: "B".repeat(87), auth: "A".repeat(22) };
    expect(pushSubscriptionSchema.safeParse({ endpoint: "http://push.example/x", keys }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://push.example/x", keys }).success).toBe(true);
  });
});

describe("Dateiprüfung", () => {
  it("bestimmt den Typ über den Inhalt, nicht über den Namen", () => {
    expect(detectFileType(Buffer.from("%PDF-1.7 ..."))?.mime).toBe("application/pdf");
    expect(detectFileType(Buffer.from("<html><script>"))).toBeNull();
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
  });
  it("bereinigt Dateinamen", () => {
    expect(sanitizeFilename("../../etc/passwd.pdf", "pdf")).toBe("etcpasswd.pdf");
    expect(sanitizeFilename("Einladung Versammlung.exe", "pdf")).toBe("Einladung_Versammlung.pdf");
  });
});

describe("Passwort-Hashing", () => {
  it("verifiziert korrekte und lehnt falsche Passwörter ab", async () => {
    const h = await hashSecret("geheimes-passwort-1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifySecret("geheimes-passwort-1", h)).toBe(true);
    expect(await verifySecret("falsch", h)).toBe(false);
    expect(await verifySecret("x", "kaputt")).toBe(false);
  });
});
