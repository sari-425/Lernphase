import Link from "next/link";
import { getDb } from "@/lib/db";
import { loadTenant, readerAccess } from "@/lib/server/context";
import { listVisibleMessages } from "@/lib/services/messages";
import { listVisiblePolls } from "@/lib/services/polls";
import { MessageCard } from "@/components/message-card";
import { VisitTracker } from "@/components/new-badge";
import { EmptyState } from "@/components/ui";
import { BrandPanel } from "@/components/logo";

export default async function TenantHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  const db = await getDb();
  const current = await listVisibleMessages(db, tenant.id, access, { limit: 6 });
  const important = current.filter((m) => m.priority !== "normal");
  const openPolls = (await listVisiblePolls(db, tenant.id, access)).filter((p) => p.isOpen);
  const latest = current.filter((m) => m.priority === "normal").slice(0, 5);

  return (
    <div className="space-y-8">
      <VisitTracker slug={slug} />

      <section aria-labelledby="wichtig" className="space-y-3">
        {important.length > 0 ? (
          <>
            <h1 id="wichtig" className="text-2xl font-bold text-red-800">
              <span aria-hidden="true">‼ </span>Wichtige Informationen
            </h1>
            <div className="space-y-3">
              {important.map((m) => (
                <MessageCard key={m.id} slug={slug} m={m} />
              ))}
            </div>
          </>
        ) : (
          <h1 id="wichtig" className="sr-only">
            {tenant.name}
          </h1>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <section aria-labelledby="neu" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="neu" className="text-xl font-bold text-brand-900">
              Aktuelle Mitteilungen
            </h2>
            <Link href={`/b/${slug}/mitteilungen`} className="link shrink-0">
              Alle anzeigen
            </Link>
          </div>
          {latest.length === 0 && important.length === 0 ? (
            <EmptyState title="Derzeit keine aktuellen Mitteilungen">
              Ältere Informationen finden Sie im <Link className="link" href={`/b/${slug}/archiv`}>Archiv</Link>.
            </EmptyState>
          ) : latest.length === 0 ? (
            <p className="text-muted">Keine weiteren Mitteilungen.</p>
          ) : (
            <div className="space-y-3">
              {latest.map((m) => (
                <MessageCard key={m.id} slug={slug} m={m} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="hidden md:block">
            <BrandPanel companyName={tenant.companyName} slogan={tenant.slogan} sloganSub={tenant.sloganSub} compact />
          </div>
          {openPolls.length > 0 ? (
            <div className="card space-y-2 border-accent-600">
              <h2 className="font-bold text-brand-900">📊 Ihre Meinung ist gefragt</h2>
              <p className="text-sm">{openPolls[0].question}</p>
              <Link href={`/b/${slug}/umfragen`} className="btn-primary w-full">
                {openPolls.length > 1 ? `${openPolls.length} laufende Umfragen` : "Zur Umfrage"}
              </Link>
            </div>
          ) : null}
          {tenant.welcomeText ? <p className="card whitespace-pre-line">{tenant.welcomeText}</p> : null}
          <div className="card space-y-3">
            <h2 className="font-bold text-brand-900">Nichts verpassen</h2>
            <p className="text-sm text-muted">Freiwillige Push-Benachrichtigungen – ohne Anmeldung, jederzeit abschaltbar.</p>
            <Link href={`/b/${slug}/benachrichtigungen`} className="btn-primary w-full">
              Benachrichtigungen einrichten
            </Link>
          </div>
          {tenant.staffAccessCodeHash && !access.staff && !access.council ? (
            <div className="card space-y-2">
              <h2 className="font-bold text-brand-900">Für Beschäftigte</h2>
              <p className="text-sm text-muted">Manche Informationen sind nur für die Belegschaft. Den Zugangscode erhalten Sie vom Betriebsrat (z. B. am Schwarzen Brett).</p>
              <Link href={`/b/${slug}/zugang`} className="btn-secondary w-full">
                Zugangscode eingeben
              </Link>
            </div>
          ) : access.staff ? (
            <p className="rounded-lg bg-accent-50 px-4 py-3 text-sm text-accent-600">🔓 Belegschafts-Zugang auf diesem Gerät aktiv.</p>
          ) : null}
          <Link href={`/b/${slug}/kontakt`} className="btn-secondary w-full">
            Ansprechpartner im Betriebsrat
          </Link>
        </aside>
      </div>
    </div>
  );
}
