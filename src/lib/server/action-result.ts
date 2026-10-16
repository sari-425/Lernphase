import "server-only";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { fieldErrors } from "@/lib/validation/schemas";

export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
  /** zusätzliche Daten, z. B. ein einmalig angezeigter Einladungslink */
  data?: Record<string, string>;
}

export const initialState: ActionState = { ok: false };

/** Übersetzt Fehler in verständliche Meldungen – ohne interne Details preiszugeben. */
export function toActionState(err: unknown): ActionState {
  if (err instanceof ZodError) {
    const fe = fieldErrors(err);
    return { ok: false, error: "Bitte prüfen Sie die markierten Eingaben.", fieldErrors: fe };
  }
  if (err instanceof AppError) return { ok: false, error: err.message };
  // Next.js-Steuerflüsse (redirect/notFound) weiterreichen
  if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) {
    throw err;
  }
  console.error("[aktion] unerwarteter Fehler:", err instanceof Error ? err.message : err);
  return { ok: false, error: "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut." };
}
