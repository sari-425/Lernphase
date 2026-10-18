import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandPanel } from "@/components/logo";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { countTenants } from "@/lib/services/tenants";

export default async function Landing({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const def = env().DEFAULT_TENANT_SLUG;
  if (def) redirect(`/b/${def}`);
  const { fehler } = await searchParams;
  const setupOpen = Boolean(env().SETUP_TOKEN) && (await countTenants(await getDb())) === 0;
  return (
    <main id="inhalt" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <div className="grid items-start gap-8 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-5">
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">Betriebsrat Direkt</h1>
          <p className="text-lg">
            Informationen Ihres Betriebsrats direkt auf dem Smartphone – <strong>kostenlos, ohne Werbung, ohne Tracking</strong> und ohne Konto.
          </p>
          <form action="/finden" className="card space-y-3" role="search">
            <label htmlFor="adresse" className="label text-lg">Ihren Betriebsrat öffnen</label>
            <p className="hint -mt-1">Die Kurzadresse steht auf dem Aushang bzw. QR-Code Ihres Betriebsrats.</p>
            {fehler ? <p role="alert" className="font-medium text-red-800">Unter dieser Kurzadresse wurde kein Betriebsrat gefunden.</p> : null}
            <div className="flex gap-2">
              <input id="adresse" name="adresse" required maxLength={48} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="z. B. gruener-systemtechnik" className="input" />
              <button className="btn-primary shrink-0" type="submit">Öffnen</button>
            </div>
          </form>
          <ul className="space-y-1 text-muted">
            <li>✔ Lesen ohne Anmeldung</li>
            <li>✔ Freiwillige Push-Benachrichtigungen</li>
            <li>✔ Keine Daten an Werbe- oder KI-Anbieter</li>
          </ul>
          <p className="flex flex-wrap gap-3">
            <Link href="/login" className="btn-secondary">Anmeldung für Betriebsräte</Link>
            {setupOpen ? <Link href="/einrichtung" className="btn-ghost">Ersteinrichtung</Link> : null}
          </p>
        </div>
        <BrandPanel slogan="Gemeinsam stark" sloganSub="Für eine bessere Zukunft" />
      </div>
      <footer className="mt-12 text-center text-sm text-muted">
        <Link href="/datenschutz" className="link">Datenschutz</Link> · <Link href="/impressum" className="link">Impressum</Link>
      </footer>
    </main>
  );
}
