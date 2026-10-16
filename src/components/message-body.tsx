import { parseBody, type Inline } from "@/lib/content/format";

function InlineView({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.t === "bold" ? (
          <strong key={i}>{p.v}</strong>
        ) : p.t === "link" ? (
          <a key={i} href={p.v} className="link break-all" rel="noopener noreferrer nofollow" target="_blank">
            {p.v}
          </a>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}

/** Rendert Mitteilungstext ausschließlich als React-Text (kein HTML) → kein XSS möglich. */
export function MessageBody({ body }: { body: string }) {
  const blocks = parseBody(body);
  return (
    <div className="space-y-4 text-[1.05rem] leading-relaxed">
      {blocks.map((b, i) => {
        if (b.type === "h")
          return (
            <h2 key={i} className="pt-2 text-xl font-bold text-brand-900">
              <InlineView parts={b.content} />
            </h2>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {b.items.map((it, j) => (
                <li key={j}>
                  <InlineView parts={it} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {b.content.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <InlineView parts={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
