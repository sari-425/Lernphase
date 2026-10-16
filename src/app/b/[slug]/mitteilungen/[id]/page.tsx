import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadTenant, readerAccess } from "@/lib/server/context";
import { getVisibleMessage, messageRequiresStaffAccess } from "@/lib/services/messages";
import { MessageBody } from "@/components/message-body";
import { ShareButton } from "@/components/share-button";
import { Alert, PriorityBadge, VisibilityBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

type P = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, id } = await params;
  const tenant = await loadTenant(slug);
  const m = await getVisibleMessage(await getDb(), tenant.id, id, await readerAccess(slug));
  // Titel nicht-öffentlicher Mitteilungen erscheinen nicht im Browser-Tab/Verlauf
  return { title: m && m.visibility === "public" ? m.title : "Mitteilung" };
}

export default async function MessageDetail({ params }: P) {
  const { slug, id } = await params;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  const db = await getDb();
  const m = await getVisibleMessage(db, tenant.id, id, access);

  if (!m) {
    if (!access.staff && (await messageRequiresStaffAccess(db, tenant.id, id))) {
      return (
        <div className="mx-auto max-w-xl space-y-4">
          <Alert kind="info" title="Diese Mitteilung ist nur für die Belegschaft">
            Bitte geben Sie einmalig den Belegschafts-Zugangscode Ihres Betriebsrats ein. Danach bleibt der Zugang auf diesem Gerät gespeichert.
          </Alert>
          <Link href={`/b/${slug}/zugang?weiter=${encodeURIComponent(`/b/${slug}/mitteilungen/${id}`)}`} className="btn-primary">
            Zugangscode eingeben
          </Link>
        </div>
      );
    }
    notFound();
  }

  const expired = m.status === "archived" || (m.expiresAt && m.expiresAt <= new Date());
  return (
    <article className="mx-auto max-w-3xl">
      <p className="mb-3">
        <Link href={`/b/${slug}/mitteilungen`} className="link">
          ← Alle Mitteilungen
        </Link>
      </p>
      <div className="card space-y-4 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <PriorityBadge priority={m.priority} />
          <VisibilityBadge visibility={m.visibility} />
          {m.categoryName ? <span className="text-muted">{m.categoryName}</span> : null}
        </div>
        <h1 className="text-2xl leading-tight font-bold text-brand-900 sm:text-3xl">{m.title}</h1>
        <p className="text-sm text-muted">
          Veröffentlicht am <time dateTime={m.publishAt?.toISOString()}>{formatDateTime(m.publishAt)}</time>
          {m.updatedAt && m.publishAt && m.updatedAt > m.publishAt ? <> · aktualisiert {formatDateTime(m.updatedAt)}</> : null}
        </p>
        {expired ? <Alert kind="warning">Diese Mitteilung ist archiviert und möglicherweise nicht mehr aktuell.</Alert> : null}
        <MessageBody body={m.body} />
        {m.linkUrl || m.attachments.length > 0 ? (
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h2 className="font-bold">Weitere Informationen</h2>
            <ul className="space-y-2">
              {m.linkUrl ? (
                <li>
                  <a className="link break-all" href={m.linkUrl} rel="noopener noreferrer nofollow" target="_blank">
                    {m.linkUrl}
                  </a>{" "}
                  <span className="text-sm text-muted">(externer Link)</span>
                </li>
              ) : null}
              {m.attachments.map((a) => (
                <li key={a.id}>
                  <a className="link" href={`/b/${slug}/anhang/${a.id}`} download>
                    📎 {a.filename}
                  </a>{" "}
                  <span className="text-sm text-muted">({Math.ceil(a.size / 1024)} KB)</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {m.visibility === "public" ? <ShareButton title={m.title} path={`/b/${slug}/mitteilungen/${m.id}`} /> : (
            <p className="text-sm text-muted">🔒 Nicht öffentlich – bitte nicht außerhalb des Betriebs weitergeben.</p>
          )}
        </div>
      </div>
    </article>
  );
}
