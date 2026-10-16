import { and, desc, eq, lt } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { auditLog, users } from "@/lib/db/schema";
import { assertCan, type Actor } from "@/lib/auth/permissions";

/**
 * Nachvollziehbarkeit: WER hat WANN WAS veröffentlicht/zurückgezogen/geändert.
 * Es werden keine Inhalte und keine Daten von Beschäftigten protokolliert.
 */
export async function audit(
  db: DB,
  actor: Pick<Actor, "tenantId" | "userId">,
  action: string,
  targetId?: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action,
    targetId: targetId ?? null,
    details: details ?? null,
  });
}

export async function listAudit(db: DB, actor: Actor, limit = 100) {
  assertCan(actor, "audit.read");
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetId: auditLog.targetId,
      details: auditLog.details,
      createdAt: auditLog.createdAt,
      userName: users.displayName,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(eq(auditLog.tenantId, actor.tenantId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

export async function purgeAudit(db: DB, olderThan: Date, tenantId?: string) {
  await db
    .delete(auditLog)
    .where(tenantId ? and(eq(auditLog.tenantId, tenantId), lt(auditLog.createdAt, olderThan)) : lt(auditLog.createdAt, olderThan));
}
