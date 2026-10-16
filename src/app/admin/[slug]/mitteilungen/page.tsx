import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listForEditor } from "@/lib/services/messages";
import { EmptyState, PageTitle, PriorityBadge, StatusBadge, VisibilityBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import type { MessageStatus } from "@/lib/db/schema";

export const metadata = { title: "Mitteilungen" };

const FILTERS: Array<[string, string]> = [
  ["all", "Alle"],
  ["draft", "Entwürfe"],
  ["review", "Zur Freigabe"],
  ["scheduled", "Geplant"],
  ["published", "Veröffentlicht"],
  ["archived", "Archiviert"],
  ["withdrawn", "Zurückgezogen"],
];

export default async function AdminMessages({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string }> }) {
  const { slug } = await params;
  const { status = "all" } = await searchParams;
  const { actor } = await requireActor(slug);
  const filter = FILTERS.some(([k]) => k === status) ? status : "all";
  const now = new Date();
  const list = await listForEditor(await getDb(), actor, { status: filter as MessageStatus | "scheduled" | "all", limit: 200 });
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle>Mitteilungen</PageTitle>
        <Link href={`/admin/${slug}/mitteilungen/neu`} className="btn-primary">+ Neue Mitteilung</Link>
      </div>
      <nav aria-label="Nach Status filtern" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/admin/${slug}/mitteilungen?status=${k}`} aria-current={filter === k ? "true" : undefined} className={"rounded-full px-3 py-1.5 text-sm font-semibold ring-1 " + (filter === k ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-slate-300")}>
            {l}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <EmptyState title="Keine Mitteilungen in dieser Ansicht" />
      ) : (
        <ul className="space-y-2">
          {list.map((m) => {
            const scheduled = m.status === "published" && m.publishAt && m.publishAt > now;
            return (
              <li key={m.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-2">
                    <StatusBadge status={scheduled ? "scheduled" : m.status} />
                    <VisibilityBadge visibility={m.visibility} />
                    <PriorityBadge priority={m.priority} />
                    {m.dispatchStatus ? <span className="text-sm text-muted">📣 Push: {m.dispatchStatus === "done" ? `übergeben (${m.dispatchAccepted})` : m.dispatchStatus}</span> : m.pushEnabled ? <span className="text-sm text-muted">📣 Push vorgesehen</span> : null}
                  </div>
                  <Link href={`/admin/${slug}/mitteilungen/${m.id}`} className="font-semibold text-brand-900 hover:underline">{m.title}</Link>
                  <p className="text-sm text-muted">
                    {m.categoryName ? `${m.categoryName} · ` : ""}
                    {scheduled ? `geplant für ${formatDateTime(m.publishAt)}` : m.publishAt && m.status !== "draft" ? `veröffentlicht ${formatDateTime(m.publishAt)}` : `geändert ${formatDateTime(m.updatedAt)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/${slug}/mitteilungen/${m.id}`} className="btn-secondary">Bearbeiten</Link>
                  <Link href={`/admin/${slug}/mitteilungen/${m.id}/vorschau`} className="btn-ghost">Vorschau</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
