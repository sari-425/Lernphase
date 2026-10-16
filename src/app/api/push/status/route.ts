import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiError, json, readJson, tenantFromBody } from "@/lib/server/api";
import { getSubscriptionPrefs } from "@/lib/services/push";

const body = z.object({ slug: z.string(), endpoint: z.string().url().max(1000) });

/** Fragt ab, ob DIESES Gerät (Endpunkt) für den Betriebsrat angemeldet ist. */
export async function POST(req: Request) {
  try {
    const data = body.parse(await readJson(req));
    const { tenant, staff } = await tenantFromBody(data.slug);
    const prefs = await getSubscriptionPrefs(await getDb(), tenant.id, data.endpoint);
    return json({ subscribed: Boolean(prefs), prefs, staffAccess: staff });
  } catch (err) {
    return apiError(err);
  }
}
