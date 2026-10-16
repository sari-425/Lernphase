"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { acceptInvitation } from "@/lib/services/tenants";
import { createSession } from "@/lib/services/auth";
import { consume, limitKey, LIMITS } from "@/lib/services/rate-limit";
import { displayNameSchema, emailSchema, passwordSchema } from "@/lib/validation/schemas";
import { clientIp, setSessionCookie } from "@/lib/server/context";
import { toActionState, type ActionState } from "@/lib/server/action-result";

const schema = z.object({ displayName: displayNameSchema, email: emailSchema, password: passwordSchema });

export async function acceptInviteAction(token: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const db = await getDb();
    await consume(db, limitKey(sessionSecret(), LIMITS.inviteByIp, await clientIp()), LIMITS.inviteByIp);
    const data = schema.parse(Object.fromEntries(fd));
    const res = await acceptInvitation(db, token, data);
    await setSessionCookie(await createSession(db, res.userId));
    slug = res.tenantSlug;
  } catch (err) {
    return toActionState(err);
  }
  redirect(`/admin/${slug}`);
}
