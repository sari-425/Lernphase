import Link from "next/link";
import { env } from "@/lib/env";
import { Alert, PageTitle } from "@/components/ui";
import { SetupForm } from "./setup-form";
import { localFirstSetupAllowed } from "@/lib/server/setup";

export const metadata = { title: "Einrichtung" };

export default async function SetupPage() {
  const token = env().SETUP_TOKEN ?? "";
  const localFirst = await localFirstSetupAllowed();
  const enabled = token.length >= 16 || localFirst;
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <main id="inhalt" className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <PageTitle sub="Neuen Betriebsrat-Bereich anlegen">Einrichtung</PageTitle>
      {enabled ? (
        <div className="space-y-4">
          {localFirst ? (
            <Alert kind="info" title="Lokales Ausprobieren">
              Für die allererste Einrichtung auf Ihrem eigenen Rechner ist kein Einrichtungs-Token nötig. Auf einem echten Server ist er aus Sicherheitsgründen immer Pflicht.
            </Alert>
          ) : null}
          <div className="card"><SetupForm requireToken={!localFirst} /></div>
        </div>
      ) : (
        <Alert kind="info" title="Einrichtung deaktiviert">
          <p>
            {token
              ? `Der Einrichtungs-Token ist zu kurz (${token.length} Zeichen, nötig sind mindestens 16).`
              : "Es ist kein Einrichtungs-Token (SETUP_TOKEN) gesetzt."}
          </p>
          {isDev ? (
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              <li>
                Im Projektordner (dort, wo die Datei <code>package.json</code> liegt) eine Datei <code>.env.local</code> mit dieser Zeile anlegen:
                <br />
                <code className="break-all">SETUP_TOKEN=mein-einrichtungs-token-123</code>
              </li>
              <li>
                Im Terminal: Server mit <kbd>Ctrl</kbd> + <kbd>C</kbd> stoppen und mit <code>npm run dev</code> neu starten.
              </li>
              <li>Diese Seite neu laden und den Token im Formular eingeben.</li>
            </ol>
          ) : (
            <p className="mt-2">
              Der Betreiber setzt die Umgebungsvariable SETUP_TOKEN (mind. 16 Zeichen) und startet die App neu – oder legt den Betriebsrat per Kommandozeile an:{" "}
              <code>npm run tenant -- create &lt;kurzadresse&gt; &quot;&lt;Name&gt;&quot; &lt;admin-email&gt; &quot;&lt;Admin-Name&gt;&quot;</code>
            </p>
          )}
        </Alert>
      )}
      <p className="mt-6 flex flex-wrap gap-3">
        <Link href="/login" className="btn-secondary">Schon eingerichtet? Zur Anmeldung</Link>
        <Link href="/" className="btn-ghost">Zur Startseite</Link>
      </p>
    </main>
  );
}
