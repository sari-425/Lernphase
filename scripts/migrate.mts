/** Datenbankschema anlegen/aktualisieren:  npm run db:migrate */
import { openDb, migrateDb } from "./cli-db.mts";

const handle = await openDb();
await migrateDb(handle);
console.log(`Datenbank aktuell (${handle.kind}).`);
await handle.close();
