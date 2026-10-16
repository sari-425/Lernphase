import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/server/context";
import { getAccount } from "@/lib/services/account";
import { listUserTenants } from "@/lib/services/auth";
import { Alert, PageTitle } from "@/components/ui";
import { logoutOthersAction, nameAction, passwordAction, totpDisableAction } from "./actions";
import { SimpleForm, TotpSetup } from "./account-forms";

export const metadata = { title: "Mein Konto" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ wiederherstellung?: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const acc = await getAccount(db, user.id);
  const tenants = await listUserTenants(db, user.id);
  const { wiederherstellung } = await searchParams;
  return (
    <main id="inhalt" className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <p>
        <Link href={tenants.length === 1 ? `/admin/${tenants[0].slug}` : "/admin"} className="link">← Zurück zur Verwaltung</Link>
      </p>
      <PageTitle sub={acc.email}>Mein Konto</PageTitle>
      {wiederherstellung ? (
        <Alert kind="warning" title="Sie haben sich mit einem Wiederherstellungscode angemeldet">
          Noch {acc.recoveryCodesLeft} Code(s) übrig. Haben Sie Ihr Gerät verloren? Schalten Sie die Zwei-Faktor-Anmeldung aus und richten Sie sie neu ein.
        </Alert>
      ) : null}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Name</h2>
        <SimpleForm action={nameAction} submit="Speichern">
          <label htmlFor="displayName" className="label">Angezeigter Name</label>
          <input id="displayName" name="displayName" defaultValue={acc.displayName} required maxLength={80} className="input" />
        </SimpleForm>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Passwort ändern</h2>
        <SimpleForm action={passwordAction} submit="Passwort ändern">
          <div>
            <label htmlFor="current" className="label">Aktuelles Passwort</label>
            <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
          </div>
          <div>
            <label htmlFor="next" className="label">Neues Passwort (mind. 12 Zeichen)</label>
            <input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required className="input" />
          </div>
          <div>
            <label htmlFor="repeat" className="label">Neues Passwort wiederholen</label>
            <input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={12} required className="input" />
          </div>
        </SimpleForm>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Zwei-Faktor-Anmeldung</h2>
        {acc.totpEnabled ? (
          <>
            <Alert kind="success">Aktiv. Wiederherstellungscodes übrig: {acc.recoveryCodesLeft}</Alert>
            <SimpleForm action={totpDisableAction} submit="Zwei-Faktor-Anmeldung ausschalten" danger>
              <label htmlFor="pw-2fa" className="label">Zur Bestätigung: Passwort</label>
              <input id="pw-2fa" name="password" type="password" autoComplete="current-password" required className="input" />
            </SimpleForm>
          </>
        ) : (
          <TotpSetup />
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Angemeldete Geräte</h2>
        <p className="text-sm text-muted">Haben Sie sich auf einem fremden Gerät angemeldet? Hier alle anderen Sitzungen beenden.</p>
        <SimpleForm action={logoutOthersAction} submit="Alle anderen Geräte abmelden" />
      </section>
    </main>
  );
}
