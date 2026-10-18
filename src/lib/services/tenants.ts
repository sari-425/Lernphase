import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import {
  categories,
  invitations,
  memberships,
  pushSubscriptions,
  tenants,
  users,
  type Role,
  type Tenant,
} from "@/lib/db/schema";
import { hashSecret, hmac, randomToken, safeEqual, sha256, verifySecret } from "@/lib/auth/crypto";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { AppError, invalid, notFound } from "@/lib/errors";
import { audit } from "./audit";
import { destroyUserSessions } from "./auth";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "logout", "einrichtung", "einladung", "datenschutz", "impressum",
  "offline", "static", "public", "b", "app", "www", "hilfe", "sw", "manifest",
]);

export const DEFAULT_CATEGORIES: Array<[string, string]> = [
  ["betriebsratsarbeit", "Aktuelle Betriebsratsarbeit"],
  ["betriebsversammlung", "Betriebsversammlungen"],
  ["arbeitszeit", "Arbeitszeit"],
  ["tarif-betriebsvereinbarungen", "Tarif & Betriebsvereinbarungen"],
  ["arbeits-gesundheitsschutz", "Arbeits- & Gesundheitsschutz"],
  ["betriebliche-veraenderungen", "Betriebliche Veränderungen"],
  ["umfragen", "Umfragen & Abstimmungen"],
  ["allgemein", "Allgemein"],
];

export async function getTenantBySlug(db: DB, slug: string): Promise<Tenant | null> {
  if (!/^[a-z0-9-]{1,48}$/.test(slug)) return null;
  const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return t ?? null;
}

export async function countTenants(db: DB) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(tenants);
  return r?.n ?? 0;
}

/** Legt einen neuen Betriebsrat (Mandanten) samt erstem Administrator an. */
export async function createTenant(
  db: DB,
  input: { slug: string; name: string; companyName?: string; adminEmail: string; adminName: string; adminPassword: string },
) {
  if (RESERVED_SLUGS.has(input.slug)) throw invalid("Diese Kurzadresse ist reserviert.");
  const passwordHash = await hashSecret(input.adminPassword);
  return db.transaction(async (tx) => {
    const [exists] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, input.slug)).limit(1);
    if (exists) throw new AppError("CONFLICT", "Diese Kurzadresse ist bereits vergeben.");
    const [tenant] = await tx
      .insert(tenants)
      .values({ slug: input.slug, name: input.name, companyName: input.companyName ?? "" })
      .returning();
    let [user] = await tx.select().from(users).where(eq(users.email, input.adminEmail)).limit(1);
    if (user) {
      // Bestehendes Konto nur mit korrektem Passwort verknüpfen (keine Kontoübernahme)
      if (!(await verifySecret(input.adminPassword, user.passwordHash))) {
        throw new AppError("CONFLICT", "Für diese E-Mail-Adresse existiert bereits ein Konto mit anderem Passwort.");
      }
    } else {
      [user] = await tx
        .insert(users)
        .values({ email: input.adminEmail, displayName: input.adminName, passwordHash })
        .returning();
    }
    await tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, role: "admin", canPublish: true });
    await tx.insert(categories).values(
      DEFAULT_CATEGORIES.map(([slug, name], i) => ({ tenantId: tenant.id, slug, name, sortOrder: i * 10 })),
    );
    return { tenant, userId: user.id };
  });
}

export async function updateTenantSettings(
  db: DB,
  actor: Actor,
  input: { name: string; companyName: string; slogan: string; sloganSub: string; welcomeText: string },
) {
  assertCan(actor, "settings.manage");
  await db.update(tenants).set(input).where(eq(tenants.id, actor.tenantId));
  await audit(db, actor, "settings.update");
}

/** Angaben für Impressum und Datenschutzerklärung dieses Betriebsrats. */
export async function updateLegalTexts(
  db: DB,
  actor: Actor,
  input: {
    imprintText: string;
    privacyController: string;
    privacyCouncilContact: string;
    privacyDpo: string;
    privacyAuthority: string;
    privacyHosting: string;
  },
  now = new Date(),
) {
  assertCan(actor, "settings.manage");
  await db.update(tenants).set({ ...input, legalUpdatedAt: now }).where(eq(tenants.id, actor.tenantId));
  await audit(db, actor, "legal.update");
}

// ---------- Belegschafts-Zugang ----------

/**
 * Setzt (oder entfernt mit null) den Belegschafts-Zugangscode.
 * Jede Änderung erhöht die Version: bisher ausgegebene Zugänge werden ungültig.
 */
export async function setStaffAccessCode(db: DB, actor: Actor, code: string | null) {
  assertCan(actor, "settings.manage");
  const hash = code ? await hashSecret(code) : null;
  await db
    .update(tenants)
    .set({ staffAccessCodeHash: hash, staffAccessVersion: sql`${tenants.staffAccessVersion} + 1` })
    .where(eq(tenants.id, actor.tenantId));
  await audit(db, actor, code ? "staff_code.set" : "staff_code.remove");
}

export async function verifyStaffCode(tenant: Tenant, code: string) {
  if (!tenant.staffAccessCodeHash) return false;
  return verifySecret(code.trim(), tenant.staffAccessCodeHash);
}

/** Wert des Belegschafts-Cookies: HMAC über Mandant + Codeversion (enthält keine Personendaten). */
export function staffAccessToken(secret: string, tenant: Pick<Tenant, "id" | "staffAccessVersion">) {
  return hmac(secret, `staff|${tenant.id}|${tenant.staffAccessVersion}`);
}

export function hasStaffAccess(secret: string, tenant: Tenant, cookieValue: string | undefined) {
  if (!cookieValue || !tenant.staffAccessCodeHash) return false;
  return safeEqual(cookieValue, staffAccessToken(secret, tenant));
}

// ---------- Team ----------

export const INVITATION_TTL_MS = 72 * 60 * 60_000;

export async function listTeam(db: DB, actor: Actor) {
  assertCan(actor, "team.manage");
  const members = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      role: memberships.role,
      canPublish: memberships.canPublish,
      since: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.tenantId, actor.tenantId))
    .orderBy(asc(users.displayName));
  const openInvites = await db
    .select({
      id: invitations.id,
      role: invitations.role,
      canPublish: invitations.canPublish,
      note: invitations.note,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(and(eq(invitations.tenantId, actor.tenantId), isNull(invitations.usedAt)))
    .orderBy(asc(invitations.expiresAt));
  return { members, openInvites };
}

export async function createInvitation(
  db: DB,
  actor: Actor,
  input: { role: Role; canPublish: boolean; note: string },
  now = new Date(),
) {
  assertCan(actor, "team.manage");
  const token = randomToken();
  await db.insert(invitations).values({
    tenantId: actor.tenantId,
    tokenHash: sha256(token),
    role: input.role,
    canPublish: input.role === "admin" ? true : input.canPublish,
    note: input.note.slice(0, 100),
    createdBy: actor.userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
  });
  await audit(db, actor, "invite.create", null, { role: input.role });
  return token;
}

export async function revokeInvitation(db: DB, actor: Actor, invitationId: string) {
  assertCan(actor, "team.manage");
  await db.delete(invitations).where(and(eq(invitations.id, invitationId), eq(invitations.tenantId, actor.tenantId)));
}

export async function getInvitation(db: DB, token: string, now = new Date()) {
  const [inv] = await db
    .select({
      id: invitations.id,
      tenantId: invitations.tenantId,
      role: invitations.role,
      canPublish: invitations.canPublish,
      expiresAt: invitations.expiresAt,
      usedAt: invitations.usedAt,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .where(eq(invitations.tokenHash, sha256(token)))
    .limit(1);
  if (!inv || inv.usedAt || inv.expiresAt <= now) return null;
  return inv;
}

export async function acceptInvitation(
  db: DB,
  token: string,
  input: { email: string; displayName: string; password: string },
  now = new Date(),
) {
  const inv = await getInvitation(db, token, now);
  if (!inv) throw notFound("Die Einladung ist ungültig, abgelaufen oder wurde bereits verwendet.");
  const newHash = await hashSecret(input.password);
  return db.transaction(async (tx) => {
    // Einladung atomar "verbrauchen" – verhindert doppelte Nutzung
    const used = await tx
      .update(invitations)
      .set({ usedAt: now })
      .where(and(eq(invitations.id, inv.id), isNull(invitations.usedAt)))
      .returning({ id: invitations.id });
    if (used.length === 0) throw notFound("Die Einladung wurde bereits verwendet.");
    let [user] = await tx.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (user) {
      if (!(await verifySecret(input.password, user.passwordHash))) {
        throw new AppError(
          "CONFLICT",
          "Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte dessen Passwort verwenden.",
        );
      }
    } else {
      [user] = await tx
        .insert(users)
        .values({ email: input.email, displayName: input.displayName, passwordHash: newHash })
        .returning();
    }
    const [already] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.tenantId, inv.tenantId), eq(memberships.userId, user.id)));
    if (already) throw new AppError("CONFLICT", "Sie sind bereits Mitglied dieses Betriebsrats.");
    await tx.insert(memberships).values({
      tenantId: inv.tenantId,
      userId: user.id,
      role: inv.role,
      canPublish: inv.canPublish,
    });
    return { userId: user.id, tenantSlug: inv.tenantSlug };
  });
}

async function adminCount(db: DB, tenantId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, "admin")));
  return r?.n ?? 0;
}

export async function updateMember(db: DB, actor: Actor, userId: string, input: { role: Role; canPublish: boolean }) {
  assertCan(actor, "team.manage");
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.userId, userId)));
  if (!m) throw notFound("Mitglied nicht gefunden.");
  if (m.role === "admin" && input.role !== "admin" && (await adminCount(db, actor.tenantId)) <= 1) {
    throw invalid("Es muss mindestens ein Administrator bleiben.");
  }
  await db
    .update(memberships)
    .set({ role: input.role, canPublish: input.role === "admin" ? true : input.canPublish })
    .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.userId, userId)));
  await audit(db, actor, "member.update", userId, { role: input.role, canPublish: input.canPublish });
}

/**
 * Entfernt ein Mitglied aus DIESEM Betriebsrat. Hat das Konto danach keine weitere
 * Mitgliedschaft, wird es vollständig gelöscht (Datenminimierung).
 */
export async function removeMember(db: DB, actor: Actor, userId: string) {
  assertCan(actor, "team.manage");
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.userId, userId)));
  if (!m) throw notFound("Mitglied nicht gefunden.");
  if (m.role === "admin" && (await adminCount(db, actor.tenantId)) <= 1) {
    throw invalid("Der letzte Administrator kann nicht entfernt werden.");
  }
  await db.delete(memberships).where(and(eq(memberships.tenantId, actor.tenantId), eq(memberships.userId, userId)));
  const rest = await db.select({ t: memberships.tenantId }).from(memberships).where(eq(memberships.userId, userId));
  if (rest.length === 0) {
    await destroyUserSessions(db, userId);
    await db.delete(users).where(eq(users.id, userId));
  }
  await audit(db, actor, "member.remove", userId);
}

/** Löscht einen gesamten Mandanten mit allen Inhalten (Betreiber-Funktion, nur per CLI). */
export async function deleteTenant(db: DB, tenantId: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  // Konten ohne verbleibende Mitgliedschaft entfernen
  await db.execute(sql`DELETE FROM users u WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)`);
}
