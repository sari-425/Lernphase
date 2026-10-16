import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listAudit } from "@/lib/services/audit";
import { can } from "@/lib/auth/permissions";
import { NoPermission } from "@/components/no-permission";
import { PageTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Protokoll" };

const LABELS: Record<string, string> = {
  "message.create": "Mitteilung erstellt",
  "message.update": "Mitteilung geändert",
  "message.submit": "Zur Freigabe eingereicht",
  "message.publish": "Mitteilung veröffentlicht",
  "message.schedule": "Veröffentlichung geplant",
  "message.archive": "Mitteilung archiviert",
  "message.withdraw": "Mitteilung zurückgezogen",
  "message.revert_draft": "Zurück zu Entwurf",
  "message.delete": "Mitteilung gelöscht",
  "push.trigger": "Push manuell ausgelöst",
  "attachment.add": "Anhang hinzugefügt",
  "attachment.remove": "Anhang entfernt",
  "invite.create": "Einladung erstellt",
  "member.update": "Rolle geändert",
  "member.remove": "Mitglied entfernt",
  "settings.update": "Einstellungen geändert",
  "staff_code.set": "Belegschafts-Code geändert",
  "staff_code.remove": "Belegschafts-Code entfernt",
  "contact.create": "Ansprechpartner angelegt",
  "contact.delete": "Ansprechpartner entfernt",
  "category.create": "Kategorie angelegt",
  "category.delete": "Kategorie gelöscht",
};

export default async function AuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { actor } = await requireActor(slug);
  if (!can(actor, "audit.read")) return <NoPermission />;
  const rows = await listAudit(await getDb(), actor, 200);
  return (
    <div>
      <PageTitle sub="Wer hat wann was veröffentlicht oder geändert. Einträge werden nach 12 Monaten automatisch gelöscht. Es werden keine Daten von Beschäftigten protokolliert.">Änderungsprotokoll</PageTitle>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-muted"><th className="py-1 pr-3">Zeit</th><th className="pr-3">Person</th><th>Aktion</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                <td className="pr-3">{r.userName ?? "gelöschtes Konto"}</td>
                <td>{LABELS[r.action] ?? r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
