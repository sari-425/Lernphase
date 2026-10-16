import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { sessionSecret } from "@/lib/env";
import { readPendingLoginToken } from "@/lib/services/account";
import { PENDING_2FA_COOKIE } from "@/lib/server/context";
import { CodeForm } from "./code-form";

export const metadata = { title: "Bestätigungscode" };

export default async function CodePage() {
  const pending = readPendingLoginToken(sessionSecret(), (await cookies()).get(PENDING_2FA_COOKIE)?.value);
  if (!pending) redirect("/login");
  return (
    <main id="inhalt" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <PageTitle sub="Zwei-Faktor-Anmeldung">Bestätigungscode</PageTitle>
      <div className="card">
        <CodeForm />
      </div>
    </main>
  );
}
