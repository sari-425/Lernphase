"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { clearStaffCookie, clientIp, loadTenant, setStaffCookie } from "@/lib/server/context";
import { staffAccessToken, verifyStaffCode } from "@/lib/services/tenants";
import { isLimited, limitKey, LIMITS, recordHit } from "@/lib/services/rate-limit";
import { AppError } from "@/lib/errors";
import { toActionState, type ActionState } from "@/lib/server/action-result";

/** Nur Ziele innerhalb DIESES Betriebsrats zulassen (kein Open Redirect). */
function safeNext(slug: string, next: unknown) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith(`/b/${slug}/`) && !s.includes("//") && !s.includes("\\") ? s : `/b/${slug}`;
}

export async function enterStaffCode(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let target: string;
  try {
    const db = await getDb();
    const tenant = await loadTenant(slug);
    const code = String(fd.get("code") ?? "").slice(0, 64);
    const secret = sessionSecret();
    const ip = await clientIp();
    const ipKey = limitKey(secret, LIMITS.staffCodeByIp, ip);
    const tenantKey = limitKey(secret, LIMITS.staffCodeByTenant, tenant.id);
    if ((await isLimited(db, ipKey, LIMITS.staffCodeByIp)) || (await isLimited(db, tenantKey, LIMITS.staffCodeByTenant))) {
      throw new AppError("RATE_LIMITED", "Zu viele Fehlversuche. Bitte warten Sie 15 Minuten.");
    }
    if (!tenant.staffAccessCodeHash) return { ok: false, error: "Für diesen Betriebsrat ist kein Belegschafts-Zugang eingerichtet." };
    if (!(await verifyStaffCode(tenant, code))) {
      // nur Fehlversuche zählen
      await recordHit(db, ipKey);
      await recordHit(db, tenantKey);
      return { ok: false, error: "Der Zugangscode ist nicht korrekt." };
    }
    await setStaffCookie(slug, staffAccessToken(secret, tenant));
    target = safeNext(slug, fd.get("weiter"));
  } catch (err) {
    return toActionState(err);
  }
  redirect(target);
}

export async function forgetStaffAccess(slug: string) {
  await clearStaffCookie(slug);
  redirect(`/b/${slug}`);
}
