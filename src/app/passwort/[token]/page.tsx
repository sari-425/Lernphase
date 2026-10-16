import { getDb } from "@/lib/db";
import { getPasswordReset } from "@/lib/services/account";
import { Alert, PageTitle } from "@/components/ui";
import { SimpleForm } from "@/app/konto/account-forms";
import { resetPasswordAction } from "@/app/konto/actions";

export const metadata = { title: "Neues Passwort", referrer: "no-referrer" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await getPasswordReset(await getDb(), token);
  return (
    <main id="inhalt" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <PageTitle>Neues Passwort festlegen</PageTitle>
      {!r ? (
        <Alert kind="error" title="Link ungültig">Der Link ist abgelaufen (24 Stunden gültig), wurde bereits verwendet oder ist unvollständig. Bitte eine Administratorin bzw. einen Administrator um einen neuen Link bitten.</Alert>
      ) : (
        <div className="card space-y-4">
          <p>Konto: <strong>{r.email}</strong></p>
          {r.resetTotp ? <Alert kind="info">Die Zwei-Faktor-Anmeldung wird dabei ausgeschaltet. Bitte danach unter „Mein Konto“ neu einrichten.</Alert> : null}
          <SimpleForm action={resetPasswordAction.bind(null, token)} submit="Passwort speichern">
            <div>
              <label htmlFor="password" className="label">Neues Passwort (mind. 12 Zeichen)</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="input" />
            </div>
            <div>
              <label htmlFor="repeat" className="label">Wiederholen</label>
              <input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={12} required className="input" />
            </div>
          </SimpleForm>
          <p className="hint">Alle bisherigen Anmeldungen dieses Kontos werden beendet.</p>
        </div>
      )}
    </main>
  );
}
