/**
 * Betriebsräte verwalten (Betreiber-Werkzeug):
 *   npm run tenant -- create <kurzadresse> "<Name>" <admin-email> "<Admin-Name>" ["<Betrieb>"]
 *       (Passwort wird abgefragt bzw. aus ADMIN_PASSWORD gelesen)
 *   npm run tenant -- list
 *   npm run tenant -- delete <kurzadresse> --ja
 */
import { createInterface } from "node:readline/promises";
import { openDb, migrateDb } from "./cli-db.mts";
import { createTenant, deleteTenant, getTenantBySlug } from "../src/lib/services/tenants.ts";
import { tenants } from "../src/lib/db/schema.ts";
import { emailSchema, passwordSchema, slugSchema } from "../src/lib/validation/schemas.ts";

const [cmd, ...args] = process.argv.slice(2);
const handle = await openDb();
await migrateDb(handle);
const db = handle.db;

try {
  if (cmd === "list") {
    const rows = await db.select({ slug: tenants.slug, name: tenants.name, createdAt: tenants.createdAt }).from(tenants);
    for (const r of rows) console.log(`${r.slug}\t${r.name}\t${r.createdAt.toISOString()}`);
    if (!rows.length) console.log("(keine Betriebsräte angelegt)");
  } else if (cmd === "create") {
    const [slug, name, email, adminName, company] = args;
    if (!slug || !name || !email || !adminName) throw new Error('Aufruf: create <kurzadresse> "<Name>" <admin-email> "<Admin-Name>" ["<Betrieb>"]');
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      password = await rl.question("Passwort für den Administrator (mind. 12 Zeichen): ");
      rl.close();
    }
    const { tenant } = await createTenant(db, {
      slug: slugSchema.parse(slug),
      name,
      companyName: company ?? "",
      adminEmail: emailSchema.parse(email),
      adminName,
      adminPassword: passwordSchema.parse(password),
    });
    console.log(`Angelegt: ${tenant.name} → /b/${tenant.slug} (Verwaltung: /admin/${tenant.slug})`);
  } else if (cmd === "delete") {
    const [slug, confirm] = args;
    const t = slug ? await getTenantBySlug(db, slug) : null;
    if (!t) throw new Error("Betriebsrat nicht gefunden.");
    if (confirm !== "--ja") throw new Error(`Zum endgültigen Löschen von "${t.name}" mit allen Daten: delete ${slug} --ja`);
    await deleteTenant(db, t.id);
    console.log(`Gelöscht: ${t.name} (alle Mitteilungen, Abos, Konten ohne weitere Mitgliedschaft).`);
  } else {
    console.log("Befehle: list | create | delete  (siehe Kopf dieser Datei)");
  }
} catch (err) {
  console.error("Fehler:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await handle.close();
}
