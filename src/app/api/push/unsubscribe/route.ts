import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiError, json, readJson, tenantFromBody } from "@/lib/server/api";
import { unsubscribe } from "@/lib/services/push";

const body = z.object({ slug: z.string(), endpoint: z.string().url().max(1000) });

/** Abmelden: das Abo wird sofort und vollständig gelöscht. */
export async function POST(req: Request) {
  try {
    const data = body.parse(await readJson(req));
    const { tenant } = await tenantFromBody(data.slug);
    const removed = await unsubscribe(await getDb(), tenant.id, data.endpoint);
    return json({ ok: true, removed });
  } catch (err) {
    return apiError(err);
  }
}
