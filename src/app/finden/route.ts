import { getDb } from "@/lib/db";
import { getTenantBySlug } from "@/lib/services/tenants";

/**
 * "Betriebsrat finden" ohne öffentliches Verzeichnis: Nur wer die Kurzadresse kennt
 * (Aushang, QR-Code), gelangt zum Bereich. So wird nicht offengelegt, welche Betriebe
 * die App nutzen.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("adresse") ?? "").trim().toLowerCase();
  // auch ganze Links akzeptieren (".../b/<slug>")
  const slug = (raw.match(/\/b\/([a-z0-9-]+)/)?.[1] ?? raw).replace(/[^a-z0-9-]/g, "").slice(0, 48);
  const tenant = slug ? await getTenantBySlug(await getDb(), slug) : null;
  const target = tenant ? `/b/${tenant.slug}` : "/?fehler=1";
  return new Response(null, { status: 303, headers: { Location: target } });
}
