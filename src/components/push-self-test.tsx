"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";
import type { ActionState } from "@/lib/server/action-result";

/** Schickt eine Test-Benachrichtigung an DIESES Gerät (echter Weg über den Push-Dienst). */
export function PushSelfTest({ slug, action }: { slug: string; action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator)) return setEndpoint(null);
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        setEndpoint(sub?.endpoint ?? null);
      } catch {
        setEndpoint(null);
      }
    })();
  }, []);
  if (endpoint === undefined) return <p className="text-sm text-muted">Prüfe dieses Gerät …</p>;
  if (!endpoint)
    return (
      <p className="text-sm">
        Auf diesem Gerät sind keine Benachrichtigungen aktiv. <Link className="link" href={`/b/${slug}/benachrichtigungen`}>Jetzt aktivieren</Link>, dann hier testen.
      </p>
    );
  return (
    <ActionForm action={action} className="space-y-2">
      {(s) => (
        <>
          {s.error ? <Alert kind="error">{s.error}</Alert> : s.notice ? <Alert kind="success">{s.notice}</Alert> : null}
          <input type="hidden" name="endpoint" value={endpoint} />
          <SubmitButton className="btn-secondary" pendingText="Sende …">Test-Benachrichtigung an dieses Gerät</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
