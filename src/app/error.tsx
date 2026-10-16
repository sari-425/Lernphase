"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Etwas ist schiefgelaufen</h1>
      <p className="mt-3 text-muted">Bitte versuchen Sie es erneut. Besteht das Problem weiter, informieren Sie den Betriebsrat.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">Erneut versuchen</button>
    </main>
  );
}
