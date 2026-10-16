import { and, eq, gt, lt } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { memberships, sessions, tenants, users } from "@/lib/db/schema";
import { getDummyHash, randomToken, sha256, verifySecret } from "@/lib/auth/crypto";
import type { Actor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { LIMITS, clearHits, isLimited, limitKey, recordHit } from "./rate-limit";

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60_000; // absolute Höchstdauer
export const SESSION_IDLE_MS = 24 * 60 * 60_000; // Abmeldung nach 24 h Inaktivität
const TOUCH_INTERVAL_MS = 5 * 60_000;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export async function createSession(db: DB, userId: string, now = new Date()) {
  const token = randomToken();
  await db.insert(sessions).values({
    idHash: sha256(token),
    userId,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS),
  });
  return token;
}

export async function validateSession(db: DB, token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const idHash = sha256(token);
  const [row] = await db
    .select({
      idHash: sessions.idHash,
      lastActiveAt: sessions.lastActiveAt,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.idHash, idHash))
    .limit(1);
  if (!row) return null;
  const idle = now.getTime() - row.lastActiveAt.getTime();
  if (row.expiresAt <= now || idle > SESSION_IDLE_MS || !row.isActive) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }
  if (idle > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastActiveAt: now }).where(eq(sessions.idHash, idHash));
  }
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export async function destroySession(db: DB, token: string | undefined) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.idHash, sha256(token)));
}

export async function destroyUserSessions(db: DB, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(db: DB, now = new Date()) {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(sessions).where(lt(sessions.lastActiveAt, new Date(now.getTime() - SESSION_IDLE_MS)));
}

export type LoginResult =
  | { kind: "session"; token: string; user: SessionUser }
  | { kind: "second-factor"; user: SessionUser };

/**
 * Anmeldung mit Ratenbegrenzung pro E-Mail und pro (gehashter) IP.
 * Fehlermeldungen verraten nicht, ob ein Konto existiert.
 */
export async function login(
  db: DB,
  secret: string,
  input: { email: string; password: string; ip: string },
  now = new Date(),
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const emailKey = limitKey(secret, LIMITS.loginByEmail, email);
  const ipKey = limitKey(secret, LIMITS.loginByIp, input.ip);
  if ((await isLimited(db, emailKey, LIMITS.loginByEmail, now)) || (await isLimited(db, ipKey, LIMITS.loginByIp, now))) {
    throw new AppError("RATE_LIMITED", "Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie 15 Minuten.");
  }
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = user ? await verifySecret(input.password, user.passwordHash) : await verifySecret(input.password, await getDummyHash());
  if (!user || !ok || !user.isActive) {
    await recordHit(db, emailKey, now);
    await recordHit(db, ipKey, now);
    throw new AppError("UNAUTHENTICATED", "E-Mail-Adresse oder Passwort ist falsch.");
  }
  await clearHits(db, emailKey);
  const sessionUser = { id: user.id, email: user.email, displayName: user.displayName };
  if (user.totpEnabled) return { kind: "second-factor", user: sessionUser };
  const token = await createSession(db, user.id, now);
  return { kind: "session", token, user: sessionUser };
}

/** Lädt die Rolle eines Benutzers in GENAU einem Mandanten. Kein Eintrag = kein Zugriff. */
export async function getActor(db: DB, userId: string, tenantId: string): Promise<Actor | null> {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  if (!m) return null;
  return { userId, tenantId, role: m.role, canPublish: m.canPublish };
}

export async function listUserTenants(db: DB, userId: string) {
  return db
    .select({ slug: tenants.slug, name: tenants.name, role: memberships.role, canPublish: memberships.canPublish })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(tenants.name);
}

export async function countActiveSessions(db: DB, userId: string, now = new Date()) {
  const rows = await db
    .select({ id: sessions.idHash })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)));
  return rows.length;
}
