/**
 * Erzeugt alle benötigten Geheimnisse für die .env-Datei:
 *   npm run secrets
 * Die Ausgabe in die Datei .env (bzw. beim Hoster) übernehmen – niemals in Git einchecken.
 */
import webpush from "web-push";
import { randomBytes } from "node:crypto";

const vapid = webpush.generateVAPIDKeys();
const rnd = (n: number) => randomBytes(n).toString("base64url");
console.log(`# --- Betriebsrat Direkt: erzeugt am ${new Date().toISOString()} ---
SESSION_SECRET=${rnd(48)}
VAPID_PUBLIC_KEY=${vapid.publicKey}
VAPID_PRIVATE_KEY=${vapid.privateKey}
SETUP_TOKEN=${rnd(24)}
CRON_SECRET=${rnd(36)}
`);
