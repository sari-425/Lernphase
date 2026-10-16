import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { getAttachmentForReader } from "@/lib/services/messages";
import { getActor, validateSession } from "@/lib/services/auth";
import { getTenantBySlug, hasStaffAccess } from "@/lib/services/tenants";
import { SESSION_COOKIE, staffCookieName } from "@/lib/server/context";

/**
 * Anhänge werden nie als öffentliche Datei abgelegt, sondern nur über diese Route
 * ausgeliefert – mit derselben Sichtbarkeitsprüfung wie die zugehörige Mitteilung.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const db = await getDb();
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) return new Response("Nicht gefunden", { status: 404 });
  const jar = await cookies();
  const user = await validateSession(db, jar.get(SESSION_COOKIE)?.value);
  const member = user ? await getActor(db, user.id, tenant.id) : null;
  const access = { staff: hasStaffAccess(sessionSecret(), tenant, jar.get(staffCookieName(slug))?.value), council: Boolean(member) };
  const file = await getAttachmentForReader(db, tenant.id, id, access, { editor: Boolean(member) });
  if (!file) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
