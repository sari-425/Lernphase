import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listCategories } from "@/lib/services/directory";
import { can } from "@/lib/auth/permissions";
import { GenericForm } from "@/components/action-forms";
import { NoPermission } from "@/components/no-permission";
import { PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export const metadata = { title: "Kategorien" };

export default async function CategoriesAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, actor } = await requireActor(slug);
  if (!can(actor, "categories.manage")) return <NoPermission />;
  const cats = await listCategories(await getDb(), tenant.id);
  return (
    <div className="space-y-6">
      <PageTitle sub="Themen, nach denen Beschäftigte filtern und Benachrichtigungen auswählen können.">Kategorien</PageTitle>
      <ul className="space-y-3">
        {cats.map((c) => (
          <li key={c.id} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
            <GenericForm action={saveCategoryAction.bind(null, slug, c.id)} submit="Speichern" className="grid flex-1 gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
              <div>
                <label htmlFor={`n-${c.id}`} className="label">Name</label>
                <input id={`n-${c.id}`} name="name" defaultValue={c.name} required maxLength={60} className="input" />
              </div>
              <div>
                <label htmlFor={`s-${c.id}`} className="label">Reihenfolge</label>
                <input id={`s-${c.id}`} name="sortOrder" type="number" defaultValue={c.sortOrder} className="input" />
              </div>
            </GenericForm>
            <form action={deleteCategoryAction.bind(null, slug, c.id)}>
              <SubmitButton className="btn-danger">Löschen</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Neue Kategorie</h2>
        <GenericForm action={saveCategoryAction.bind(null, slug, null)} submit="Hinzufügen" resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
          <div>
            <label htmlFor="n-neu" className="label">Name</label>
            <input id="n-neu" name="name" required maxLength={60} className="input" />
          </div>
          <div>
            <label htmlFor="s-neu" className="label">Reihenfolge</label>
            <input id="s-neu" name="sortOrder" type="number" defaultValue={100} className="input" />
          </div>
        </GenericForm>
      </section>
    </div>
  );
}
