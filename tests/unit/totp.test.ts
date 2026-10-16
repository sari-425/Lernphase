import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, decryptSecret, encryptSecret, generateRecoveryCodes, totpCode, verifyTotp, currentStep } from "@/lib/auth/totp";

describe("TOTP (RFC 6238)", () => {
  it("entspricht den Testvektoren aus RFC 6238 (SHA-1)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    // RFC 6238 Anhang B: T=59 → 94287082, T=1111111109 → 07081804 (8-stellig; wir nutzen die letzten 6)
    expect(totpCode(secret, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(secret, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("Base32 ist umkehrbar", () => {
    const b = Buffer.from("Betriebsrat-2026!");
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
  it("akzeptiert ±30 Sekunden, lehnt alte und bereits genutzte Codes ab", () => {
    const secret = base32Encode(Buffer.from("abcdefghijabcdefghij"));
    const now = 1_800_000_000_000;
    const step = currentStep(now);
    expect(verifyTotp(secret, totpCode(secret, step), { now })).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step - 3), { now })).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, step), { now, lastStep: step })).toBeNull();
    expect(verifyTotp(secret, "12a456", { now })).toBeNull();
  });
  it("verschlüsselt das Geheimnis (manipulationssicher)", () => {
    const enc = encryptSecret("server-geheimnis", "JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret("server-geheimnis", enc)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret("anderes-geheimnis", enc)).toThrow();
  });
  it("erzeugt 8 unterschiedliche Wiederherstellungscodes", () => {
    const c = generateRecoveryCodes();
    expect(new Set(c).size).toBe(8);
    expect(c[0]).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}-[a-z2-7]{2}$/);
  });
});
