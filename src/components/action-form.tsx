"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/server/action-result";

/**
 * Formular für Server-Aktionen, das Eingaben bei Fehlern NICHT verwirft.
 * (React setzt Formulare mit `action`-Prop nach jedem Absenden zurück – bei einer
 * Fehlermeldung müssten Nutzer sonst alles neu eintippen.)
 */
const PendingContext = createContext(false);
export const useActionPending = () => useContext(PendingContext);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  noValidate,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  noValidate?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <PendingContext value={pending}>
      <form
        ref={ref}
        className={className}
        noValidate={noValidate}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          startTransition(() => dispatch(fd));
        }}
      >
        {typeof children === "function" ? children(state) : children}
      </form>
    </PendingContext>
  );
}
