import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandPanel, LogoMark } from "@/components/logo";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { countTenants } from "@/lib/services/tenants";

/** Kleine Symbole (24×24, currentColor) – gleiche Formensprache wie die Navigation im Betriebsratsbereich. */
const ICON = {
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z" fill="none" stroke="currentColor" strokeWidth="2" />,
  lesen: <path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h5" fill="none" stroke="currentColor" strokeWidth="2" />,
  glocke: <path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0" />,
  schloss: <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  umfrage: <path d="M5 20V12M12 20V5M19 20v-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />,
  archiv: <path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" fill="none" stroke="currentColor" strokeWidth="2" />,
  kontakt: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0z" />,
};

function Icon({ name, className = "h-6 w-6" }: { name: keyof typeof ICON; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      {ICON[name]}
    </svg>
  );
}

const STEPS: { icon: keyof typeof ICON; title: string; text: string }[] = [
  {
    icon: "qr",
    title: "QR-Code scannen",
    text: "Halten Sie die Handykamera auf den QR-Code am Aushang Ihres Betriebsrats – oder tippen Sie oben die Kurzadresse ein.",
  },
  {
    icon: "lesen",
    title: "Einfach lesen",
    text: "Mitteilungen, Umfragen und Ansprechpartner sind sofort da. Ohne Konto, ohne Passwort, ohne App-Store.",
  },
  {
    icon: "glocke",
    title: "Nichts mehr verpassen",
    text: "Wenn Sie möchten: Seite auf den Startbildschirm legen und Benachrichtigungen einschalten. Jederzeit wieder abschaltbar.",
  },
];

const PRIVACY = [
  "Sie brauchen kein Konto und geben keinen Namen an.",
  "Niemand sieht, wer welche Mitteilung gelesen hat.",
  "Abstimmungen in Umfragen bleiben anonym.",
  "Keine Werbung, kein Tracking, keine Daten an Werbe- oder KI-Anbieter.",
];

const FEATURES: { icon: keyof typeof ICON; title: string; text: string }[] = [
  { icon: "lesen", title: "Mitteilungen", text: "Neuigkeiten und Aushänge Ihres Betriebsrats" },
  { icon: "umfrage", title: "Umfragen", text: "Ihre Meinung zählt – anonym abstimmen" },
  { icon: "archiv", title: "Archiv & Suche", text: "Ältere Informationen schnell wiederfinden" },
  { icon: "kontakt", title: "Ansprechpartner", text: "Wer im Betriebsrat für Sie da ist" },
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const def = env().DEFAULT_TENANT_SLUG;
  if (def) redirect(`/b/${def}`);
  const { fehler } = await searchParams;
  const noTenants = (await countTenants(await getDb())) === 0;
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="bg-[#111111] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <LogoMark className="h-11 w-11 shrink-0" title="" />
          <span className="flex-1 text-base leading-tight font-bold">Betriebsrat Direkt</span>
          <Link href="/login" className="btn-ghost px-3 text-sm text-white hover:bg-white/10">
            Anmeldung
          </Link>
        </div>
      </header>

      <main id="inhalt" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
        {noTenants ? (
          <section className="mb-8 rounded-xl border-2 border-brand-600 bg-brand-50 p-5" aria-labelledby="erste-schritte">
            <h2 id="erste-schritte" className="text-xl font-bold text-brand-900">Erste Schritte: Noch kein Betriebsrat eingerichtet</h2>
            <p className="mt-1">Legen Sie zuerst Ihren Betriebsrat und Ihr Administrator-Konto an. Danach melden Sie sich über „Anmeldung für Betriebsräte“ an.</p>
            <Link href="/einrichtung" className="btn-primary mt-3">Betriebsrat einrichten</Link>
          </section>
        ) : null}

        {/* Einstieg: Betriebsrat öffnen */}
        <div className="grid items-center gap-8 md:grid-cols-[1fr_17rem]">
          <div className="space-y-5">
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Ihr Betriebsrat.
              <br />
              Direkt auf Ihrem Handy.
            </h1>
            <p className="text-lg">
              Alle Informationen Ihres Betriebsrats an einem Ort – <strong>kostenlos, ohne Werbung, ohne Tracking</strong> und ohne Konto.
            </p>
            <form action="/finden" className="card space-y-3" role="search">
              <label htmlFor="adresse" className="label text-lg">Ihren Betriebsrat öffnen</label>
              <p className="hint -mt-1">
                Die Kurzadresse steht auf dem Aushang bzw. QR-Code Ihres Betriebsrats. Am schnellsten geht es, wenn Sie den QR-Code mit der Handykamera scannen.
              </p>
              {fehler ? (
                <p role="alert" className="font-medium text-red-800">
                  Unter dieser Kurzadresse wurde kein Betriebsrat gefunden. Bitte prüfen Sie die Schreibweise auf dem Aushang.
                </p>
              ) : null}
              <div className="flex gap-2">
                <input id="adresse" name="adresse" required maxLength={48} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="z. B. gruener-systemtechnik" className="input" />
                <button className="btn-primary shrink-0" type="submit">Öffnen</button>
              </div>
            </form>
          </div>
          <div className="hidden md:block">
            <BrandPanel slogan="Gemeinsam stark" sloganSub="Für eine bessere Zukunft" />
          </div>
        </div>

        {/* So funktioniert's */}
        <section className="mt-14" aria-labelledby="so-gehts">
          <h2 id="so-gehts" className="text-2xl font-bold text-brand-900">So einfach geht&apos;s</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card flex gap-4 md:flex-col md:gap-3">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name={s.icon} />
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">
                    <span className="sr-only">Schritt {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-1 text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Was Sie finden */}
        <section className="mt-14" aria-labelledby="inhalte">
          <h2 id="inhalte" className="text-2xl font-bold text-brand-900">Das finden Sie dort</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <Icon name={f.icon} />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{f.title}</span>
                  <span className="block text-sm text-muted">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Datenschutz */}
        <section className="mt-14 rounded-2xl bg-brand-900 p-6 text-white sm:p-8" aria-labelledby="privatsphaere">
          <div className="flex items-center gap-3">
            <Icon name="schloss" className="h-8 w-8 shrink-0" />
            <h2 id="privatsphaere" className="text-2xl font-bold">Ihre Privatsphäre ist geschützt</h2>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {PRIVACY.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden="true" className="font-bold text-emerald-300">✔</span>
                <span className="text-white/90">{p}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Für Mitglieder des Betriebsrats */}
        <section className="mt-14 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="fuer-br">
          <h2 id="fuer-br" className="text-lg font-semibold text-ink">Sie sind im Betriebsrat?</h2>
          <p className="mt-1 text-muted">Hier melden Sie sich an, um Mitteilungen und Umfragen zu veröffentlichen.</p>
          <p className="mt-3 flex flex-wrap gap-3">
            <Link href="/login" className="btn-secondary">Anmeldung für Betriebsräte</Link>
            <Link href="/einrichtung" className="btn-ghost">Neuen Betriebsrat einrichten</Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-sm text-muted">
        <Link href="/datenschutz" className="link">Datenschutz</Link> · <Link href="/impressum" className="link">Impressum</Link>
        <span className="block sm:inline"> · Keine Werbung, kein Tracking.</span>
      </footer>
    </div>
  );
}
