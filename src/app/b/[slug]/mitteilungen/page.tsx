import Link from "next/link";
import { getDb } from "@/lib/db";
import { loadTenant, readerAccess } from "@/lib/server/context";
import { listVisibleMessages } from "@/lib/services/messages";
import { listCategories } from "@/lib/services/directory";
import { MessageCard } from "@/components/message-card";
import { EmptyState, PageTitle } from "@/components/ui";

export const metadata = { title: "Aktuelle Mitteilungen" };

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kategorie?: string }>;
}) {
  const { slug } = await params;
  const { kategorie } = await searchParams;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  const db = await getDb();
  const cats = await listCategories(db, tenant.id);
  const active = cats.find((c) => c.slug === kategorie) ?? null;
  const list = await listVisibleMessages(db, tenant.id, access, { categoryId: active?.id, limit: 50 });

  return (
    <div>
      <PageTitle sub="Wichtige Mitteilungen stehen oben.">{active ? active.name : "Aktuelle Mitteilungen"}</PageTitle>
      <nav aria-label="Nach Thema filtern" className="-mx-4 mb-5 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li>
            <Link
              href={`/b/${slug}/mitteilungen`}
              aria-current={!active ? "true" : undefined}
              className={"inline-flex min-h-11 items-center rounded-full px-4 font-semibold whitespace-nowrap ring-1 " + (!active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-800 ring-slate-300")}
            >
              Alle
            </Link>
          </li>
          {cats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/b/${slug}/mitteilungen?kategorie=${c.slug}`}
                aria-current={active?.id === c.id ? "true" : undefined}
                className={"inline-flex min-h-11 items-center rounded-full px-4 font-semibold whitespace-nowrap ring-1 " + (active?.id === c.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-800 ring-slate-300")}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {list.length === 0 ? (
        <EmptyState title="Keine aktuellen Mitteilungen">
          {active ? "In diesem Thema gibt es derzeit nichts Neues. " : ""}
          Ältere Informationen finden Sie im <Link className="link" href={`/b/${slug}/archiv`}>Archiv</Link>.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <MessageCard key={m.id} slug={slug} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
