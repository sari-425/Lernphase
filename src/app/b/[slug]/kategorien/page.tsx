import Link from "next/link";
import { getDb } from "@/lib/db";
import { loadTenant, readerAccess } from "@/lib/server/context";
import { countByCategory } from "@/lib/services/messages";
import { listCategories } from "@/lib/services/directory";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Themen" };

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  const db = await getDb();
  const [cats, counts] = await Promise.all([listCategories(db, tenant.id), countByCategory(db, tenant.id, access)]);
  const countOf = (id: string) => counts.find((c) => c.categoryId === id)?.n ?? 0;
  return (
    <div>
      <PageTitle sub="Mitteilungen nach Thema">Themen</PageTitle>
      <p className="mb-4">
        <Link href={`/b/${slug}/umfragen`} className="card flex min-h-16 items-center justify-between gap-3 font-semibold text-brand-900 hover:bg-brand-50">
          📊 Umfragen <span aria-hidden="true">→</span>
        </Link>
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={`/b/${slug}/mitteilungen?kategorie=${c.slug}`} className="card flex min-h-16 items-center justify-between gap-3 hover:border-brand-200 hover:bg-brand-50">
              <span className="font-semibold text-brand-900">{c.name}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-muted" aria-label={`${countOf(c.id)} Mitteilungen`}>
                {countOf(c.id)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
