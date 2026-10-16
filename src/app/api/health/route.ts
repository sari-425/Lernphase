import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { vapidConfig } from "@/lib/env";
import { json } from "@/lib/server/api";

/** Gesundheitsprüfung für Docker/Monitoring – ohne interne Details. */
export async function GET() {
  try {
    await (await getDb()).execute(sql`select 1`);
    return json({ ok: true, push: Boolean(vapidConfig()) });
  } catch {
    return json({ ok: false }, 503);
  }
}
