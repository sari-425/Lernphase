import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { countTenants } from "@/lib/services/tenants";

/**
 * Erleichterung NUR für das lokale Ausprobieren (npm run dev auf dem eigenen Rechner):
 * Die allererste Einrichtung ist ohne SETUP_TOKEN möglich – aber nur
 *  - außerhalb des Produktionsbetriebs,
 *  - bei Aufruf über localhost/127.0.0.1,
 *  - solange noch KEIN Betriebsrat existiert.
 * Im Produktionsbetrieb ist SETUP_TOKEN immer Pflicht.
 */
export async function localFirstSetupAllowed(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  const host = (await headers()).get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  return (await countTenants(await getDb())) === 0;
}
