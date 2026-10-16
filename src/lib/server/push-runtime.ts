import "server-only";
import { env, vapidConfig } from "@/lib/env";
import { getDb } from "@/lib/db";
import { createWebPushSender, type PushSender } from "@/lib/push/sender";
import { processDispatches, type DispatchConfig } from "@/lib/services/push";
import { runRetention, runSchedulerTick } from "@/lib/services/maintenance";

export function pushSender(): PushSender | null {
  const v = vapidConfig();
  return v ? createWebPushSender(v) : null;
}

export function dispatchConfig(): DispatchConfig {
  const e = env();
  return {
    maxPerTenantPerDay: e.PUSH_MAX_PER_TENANT_PER_DAY,
    minIntervalMinutes: e.PUSH_MIN_INTERVAL_MINUTES,
    appUrl: e.APP_URL ?? "",
  };
}

/** Sofortiger Versand nach dem Veröffentlichen (läuft nach der Antwort an den Browser). */
export async function processNow() {
  const sender = pushSender();
  if (!sender) return;
  try {
    await processDispatches(await getDb(), sender, dispatchConfig());
  } catch (err) {
    console.error("[push] Versand fehlgeschlagen:", (err as Error).message);
  }
}

let lastRetention = 0;

/** Ein Durchlauf des Planers – vom internen Intervall oder von /api/cron aufgerufen. */
export async function schedulerTick() {
  const db = await getDb();
  const result = await runSchedulerTick(db, pushSender(), dispatchConfig());
  if (Date.now() - lastRetention > 60 * 60_000) {
    lastRetention = Date.now();
    await runRetention(db);
  }
  return result;
}
