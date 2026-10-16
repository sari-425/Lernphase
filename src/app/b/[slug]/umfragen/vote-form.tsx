"use client";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import type { ActionState } from "@/lib/server/action-result";

export function VoteForm({ action, options, question }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; options: { id: string; label: string }[]; question: string }) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(s) =>
        s.ok ? (
          <Alert kind="success">{s.notice}</Alert>
        ) : (
          <>
            {s.error ? <Alert kind="error">{s.error}</Alert> : null}
            <fieldset>
              <legend className="sr-only">{question}</legend>
              <div className="space-y-2">
                {options.map((o) => (
                  <label key={o.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-3 hover:bg-brand-50">
                    <input type="radio" name="option" value={o.id} required className="h-5 w-5" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton pendingText="Wird gezählt …">Abstimmen</SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}
