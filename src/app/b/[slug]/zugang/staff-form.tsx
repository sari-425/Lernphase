"use client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import type { ActionState } from "@/lib/server/action-result";

export function StaffCodeForm({ action, next }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; next: string }) {
  return (
    <ActionForm action={action} className="space-y-4">
      {(state) => (
        <>
          {state.error ? <Alert kind="error">{state.error}</Alert> : null}
          <input type="hidden" name="weiter" value={next} />
          <div>
            <label htmlFor="code" className="label">Belegschafts-Zugangscode</label>
            <input id="code" name="code" type="password" autoComplete="off" required minLength={4} maxLength={64} className="input" aria-describedby="code-hint" />
            <p id="code-hint" className="hint">Den Code gibt der Betriebsrat bekannt, z. B. am Schwarzen Brett oder in der Betriebsversammlung.</p>
          </div>
          <SubmitButton>Zugang freischalten</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
