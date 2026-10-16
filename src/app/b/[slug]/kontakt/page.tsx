import { getDb } from "@/lib/db";
import { loadTenant } from "@/lib/server/context";
import { listContacts } from "@/lib/services/directory";
import { EmptyState, PageTitle } from "@/components/ui";

export const metadata = { title: "Ansprechpartner" };

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  const contacts = await listContacts(await getDb(), tenant.id);
  return (
    <div>
      <PageTitle sub="Sprechen Sie uns an – vertraulich.">Ansprechpartner</PageTitle>
      {contacts.length === 0 ? (
        <EmptyState title="Noch keine Ansprechpartner hinterlegt" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.id} className="card space-y-1">
              <p className="text-lg font-bold text-brand-900">{c.name}</p>
              {c.roleTitle ? <p className="font-medium text-muted">{c.roleTitle}</p> : null}
              <dl className="mt-2 space-y-1">
                {c.phone ? (
                  <div className="flex gap-2"><dt className="sr-only">Telefon</dt><dd><a className="link" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>📞 {c.phone}</a></dd></div>
                ) : null}
                {c.email ? (
                  <div className="flex gap-2"><dt className="sr-only">E-Mail</dt><dd><a className="link break-all" href={`mailto:${c.email}`}>✉️ {c.email}</a></dd></div>
                ) : null}
                {c.location ? (
                  <div className="flex gap-2"><dt className="sr-only">Ort</dt><dd>📍 {c.location}</dd></div>
                ) : null}
                {c.availability ? (
                  <div className="flex gap-2"><dt className="sr-only">Erreichbarkeit</dt><dd>🕑 {c.availability}</dd></div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted">
        Hinweis: Diese App bietet bewusst keine Nachrichtenfunktion an den Betriebsrat. Vertrauliche Anliegen besprechen Sie bitte persönlich, telefonisch oder per E-Mail.
      </p>
    </div>
  );
}
