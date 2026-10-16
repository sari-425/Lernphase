import "server-only";
import { databaseUrl, env } from "@/lib/env";
import { createDb, migrateDb, type DB, type DbHandle } from "./client";

export type { DB } from "./client";

const g = globalThis as unknown as { __brdDb?: Promise<DbHandle> };

/** Liefert die (einmalig erzeugte) Datenbankverbindung des Serverprozesses. */
export async function getDb(): Promise<DB> {
  if (!g.__brdDb) {
    g.__brdDb = (async () => {
      const url = databaseUrl();
      const handle = await createDb(url);
      // Eingebettete DB und AUTO_MIGRATE=true: Schema automatisch aktualisieren
      if (handle.kind === "pglite" || env().AUTO_MIGRATE) {
        await migrateDb(handle);
      }
      return handle;
    })().catch((err) => {
      g.__brdDb = undefined;
      throw err;
    });
  }
  return (await g.__brdDb).db;
}
