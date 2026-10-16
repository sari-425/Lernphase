import { env } from "@/lib/env";
import { Alert, PageTitle } from "@/components/ui";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Einrichtung" };

export default function SetupPage() {
  const enabled = (env().SETUP_TOKEN ?? "").length >= 16;
  return (
    <main id="inhalt" className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <PageTitle sub="Neuen Betriebsrat-Bereich anlegen">Einrichtung</PageTitle>
      {enabled ? (
        <div className="card"><SetupForm /></div>
      ) : (
        <Alert kind="info" title="Einrichtung deaktiviert">
          Um einen Betriebsrat anzulegen, setzt der Betreiber die Umgebungsvariable SETUP_TOKEN (mind. 16 Zeichen) oder nutzt das Kommandozeilen-Werkzeug „npm run tenant:create“.
        </Alert>
      )}
    </main>
  );
}
