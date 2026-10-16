import { and, isNotNull, lt, or } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { invitations } from "@/lib/db/schema";
import type { PushSender } from "@/lib/push/sender";
import { purgeExpiredSessions } from "./auth";
import { purgeAudit } from "./audit";
import { enqueueDueScheduled, processDispatches, purgeDispatches, purgeSubscriptions, type DispatchConfig } from "./push";
import { purgeRateLimits } from "./rate-limit";

const DAY = 24 * 60 * 60_000;

/**
 * Lösch- und Aufbewahrungskonzept (siehe docs/DATENSCHUTZ.md):
 *  - abgelaufene Sitzungen: sofort
 *  - Ratenbegrenzungs-Einträge: nach 24 Stunden
 *  - Einladungen: 7 Tage nach Ablauf/Verwendung
 *  - Push-Abos: nach 180 Tagen ohne Lebenszeichen oder nach 5 Fehlversuchen
 *  - Push-Versandprotokolle (nur Zähler): nach 90 Tagen
 *  - Änderungsprotokoll (Audit): nach 365 Tagen
 */
export async function runRetention(db: DB, now = new Date()) {
  await purgeExpiredSessions(db, now);
  await purgeRateLimits(db, new Date(now.getTime() - DAY));
  await db
    .delete(invitations)
    .where(
      or(
        lt(invitations.expiresAt, new Date(now.getTime() - 7 * DAY)),
        and(isNotNull(invitations.usedAt), lt(invitations.usedAt, new Date(now.getTime() - 7 * DAY))),
      ),
    );
  const removedSubs = await purgeSubscriptions(db, now);
  await purgeDispatches(db, new Date(now.getTime() - 90 * DAY));
  await purgeAudit(db, new Date(now.getTime() - 365 * DAY));
  return { removedSubs };
}

/** Ein Planer-Durchlauf: fällige Pushes anlegen und versenden. */
export async function runSchedulerTick(db: DB, sender: PushSender | null, cfg: DispatchConfig, now = new Date()) {
  const enqueued = await enqueueDueScheduled(db, now);
  const reports = sender ? await processDispatches(db, sender, cfg, now) : [];
  return { enqueued, reports };
}
