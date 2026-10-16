"use client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import { Alert } from "@/components/ui";
import { setupAction } from "./actions";

export function SetupForm() {
  return (
    <ActionForm action={setupAction} className="space-y-5">
      {(s) => {
        const fe = s.fieldErrors ?? {};
        return (
          <>
            {s.error ? <Alert kind="error">{s.error}</Alert> : null}
            <TextField name="token" label="Einrichtungs-Token" type="password" required autoComplete="off" hint="Steht in der Server-Konfiguration (SETUP_TOKEN)." error={fe.token} />
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-bold">Betriebsrat</legend>
              <TextField name="tenantName" label="Name" required placeholder="Betriebsrat Grüner Systemtechnik" error={fe.tenantName} maxLength={120} />
              <TextField name="companyName" label="Betrieb / Unternehmen (optional)" placeholder="Grüner Systemtechnik" error={fe.companyName} maxLength={120} />
              <TextField name="slug" label="Kurzadresse" required placeholder="gruener-systemtechnik" hint="Wird Teil des Links: …/b/kurzadresse. Kleinbuchstaben, Ziffern, Bindestriche." error={fe.slug} maxLength={48} />
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-bold">Erster Administrator</legend>
              <TextField name="adminName" label="Name" required autoComplete="name" error={fe.adminName} maxLength={80} />
              <TextField name="adminEmail" label="E-Mail-Adresse" type="email" required autoComplete="username" hint="Dienstliche Adresse genügt. Wird nur für die Anmeldung verwendet." error={fe.adminEmail} />
              <TextField name="adminPassword" label="Passwort" type="password" required minLength={12} autoComplete="new-password" hint="Mindestens 12 Zeichen. Tipp: mehrere Wörter kombinieren." error={fe.adminPassword} />
            </fieldset>
            <SubmitButton pendingText="Wird eingerichtet …">Betriebsrat einrichten</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
