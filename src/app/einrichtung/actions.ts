"use server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { env, sessionSecret } from "@/lib/env";
import { safeEqual } from "@/lib/auth/crypto";
import { createSession } from "@/lib/services/auth";
import { createTenant } from "@/lib/services/tenants";
import { consume, limitKey, LIMITS } from "@/lib/services/rate-limit";
import { setupSchema } from "@/lib/validation/schemas";
import { clientIp, setSessionCookie } from "@/lib/server/context";
import { toActionState, type ActionState } from "@/lib/server/action-result";
import { localFirstSetupAllowed } from "@/lib/server/setup";

/**
 * Einrichtung eines neuen Betriebsrats. Nur möglich, wenn der Betreiber ein
 * SETUP_TOKEN gesetzt hat und dieses korrekt eingegeben wird.
 * Ausnahme: allererste Einrichtung beim lokalen Ausprobieren (siehe localFirstSetupAllowed).
 */
export async function setupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const db = await getDb();
    const localFirst = await localFirstSetupAllowed();
    const configured = env().SETUP_TOKEN;
    if (!localFirst && (!configured || configured.length < 16)) {
      return { ok: false, error: "Die Einrichtung ist auf diesem Server deaktiviert (SETUP_TOKEN fehlt oder ist zu kurz)." };
    }
    await consume(db, limitKey(sessionSecret(), LIMITS.setupByIp, await clientIp()), LIMITS.setupByIp);
    const data = setupSchema.parse(Object.fromEntries(fd));
    if (!localFirst && !safeEqual(data.token, configured ?? "")) return { ok: false, error: "Das Einrichtungs-Token ist falsch." };
    const { tenant, userId } = await createTenant(db, {
      slug: data.slug,
      name: data.tenantName,
      companyName: data.companyName,
      adminEmail: data.adminEmail,
      adminName: data.adminName,
      adminPassword: data.adminPassword,
    });
    await setSessionCookie(await createSession(db, userId));
    slug = tenant.slug;
  } catch (err) {
    return toActionState(err);
  }
  redirect(`/admin/${slug}?willkommen=1`);
}
