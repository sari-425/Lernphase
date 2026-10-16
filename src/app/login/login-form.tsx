"use client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { loginAction } from "./actions";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      {(state) => (
        <>
          {state.error ? <Alert kind="error">{state.error}</Alert> : null}
          <div>
            <label htmlFor="email" className="label">E-Mail-Adresse</label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Passwort</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton pendingText="Anmeldung läuft …">Anmelden</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
