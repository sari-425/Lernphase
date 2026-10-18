"use server";
/**
 * Server-Aktionen der Verwaltung.
 * Jede Aktion lädt Benutzer + Rolle für GENAU diesen Betriebsrat neu (requireActor)
 * und die Services prüfen die konkrete Berechtigung. Ausgeblendete Buttons sind
 * nur Komfort – die Sicherheit liegt hier.
 */
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireActor, setFlash } from "@/lib/server/context";
import { toActionState, type ActionState } from "@/lib/server/action-result";
import { processNow } from "@/lib/server/push-runtime";
import { categorySchema, contactSchema, legalTextsSchema, messageInputSchema, staffCodeSchema, tenantSettingsSchema } from "@/lib/validation/schemas";
import {
  addAttachment,
  archiveMessage,
  createMessage,
  deleteMessage,
  publishMessage,
  removeAttachment,
  revertToDraft,
  submitForReview,
  updateMessage,
  withdrawMessage,
} from "@/lib/services/messages";
import { sendTestPush, triggerPush } from "@/lib/services/push";
import { pushSender } from "@/lib/server/push-runtime";
import { consume, limitKey } from "@/lib/services/rate-limit";
import { sessionSecret } from "@/lib/env";
import {
  createInvitation,
  removeMember,
  revokeInvitation,
  setStaffAccessCode,
  updateMember,
  updateLegalTexts,
  updateTenantSettings,
} from "@/lib/services/tenants";
import {
  createCategory,
  createContact,
  deleteCategory,
  deleteContact,
  updateCategory,
  updateContact,
} from "@/lib/services/directory";
import { env } from "@/lib/env";
import { createPasswordReset } from "@/lib/services/account";
import { closePoll, createPoll, deletePoll, openPoll, updatePoll } from "@/lib/services/polls";
import { pollInputSchema } from "@/lib/validation/schemas";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

function messageFromForm(fd: FormData) {
  return messageInputSchema.parse({
    title: str(fd, "title"),
    body: str(fd, "body"),
    categoryId: str(fd, "categoryId"),
    priority: str(fd, "priority") || "normal",
    visibility: str(fd, "visibility") || undefined,
    publishAt: str(fd, "publishAt"),
    expiresAt: str(fd, "expiresAt"),
    linkUrl: str(fd, "linkUrl"),
    pushEnabled: fd.get("pushEnabled") === "on",
    pushTitle: str(fd, "pushTitle"),
    pushBody: str(fd, "pushBody"),
  });
}

// ---------- Mitteilungen ----------

export async function saveMessageAction(slug: string, id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let target: string;
  try {
    const { actor } = await requireActor(slug);
    const db = await getDb();
    const input = messageFromForm(fd);
    const m = id ? await updateMessage(db, actor, id, input) : await createMessage(db, actor, input);
    const intent = str(fd, "intent");
    if (intent === "review") await submitForReview(db, actor, m.id);
    target = intent === "preview" || intent === "review" ? `/admin/${slug}/mitteilungen/${m.id}/vorschau` : `/admin/${slug}/mitteilungen/${m.id}`;
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/admin/${slug}`, "layout");
  redirect(target);
}

export async function publishAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const res = await publishMessage(await getDb(), actor, id, {
      confirmPublic: fd.get("confirmPublic") === "on",
      confirmSensitive: fd.get("confirmSensitive") === "on",
    });
    if (res.dispatchCreated) after(processNow);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/b/${slug}`, "layout");
  redirect(`/admin/${slug}/mitteilungen/${id}`);
}

type Simple = (slug: string, id: string) => Promise<void>;

function simpleMessageAction(fn: (db: Awaited<ReturnType<typeof getDb>>, actor: Awaited<ReturnType<typeof requireActor>>["actor"], id: string) => Promise<unknown>, notice: string): Simple {
  return async (slug, id) => {
    const { actor } = await requireActor(slug);
    try {
      await fn(await getDb(), actor, id);
      await setFlash(notice);
    } catch (err) {
      await setFlash(toActionState(err).error ?? "Fehler", "error");
    }
    revalidatePath(`/b/${slug}`, "layout");
    redirect(`/admin/${slug}/mitteilungen/${id}`);
  };
}

export async function archiveAction(slug: string, id: string) {
  return simpleMessageAction(archiveMessage, "Mitteilung archiviert.")(slug, id);
}
export async function withdrawAction(slug: string, id: string) {
  return simpleMessageAction(withdrawMessage, "Mitteilung zurückgezogen – sie ist nicht mehr sichtbar.")(slug, id);
}
export async function revertAction(slug: string, id: string) {
  return simpleMessageAction(revertToDraft, "Mitteilung ist wieder ein Entwurf.")(slug, id);
}
export async function submitReviewAction(slug: string, id: string) {
  return simpleMessageAction(submitForReview, "Zur Freigabe eingereicht.")(slug, id);
}

export async function triggerPushAction(slug: string, id: string, _prev: ActionState): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    await triggerPush(await getDb(), actor, id);
    after(processNow);
    return { ok: true, notice: "Push-Benachrichtigung wurde zum Versand übergeben." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteMessageAction(slug: string, id: string, fd: FormData) {
  const { actor } = await requireActor(slug);
  if (fd.get("confirmDelete") !== "on") {
    await setFlash("Bitte das Löschen ausdrücklich bestätigen.", "error");
    redirect(`/admin/${slug}/mitteilungen/${id}`);
  }
  await deleteMessage(await getDb(), actor, id);
  revalidatePath(`/b/${slug}`, "layout");
  await setFlash("Mitteilung endgültig gelöscht.");
  redirect(`/admin/${slug}/mitteilungen`);
}

export async function uploadAttachmentAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Bitte eine Datei auswählen." };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Die Datei ist zu groß (maximal 5 MB)." };
    await addAttachment(await getDb(), actor, id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/admin/${slug}/mitteilungen/${id}`);
  return { ok: true, notice: "Anhang hochgeladen." };
}

export async function removeAttachmentAction(slug: string, messageId: string, attachmentId: string) {
  const { actor } = await requireActor(slug);
  await removeAttachment(await getDb(), actor, attachmentId);
  await setFlash("Anhang entfernt.");
  redirect(`/admin/${slug}/mitteilungen/${messageId}`);
}

// ---------- Team ----------

const inviteSchema = z.object({
  role: z.enum(["admin", "editor"]),
  canPublish: z.boolean(),
  note: z.string().trim().max(100).default(""),
});

export async function inviteAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const input = inviteSchema.parse({ role: str(fd, "role"), canPublish: fd.get("canPublish") === "on", note: str(fd, "note") });
    const token = await createInvitation(await getDb(), actor, input);
    const base = env().APP_URL ?? "";
    revalidatePath(`/admin/${slug}/team`);
    return { ok: true, notice: "Einladung erstellt. Der Link wird nur jetzt angezeigt.", data: { link: `${base}/einladung/${token}` } };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateMemberAction(slug: string, userId: string, fd: FormData) {
  const { actor } = await requireActor(slug);
  const role = str(fd, "role") === "admin" ? "admin" : "editor";
  let notice = "Rolle aktualisiert.";
  try {
    await updateMember(await getDb(), actor, userId, { role, canPublish: fd.get("canPublish") === "on" });
  } catch (err) {
    notice = toActionState(err).error ?? "Fehler";
    await setFlash(notice, "error");
  }
  if (notice === "Rolle aktualisiert.") await setFlash(notice);
  redirect(`/admin/${slug}/team`);
}

export async function removeMemberAction(slug: string, userId: string) {
  const { actor } = await requireActor(slug);
  let ok = true;
  try {
    await removeMember(await getDb(), actor, userId);
    await setFlash("Mitglied entfernt.");
  } catch (err) {
    ok = false;
    await setFlash(toActionState(err).error ?? "Fehler", "error");
  }
  if (ok && userId === actor.userId) redirect("/admin");
  redirect(`/admin/${slug}/team`);
}

export async function revokeInviteAction(slug: string, invitationId: string) {
  const { actor } = await requireActor(slug);
  await revokeInvitation(await getDb(), actor, invitationId);
  await setFlash("Einladung widerrufen.");
  redirect(`/admin/${slug}/team`);
}

// ---------- Einstellungen ----------

export async function settingsAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const input = tenantSettingsSchema.parse(Object.fromEntries(fd));
    await updateTenantSettings(await getDb(), actor, input);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/b/${slug}`, "layout");
  return { ok: true, notice: "Einstellungen gespeichert." };
}

export async function legalTextsAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const input = legalTextsSchema.parse(Object.fromEntries(fd));
    await updateLegalTexts(await getDb(), actor, input);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/b/${slug}`, "layout");
  revalidatePath(`/admin/${slug}/einstellungen`);
  return { ok: true, notice: "Angaben für Impressum und Datenschutz gespeichert." };
}

export async function staffCodeAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    if (str(fd, "intent") === "remove") {
      await setStaffAccessCode(await getDb(), actor, null);
      return { ok: true, notice: "Belegschafts-Zugang entfernt. Belegschafts-Mitteilungen sind jetzt nur noch für das Gremium sichtbar." };
    }
    const code = staffCodeSchema.parse(str(fd, "code"));
    await setStaffAccessCode(await getDb(), actor, code);
    return { ok: true, notice: "Neuer Zugangscode gespeichert. Bisherige Freischaltungen auf Geräten sind ungültig." };
  } catch (err) {
    return toActionState(err);
  }
}

// ---------- Kontakte & Kategorien ----------

export async function saveContactAction(slug: string, id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const input = contactSchema.parse(Object.fromEntries(fd));
    if (id) await updateContact(await getDb(), actor, id, input);
    else await createContact(await getDb(), actor, input);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/admin/${slug}/kontakte`);
  return { ok: true, notice: "Gespeichert." };
}

export async function deleteContactAction(slug: string, id: string) {
  const { actor } = await requireActor(slug);
  await deleteContact(await getDb(), actor, id);
  await setFlash("Ansprechpartner entfernt.");
  redirect(`/admin/${slug}/kontakte`);
}

export async function saveCategoryAction(slug: string, id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    const input = categorySchema.parse(Object.fromEntries(fd));
    if (id) await updateCategory(await getDb(), actor, id, input);
    else await createCategory(await getDb(), actor, input);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/admin/${slug}/kategorien`);
  return { ok: true, notice: "Gespeichert." };
}

export async function deleteCategoryAction(slug: string, id: string) {
  const { actor } = await requireActor(slug);
  try {
    await deleteCategory(await getDb(), actor, id);
    await setFlash("Kategorie gelöscht.");
  } catch (err) {
    await setFlash(toActionState(err).error ?? "Fehler", "error");
  }
  redirect(`/admin/${slug}/kategorien`);
}

export async function passwordResetAction(slug: string, userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    if (userId === actor.userId) return { ok: false, error: "Ihr eigenes Passwort ändern Sie unter „Mein Konto“." };
    const token = await createPasswordReset(await getDb(), actor, userId, { resetTotp: fd.get("resetTotp") === "on" });
    return { ok: true, notice: "Link erstellt (24 Stunden gültig, einmal nutzbar). Bitte persönlich weitergeben.", data: { link: `${env().APP_URL ?? ""}/passwort/${token}` } };
  } catch (err) {
    return toActionState(err);
  }
}

// ---------- Umfragen ----------

function pollFromForm(fd: FormData) {
  return pollInputSchema.parse({
    question: str(fd, "question"),
    description: str(fd, "description"),
    options: str(fd, "options").split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    visibility: str(fd, "visibility") || undefined,
    closesAt: str(fd, "closesAt"),
    resultsPublic: fd.get("resultsPublic") === "on",
  });
}

export async function savePollAction(slug: string, id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let target: string;
  try {
    const { actor } = await requireActor(slug);
    const input = pollFromForm(fd);
    if (id) {
      await updatePoll(await getDb(), actor, id, input);
      target = `/admin/${slug}/umfragen/${id}`;
    } else {
      const p = await createPoll(await getDb(), actor, input);
      target = `/admin/${slug}/umfragen/${p.id}`;
    }
    await setFlash("Umfrage gespeichert (Entwurf).");
  } catch (err) {
    return toActionState(err);
  }
  redirect(target);
}

export async function openPollAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireActor(slug);
    await openPoll(await getDb(), actor, id, { confirmPublic: fd.get("confirmPublic") === "on" });
    await setFlash("Umfrage gestartet.");
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/b/${slug}`, "layout");
  redirect(`/admin/${slug}/umfragen/${id}`);
}

export async function closePollAction(slug: string, id: string) {
  const { actor } = await requireActor(slug);
  try {
    await closePoll(await getDb(), actor, id);
    await setFlash("Umfrage beendet. Die Gerätekennungen wurden gelöscht, nur die Zählung bleibt.");
  } catch (err) {
    await setFlash(toActionState(err).error ?? "Fehler", "error");
  }
  revalidatePath(`/b/${slug}`, "layout");
  redirect(`/admin/${slug}/umfragen/${id}`);
}

export async function deletePollAction(slug: string, id: string, fd: FormData) {
  const { actor } = await requireActor(slug);
  if (fd.get("confirmDelete") !== "on") {
    await setFlash("Bitte das Löschen ausdrücklich bestätigen.", "error");
    redirect(`/admin/${slug}/umfragen/${id}`);
  }
  await deletePoll(await getDb(), actor, id);
  await setFlash("Umfrage gelöscht.");
  revalidatePath(`/b/${slug}`, "layout");
  redirect(`/admin/${slug}/umfragen`);
}

const TEST_PUSH_LIMIT = { scope: "test-push", max: 5, windowMs: 10 * 60_000 };

export async function testPushAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { tenant, actor } = await requireActor(slug);
    const sender = pushSender();
    if (!sender) return { ok: false, error: "Push ist auf dem Server nicht eingerichtet (VAPID-Schlüssel fehlen)." };
    const db = await getDb();
    await consume(db, limitKey(sessionSecret(), TEST_PUSH_LIMIT, actor.userId), TEST_PUSH_LIMIT);
    const endpoint = str(fd, "endpoint");
    if (!endpoint.startsWith("https://")) return { ok: false, error: "Auf diesem Gerät ist kein Push-Abo vorhanden." };
    const code = await sendTestPush(db, sender, tenant, endpoint);
    return { ok: true, notice: `Vom Push-Dienst angenommen (HTTP ${code}). Die Benachrichtigung sollte in wenigen Sekunden erscheinen. Kommt nichts an: Mitteilungen/Fokus-Modus des Geräts prüfen.` };
  } catch (err) {
    return toActionState(err);
  }
}
