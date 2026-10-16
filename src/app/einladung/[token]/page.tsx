import { getDb } from "@/lib/db";
import { getInvitation } from "@/lib/services/tenants";
import { Alert, PageTitle } from "@/components/ui";
import { acceptInviteAction } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Einladung", referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = token.length < 100 ? await getInvitation(await getDb(), token) : null;
  return (
    <main id="inhalt" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <PageTitle>Einladung</PageTitle>
      {!inv ? (
        <Alert kind="error" title="Einladung ungültig">Der Link ist abgelaufen (gültig 72 Stunden), wurde bereits verwendet oder ist unvollständig. Bitte um eine neue Einladung bitten.</Alert>
      ) : (
        <div className="card space-y-4">
          <p>
            Sie wurden in das Redaktionsteam von <strong>{inv.tenantName}</strong> eingeladen – als{" "}
            <strong>{inv.role === "admin" ? "Administrator/in" : inv.canPublish ? "Redakteur/in mit Veröffentlichungsrecht" : "Redakteur/in"}</strong>.
          </p>
          <InviteForm action={acceptInviteAction.bind(null, token)} />
        </div>
      )}
    </main>
  );
}
