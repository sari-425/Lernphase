"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { destroySession, listUserTenants, login } from "@/lib/services/auth";
import { clearSessionCookie, clientIp, SESSION_COOKIE, setSessionCookie } from "@/lib/server/context";
import { toActionState, type ActionState } from "@/lib/server/action-result";

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let target = "/admin";
  try {
    const email = String(fd.get("email") ?? "").slice(0, 254);
    const password = String(fd.get("password") ?? "").slice(0, 200);
    if (!email || !password) return { ok: false, error: "Bitte E-Mail-Adresse und Passwort eingeben." };
    const db = await getDb();
    const { token, user } = await login(db, sessionSecret(), { email, password, ip: await clientIp() });
    await setSessionCookie(token);
    const tenants = await listUserTenants(db, user.id);
    if (tenants.length === 1) target = `/admin/${tenants[0].slug}`;
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
