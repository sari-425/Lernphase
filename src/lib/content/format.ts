/**
 * Sehr einfaches, sicheres Textformat für Mitteilungen.
 * Es wird KEIN HTML erzeugt oder interpretiert – nur Datenstrukturen, die React
 * als Text rendert. Damit ist Cross-Site-Scripting über Mitteilungsinhalte ausgeschlossen.
 *
 *   ## Überschrift
 *   - Aufzählung
 *   **fett**
 *   Links (https://…) werden automatisch erkannt.
 */
export type Inline = { t: "text"; v: string } | { t: "bold"; v: string } | { t: "link"; v: string };
export type Block =
  | { type: "h"; content: Inline[] }
  | { type: "p"; content: Inline[][] }
  | { type: "ul"; items: Inline[][] };

const URL_RE = /(https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?])/g;

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ t: "bold", v: part.slice(2, -2) });
      continue;
    }
    let last = 0;
    for (const m of part.matchAll(URL_RE)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ t: "text", v: part.slice(last, i) });
      out.push({ t: "link", v: m[0] });
      last = i + m[0].length;
    }
    if (last < part.length) out.push({ t: "text", v: part.slice(last) });
  }
  return out;
}

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let para: Inline[][] = [];
  let list: Inline[][] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", content: para });
    if (list.length) blocks.push({ type: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = line.match(/^#{1,3}\s+(.*)$/);
    const li = line.match(/^\s*[-*•]\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ type: "h", content: parseInline(h[1]) });
    } else if (li) {
      if (para.length) {
        blocks.push({ type: "p", content: para });
        para = [];
      }
      list.push(parseInline(li[1]));
    } else {
      if (list.length) {
        blocks.push({ type: "ul", items: list });
        list = [];
      }
      para.push(parseInline(line));
    }
  }
  flush();
  return blocks;
}

/** Kurzer Anreißertext ohne Formatierungszeichen. */
export function excerpt(body: string, max = 180): string {
  const plain = body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^#{1,3}\s+/, "").replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + "…" : plain;
}
