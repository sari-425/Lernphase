"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";
import type { ActionState } from "@/lib/server/action-result";

type Act = (p: ActionState, fd: FormData) => Promise<ActionState>;

function StateMessage({ s }: { s: ActionState }) {
  if (s.error) return <Alert kind="error">{s.error}</Alert>;
  if (s.notice) return <Alert kind="success">{s.notice}</Alert>;
  return null;
}

export function AttachmentUpload({ action }: { action: Act }) {
  return (
    <ActionForm action={action} className="space-y-3" resetOnSuccess>
      {(s) => (
        <>
          <StateMessage s={s} />
          <div>
            <label htmlFor="file" className="label">Datei hinzufügen</label>
            <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="block w-full text-base" aria-describedby="file-hint" />
            <p id="file-hint" className="hint">PDF, PNG oder JPEG, max. 5 MB, höchstens 3 Dateien. Anhänge haben immer denselben Sichtbarkeitsbereich wie die Mitteilung. Bitte keine Dokumente mit personenbezogenen Daten hochladen.</p>
          </div>
          <SubmitButton className="btn-secondary" pendingText="Lädt hoch …">Hochladen</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PushTrigger({ action }: { action: (p: ActionState) => Promise<ActionState> }) {
  return (
    <ActionForm action={(p) => action(p)} className="space-y-2">
      {(s) => (
        <>
          <StateMessage s={s} />
          {!s.ok ? <SubmitButton className="btn-secondary" pendingText="Wird übergeben …">📣 Push jetzt senden</SubmitButton> : null}
        </>
      )}
    </ActionForm>
  );
}

export function GenericForm({
  action,
  children,
  submit,
  className = "space-y-4",
  resetOnSuccess = false,
}: {
  action: Act;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  return (
    <ActionForm action={action} className={className} resetOnSuccess={resetOnSuccess}>
      {(s) => (
        <>
          <StateMessage s={s} />
          {children}
          <div>
            <SubmitButton>{submit}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function InviteForm({ action }: { action: Act }) {
  const [role, setRole] = useState("editor");
  const [copied, setCopied] = useState(false);
  return (
    <ActionForm action={action} className="space-y-4">
      {(s) => {
        const link = s.data?.link ? (s.data.link.startsWith("http") ? s.data.link : window.location.origin + s.data.link) : null;
        return (
          <>
            {s.error ? <Alert kind="error">{s.error}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="role" className="label">Rolle</label>
                <select id="role" name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="editor">Redakteur/in</option>
                  <option value="admin">Administrator/in</option>
                </select>
              </div>
              <div className="flex items-end">
                {role === "editor" ? (
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" name="canPublish" className="h-5 w-5" /> darf veröffentlichen & Push senden
                  </label>
                ) : (
                  <p className="text-sm text-muted">Administratoren dürfen alles in diesem Betriebsrat.</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="note" className="label">Notiz (optional, nur für Sie)</label>
                <input id="note" name="note" className="input" maxLength={100} placeholder="z. B. für Max (Schriftführer)" />
              </div>
            </div>
            <SubmitButton>Einladungslink erstellen</SubmitButton>
            {link ? (
              <Alert kind="success" title="Einladungslink (72 Stunden gültig, nur einmal nutzbar)">
                <p className="mb-2">Bitte persönlich oder über einen vertraulichen Kanal weitergeben. Der Link wird aus Sicherheitsgründen nicht erneut angezeigt.</p>
                <code className="block rounded bg-white p-2 text-sm break-all">{link}</code>
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  }}
                >
                  {copied ? "Kopiert" : "Link kopieren"}
                </button>
              </Alert>
            ) : null}
          </>
        );
      }}
    </ActionForm>
  );
}
