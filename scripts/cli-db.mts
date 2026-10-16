import { createDb, migrateDb } from "../src/lib/db/client.ts";

export async function openDb() {
  const url = process.env.DATABASE_URL || "pglite://.data/pglite";
  const handle = await createDb(url);
  return handle;
}
export { migrateDb };
