import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listTeam } from "@/lib/services/tenants";
import { can } from "@/lib/auth/permissions";
import { InviteForm, ResetLinkForm } from "@/components/action-forms";
import { NoPermission } from "@/components/no-permission";
import { PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatDateTime } from "@/lib/time";
import { inviteAction, passwordResetAction, removeMemberAction, revokeInviteAction, updateMemberAction } from "../actions";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { actor } = await requireActor(slug);
  if (!can(actor, "team.manage")) return <NoPermission />;
  const { members, openInvites } = await listTeam(await getDb(), actor);
  return (
    <div className="space-y-6">
      <PageTitle sub="Wer darf Mitteilungen verfassen und veröffentlichen?">Team</PageTitle>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Mitglieder</h2>
        <ul className="divide-y divide-slate-200">
          {members.map((m) => (
            <li key={m.userId} className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-semibold">{m.displayName}{m.userId === actor.userId ? " (Sie)" : ""}</p>
                <p className="text-sm text-muted">{m.email} · seit {formatDate(m.since)}</p>
                {m.userId !== actor.userId ? <ResetLinkForm action={passwordResetAction.bind(null, slug, m.userId)} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={updateMemberAction.bind(null, slug, m.userId)} className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${m.userId}`}>Rolle von {m.displayName}</label>
                  <select id={`role-${m.userId}`} name="role" defaultValue={m.role} className="input w-auto">
                    <option value="editor">Redakteur/in</option>
                    <option value="admin">Administrator/in</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="canPublish" defaultChecked={m.canPublish} className="h-5 w-5" /> veröffentlichen
                  </label>
                  <SubmitButton className="btn-secondary">Speichern</SubmitButton>
                </form>
                <form action={removeMemberAction.bind(null, slug, m.userId)}>
                  <SubmitButton className="btn-danger">Entfernen</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">Beim Entfernen wird das Konto vollständig gelöscht, sofern die Person keinem anderen Betriebsrat angehört. Veröffentlichte Mitteilungen bleiben erhalten.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Neues Mitglied einladen</h2>
        <p className="text-sm text-muted">Es wird kein E-Mail-Dienst benötigt: Sie erhalten einen persönlichen Link, den Sie selbst weitergeben.</p>
        <InviteForm action={inviteAction.bind(null, slug)} />
      </section>
      {openInvites.length ? (
        <section className="card">
          <h2 className="mb-2 text-lg font-bold">Offene Einladungen</h2>
          <ul className="divide-y divide-slate-200">
            {openInvites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{i.role === "admin" ? "Administrator/in" : i.canPublish ? "Redaktion mit Veröffentlichung" : "Redaktion"}{i.note ? ` – ${i.note}` : ""} <span className="text-sm text-muted">· {i.expiresAt > new Date() ? `gültig bis ${formatDateTime(i.expiresAt)}` : "abgelaufen"}</span></span>
                <form action={revokeInviteAction.bind(null, slug, i.id)}>
                  <SubmitButton className="btn-ghost text-red-800">Widerrufen</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
