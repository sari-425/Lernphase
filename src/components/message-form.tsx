"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { Alert, FieldError } from "./ui";
import type { ActionState } from "@/lib/server/action-result";

export interface MessageFormValues {
  title: string;
  body: string;
  categoryId: string;
  priority: "normal" | "high" | "urgent";
  visibility: "public" | "staff" | "council" | "";
  publishAt: string;
  expiresAt: string;
  linkUrl: string;
  pushEnabled: boolean;
  pushTitle: string;
  pushBody: string;
}

const VIS_OPTIONS = [
  {
    value: "council",
    title: "Gremium intern",
    desc: "Nur angemeldete Mitglieder des Betriebsrats. Für interne Abstimmungen, Entwürfe, vertrauliche Themen.",
  },
  {
    value: "staff",
    title: "Belegschaft",
    desc: "Nur Beschäftigte mit dem Belegschafts-Zugangscode. Nicht für Außenstehende sichtbar.",
  },
  {
    value: "public",
    title: "Öffentlich",
    desc: "Jede Person mit dem Link kann die Mitteilung lesen – auch außerhalb des Betriebs. Nur für unkritische Informationen!",
  },
] as const;

export function MessageForm({
  action,
  initial,
  categories,
  isNew,
  canPublish,
  locked,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  initial: MessageFormValues;
  categories: { id: string; name: string }[];
  isNew: boolean;
  canPublish: boolean;
  /** veröffentlicht: Änderungen nur mit Veröffentlichungsrecht */
  locked: boolean;
}) {
  const [visibility, setVisibility] = useState(initial.visibility);
  const [pushEnabled, setPushEnabled] = useState(initial.pushEnabled);
  const [body, setBody] = useState(initial.body);
  const disabled = locked && !canPublish;

  return (
    <ActionForm action={action} className="space-y-6" noValidate>
      {(state) => {
      const fe = state.fieldErrors ?? {};
      return (
      <>
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {disabled ? <Alert kind="info">Diese Mitteilung ist veröffentlicht. Änderungen sind nur mit Veröffentlichungsrecht möglich.</Alert> : null}
      <fieldset disabled={disabled} className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label htmlFor="title" className="label">Titel <span className="text-red-800">*</span></label>
            <input id="title" name="title" className="input text-lg" defaultValue={initial.title} required maxLength={160} aria-invalid={fe.title ? true : undefined} aria-describedby={fe.title ? "title-err" : undefined} />
            <FieldError id="title-err" error={fe.title} />
          </div>
          <div>
            <label htmlFor="body" className="label">Inhalt <span className="text-red-800">*</span></label>
            <textarea
              id="body"
              name="body"
              rows={12}
              className="input font-[inherit]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              aria-describedby="body-hint body-err"
              aria-invalid={fe.body ? true : undefined}
            />
            <p id="body-hint" className="hint">
              Einfaches Format: Leerzeile = neuer Absatz · <code>## Zwischenüberschrift</code> · <code>- Aufzählung</code> · <code>**fett**</code> · Links (https://…) werden automatisch erkannt. {body.length}/20.000 Zeichen
            </p>
            <FieldError id="body-err" error={fe.body} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="categoryId" className="label">Kategorie</label>
              <select id="categoryId" name="categoryId" className="input" defaultValue={initial.categoryId}>
                <option value="">– ohne –</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="label">Priorität</legend>
              <div className="flex flex-wrap gap-4">
                {[
                  ["normal", "Normal"],
                  ["high", "Wichtig"],
                  ["urgent", "Dringend"],
                ].map(([v, l]) => (
                  <label key={v} className="flex min-h-11 items-center gap-2">
                    <input type="radio" name="priority" value={v} defaultChecked={initial.priority === v} className="h-5 w-5" /> {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <fieldset className="card space-y-3" aria-describedby="vis-err">
          <legend className="px-1 text-lg font-bold">Veröffentlichungsbereich <span className="text-red-800">*</span></legend>
          <p className="text-sm text-muted">Bitte bewusst auswählen. Im Zweifel: „Gremium intern“.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {VIS_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={
                  "flex cursor-pointer gap-3 rounded-lg border-2 p-3 " +
                  (visibility === o.value ? (o.value === "public" ? "border-amber-500 bg-amber-50" : "border-brand-600 bg-brand-50") : "border-slate-200")
                }
              >
                <input type="radio" name="visibility" value={o.value} checked={visibility === o.value} onChange={() => setVisibility(o.value)} className="mt-1 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold">{o.value === "public" ? "🌐 " : "🔒 "}{o.title}</span>
                  <span className="block text-sm text-muted">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="vis-err" error={fe.visibility} />
        </fieldset>

        <div className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="publishAt" className="label">Veröffentlichen am (optional)</label>
            <input id="publishAt" name="publishAt" type="datetime-local" className="input" defaultValue={initial.publishAt} aria-describedby="publishAt-hint" />
            <p id="publishAt-hint" className="hint">Leer = sofort bei Veröffentlichung. Deutsche Zeit.</p>
            <FieldError error={fe.publishAt} />
          </div>
          <div>
            <label htmlFor="expiresAt" className="label">Läuft ab am (optional)</label>
            <input id="expiresAt" name="expiresAt" type="datetime-local" className="input" defaultValue={initial.expiresAt} aria-describedby="expiresAt-hint" />
            <p id="expiresAt-hint" className="hint">Danach erscheint die Mitteilung nur noch im Archiv.</p>
            <FieldError error={fe.expiresAt} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="linkUrl" className="label">Weiterführender Link (optional)</label>
            <input id="linkUrl" name="linkUrl" type="url" inputMode="url" className="input" placeholder="https://…" defaultValue={initial.linkUrl} />
            <FieldError error={fe.linkUrl} />
          </div>
        </div>

        <fieldset className="card space-y-3" disabled={visibility === "council"}>
          <legend className="px-1 text-lg font-bold">Push-Benachrichtigung</legend>
          {visibility === "council" ? (
            <p className="text-muted">Interne Gremiums-Mitteilungen werden nicht per Push an Beschäftigte gesendet.</p>
          ) : (
            <>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="pushEnabled" className="h-5 w-5" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} />
                Bei Veröffentlichung eine Push-Benachrichtigung senden
              </label>
              {pushEnabled ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pushTitle" className="label">Push-Titel (optional)</label>
                    <input id="pushTitle" name="pushTitle" className="input" maxLength={80} defaultValue={initial.pushTitle} placeholder="Neue Information des Betriebsrats" />
                  </div>
                  <div>
                    <label htmlFor="pushBody" className="label">Push-Text (optional)</label>
                    <input id="pushBody" name="pushBody" className="input" maxLength={180} defaultValue={initial.pushBody} placeholder="Es gibt eine neue Mitteilung. Jetzt die vollständige Mitteilung lesen." />
                  </div>
                  <p className="text-sm text-amber-900 sm:col-span-2">
                    ⚠ Der Push-Text ist auf dem Sperrbildschirm sichtbar – auch für Umstehende. Bitte neutral formulieren, keine Namen oder vertraulichen Details. Leer lassen = neutraler Standardtext.
                  </p>
                </div>
              ) : (
                <>
                  <input type="hidden" name="pushTitle" value={initial.pushTitle} />
                  <input type="hidden" name="pushBody" value={initial.pushBody} />
                </>
              )}
            </>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <SubmitButton name="intent" value="preview">{isNew ? "Speichern & Vorschau" : "Speichern & Vorschau"}</SubmitButton>
          <SubmitButton name="intent" value="save" className="btn-secondary">Als Entwurf speichern</SubmitButton>
          {!canPublish && !locked ? (
            <SubmitButton name="intent" value="review" className="btn-secondary">Zur Freigabe einreichen</SubmitButton>
          ) : null}
        </div>
      </fieldset>
      </>
      );
      }}
    </ActionForm>
  );
}
