import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Alert } from "@/components/ui";
import { getSessionUser } from "@/lib/server/context";
import { getDb } from "@/lib/db";
import { countTenants } from "@/lib/services/tenants";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmeldung" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ abgemeldet?: string }> }) {
  if (await getSessionUser()) redirect("/admin");
  const { abgemeldet } = await searchParams;
  const noTenants = (await countTenants(await getDb())) === 0;
  return (
    <main id="inhalt" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-xl bg-[#111111] p-1.5 text-white"><LogoMark className="h-12 w-12" title="" /></span>
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Anmeldung</h1>
          <p className="text-muted">Nur für Mitglieder des Betriebsrats</p>
        </div>
      </div>
      {noTenants ? (
        <div className="mb-4">
          <Alert kind="info" title="Noch kein Konto vorhanden">
            Es ist noch kein Betriebsrat eingerichtet. Legen Sie zuerst Betriebsrat und Administrator-Konto an.{" "}
            <Link href="/einrichtung" className="link">Jetzt einrichten</Link>
          </Alert>
        </div>
      ) : null}
      {abgemeldet ? <div className="mb-4"><Alert kind="success">Sie wurden abgemeldet.</Alert></div> : null}
      <div className="card">
        <LoginForm />
      </div>
      <p className="mt-4 text-sm text-muted">
        Beschäftigte brauchen kein Konto. <Link href="/" className="link">Zur Startseite</Link>
      </p>
      <p className="mt-2 text-sm text-muted">Passwort vergessen? Eine Administratorin bzw. ein Administrator Ihres Betriebsrats kann Ihnen unter „Team“ einen Link zum Zurücksetzen erzeugen.</p>
    </main>
  );
}
