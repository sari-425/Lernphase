import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { DEVICE_COOKIE, loadTenant, readerAccess } from "@/lib/server/context";
import { hasVoted, listVisiblePolls, pollResults } from "@/lib/services/polls";
import { EmptyState, PageTitle, VisibilityBadge } from "@/components/ui";
import { PollResultBars } from "@/components/poll-results";
import { formatDateTime } from "@/lib/time";
import { voteAction } from "./actions";
import { VoteForm } from "./vote-form";

export const metadata = { title: "Umfragen" };

export default async function PollsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  const db = await getDb();
  const device = (await cookies()).get(DEVICE_COOKIE)?.value;
  const list = await listVisiblePolls(db, tenant.id, access);
  const items = await Promise.all(
    list.map(async (p) => {
      const voted = await hasVoted(db, sessionSecret(), p.id, device);
      const showResults = access.council || (p.resultsPublic && (voted || !p.isOpen));
      return { p, voted, results: showResults ? await pollResults(db, p.id) : null };
    }),
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle sub="Anonymes, unverbindliches Stimmungsbild – kein Ersatz für Wahlen oder Beschlüsse.">Umfragen</PageTitle>
      {items.length === 0 ? (
        <EmptyState title="Derzeit keine Umfragen">{!access.staff && tenant.staffAccessCodeHash ? "Manche Umfragen sind nur mit dem Belegschafts-Zugangscode sichtbar." : null}</EmptyState>
      ) : (
        <div className="space-y-5">
          {items.map(({ p, voted, results }) => (
            <section key={p.id} className="card space-y-3" aria-labelledby={`q-${p.id}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={"rounded-full px-2.5 py-0.5 font-semibold " + (p.isOpen ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-800")}>{p.isOpen ? "läuft" : "beendet"}</span>
                {p.visibility !== "public" ? <VisibilityBadge visibility={p.visibility} /> : null}
                {p.isOpen && p.closesAt ? <span className="text-muted">bis {formatDateTime(p.closesAt)}</span> : null}
              </div>
              <h2 id={`q-${p.id}`} className="text-xl font-bold text-brand-900">{p.question}</h2>
              {p.description ? <p className="whitespace-pre-line">{p.description}</p> : null}
              {p.isOpen && !voted ? <VoteForm action={voteAction.bind(null, slug, p.id)} options={p.options} question={p.question} /> : null}
              {voted && p.isOpen ? <p className="font-medium text-green-800">✓ Ihre Stimme wurde anonym gezählt (von diesem Gerät wurde abgestimmt).</p> : null}
              {results ? <PollResultBars options={p.options} results={results} /> : !p.isOpen || voted ? <p className="text-muted">Das Ergebnis wird vom Betriebsrat bekanntgegeben.</p> : null}
            </section>
          ))}
        </div>
      )}
      <details className="card mt-6 text-sm">
        <summary className="cursor-pointer font-semibold text-brand-800">Wie anonym ist das?</summary>
        <p className="mt-2 text-muted">
          Es werden weder Name noch IP-Adresse gespeichert. Damit nicht beliebig oft abgestimmt wird, legt Ihr Browser einen zufälligen Wert (Cookie) an; gespeichert wird davon nur eine nicht umkehrbare Prüfsumme – und auch diese wird gelöscht, sobald die Umfrage endet. Danach bleibt nur die Anzahl der Stimmen. Wer mehrere Geräte nutzt, könnte mehrfach abstimmen; deshalb ist das Ergebnis ein Stimmungsbild und nicht verbindlich.
        </p>
      </details>
    </div>
  );
}
