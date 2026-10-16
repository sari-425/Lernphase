import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { getMessageForEditor } from "@/lib/services/messages";
import { listCategories } from "@/lib/services/directory";
import { can } from "@/lib/auth/permissions";
import { MessageForm } from "@/components/message-form";
import { AttachmentUpload, PushTrigger } from "@/components/action-forms";
import { PageTitle, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime, toBerlinLocalInput } from "@/lib/time";
import {
  archiveAction,
  deleteMessageAction,
  removeAttachmentAction,
  revertAction,
  saveMessageAction,
  triggerPushAction,
  uploadAttachmentAction,
  withdrawAction,
} from "@/app/admin/[slug]/actions";

export const metadata = { title: "Mitteilung bearbeiten" };

const DISPATCH: Record<string, string> = { pending: "wartet auf Versand", sending: "wird gesendet", done: "an Push-Dienste übergeben", failed: "fehlgeschlagen", skipped: "verworfen" };

export default async function EditMessage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { tenant, actor } = await requireActor(slug);
  const db = await getDb();
  const { message: m, attachments, dispatch } = await getMessageForEditor(db, actor, id);
  const cats = await listCategories(db, tenant.id);
  const canPublish = can(actor, "message.publish");
  const editable = ["draft", "review"].includes(m.status) || canPublish;
  const scheduled = m.status === "published" && m.publishAt && m.publishAt > new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Link href={`/admin/${slug}/mitteilungen`} className="link">← Alle Mitteilungen</Link>
        </div>
        <PageTitle sub={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={scheduled ? "scheduled" : m.status} /> zuletzt geändert {formatDateTime(m.updatedAt)}</span>}>
          Mitteilung bearbeiten
        </PageTitle>
        <MessageForm
          action={saveMessageAction.bind(null, slug, id)}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          isNew={false}
          canPublish={canPublish}
          locked={!["draft", "review"].includes(m.status)}
          initial={{
            title: m.title,
            body: m.body,
            categoryId: m.categoryId ?? "",
            priority: m.priority,
            visibility: m.visibility,
            publishAt: m.status === "draft" || m.status === "review" || scheduled ? toBerlinLocalInput(m.publishAt) : toBerlinLocalInput(m.publishAt),
            expiresAt: toBerlinLocalInput(m.expiresAt),
            linkUrl: m.linkUrl ?? "",
            pushEnabled: m.pushEnabled,
            pushTitle: m.pushTitle,
            pushBody: m.pushBody,
          }}
        />
      </div>

      <aside className="space-y-4">
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Veröffentlichung</h2>
          <Link href={`/admin/${slug}/mitteilungen/${id}/vorschau`} className="btn-primary w-full">
            {["draft", "review", "archived"].includes(m.status) && canPublish ? "Vorschau & veröffentlichen" : "Vorschau"}
          </Link>
          {m.status === "published" && !scheduled ? (
            <a href={`/b/${slug}/mitteilungen/${id}`} className="btn-ghost w-full" target="_blank" rel="noopener">Live ansehen ↗</a>
          ) : null}
          {can(actor, "message.archive") && m.status === "published" ? (
            <form action={archiveAction.bind(null, slug, id)}>
              <SubmitButton className="btn-secondary w-full">Archivieren</SubmitButton>
            </form>
          ) : null}
          {can(actor, "message.archive") && ["published", "archived"].includes(m.status) ? (
            <form action={withdrawAction.bind(null, slug, id)}>
              <SubmitButton className="btn-danger w-full">Zurückziehen (sofort unsichtbar)</SubmitButton>
            </form>
          ) : null}
          {m.status !== "draft" && (m.status === "review" || can(actor, "message.archive")) ? (
            <form action={revertAction.bind(null, slug, id)}>
              <SubmitButton className="btn-ghost w-full">Zurück zu Entwurf</SubmitButton>
            </form>
          ) : null}
        </section>

        {m.visibility !== "council" ? (
          <section className="card space-y-2">
            <h2 className="text-lg font-bold">Push</h2>
            {dispatch ? (
              <p className="text-sm">
                Status: <strong>{DISPATCH[dispatch.status]}</strong>
                {dispatch.status === "done" ? <> – {dispatch.acceptedCount} von {dispatch.targetCount} Geräten übergeben{dispatch.removedCount ? `, ${dispatch.removedCount} abgelaufene Abos entfernt` : ""}.</> : null}
                {dispatch.status === "pending" ? <> – frühestens {formatDateTime(dispatch.notBefore)}</> : null}
                {dispatch.note ? <span className="block text-muted">{dispatch.note}</span> : null}
              </p>
            ) : m.status === "published" && can(actor, "push.send") ? (
              <PushTrigger action={triggerPushAction.bind(null, slug, id)} />
            ) : (
              <p className="text-sm text-muted">{m.pushEnabled ? "Wird bei Veröffentlichung gesendet." : "Kein Push vorgesehen."}</p>
            )}
            <p className="text-xs text-muted">Pro Mitteilung wird höchstens einmal gepusht.</p>
          </section>
        ) : null}

        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Anhänge</h2>
          {attachments.length ? (
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <a className="link truncate" href={`/b/${slug}/anhang/${a.id}`}>📎 {a.filename}</a>
                  {editable ? (
                    <form action={removeAttachmentAction.bind(null, slug, id, a.id)}>
                      <button className="btn-ghost px-2 text-sm text-red-800" type="submit" aria-label={`${a.filename} entfernen`}>Entfernen</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Keine Anhänge.</p>
          )}
          {editable && attachments.length < 3 ? <AttachmentUpload action={uploadAttachmentAction.bind(null, slug, id)} /> : null}
        </section>

        {can(actor, "message.delete") ? (
          <section className="card space-y-3 border-red-200">
            <h2 className="text-lg font-bold text-red-900">Endgültig löschen</h2>
            <form action={deleteMessageAction.bind(null, slug, id)} className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="confirmDelete" required className="mt-0.5 h-5 w-5" />
                Ich möchte diese Mitteilung samt Anhängen und Versandprotokoll unwiderruflich löschen.
              </label>
              <SubmitButton className="btn-danger w-full">Endgültig löschen</SubmitButton>
            </form>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
