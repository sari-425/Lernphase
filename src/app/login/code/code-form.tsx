"use client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { secondFactorAction } from "../actions";

export function CodeForm() {
  return (
    <ActionForm action={secondFactorAction} className="space-y-4">
      {(s) => (
        <>
          {s.error ? <Alert kind="error">{s.error}</Alert> : null}
          <div>
            <label htmlFor="code" className="label">6-stelliger Code aus Ihrer Authenticator-App</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={20} className="input text-center text-2xl tracking-[0.3em]" aria-describedby="code-hint" />
            <p id="code-hint" className="hint">Kein Zugriff auf die App? Geben Sie einen Ihrer Wiederherstellungscodes ein (Format xxxx-xxxx-xx).</p>
          </div>
          <SubmitButton pendingText="Prüfe …">Anmelden</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
