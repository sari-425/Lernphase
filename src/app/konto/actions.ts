"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { otpauthUri } from "@/lib/auth/totp";
import {
  beginTotpSetup,
  changeDisplayName,
  changePassword,
  confirmTotpSetup,
  disableTotp,
  logoutOtherSessions,
  redeemPasswordReset,
} from "@/lib/services/account";
import { createSession } from "@/lib/services/auth";
import { consume, limitKey, LIMITS } from "@/lib/services/rate-limit";
import { displayNameSchema, passwordSchema } from "@/lib/validation/schemas";
import { clientIp, currentSessionToken, requireUser, setSessionCookie } from "@/lib/server/context";
import { toActionState, type ActionState } from "@/lib/server/action-result";

export async function nameAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    await changeDisplayName(await getDb(), user.id, displayNameSchema.parse(fd.get("displayName")));
    return { ok: true, notice: "Name gespeichert." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function passwordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const next = passwordSchema.parse(fd.get("next"));
    if (next !== fd.get("repeat")) return { ok: false, error: "Die beiden neuen Passwörter stimmen nicht überein." };
    await changePassword(await getDb(), user.id, String(fd.get("current") ?? ""), next, await currentSessionToken());
    return { ok: true, notice: "Passwort geändert. Alle anderen Geräte wurden abgemeldet." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function logoutOthersAction(_p: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const token = await currentSessionToken();
  if (token) await logoutOtherSessions(await getDb(), user.id, token);
  return { ok: true, notice: "Alle anderen Geräte wurden abgemeldet." };
}

export async function totpBeginAction(_p: ActionState): Promise<ActionState> {
  try {
    const user = await requireUser();
    const { secret, email } = await beginTotpSetup(await getDb(), sessionSecret(), user.id);
    const qr = await QRCode.toDataURL(otpauthUri(secret, email), { margin: 1, width: 220, errorCorrectionLevel: "M" });
    return { ok: true, data: { secret, qr } };
  } catch (err) {
    return toActionState(err);
  }
}

export async function totpConfirmAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const codes = await confirmTotpSetup(await getDb(), sessionSecret(), user.id, String(fd.get("code") ?? ""));
    return { ok: true, notice: "Zwei-Faktor-Anmeldung ist aktiv.", data: { codes: codes.join("\n") } };
  } catch (err) {
    return toActionState(err);
  }
}

export async function totpDisableAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    await disableTotp(await getDb(), user.id, String(fd.get("password") ?? ""));
    return { ok: true, notice: "Zwei-Faktor-Anmeldung wurde ausgeschaltet." };
  } catch (err) {
    return toActionState(err);
  }
}

const resetSchema = z.object({ password: passwordSchema, repeat: z.string() });

export async function resetPasswordAction(token: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const db = await getDb();
    await consume(db, limitKey(sessionSecret(), LIMITS.inviteByIp, await clientIp()), LIMITS.inviteByIp);
    const data = resetSchema.parse(Object.fromEntries(fd));
    if (data.password !== data.repeat) return { ok: false, error: "Die beiden Passwörter stimmen nicht überein." };
    const { userId } = await redeemPasswordReset(db, token, data.password);
    await setSessionCookie(await createSession(db, userId));
  } catch (err) {
    return toActionState(err);
  }
  redirect("/admin");
}
