import Link from "next/link";
import { excerpt } from "@/lib/content/format";
import { formatDate } from "@/lib/time";
import type { MessageListItem } from "@/lib/services/messages";
import { PriorityBadge, VisibilityBadge } from "./ui";
import { NewBadge } from "./new-badge";

export function MessageCard({ slug, m, showNew = true }: { slug: string; m: MessageListItem; showNew?: boolean }) {
  const border =
    m.priority === "urgent" ? "border-l-red-700" : m.priority === "high" ? "border-l-amber-500" : "border-l-brand-200";
  return (
    <article className={`card relative border-l-4 ${border}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <PriorityBadge priority={m.priority} />
        {showNew && m.publishAt ? <NewBadge slug={slug} publishedAt={m.publishAt.toISOString()} /> : null}
        {m.visibility !== "public" ? <VisibilityBadge visibility={m.visibility} /> : null}
        {m.categoryName ? <span className="text-muted">{m.categoryName}</span> : null}
        {m.publishAt ? (
          <time className="ml-auto text-muted" dateTime={m.publishAt.toISOString()}>
            {formatDate(m.publishAt)}
          </time>
        ) : null}
      </div>
      <h2 className="text-lg leading-snug font-bold text-brand-900 sm:text-xl">
        <Link href={`/b/${slug}/mitteilungen/${m.id}`} className="after:absolute after:inset-0 hover:underline focus-visible:underline">
          {m.title}
        </Link>
      </h2>
      <p className="mt-1 text-muted">{excerpt(m.body)}</p>
    </article>
  );
}
