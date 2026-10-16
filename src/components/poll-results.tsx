import type { PollResults } from "@/lib/services/polls";

/** Ergebnisanzeige: Text (für Screenreader) + Balken (dekorativ). */
export function PollResultBars({ options, results }: { options: { id: string; label: string }[]; results: PollResults }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {options.map((o) => {
          const n = results.counts[o.id] ?? 0;
          const pct = results.total ? Math.round((n / results.total) * 100) : 0;
          return (
            <li key={o.id}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-semibold">{o.label}</span>
                <span className="shrink-0 text-muted">
                  {pct} % ({n} {n === 1 ? "Stimme" : "Stimmen"})
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-slate-200" aria-hidden="true">
                <div className="h-3 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">Insgesamt {results.total} {results.total === 1 ? "Stimme" : "Stimmen"}.</p>
    </div>
  );
}
