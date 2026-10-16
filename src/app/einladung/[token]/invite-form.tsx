"use client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { Alert } from "@/components/ui";
import type { ActionState } from "@/lib/server/action-result";

export function InviteForm({ action }: { action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="space-y-4">
      {(s) => {
        const fe = s.fieldErrors ?? {};
        return (
          <>
            {s.error ? <Alert kind="error">{s.error}</Alert> : null}
            <TextField name="displayName" label="Ihr Name" required autoComplete="name" error={fe.displayName} hint="So erscheinen Sie im Team und im Änderungsprotokoll." />
            <TextField name="email" label="E-Mail-Adresse" type="email" required autoComplete="username" error={fe.email} hint="Nur für die Anmeldung. Haben Sie bereits ein Konto, verwenden Sie dessen Adresse und Passwort." />
            <TextField name="password" label="Passwort" type="password" required minLength={12} autoComplete="new-password" error={fe.password} hint="Mindestens 12 Zeichen." />
            <SubmitButton>Einladung annehmen</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
