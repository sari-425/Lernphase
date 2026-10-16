"use client";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import type { ActionState } from "@/lib/server/action-result";
import { totpBeginAction, totpConfirmAction } from "./actions";

function Msg({ s }: { s: ActionState }) {
  if (s.error) return <Alert kind="error">{s.error}</Alert>;
  if (s.notice) return <Alert kind="success">{s.notice}</Alert>;
  return null;
}

export function TotpSetup() {
  // Zwei getrennte Formulare (Formulare dürfen nicht verschachtelt sein)
  const [begin, beginAction] = useActionState(totpBeginAction, { ok: false });
  if (!begin.data?.secret) {
    return (
      <form action={beginAction} className="space-y-4">
        <Msg s={begin} />
        <p>Zusätzlich zum Passwort wird bei der Anmeldung ein 6-stelliger Code aus einer Authenticator-App abgefragt (z. B. Aegis, FreeOTP, 2FAS, Google oder Microsoft Authenticator). Empfohlen für alle Administratoren.</p>
        <SubmitButton>Zwei-Faktor-Anmeldung einrichten</SubmitButton>
      </form>
    );
  }
  return (
    <div className="space-y-4">
      <p>1. Authenticator-App öffnen und diesen QR-Code scannen:</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- lokal erzeugtes Daten-Bild */}
      <img src={begin.data.qr} alt="QR-Code für die Authenticator-App" width={220} height={220} className="rounded border border-slate-200" />
      <p className="text-sm">
        Oder Schlüssel manuell eingeben: <code className="rounded bg-slate-100 px-2 py-1 break-all">{begin.data.secret.match(/.{1,4}/g)?.join(" ")}</code>
      </p>
      <TotpConfirm />
    </div>
  );
}

function TotpConfirm() {
  return (
    <ActionForm action={totpConfirmAction} className="space-y-3">
      {(s) =>
        s.data?.codes ? (
          <Alert kind="success" title="Aktiv! Bitte jetzt die Wiederherstellungscodes sichern">
            <p className="mb-2">Jeder Code funktioniert einmal, falls Sie keinen Zugriff auf die App haben. Ausdrucken oder im Passwortmanager speichern – sie werden nicht erneut angezeigt.</p>
            <pre className="rounded bg-white p-3 font-mono text-base">{s.data.codes}</pre>
            <a href="/konto" className="btn-primary mt-3">Fertig</a>
          </Alert>
        ) : (
          <>
            <Msg s={s} />
            <label htmlFor="totp-code" className="label">2. Angezeigten 6-stelligen Code eingeben</label>
            <input id="totp-code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} className="input max-w-48 text-center text-xl tracking-[0.3em]" />
            <SubmitButton>Bestätigen und aktivieren</SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}

export function SimpleForm({ action, children, submit, danger }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; children?: React.ReactNode; submit: string; danger?: boolean }) {
  return (
    <ActionForm action={action} className="space-y-3" resetOnSuccess>
      {(s) => (
        <>
          <Msg s={s} />
          {children}
          <SubmitButton className={danger ? "btn-danger" : "btn-primary"}>{submit}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
