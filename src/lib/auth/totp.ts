import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Zeitbasierte Einmalcodes (TOTP, RFC 6238) – kompatibel mit gängigen
 * Authenticator-Apps (z. B. Aegis, FreeOTP, Google/Microsoft Authenticator, 2FAS).
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Ungültiges Base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secretB32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD);

/**
 * Prüft einen Code (±1 Zeitschritt Toleranz). Gibt den verwendeten Zeitschritt zurück,
 * oder null. Bereits verwendete Zeitschritte (lastStep) werden abgelehnt (keine Wiederverwendung).
 */
export function verifyTotp(secretB32: string, code: string, opts: { now?: number; lastStep?: number | null } = {}): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const step = currentStep(opts.now);
  for (const s of [step - 1, step, step + 1]) {
    if (opts.lastStep != null && s <= opts.lastStep) continue;
    if (totpCode(secretB32, s) === c) return s;
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer = "Betriebsrat Direkt") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD}`;
}

// ---------- Verschlüsselung des Geheimnisses in der Datenbank ----------

const keyFrom = (serverSecret: string) => createHash("sha256").update(`totp-key|${serverSecret}`).digest();

export function encryptSecret(serverSecret: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(serverSecret), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(serverSecret: string, stored: string): string {
  const [v, iv, tag, enc] = stored.split(".");
  if (v !== "v1") throw new Error("Unbekanntes Format");
  const d = createDecipheriv("aes-256-gcm", keyFrom(serverSecret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

/** 8 Wiederherstellungscodes im Format xxxx-xxxx-xx (je ~50 Bit) */
export function generateRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const raw = base32Encode(randomBytes(7)).toLowerCase().slice(0, 10);
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
  });
}

export const normalizeRecoveryCode = (c: string) => c.toLowerCase().replace(/[^a-z2-7]/g, "");
