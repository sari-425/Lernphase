import { getDb } from "@/lib/db";
import { getTenantBySlug } from "@/lib/services/tenants";

/** Eigenes Web-App-Manifest je Betriebsrat: Start direkt im richtigen Bereich. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const tenant = await getTenantBySlug(await getDb(), slug);
  if (!tenant) return new Response("Nicht gefunden", { status: 404 });
  const manifest = {
    id: `/b/${slug}`,
    name: tenant.name,
    short_name: "Betriebsrat",
    description: `Informationen des ${tenant.name}`,
    lang: "de",
    start_url: `/b/${slug}`,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
