import { loadTenant, readerAccess } from "@/lib/server/context";
import { Alert, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { enterStaffCode, forgetStaffAccess } from "./actions";
import { StaffCodeForm } from "./staff-form";

export const metadata = { title: "Belegschafts-Zugang" };

export default async function StaffAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { slug } = await params;
  const { weiter } = await searchParams;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle sub="Einige Informationen sind nur für Beschäftigte des Betriebs bestimmt.">Belegschafts-Zugang</PageTitle>
      {!tenant.staffAccessCodeHash ? (
        <Alert kind="info">Für diesen Betriebsrat ist kein Belegschafts-Zugang eingerichtet. Alle Mitteilungen für Beschäftigte sind öffentlich abrufbar.</Alert>
      ) : access.staff ? (
        <div className="card space-y-4">
          <Alert kind="success" title="Zugang aktiv">Auf diesem Gerät sind Belegschafts-Informationen freigeschaltet.</Alert>
          <form action={forgetStaffAccess.bind(null, slug)}>
            <SubmitButton className="btn-secondary">Zugang auf diesem Gerät entfernen</SubmitButton>
          </form>
          <p className="hint">Tipp: Auf fremden oder gemeinsam genutzten Geräten den Zugang nach dem Lesen wieder entfernen.</p>
        </div>
      ) : (
        <div className="card space-y-4">
          <StaffCodeForm action={enterStaffCode.bind(null, slug)} next={weiter ?? ""} />
          <details className="text-sm text-muted">
            <summary className="cursor-pointer font-semibold text-brand-800">Was wird gespeichert?</summary>
            <p className="mt-2">
              Nur ein technisches Merkmal (Cookie) auf Ihrem Gerät, dass der Code eingegeben wurde. Es enthält keine Angaben zu Ihrer Person. Wir speichern weder Namen noch Personalnummer. Ändert der Betriebsrat den Code, müssen Sie ihn neu eingeben.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
