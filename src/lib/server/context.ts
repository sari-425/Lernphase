import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { cookieSecure, env, sessionSecret } from "@/lib/env";
import { getActor, validateSession, type SessionUser } from "@/lib/services/auth";
import { getTenantBySlug, hasStaffAccess } from "@/lib/services/tenants";
import type { Access } from "@/lib/services/messages";
import type { Actor } from "@/lib/auth/permissions";
import type { Tenant } from "@/lib/db/schema";

export const SESSION_COOKIE = "brd_session";
/** zufälliger Gerätewert nur gegen Doppelabstimmung bei Umfragen */
export const DEVICE_COOKIE = "brd_device";
export const staffCookieName = (slug: string) => `brd_staff_${slug.replace(/-/g, "_")}`;

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

export const PENDING_2FA_COOKIE = "brd_2fa";

export async function setPendingLogin(value: string) {
  (await cookies()).set(PENDING_2FA_COOKIE, value, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60,
  });
}

export async function currentSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setStaffCookie(slug: string, value: string) {
  (await cookies()).set(staffCookieName(slug), value, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: `/`,
    maxAge: 180 * 24 * 3600,
  });
}

export async function clearStaffCookie(slug: string) {
  (await cookies()).delete(staffCookieName(slug));
}

/** Angemeldeter Benutzer der aktuellen Anfrage (oder null). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(await getDb(), token);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export const loadTenant = cache(async (slug: string): Promise<Tenant> => {
  const tenant = await getTenantBySlug(await getDb(), slug);
  if (!tenant) notFound();
  return tenant;
});

/** Für die Verwaltung: Benutzer MUSS Mitglied genau dieses Betriebsrats sein. */
export async function requireActor(slug: string): Promise<{ tenant: Tenant; actor: Actor; user: SessionUser }> {
  const user = await requireUser();
  const tenant = await loadTenant(slug);
  const actor = await getActor(await getDb(), user.id, tenant.id);
  if (!actor) notFound(); // kein Hinweis, dass der Bereich existiert
  return { tenant, actor, user };
}

/** Leserechte der aktuellen Anfrage für einen Betriebsrat. */
export const readerAccess = cache(async (slug: string): Promise<Access & { member: Actor | null }> => {
  const tenant = await loadTenant(slug);
  const staffValue = (await cookies()).get(staffCookieName(slug))?.value;
  const user = await getSessionUser();
  const member = user ? await getActor(await getDb(), user.id, tenant.id) : null;
  return {
    staff: hasStaffAccess(sessionSecret(), tenant, staffValue),
    council: Boolean(member),
    member,
  };
});

/**
 * Client-IP nur für die Ratenbegrenzung (wird sofort gehasht, nie gespeichert).
 * Hinter einem Reverse Proxy TRUST_PROXY=true setzen.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  if (env().TRUST_PROXY) {
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  return h.get("x-forwarded-for")?.split(",").pop()?.trim() || "unbekannt";
}

// ---------- Kurzlebige Hinweise ("Flash") ----------
// Nur der Server kann sie setzen (kein manipulierbarer URL-Parameter).
const FLASH_COOKIE = "brd_flash";

export async function setFlash(text: string, kind: "success" | "error" = "success") {
  (await cookies()).set(FLASH_COOKIE, JSON.stringify({ text: text.slice(0, 300), kind }), {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 15,
  });
}

export async function readFlash(): Promise<{ text: string; kind: "success" | "error" } | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v.text === "string" ? { text: v.text, kind: v.kind === "error" ? "error" : "success" } : null;
  } catch {
    return null;
  }
}
