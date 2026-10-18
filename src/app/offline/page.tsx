import { ReloadButton } from "@/components/reload-button";

export const metadata = { title: "Nicht erreichbar" };

export default function Offline() {
  return (
    <main id="inhalt" className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Seite gerade nicht erreichbar</h1>
      <p className="mt-3 text-muted">
        Entweder hat Ihr Gerät keine Internetverbindung, oder der Server des Betriebsrats ist gerade nicht erreichbar (z. B. Wartung). Bitte versuchen Sie es gleich noch einmal.
      </p>
      <p className="mt-3 text-sm text-muted">Mitteilungen werden aus Datenschutzgründen nicht auf dem Gerät gespeichert und sind deshalb offline nicht lesbar.</p>
      <div className="mt-6"><ReloadButton /></div>
    </main>
  );
}
