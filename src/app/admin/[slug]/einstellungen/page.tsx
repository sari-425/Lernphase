import { requireActor } from "@/lib/server/context";
import { can } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { GenericForm } from "@/components/action-forms";
import { NoPermission } from "@/components/no-permission";
import { BrandPanel } from "@/components/logo";
import { Alert, PageTitle } from "@/components/ui";
import { legalIncomplete } from "@/lib/content/legal";
import { legalTextsAction, settingsAction, staffCodeAction } from "../actions";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, actor } = await requireActor(slug);
  if (!can(actor, "settings.manage")) return <NoPermission />;
  const base = env().APP_URL ?? "";
  return (
    <div className="space-y-6">
      <PageTitle>Einstellungen</PageTitle>
      <section className="card space-y-2">
        <h2 className="text-lg font-bold">Adresse für Beschäftigte</h2>
        <p>
          <code className="rounded bg-slate-100 px-2 py-1 break-all">{base}/b/{slug}</code>
        </p>
        <p className="text-sm text-muted">Diese Adresse bzw. die Kurzadresse <strong>{slug}</strong> am Schwarzen Brett, im Intranet oder als QR-Code bekanntgeben. Es gibt bewusst kein öffentliches Verzeichnis aller Betriebsräte.</p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Darstellung</h2>
          <GenericForm action={settingsAction.bind(null, slug)} submit="Speichern">
            {[
              ["name", "Name des Betriebsrats", tenant.name, 120],
              ["companyName", "Betrieb (unter dem Logo)", tenant.companyName, 120],
              ["slogan", "Leitspruch (z. B. Gemeinsam stark)", tenant.slogan, 80],
              ["sloganSub", "Unterzeile (z. B. Für eine bessere Zukunft)", tenant.sloganSub, 120],
            ].map(([n, l, v, max]) => (
              <div key={n as string}>
                <label htmlFor={n as string} className="label">{l}</label>
                <input id={n as string} name={n as string} defaultValue={v as string} maxLength={max as number} className="input" />
              </div>
            ))}
            <div>
              <label htmlFor="welcomeText" className="label">Begrüßungstext auf der Startseite (optional)</label>
              <textarea id="welcomeText" name="welcomeText" rows={4} maxLength={1000} defaultValue={tenant.welcomeText} className="input" />
            </div>
          </GenericForm>
        </section>
        <div><BrandPanel companyName={tenant.companyName} slogan={tenant.slogan} sloganSub={tenant.sloganSub} /></div>
      </div>
      <section className="card space-y-3" aria-labelledby="rechtliches">
        <h2 id="rechtliches" className="text-lg font-bold">Impressum und Datenschutz</h2>
        <p className="text-sm text-muted">
          Diese Angaben erscheinen öffentlich im <a className="link" href={`/b/${slug}/impressum`}>Impressum</a> und in der{" "}
          <a className="link" href={`/b/${slug}/datenschutz`}>Datenschutzerklärung</a>. Der übrige Text der Datenschutzerklärung beschreibt die App und ist bereits vorhanden.
          Gespeichert wird nur in der Datenbank dieses Servers. Mehrere Zeilen und Links (https://…) sind möglich. Bitte rechtlich prüfen lassen (z. B. durch die/den Datenschutzbeauftragte/n).
        </p>
        {legalIncomplete(tenant, "imprint") || legalIncomplete(tenant, "privacy") ? (
          <Alert kind="warning" title="Noch unvollständig">Impressum, Verantwortlicher, Hosting und Aufsichtsbehörde sollten ausgefüllt sein, bevor die App im Betrieb bekanntgegeben wird.</Alert>
        ) : null}
        <GenericForm action={legalTextsAction.bind(null, slug)} submit="Angaben speichern">
          {[
            ["imprintText", "Impressum", tenant.imprintText, 3000, 6, "Wer bietet die Seite an? Name bzw. Bezeichnung, Anschrift, E-Mail, ggf. Telefon.", "Betriebsrat der Muster GmbH\nVorsitzende/r: Vorname Name\nMusterstraße 1, 12345 Musterstadt\nE-Mail: betriebsrat@example.org"],
            ["privacyController", "Verantwortlicher (Datenschutz)", tenant.privacyController, 1000, 4, "In der Regel der Arbeitgeber (§ 79a BetrVG): Firma, Anschrift, Kontakt.", "Muster GmbH\nMusterstraße 1, 12345 Musterstadt\nE-Mail: info@example.org"],
            ["privacyCouncilContact", "Kontakt des Betriebsrats", tenant.privacyCouncilContact, 1000, 3, "Inhaltlich verantwortlich für die Mitteilungen.", "Betriebsrat der Muster GmbH, Musterstraße 1, 12345 Musterstadt, betriebsrat@example.org"],
            ["privacyDpo", "Datenschutzbeauftragte/r (falls vorhanden)", tenant.privacyDpo, 1000, 3, "Name oder Funktion und Kontakt.", "Datenschutzbeauftragte/r der Muster GmbH, datenschutz@example.org"],
            ["privacyHosting", "Hosting-Anbieter", tenant.privacyHosting, 1000, 3, "Wo läuft der Server? Mit dem Anbieter muss ein Auftragsverarbeitungsvertrag bestehen.", "Name des Anbieters, Anschrift; Serverstandort Deutschland"],
            ["privacyAuthority", "Zuständige Aufsichtsbehörde", tenant.privacyAuthority, 1000, 3, "Datenschutz-Aufsichtsbehörde des Bundeslands, in dem der Verantwortliche sitzt.", "Name der Behörde, Anschrift, Website"],
          ].map(([n, l, v, max, rows, hint, ph]) => (
            <div key={n as string}>
              <label htmlFor={n as string} className="label">{l}</label>
              <p id={`${n}-hint`} className="hint -mt-1 mb-1">{hint}</p>
              <textarea
                id={n as string}
                name={n as string}
                rows={rows as number}
                maxLength={max as number}
                defaultValue={v as string}
                placeholder={ph as string}
                aria-describedby={`${n}-hint`}
                className="input"
              />
            </div>
          ))}
        </GenericForm>
      </section>
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Belegschafts-Zugangscode</h2>
        <p className="text-sm text-muted">
          Mitteilungen im Bereich „Belegschaft“ sind nur nach Eingabe dieses Codes lesbar. Er schützt vor zufälligem Zugriff von außen, ist aber kein persönlicher Zugang: Wer den Code kennt, kann mitlesen. Wirklich vertrauliche Inhalte daher nur als „Gremium intern“. Den Code regelmäßig (z. B. quartalsweise) und bei Bedarf sofort ändern.
        </p>
        <p>Status: <strong>{tenant.staffAccessCodeHash ? "eingerichtet" : "nicht eingerichtet"}</strong></p>
        <GenericForm action={staffCodeAction.bind(null, slug)} submit={tenant.staffAccessCodeHash ? "Neuen Code speichern" : "Code festlegen"} resetOnSuccess>
          <div>
            <label htmlFor="code" className="label">Neuer Code</label>
            <input id="code" name="code" type="text" minLength={8} maxLength={64} autoComplete="off" className="input" aria-describedby="code-hint" />
            <p id="code-hint" className="hint">Mindestens 8 Zeichen. Wird nur verschlüsselt (gehasht) gespeichert und kann nicht wieder angezeigt werden.</p>
          </div>
        </GenericForm>
        {tenant.staffAccessCodeHash ? (
          <GenericForm action={staffCodeAction.bind(null, slug)} submit="Belegschafts-Zugang abschalten">
            <input type="hidden" name="intent" value="remove" />
          </GenericForm>
        ) : null}
      </section>
    </div>
  );
}
