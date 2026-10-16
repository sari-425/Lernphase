import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listPollsForEditor, isPollOpen } from "@/lib/services/polls";
import { PollForm } from "@/components/poll-form";
import { Alert, EmptyState, PageTitle } from "@/components/ui";
import { savePollAction } from "../actions";

export const metadata = { title: "Umfragen" };

export default async function AdminPolls({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { actor } = await requireActor(slug);
  const list = await listPollsForEditor(await getDb(), actor);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
      <div>
        <PageTitle sub="Anonymes Stimmungsbild der Belegschaft">Umfragen</PageTitle>
        <Alert kind="info">
          Umfragen sind anonym und erschweren Mehrfachabstimmung nur pro Gerät. Sie eignen sich für Meinungsbilder (z. B. Terminwünsche), <strong>nicht</strong> für Wahlen, Urabstimmungen oder Beschlüsse.
        </Alert>
        <ul className="mt-4 space-y-2">
          {list.length === 0 ? <EmptyState title="Noch keine Umfragen" /> : null}
          {list.map((p) => {
            const open = isPollOpen(p);
            const label = p.status === "draft" ? "Entwurf" : open ? "läuft" : "beendet";
            return (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="mr-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold">{label}</span>
                  <Link href={`/admin/${slug}/umfragen/${p.id}`} className="font-semibold text-brand-900 hover:underline">{p.question}</Link>
                </div>
                <span className="text-sm text-muted">{p.results.total} Stimmen</span>
              </li>
            );
          })}
        </ul>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">Neue Umfrage</h2>
        <PollForm action={savePollAction.bind(null, slug, null)} initial={{ question: "", description: "", options: "", visibility: "", closesAt: "", resultsPublic: true }} />
      </section>
    </div>
  );
}
