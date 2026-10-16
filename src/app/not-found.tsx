import Link from "next/link";

export default function NotFound() {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Seite nicht gefunden</h1>
      <p className="mt-3 text-muted">Die Seite existiert nicht, wurde entfernt oder Sie haben keinen Zugriff darauf.</p>
      <Link href="/" className="btn-primary mt-6">Zur Startseite</Link>
    </main>
  );
}
