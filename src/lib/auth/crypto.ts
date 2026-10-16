import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Zufälliges, URL-taugliches Token (256 Bit). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// scrypt-Parameter (OWASP-Empfehlung: N=2^17, r=8, p=1). maxmem muss passend erhöht werden.
let N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 256 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Nur für automatisierte Tests: geringere Kosten, damit Tests schnell laufen. */
export function setHashCostForTests(n: number) {
  N = n;
  dummyHash = null;
}

/** Format: scrypt$N$r$p$salt$hash */
export async function hashSecret(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifySecret(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64url"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Ein fester Dummy-Hash, damit ein Login mit unbekannter E-Mail genauso lange dauert
// wie einer mit bekannter (kein Rückschluss auf existierende Konten).
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashSecret("dummy-password-for-timing");
  return dummyHash;
}
