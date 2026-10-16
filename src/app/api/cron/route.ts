import { env } from "@/lib/env";
import { safeEqual } from "@/lib/auth/crypto";
import { json } from "@/lib/server/api";
import { schedulerTick } from "@/lib/server/push-runtime";

/**
 * Für Hosting ohne dauerhaft laufenden Prozess (z. B. Serverless):
 * regelmäßig (jede Minute bis alle 5 Minuten) per POST mit
 * "Authorization: Bearer <CRON_SECRET>" aufrufen.
 */
export async function POST(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || !safeEqual(auth, `Bearer ${secret}`)) {
    return json({ error: "Nicht berechtigt." }, 401);
  }
  const res = await schedulerTick();
  return json({ ok: true, enqueued: res.enqueued, dispatches: res.reports.length });
}
