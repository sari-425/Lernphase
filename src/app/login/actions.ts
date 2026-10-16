"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { createSession, destroySession, listUserTenants, login } from "@/lib/services/auth";
import { pendingLoginToken, readPendingLoginToken, verifySecondFactor } from "@/lib/services/account";
import { clearSessionCookie, clientIp, PENDING_2FA_COOKIE, SESSION_COOKIE, setPendingLogin, setSessionCookie } from "@/lib/server/context";
import { toActionState, type ActionState } from "@/lib/server/action-result";

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let target = "/admin";
  try {
    const email = String(fd.get("email") ?? "").slice(0, 254);
    const password = String(fd.get("password") ?? "").slice(0, 200);
    if (!email || !password) return { ok: false, error: "Bitte E-Mail-Adresse und Passwort eingeben." };
    const db = await getDb();
    const res = await login(db, sessionSecret(), { email, password, ip: await clientIp() });
    if (res.kind === "second-factor") {
      await setPendingLogin(pendingLoginToken(sessionSecret(), res.user.id));
      target = "/login/code";
    } else {
      await setSessionCookie(res.token);
      const tenants = await listUserTenants(db, res.user.id);
      if (tenants.length === 1) target = `/admin/${tenants[0].slug}`;
    }
  } catch (err) {
    return toActionState(err);
  }
  redirect(target);
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await destroySession(await getDb(), token);
  await clearSessionCookie();
  redirect("/login?abgemeldet=1");
}

/** Zweiter Schritt: Code aus der Authenticator-App oder Wiederherstellungscode. */
export async function secondFactorAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let target = "/admin";
  try {
    const db = await getDb();
    const jar = await cookies();
    const userId = readPendingLoginToken(sessionSecret(), jar.get(PENDING_2FA_COOKIE)?.value);
    if (!userId) return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte erneut mit E-Mail und Passwort anmelden." };
    const used = await verifySecondFactor(db, sessionSecret(), userId, String(fd.get("code") ?? "").slice(0, 40));
    jar.delete(PENDING_2FA_COOKIE);
    await setSessionCookie(await createSession(db, userId));
    const tenants = await listUserTenants(db, userId);
    if (tenants.length === 1) target = `/admin/${tenants[0].slug}`;
    if (used === "recovery") target = "/konto?wiederherstellung=1";
  } catch (err) {
    return toActionState(err);
  }
  redirect(target);
}
