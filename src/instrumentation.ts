/**
 * Interner Planer für den Selbstbetrieb (ein dauerhaft laufender Node-Prozess):
 * versendet geplante Push-Benachrichtigungen und führt die Löschfristen aus.
 * Bei Serverless-Hosting stattdessen /api/cron regelmäßig aufrufen.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const enabled = (process.env.ENABLE_INTERNAL_SCHEDULER ?? "true") !== "false";
  if (!enabled) return;
  const g = globalThis as unknown as { __brdScheduler?: NodeJS.Timeout };
  if (g.__brdScheduler) return;
  const { schedulerTick } = await import("@/lib/server/push-runtime");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await schedulerTick();
    } catch (err) {
      console.error("[planer] Fehler:", (err as Error).message);
    } finally {
      running = false;
    }
  };
  g.__brdScheduler = setInterval(tick, 60_000);
  g.__brdScheduler.unref?.();
  setTimeout(tick, 5_000).unref?.();
}
