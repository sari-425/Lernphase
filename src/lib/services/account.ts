import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { memberships, passwordResets, sessions, users } from "@/lib/db/schema";
import { hashSecret, hmac, randomToken, safeEqual, sha256, verifySecret } from "@/lib/auth/crypto";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotp,
} from "@/lib/auth/totp";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { AppError, invalid, notFound } from "@/lib/errors";
import { audit } from "./audit";
import { destroyUserSessions } from "./auth";
import { isLimited, limitKey, recordHit, clearHits } from "./rate-limit";

async function loadUser(db: DB, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw notFound("Konto nicht gefunden.");
  return u;
}

export async function getAccount(db: DB, userId: string) {
  const u = await loadUser(db, userId);
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    totpEnabled: u.totpEnabled,
    recoveryCodesLeft: u.recoveryCodeHashes?.length ?? 0,
  };
}

export async function changeDisplayName(db: DB, userId: string, displayName: string) {
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
}

/** Passwort ändern. Alle ANDEREN Sitzungen werden beendet. */
export async function changePassword(db: DB, userId: string, current: string, next: string, keepSessionToken?: string) {
  const u = await loadUser(db, userId);
  if (!(await verifySecret(current, u.passwordHash))) throw invalid("Das aktuelle Passwort ist falsch.");
  if (current === next) throw invalid("Das neue Passwort muss sich vom bisherigen unterscheiden.");
  await db.update(users).set({ passwordHash: await hashSecret(next) }).where(eq(users.id, userId));
  if (keepSessionToken) {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.idHash, sha256(keepSessionToken))));
  } else {
    await destroyUserSessions(db, userId);
  }
}

/** Alle anderen Geräte abmelden. */
export async function logoutOtherSessions(db: DB, userId: string, keepSessionToken: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.idHash, sha256(keepSessionToken))));
}

// ---------- Zwei-Faktor (TOTP) ----------

/** Schritt 1: neues Geheimnis erzeugen (noch nicht aktiv). */
export async function beginTotpSetup(db: DB, serverSecret: string, userId: string) {
  const u = await loadUser(db, userId);
  if (u.totpEnabled) throw invalid("Die Zwei-Faktor-Anmeldung ist bereits aktiv.");
  const secret = generateTotpSecret();
  await db.update(users).set({ totpSecretEnc: encryptSecret(serverSecret, secret), totpLastStep: null }).where(eq(users.id, userId));
  return { secret, email: u.email };
}

/** Schritt 2: Code aus der App bestätigen → aktivieren, Wiederherstellungscodes einmalig zurückgeben. */
export async function confirmTotpSetup(db: DB, serverSecret: string, userId: string, code: string, now = Date.now()) {
  const u = await loadUser(db, userId);
  if (u.totpEnabled) throw invalid("Die Zwei-Faktor-Anmeldung ist bereits aktiv.");
  if (!u.totpSecretEnc) throw invalid("Bitte die Einrichtung neu starten.");
  const step = verifyTotp(decryptSecret(serverSecret, u.totpSecretEnc), code, { now });
  if (step === null) throw invalid("Der Code ist nicht korrekt. Bitte Uhrzeit des Geräts prüfen und den aktuellen Code eingeben.");
  const codes = generateRecoveryCodes();
  await db
    .update(users)
    .set({ totpEnabled: true, totpLastStep: step, recoveryCodeHashes: codes.map((c) => sha256(normalizeRecoveryCode(c))) })
    .where(eq(users.id, userId));
  return codes;
}

export async function disableTotp(db: DB, userId: string, password: string) {
  const u = await loadUser(db, userId);
  if (!(await verifySecret(password, u.passwordHash))) throw invalid("Das Passwort ist falsch.");
  await db
    .update(users)
    .set({ totpEnabled: false, totpSecretEnc: null, totpLastStep: null, recoveryCodeHashes: null })
    .where(eq(users.id, userId));
}

export const SECOND_FACTOR_LIMIT = { scope: "2fa-user", max: 5, windowMs: 15 * 60_000 };

/** Prüft TOTP- oder Wiederherstellungscode beim Login (mit Ratenbegrenzung). */
export async function verifySecondFactor(db: DB, serverSecret: string, userId: string, input: string, now = Date.now()) {
  const key = limitKey(serverSecret, SECOND_FACTOR_LIMIT, userId);
  if (await isLimited(db, key, SECOND_FACTOR_LIMIT, new Date(now))) {
    throw new AppError("RATE_LIMITED", "Zu viele falsche Codes. Bitte warten Sie 15 Minuten.");
  }
  const u = await loadUser(db, userId);
  if (!u.totpEnabled || !u.totpSecretEnc || !u.isActive) throw new AppError("UNAUTHENTICATED", "Anmeldung ungültig.");
  const trimmed = input.trim();
  const step = verifyTotp(decryptSecret(serverSecret, u.totpSecretEnc), trimmed, { now, lastStep: u.totpLastStep });
  if (step !== null) {
    // Bedingte Aktualisierung: derselbe Code kann nicht zweimal verwendet werden (auch nicht parallel)
    const ok = await db
      .update(users)
      .set({ totpLastStep: step })
      .where(and(eq(users.id, userId), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
      .returning({ id: users.id });
    if (ok.length) {
      await clearHits(db, key);
      return "totp" as const;
    }
  }
  const hashed = sha256(normalizeRecoveryCode(trimmed));
  const list = u.recoveryCodeHashes ?? [];
  const match = list.find((h) => safeEqual(h, hashed));
  if (match && normalizeRecoveryCode(trimmed).length >= 10) {
    await db.update(users).set({ recoveryCodeHashes: list.filter((h) => h !== match) }).where(eq(users.id, userId));
    await clearHits(db, key);
    return "recovery" as const;
  }
  await recordHit(db, key, new Date(now));
  throw new AppError("UNAUTHENTICATED", "Der Code ist nicht korrekt.");
}

/** Signierter, kurzlebiger Zwischenstand "Passwort korrekt, zweiter Faktor fehlt" (5 Minuten). */
export function pendingLoginToken(serverSecret: string, userId: string, now = Date.now()) {
  const exp = now + 5 * 60_000;
  return `${userId}.${exp}.${hmac(serverSecret, `2fa|${userId}|${exp}`)}`;
}

export function readPendingLoginToken(serverSecret: string, value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const [userId, exp, sig] = value.split(".");
  if (!userId || !exp || !sig || Number(exp) < now) return null;
  return safeEqual(sig, hmac(serverSecret, `2fa|${userId}|${exp}`)) ? userId : null;
}

// ---------- Passwort zurücksetzen (durch Admin, ohne E-Mail) ----------

export const RESET_TTL_MS = 24 * 60 * 60_000;

/**
 * Ein Admin darf nur Konten zurücksetzen, die AUSSCHLIESSLICH zu seinem Betriebsrat gehören.
 * Sonst könnte ein Admin von Betriebsrat A ein Konto übernehmen, das auch in B Rechte hat.
 */
export async function createPasswordReset(
  db: DB,
  actor: Actor,
  targetUserId: string,
  opts: { resetTotp: boolean },
  now = new Date(),
) {
  assertCan(actor, "team.manage");
  const ms = await db.select({ tenantId: memberships.tenantId }).from(memberships).where(eq(memberships.userId, targetUserId));
  if (!ms.some((m) => m.tenantId === actor.tenantId)) throw notFound("Mitglied nicht gefunden.");
  if (ms.some((m) => m.tenantId !== actor.tenantId)) {
    throw invalid("Dieses Konto gehört auch zu einem anderen Betriebsrat und kann hier nicht zurückgesetzt werden. Bitte an den Betreiber wenden.");
  }
  const token = randomToken();
  await db.insert(passwordResets).values({
    userId: targetUserId,
    tenantId: actor.tenantId,
    tokenHash: sha256(token),
    resetTotp: opts.resetTotp,
    createdBy: actor.userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + RESET_TTL_MS),
  });
  await audit(db, actor, "member.password_reset_link", targetUserId, { resetTotp: opts.resetTotp });
  return token;
}

export async function getPasswordReset(db: DB, token: string, now = new Date()) {
  if (!token || token.length > 100) return null;
  const [r] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, expiresAt: passwordResets.expiresAt, usedAt: passwordResets.usedAt, resetTotp: passwordResets.resetTotp, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(eq(passwordResets.tokenHash, sha256(token)))
    .limit(1);
  if (!r || r.usedAt || r.expiresAt <= now) return null;
  return r;
}

export async function redeemPasswordReset(db: DB, token: string, newPassword: string, now = new Date()) {
  const r = await getPasswordReset(db, token, now);
  if (!r) throw notFound("Der Link ist ungültig, abgelaufen oder wurde bereits verwendet.");
  const hash = await hashSecret(newPassword);
  return db.transaction(async (tx) => {
    const used = await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(and(eq(passwordResets.id, r.id), isNull(passwordResets.usedAt)))
      .returning({ id: passwordResets.id });
    if (!used.length) throw notFound("Der Link wurde bereits verwendet.");
    await tx
      .update(users)
      .set({
        passwordHash: hash,
        ...(r.resetTotp ? { totpEnabled: false, totpSecretEnc: null, totpLastStep: null, recoveryCodeHashes: null } : {}),
      })
      .where(eq(users.id, r.userId));
    await tx.delete(sessions).where(eq(sessions.userId, r.userId));
    // weitere offene Links desselben Kontos entwerten
    await tx.delete(passwordResets).where(and(eq(passwordResets.userId, r.userId), isNull(passwordResets.usedAt)));
    return { userId: r.userId };
  });
}

/**
 * Betreiber-Werkzeug (nur Kommandozeile, nie über die Weboberfläche erreichbar):
 * neues Passwort für ein Konto setzen, z. B. wenn der einzige Admin es vergessen hat.
 * Beendet alle Sitzungen des Kontos; optional wird auch die Zwei-Faktor-Anmeldung abgeschaltet.
 */
export async function operatorSetPassword(db: DB, email: string, newPassword: string, opts: { resetTotp?: boolean } = {}) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!u) throw notFound("Kein Konto mit dieser E-Mail-Adresse.");
  await db
    .update(users)
    .set({
      passwordHash: await hashSecret(newPassword),
      ...(opts.resetTotp ? { totpEnabled: false, totpSecretEnc: null, totpLastStep: null, recoveryCodeHashes: null } : {}),
    })
    .where(eq(users.id, u.id));
  await destroyUserSessions(db, u.id);
  return u.id;
}
