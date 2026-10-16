export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main id="inhalt" className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Keine Internetverbindung</h1>
      <p className="mt-3 text-muted">
        Die Mitteilungen des Betriebsrats werden aus Datenschutzgründen nicht auf dem Gerät gespeichert. Bitte versuchen Sie es erneut, sobald Sie wieder online sind.
      </p>
    </main>
  );
}
