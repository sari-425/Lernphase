"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { cookieSecure, sessionSecret } from "@/lib/env";
import { DEVICE_COOKIE, loadTenant, readerAccess } from "@/lib/server/context";
import { newDeviceToken, vote } from "@/lib/services/polls";
import { toActionState, type ActionState } from "@/lib/server/action-result";

export async function voteAction(slug: string, pollId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const tenant = await loadTenant(slug);
    const access = await readerAccess(slug);
    const jar = await cookies();
    let device = jar.get(DEVICE_COOKIE)?.value;
    if (!device || device.length < 20 || device.length > 64) {
      device = newDeviceToken();
      // zufälliger Wert ohne Personenbezug, nur um Doppelabstimmung je Gerät zu erschweren
      jar.set(DEVICE_COOKIE, device, { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/", maxAge: 365 * 24 * 3600 });
    }
    const optionId = String(fd.get("option") ?? "");
    if (!optionId) return { ok: false, error: "Bitte eine Antwort auswählen." };
    await vote(await getDb(), sessionSecret(), { tenantId: tenant.id, pollId, optionId, deviceToken: device, access });
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/b/${slug}/umfragen`);
  return { ok: true, notice: "Danke! Ihre Stimme wurde anonym gezählt." };
}
