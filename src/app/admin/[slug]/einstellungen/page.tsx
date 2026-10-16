import { requireActor } from "@/lib/server/context";
import { can } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { GenericForm } from "@/components/action-forms";
import { NoPermission } from "@/components/no-permission";
import { BrandPanel } from "@/components/logo";
import { PageTitle } from "@/components/ui";
import { settingsAction, staffCodeAction } from "../actions";

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
