import { createDb, migrateDb, type DbHandle } from "@/lib/db/client";
import { setHashCostForTests } from "@/lib/auth/crypto";
import { createTenant } from "@/lib/services/tenants";
import { getActor } from "@/lib/services/auth";
import type { Actor } from "@/lib/auth/permissions";

setHashCostForTests(2 ** 10);

/**
 * Jede Testdatei bekommt eine frische Datenbank.
 * Standard: eingebettetes PostgreSQL (PGlite, In-Memory).
 * Mit TEST_DATABASE_URL=postgres://… laufen dieselben Tests gegen einen echten Server.
 */
export async function freshDb(): Promise<DbHandle> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const handle = await createDb(url);
    const { sql } = await import("drizzle-orm");
    await handle.db.execute(sql.raw("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;"));
    await migrateDb(handle);
    return handle;
  }
  const handle = await createDb("pglite://memory");
  await migrateDb(handle);
  return handle;
}

export const SECRET = "test-secret-0123456789-0123456789-abcdef";

export async function makeTenant(handle: DbHandle, slug: string) {
  const { tenant, userId } = await createTenant(handle.db, {
    slug,
    name: `Betriebsrat ${slug}`,
    companyName: slug.toUpperCase(),
    adminEmail: `admin@${slug}.test`,
    adminName: `Admin ${slug}`,
    adminPassword: "sehr-sicheres-passwort-123",
  });
  const admin = (await getActor(handle.db, userId, tenant.id)) as Actor;
  return { tenant, admin };
}
