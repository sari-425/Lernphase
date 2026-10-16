import { z } from "zod";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { apiError, json, readJson, tenantFromBody } from "@/lib/server/api";
import { clientIp } from "@/lib/server/context";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";
import { subscribe } from "@/lib/services/push";
import { listCategories } from "@/lib/services/directory";
import { consume, limitKey, LIMITS } from "@/lib/services/rate-limit";

const body = z.object({ slug: z.string(), subscription: pushSubscriptionSchema.pick({ endpoint: true, keys: true }), categoryIds: z.array(z.string().uuid()).max(50).nullable().default(null), onlyImportant: z.boolean().default(false) });

/** Anonymes Push-Abo anlegen/aktualisieren. Es werden keine personenbezogenen Stammdaten erhoben. */
export async function POST(req: Request) {
  try {
    const data = body.parse(await readJson(req));
    const db = await getDb();
    await consume(db, limitKey(sessionSecret(), LIMITS.pushSubscribeByIp, await clientIp()), LIMITS.pushSubscribeByIp);
    const { tenant, staff } = await tenantFromBody(data.slug);
    const valid = new Set((await listCategories(db, tenant.id)).map((c) => c.id));
    const categoryIds = data.categoryIds ? data.categoryIds.filter((id) => valid.has(id)) : null;
    await subscribe(db, tenant, { ...data.subscription, categoryIds, onlyImportant: data.onlyImportant }, { staffAccess: staff });
    return json({ ok: true, staffAccess: staff });
  } catch (err) {
    return apiError(err);
  }
}
