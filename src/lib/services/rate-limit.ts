import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { rateLimitEvents } from "@/lib/db/schema";
import { hmac } from "@/lib/auth/crypto";
import { AppError } from "@/lib/errors";

export interface Limit {
  /** fachlicher Bereich, z. B. "login-email" */
  scope: string;
  max: number;
  windowMs: number;
}

export const LIMITS = {
  loginByEmail: { scope: "login-email", max: 5, windowMs: 15 * 60_000 },
  loginByIp: { scope: "login-ip", max: 30, windowMs: 15 * 60_000 },
  // zählt nur FEHLversuche (viele Beschäftigte können sich eine Firmen-IP teilen)
  staffCodeByIp: { scope: "staff-code-ip", max: 20, windowMs: 15 * 60_000 },
  staffCodeByTenant: { scope: "staff-code-tenant", max: 300, windowMs: 15 * 60_000 },
  pushSubscribeByIp: { scope: "push-sub-ip", max: 600, windowMs: 60 * 60_000 },
  setupByIp: { scope: "setup-ip", max: 10, windowMs: 60 * 60_000 },
  inviteByIp: { scope: "invite-ip", max: 20, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/** Der Schlüssel wird als HMAC gespeichert – keine Klartext-IP oder -E-Mail in der Datenbank. */
export function limitKey(secret: string, limit: Limit, identifier: string) {
  return `${limit.scope}:${hmac(secret, `${limit.scope}|${identifier.toLowerCase()}`)}`;
}

export async function isLimited(db: DB, key: string, limit: Limit, now = new Date()) {
  const since = new Date(now.getTime() - limit.windowMs);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(rateLimitEvents)
    .where(and(eq(rateLimitEvents.key, key), gte(rateLimitEvents.createdAt, since)));
  return (row?.n ?? 0) >= limit.max;
}

export async function recordHit(db: DB, key: string, now = new Date()) {
  await db.insert(rateLimitEvents).values({ key, createdAt: now });
}

export async function clearHits(db: DB, key: string) {
  await db.delete(rateLimitEvents).where(eq(rateLimitEvents.key, key));
}

/** Prüft und zählt in einem Schritt (für Aktionen, bei denen jeder Versuch zählt). */
export async function consume(db: DB, key: string, limit: Limit, now = new Date()) {
  if (await isLimited(db, key, limit, now)) {
    throw new AppError("RATE_LIMITED", "Zu viele Versuche. Bitte warten Sie einige Minuten.");
  }
  await recordHit(db, key, now);
}

export async function purgeRateLimits(db: DB, olderThan: Date) {
  await db.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, olderThan));
}
