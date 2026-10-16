"use client";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { Alert, FieldError } from "./ui";
import type { ActionState } from "@/lib/server/action-result";

export function PollForm({
  action,
  initial,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  initial: { question: string; description: string; options: string; visibility: string; closesAt: string; resultsPublic: boolean };
}) {
  return (
    <ActionForm action={action} className="card space-y-4" noValidate>
      {(s) => {
        const fe = s.fieldErrors ?? {};
        return (
          <>
            {s.error ? <Alert kind="error">{s.error}</Alert> : null}
            <div>
              <label htmlFor="question" className="label">Frage *</label>
              <input id="question" name="question" defaultValue={initial.question} maxLength={200} className="input" />
              <FieldError error={fe.question} />
            </div>
            <div>
              <label htmlFor="description" className="label">Erläuterung (optional)</label>
              <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={initial.description} className="input" />
            </div>
            <div>
              <label htmlFor="options" className="label">Antwortmöglichkeiten * (eine pro Zeile, 2–10)</label>
              <textarea id="options" name="options" rows={5} defaultValue={initial.options} className="input" placeholder={"Ja\nNein\nEgal"} />
              <FieldError error={fe.options ?? fe["options.0"]} />
            </div>
            <fieldset>
              <legend className="label">Wer darf teilnehmen? *</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name="visibility" value="staff" defaultChecked={initial.visibility === "staff"} className="h-5 w-5" /> 🔒 Belegschaft (mit Zugangscode)</label>
                <label className="flex min-h-11 items-center gap-2"><input type="radio" name="visibility" value="public" defaultChecked={initial.visibility === "public"} className="h-5 w-5" /> 🌐 Jede Person mit dem Link</label>
              </div>
              <FieldError error={fe.visibility} />
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="closesAt" className="label">Endet automatisch am (optional)</label>
                <input id="closesAt" name="closesAt" type="datetime-local" defaultValue={initial.closesAt} className="input" />
                <FieldError error={fe.closesAt} />
              </div>
              <label className="flex items-end gap-3 pb-2">
                <input type="checkbox" name="resultsPublic" defaultChecked={initial.resultsPublic} className="h-5 w-5" />
                Ergebnis nach eigener Stimmabgabe bzw. nach Ende anzeigen
              </label>
            </div>
            <SubmitButton>Als Entwurf speichern</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

export function OpenPollForm({ action, isPublic }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; isPublic: boolean }) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(s) => (
        <>
          {s.error ? <Alert kind="error">{s.error}</Alert> : null}
          {isPublic ? (
            <label className="flex items-start gap-3 rounded-lg border-2 border-amber-500 p-3">
              <input type="checkbox" name="confirmPublic" required className="mt-1 h-5 w-5 shrink-0" />
              <span>Ich bestätige: <strong>jede Person mit dem Link</strong> kann teilnehmen, auch außerhalb des Betriebs.</span>
            </label>
          ) : null}
          <SubmitButton>Umfrage starten</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
