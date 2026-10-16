"use client";
import { useFormStatus } from "react-dom";
import { useActionPending } from "./action-form";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Bitte warten …",
  name,
  value,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  formAction?: (fd: FormData) => void;
}) {
  const status = useFormStatus();
  const pending = useActionPending() || status.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending} name={name} value={value} formAction={formAction}>
      {pending ? pendingText : children}
    </button>
  );
}
