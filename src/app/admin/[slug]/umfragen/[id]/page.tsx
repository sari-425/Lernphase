import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { getPollForEditor, isPollOpen } from "@/lib/services/polls";
import { can } from "@/lib/auth/permissions";
import { OpenPollForm, PollForm } from "@/components/poll-form";
import { PollResultBars } from "@/components/poll-results";
import { PageTitle, VisibilityBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime, toBerlinLocalInput } from "@/lib/time";
import { closePollAction, deletePollAction, openPollAction, savePollAction } from "@/app/admin/[slug]/actions";

export const metadata = { title: "Umfrage" };

export default async function AdminPoll({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { actor } = await requireActor(slug);
  const p = await getPollForEditor(await getDb(), actor, id);
  const open = isPollOpen(p);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <p><Link href={`/admin/${slug}/umfragen`} className="link">← Alle Umfragen</Link></p>
        <PageTitle sub={<span className="flex flex-wrap items-center gap-2"><VisibilityBadge visibility={p.visibility} /> {p.status === "draft" ? "Entwurf" : open ? "läuft" : "beendet"}{p.closesAt ? ` · endet ${formatDateTime(p.closesAt)}` : ""}</span>}>
          {p.question}
        </PageTitle>
        {p.status === "draft" ? (
          <PollForm
            action={savePollAction.bind(null, slug, id)}
            initial={{ question: p.question, description: p.description, options: p.options.map((o) => o.label).join("\n"), visibility: p.visibility, closesAt: toBerlinLocalInput(p.closesAt), resultsPublic: p.resultsPublic }}
          />
        ) : (
          <section className="card space-y-3">
            <h2 className="text-lg font-bold">Ergebnis {open ? "(Zwischenstand)" : ""}</h2>
            <PollResultBars options={p.options} results={p.results} />
          </section>
        )}
      </div>
      <aside className="space-y-4">
        {can(actor, "message.publish") ? (
          <section className="card space-y-3">
            <h2 className="text-lg font-bold">Status</h2>
            {p.status === "draft" ? <OpenPollForm action={openPollAction.bind(null, slug, id)} isPublic={p.visibility === "public"} /> : null}
            {p.status === "open" ? (
              <form action={closePollAction.bind(null, slug, id)}>
                <SubmitButton className="btn-secondary w-full">Umfrage beenden</SubmitButton>
              </form>
            ) : null}
            {p.status === "closed" ? <p className="text-sm text-muted">Beendet am {formatDateTime(p.closedAt)}. Nur die Zählung ist gespeichert.</p> : null}
            {p.status !== "draft" ? <a className="btn-ghost w-full" href={`/b/${slug}/umfragen`} target="_blank" rel="noopener">Ansicht für Beschäftigte ↗</a> : null}
          </section>
        ) : (
          <p className="card text-sm text-muted">Starten und Beenden dürfen Personen mit Veröffentlichungsrecht.</p>
        )}
        {can(actor, "message.delete") ? (
          <section className="card space-y-3 border-red-200">
            <h2 className="text-lg font-bold text-red-900">Löschen</h2>
            <form action={deletePollAction.bind(null, slug, id)} className="space-y-3">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmDelete" required className="mt-0.5 h-5 w-5" /> Umfrage samt Ergebnis endgültig löschen</label>
              <SubmitButton className="btn-danger w-full">Endgültig löschen</SubmitButton>
            </form>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
