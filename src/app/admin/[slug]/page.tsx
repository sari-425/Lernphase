import Link from "next/link";
import { getDb } from "@/lib/db";
import { vapidConfig } from "@/lib/env";
import { requireActor } from "@/lib/server/context";
import { dashboardStats, listForEditor } from "@/lib/services/messages";
import { countSubscriptions, listDispatches } from "@/lib/services/push";
import { can } from "@/lib/auth/permissions";
import { Alert, PageTitle, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

const DISPATCH_LABEL: Record<string, string> = { pending: "wartet", sending: "wird gesendet", done: "übergeben", failed: "fehlgeschlagen", skipped: "verworfen" };

export default async function Dashboard({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ willkommen?: string }> }) {
  const { slug } = await params;
  const { willkommen } = await searchParams;
  const { tenant, actor } = await requireActor(slug);
  const db = await getDb();
  const [stats, review, subs, dispatches] = await Promise.all([
    dashboardStats(db, actor),
    listForEditor(db, actor, { status: "review", limit: 10 }),
    countSubscriptions(db, tenant.id),
    listDispatches(db, actor, 5),
  ]);
  const pushReady = Boolean(vapidConfig());
  return (
    <div className="space-y-6">
      <PageTitle sub={tenant.name}>Übersicht</PageTitle>
      {willkommen ? (
        <Alert kind="success" title="Willkommen!">
          Ihr Bereich ist eingerichtet. Nächste Schritte: Ansprechpartner eintragen, ggf. einen Belegschafts-Zugangscode festlegen, Team einladen und die erste Mitteilung schreiben. Der Link für Beschäftigte lautet <strong>/b/{slug}</strong>.
        </Alert>
      ) : null}
      {!pushReady ? (
        <Alert kind="warning" title="Push-Benachrichtigungen sind noch nicht eingerichtet">
          Der Server-Betreiber muss VAPID-Schlüssel hinterlegen (siehe Anleitung „npm run push:keys“). Mitteilungen können trotzdem veröffentlicht werden.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href={`/admin/${slug}/mitteilungen/neu`} className="btn-primary">+ Neue Mitteilung</Link>
        <Link href={`/admin/${slug}/mitteilungen`} className="btn-secondary">Alle Mitteilungen</Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Entwürfe", stats.draft],
          ["Zur Freigabe", stats.review],
          ["Geplant", stats.scheduled],
          ["Veröffentlicht", stats.published],
          ["Archiviert", stats.archived],
          ["Push-Geräte", subs],
        ].map(([label, n]) => (
          <div key={label} className="card">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-bold text-brand-900">{n}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-sm text-muted">„Push-Geräte“ = Anzahl anonymer Abonnements. Wer liest, wird bewusst nicht erfasst.</p>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Warten auf Freigabe</h2>
        {review.length === 0 ? (
          <p className="text-muted">Nichts offen.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {review.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                <StatusBadge status="review" />
                <Link className="link" href={`/admin/${slug}/mitteilungen/${m.id}/vorschau`}>{m.title}</Link>
                {can(actor, "message.publish") ? <span className="text-sm text-muted">– Vorschau prüfen und veröffentlichen</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Letzte Push-Versände</h2>
        {dispatches.length === 0 ? (
          <p className="text-muted">Noch keine Push-Benachrichtigungen versendet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-muted"><th className="py-1 pr-3">Mitteilung</th><th className="pr-3">Status</th><th className="pr-3">Zeit</th><th className="pr-3">An Push-Dienste übergeben</th><th>Fehler / entfernt</th></tr>
              </thead>
              <tbody>
                {dispatches.map((d) => (
                  <tr key={d.id} className="border-t border-slate-200">
                    <td className="py-2 pr-3"><Link className="link" href={`/admin/${slug}/mitteilungen/${d.messageId}`}>{d.messageTitle}</Link></td>
                    <td className="pr-3">{DISPATCH_LABEL[d.status]}{d.note ? <span className="block text-xs text-muted">{d.note}</span> : null}</td>
                    <td className="pr-3">{formatDateTime(d.finishedAt ?? d.notBefore)}</td>
                    <td className="pr-3">{d.acceptedCount} von {d.targetCount}</td>
                    <td>{d.failedCount} / {d.removedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">„Übergeben“ heißt: Der Push-Dienst des Browserherstellers hat die Nachricht angenommen. Ob sie angezeigt oder gelesen wurde, ist technisch nicht feststellbar und wird nicht erfasst.</p>
          </div>
        )}
      </section>
    </div>
  );
}
