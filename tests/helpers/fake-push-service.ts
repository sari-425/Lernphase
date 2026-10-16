import https from "node:https";
import { execFileSync } from "node:child_process";
import { createECDH, createDecipheriv, createHmac, randomBytes, createVerify } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

/**
 * Ein lokaler Push-Dienst für Tests. Er empfängt echte, mit web-push verschlüsselte
 * Nachrichten, prüft die VAPID-Signatur und entschlüsselt den Inhalt wie ein Browser
 * (RFC 8291, aes128gcm). So wird der Versand Ende-zu-Ende getestet – ohne Google/Apple/Mozilla.
 */
export interface ReceivedPush {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  payload: string;
  vapidValid: boolean;
}

export interface FakeClient {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  decrypt(body: Buffer): string;
}

const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, len: number) => {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len);
};

export function makeClientKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const uaPublic = ecdh.getPublicKey();
  return {
    keys: { p256dh: uaPublic.toString("base64url"), auth: auth.toString("base64url") },
    decrypt(body: Buffer) {
      const salt = body.subarray(0, 16);
      const idlen = body[20];
      const asPublic = body.subarray(21, 21 + idlen);
      const ciphertext = body.subarray(21 + idlen);
      const secret = ecdh.computeSecret(asPublic);
      const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
      const ikm = hkdf(auth, secret, keyInfo, 32);
      const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
      const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
      const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
      decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
      const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
      let end = plain.length - 1;
      while (end >= 0 && plain[end] === 0) end--;
      if (plain[end] !== 2) throw new Error("Ungültiges Padding");
      return plain.subarray(0, end).toString("utf8");
    },
  };
}

function verifyVapid(authHeader: string | undefined, vapidPublicKey: string, audience: string) {
  // Format: "vapid t=<jwt>, k=<publicKey>"
  if (!authHeader?.startsWith("vapid ")) return false;
  const t = /t=([^,\s]+)/.exec(authHeader)?.[1];
  const k = /k=([^,\s]+)/.exec(authHeader)?.[1];
  if (!t || k !== vapidPublicKey) return false;
  const [h, p, sig] = t.split(".");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.aud !== audience || claims.exp * 1000 < Date.now()) return false;
  const pub = Buffer.from(vapidPublicKey, "base64url");
  const jwk = { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33, 65).toString("base64url") };
  const v = createVerify("SHA256");
  v.update(`${h}.${p}`);
  return v.verify({ key: jwk, format: "jwk", dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"));
}

export async function startFakePushService(vapidPublicKey: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fakepush-"));
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes",
    "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem"), "-days", "1", "-subj", "/CN=localhost",
  ], { stdio: "ignore" });
  const clients = new Map<string, ReturnType<typeof makeClientKeys>>();
  const statusFor = new Map<string, number>();
  const received: ReceivedPush[] = [];
  let origin = "";
  const server = https.createServer(
    { key: fs.readFileSync(path.join(dir, "key.pem")), cert: fs.readFileSync(path.join(dir, "cert.pem")) },
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const p = req.url ?? "";
        const status = statusFor.get(p) ?? 201;
        const client = clients.get(p);
        let payload = "";
        try {
          payload = client ? client.decrypt(Buffer.concat(chunks)) : "";
        } catch {
          payload = "<Entschlüsselung fehlgeschlagen>";
        }
        received.push({ path: p, headers: req.headers, payload, vapidValid: verifyVapid(req.headers.authorization as string, vapidPublicKey, origin) });
        res.statusCode = status;
        res.end();
      });
    },
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const agent = new https.Agent({ rejectUnauthorized: false });
  return {
    origin,
    agent,
    received,
    newClient(name: string, status = 201): FakeClient {
      const c = makeClientKeys();
      const p = `/push/${name}`;
      clients.set(p, c);
      statusFor.set(p, status);
      return { endpoint: `${origin}${p}`, keys: c.keys, decrypt: c.decrypt };
    },
    setStatus(name: string, status: number) {
      statusFor.set(`/push/${name}`, status);
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
