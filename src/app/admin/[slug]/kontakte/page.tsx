import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listContacts } from "@/lib/services/directory";
import { can } from "@/lib/auth/permissions";
import { GenericForm } from "@/components/action-forms";
import { NoPermission } from "@/components/no-permission";
import { PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deleteContactAction, saveContactAction } from "../actions";
import type { Contact } from "@/lib/db/schema";

export const metadata = { title: "Ansprechpartner" };

function Fields({ c }: { c?: Contact }) {
  const id = c?.id ?? "neu";
  const f = (name: keyof Contact, label: string, opts: { type?: string; required?: boolean; max?: number; ph?: string } = {}) => (
    <div>
      <label htmlFor={`${name}-${id}`} className="label">{label}{opts.required ? " *" : ""}</label>
      <input id={`${name}-${id}`} name={name} type={opts.type ?? "text"} required={opts.required} maxLength={opts.max} placeholder={opts.ph} defaultValue={c ? String(c[name] ?? "") : name === "sortOrder" ? "0" : ""} className="input" />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {f("name", "Name", { required: true, max: 100 })}
      {f("roleTitle", "Funktion", { max: 100, ph: "z. B. Vorsitzende/r" })}
      {f("phone", "Telefon (dienstlich)", { max: 40 })}
      {f("email", "E-Mail (dienstlich)", { type: "email" })}
      {f("location", "Ort / Raum", { max: 120 })}
      {f("availability", "Erreichbarkeit", { max: 200, ph: "z. B. Di + Do 9–12 Uhr" })}
      {f("sortOrder", "Reihenfolge", { type: "number" })}
    </div>
  );
}

export default async function ContactsAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, actor } = await requireActor(slug);
  if (!can(actor, "contacts.manage")) return <NoPermission />;
  const contacts = await listContacts(await getDb(), tenant.id);
  return (
    <div className="space-y-6">
      <PageTitle sub="Werden öffentlich angezeigt. Nur dienstliche Kontaktdaten und nur mit Einverständnis der Person eintragen.">Ansprechpartner</PageTitle>
      {contacts.map((c) => (
        <section key={c.id} className="card space-y-3">
          <h2 className="font-bold">{c.name}</h2>
          <GenericForm action={saveContactAction.bind(null, slug, c.id)} submit="Speichern">
            <Fields c={c} />
          </GenericForm>
          <form action={deleteContactAction.bind(null, slug, c.id)}>
            <SubmitButton className="btn-danger">Entfernen</SubmitButton>
          </form>
        </section>
      ))}
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Neuer Ansprechpartner</h2>
        <GenericForm action={saveContactAction.bind(null, slug, null)} submit="Hinzufügen" resetOnSuccess>
          <Fields />
        </GenericForm>
      </section>
    </div>
  );
}
