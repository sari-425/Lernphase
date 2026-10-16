import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { getMessageForEditor, publishCheck } from "@/lib/services/messages";
import { listCategories } from "@/lib/services/directory";
import { can } from "@/lib/auth/permissions";
import { MessageBody } from "@/components/message-body";
import { PublishPanel } from "@/components/publish-panel";
import { Alert, PageTitle, PriorityBadge, StatusBadge, VisibilityBadge, visibilityLabel } from "@/components/ui";
import { DEFAULT_PUSH_BODY, DEFAULT_PUSH_TITLE, URGENT_PUSH_TITLE } from "@/lib/services/push";
import { formatDateTime } from "@/lib/time";
import { publishAction, submitReviewAction } from "@/app/admin/[slug]/actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Vorschau" };

export default async function Preview({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { tenant, actor } = await requireActor(slug);
  const db = await getDb();
  const { message: m, attachments } = await getMessageForEditor(db, actor, id);
  const cat = (await listCategories(db, tenant.id)).find((c) => c.id === m.categoryId);
  const check = publishCheck(m);
  const publishable = ["draft", "review", "archived"].includes(m.status);
  const future = m.publishAt && m.publishAt > new Date() ? formatDateTime(m.publishAt) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <p className="mb-2"><Link href={`/admin/${slug}/mitteilungen/${id}`} className="link">← Zurück zur Bearbeitung</Link></p>
        <PageTitle sub="So sehen Beschäftigte die Mitteilung.">Vorschau <StatusBadge status={m.status} /></PageTitle>
        <article className="card space-y-4 sm:p-7" aria-label="Vorschau der Mitteilung">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PriorityBadge priority={m.priority} />
            <VisibilityBadge visibility={m.visibility} />
            {cat ? <span className="text-muted">{cat.name}</span> : null}
          </div>
          <h2 className="text-2xl leading-tight font-bold text-brand-900 sm:text-3xl">{m.title}</h2>
          <MessageBody body={m.body} />
          {m.linkUrl || attachments.length ? (
            <ul className="border-t border-slate-200 pt-3">
              {m.linkUrl ? <li className="break-all">🔗 {m.linkUrl}</li> : null}
              {attachments.map((a) => <li key={a.id}>📎 {a.filename}</li>)}
            </ul>
          ) : null}
        </article>
        {m.pushEnabled && m.visibility !== "council" ? (
          <div className="mt-5">
            <h2 className="mb-2 font-bold">Push-Vorschau (Sperrbildschirm)</h2>
            <div className="flex max-w-sm gap-3 rounded-2xl bg-slate-800 p-3 text-white shadow">
              {/* eslint-disable-next-line @next/next/no-img-element -- kleines statisches Symbol */}
              <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
              <div className="min-w-0">
                <p className="font-semibold">{m.pushTitle || (m.priority === "urgent" ? URGENT_PUSH_TITLE : DEFAULT_PUSH_TITLE)}</p>
                <p className="text-sm text-white/85">{m.pushBody || DEFAULT_PUSH_BODY}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <aside className="space-y-4">
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Veröffentlichen</h2>
          {!publishable ? (
            <Alert kind="info">Diese Mitteilung ist bereits {m.status === "published" ? "veröffentlicht" : "zurückgezogen"}.</Alert>
          ) : can(actor, "message.publish") ? (
            <PublishPanel
              action={publishAction.bind(null, slug, id)}
              isPublic={check.needsPublicConfirmation}
              warnings={check.sensitiveWarnings.map((w) => ({ label: w.label, match: w.match }))}
              scheduledFor={future}
              pushEnabled={m.pushEnabled && m.visibility !== "council"}
              visibilityLabel={visibilityLabel(m.visibility)}
            />
          ) : m.status === "draft" ? (
            <>
              <p className="text-sm text-muted">Sie haben kein Veröffentlichungsrecht. Reichen Sie die Mitteilung zur Freigabe ein.</p>
              <form action={submitReviewAction.bind(null, slug, id)}>
                <SubmitButton>Zur Freigabe einreichen</SubmitButton>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted">Eingereicht – wartet auf Freigabe durch eine berechtigte Person.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
