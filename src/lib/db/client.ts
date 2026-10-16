import path from "node:path";
import fs from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: DB;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
}

const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

/**
 * Erstellt eine Datenbankverbindung.
 *  - postgres://… / postgresql://…  → PostgreSQL (empfohlen für den Betrieb)
 *  - pglite://memory                 → eingebettete In-Memory-DB (Tests)
 *  - pglite://<ordner>               → eingebettete Datei-DB (schneller lokaler Start)
 */
export async function createDb(url: string): Promise<DbHandle> {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 10 });
    const db = drizzle(pool, { schema });
    return { db, kind: "postgres", close: () => pool.end() };
  }
  if (url.startsWith("pglite://")) {
    const target = url.slice("pglite://".length);
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    let client;
    if (target === "memory" || target === "") {
      client = new PGlite();
    } else {
      const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), target);
      fs.mkdirSync(dir, { recursive: true });
      client = new PGlite(dir);
    }
    await client.waitReady;
    const db = drizzle(client, { schema }) as unknown as DB;
    return { db, kind: "pglite", close: () => client.close() };
  }
  throw new Error("DATABASE_URL muss mit postgres://, postgresql:// oder pglite:// beginnen.");
}

export async function migrateDb(handle: DbHandle, migrationsFolder = MIGRATIONS_DIR) {
  if (handle.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(handle.db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(handle.db as any, { migrationsFolder });
  }
}
