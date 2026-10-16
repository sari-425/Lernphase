"use client";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";
import type { ActionState } from "@/lib/server/action-result";

export function PublishPanel({
  action,
  isPublic,
  warnings,
  scheduledFor,
  pushEnabled,
  visibilityLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  isPublic: boolean;
  warnings: { label: string; match: string }[];
  scheduledFor: string | null;
  pushEnabled: boolean;
  visibilityLabel: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      {(s) => (
      <>
      {s.error ? <Alert kind="error">{s.error}</Alert> : null}
      <ul className="space-y-1 text-sm">
        <li>Bereich: <strong>{visibilityLabel}</strong></li>
        <li>Zeitpunkt: <strong>{scheduledFor ? `geplant für ${scheduledFor}` : "sofort"}</strong></li>
        <li>Push: <strong>{pushEnabled ? (scheduledFor ? "zum geplanten Zeitpunkt" : "direkt nach Veröffentlichung") : "nein"}</strong></li>
      </ul>
      {warnings.length > 0 ? (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-amber-950">
          <p className="font-bold">⚠ Bitte prüfen: möglicherweise vertrauliche oder personenbezogene Inhalte</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {warnings.map((w, i) => (
              <li key={i}>
                {w.label}: „{w.match}“
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">Personalangelegenheiten einzelner Beschäftigter, Gesundheitsdaten oder interne Gremiumsinhalte gehören nicht in Mitteilungen an die Belegschaft.</p>
          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" name="confirmSensitive" required className="mt-1 h-5 w-5 shrink-0" />
            <span>Ich habe die Hinweise geprüft. Die Veröffentlichung ist zulässig und erforderlich.</span>
          </label>
        </div>
      ) : null}
      {isPublic ? (
        <div className="rounded-lg border-2 border-amber-500 bg-white p-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="confirmPublic" required className="mt-1 h-5 w-5 shrink-0" />
            <span>
              <strong>Ich bestätige:</strong> Diese Mitteilung wird <strong>öffentlich</strong> – jede Person mit dem Link kann sie lesen, auch außerhalb des Betriebs. Sie enthält keine vertraulichen Informationen.
            </span>
          </label>
        </div>
      ) : null}
      <SubmitButton pendingText="Wird veröffentlicht …">{scheduledFor ? "Veröffentlichung planen" : "Jetzt veröffentlichen"}</SubmitButton>
      </>
      )}
    </ActionForm>
  );
}
