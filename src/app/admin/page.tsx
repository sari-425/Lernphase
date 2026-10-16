import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/server/context";
import { listUserTenants } from "@/lib/services/auth";
import { EmptyState, PageTitle } from "@/components/ui";
import { logoutAction } from "@/app/login/actions";

export const metadata = { title: "Verwaltung" };

export default async function AdminHome() {
  const user = await requireUser();
  const tenants = await listUserTenants(await getDb(), user.id);
  if (tenants.length === 1) redirect(`/admin/${tenants[0].slug}`);
  return (
    <main id="inhalt" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <PageTitle sub={`Angemeldet als ${user.displayName}`}>Ihre Betriebsräte</PageTitle>
      {tenants.length === 0 ? (
        <EmptyState title="Sie sind derzeit keinem Betriebsrat zugeordnet" />
      ) : (
        <ul className="space-y-3">
          {tenants.map((t) => (
            <li key={t.slug}>
              <Link href={`/admin/${t.slug}`} className="card block font-semibold hover:bg-brand-50">{t.name}</Link>
            </li>
          ))}
        </ul>
      )}
      <form action={logoutAction} className="mt-6">
        <button className="btn-secondary" type="submit">Abmelden</button>
      </form>
    </main>
  );
}
