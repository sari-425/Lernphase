import { getDb } from "@/lib/db";
import { loadTenant, readerAccess } from "@/lib/server/context";
import { listVisibleMessages } from "@/lib/services/messages";
import { listCategories } from "@/lib/services/directory";
import { MessageCard } from "@/components/message-card";
import { EmptyState, PageTitle } from "@/components/ui";

export const metadata = { title: "Archiv & Suche" };

export default async function ArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; kategorie?: string; seite?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(50, Number(sp.seite) || 1));
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  const db = await getDb();
  const cats = await listCategories(db, tenant.id);
  const cat = cats.find((c) => c.slug === sp.kategorie) ?? null;
  const PER = 20;
  const list = await listVisibleMessages(db, tenant.id, access, {
    q,
    categoryId: cat?.id,
    scope: q ? "all" : "archive",
    limit: PER + 1,
    offset: (page - 1) * PER,
  });
  const hasMore = list.length > PER;

  return (
    <div>
      <PageTitle sub="Ältere und abgelaufene Mitteilungen wiederfinden. Die Suche durchsucht alle Mitteilungen.">Archiv & Suche</PageTitle>
      <form role="search" className="card mb-5 grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end" action={`/b/${slug}/archiv`}>
        <div>
          <label htmlFor="q" className="label">Suchbegriff</label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={100} className="input" placeholder="z. B. Schichtplan, Urlaub, Versammlung" />
        </div>
        <div>
          <label htmlFor="kategorie" className="label">Thema</label>
          <select id="kategorie" name="kategorie" defaultValue={cat?.slug ?? ""} className="input">
            <option value="">Alle Themen</option>
            {cats.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" type="submit">Suchen</button>
      </form>
      <p className="mb-3 text-muted" aria-live="polite">
        {q ? `Suchergebnisse für „${q}“` : "Archivierte Mitteilungen"}
      </p>
      {list.length === 0 ? (
        <EmptyState title={q ? "Keine Treffer" : "Das Archiv ist noch leer"}>{q ? "Versuchen Sie einen anderen Suchbegriff." : null}</EmptyState>
      ) : (
        <div className="space-y-3">
          {list.slice(0, PER).map((m) => (
            <MessageCard key={m.id} slug={slug} m={m} showNew={false} />
          ))}
        </div>
      )}
      <nav aria-label="Seiten" className="mt-5 flex justify-between">
        {page > 1 ? (
          <a className="btn-secondary" href={`/b/${slug}/archiv?${new URLSearchParams({ q, kategorie: cat?.slug ?? "", seite: String(page - 1) })}`}>← Neuere</a>
        ) : <span />}
        {hasMore ? (
          <a className="btn-secondary" href={`/b/${slug}/archiv?${new URLSearchParams({ q, kategorie: cat?.slug ?? "", seite: String(page + 1) })}`}>Ältere →</a>
        ) : null}
      </nav>
    </div>
  );
}
