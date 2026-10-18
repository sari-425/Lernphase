import type { Tenant } from "@/lib/db/schema";

export type LegalTenant = Pick<
  Tenant,
  | "name"
  | "imprintText"
  | "privacyController"
  | "privacyCouncilContact"
  | "privacyDpo"
  | "privacyAuthority"
  | "privacyHosting"
  | "legalUpdatedAt"
>;

/** true, wenn Pflichtangaben fehlen (Hinweis für Leser und Verwaltung). */
export function legalIncomplete(t: LegalTenant | null, kind: "imprint" | "privacy") {
  if (!t) return true;
  if (kind === "imprint") return !t.imprintText.trim();
  return !t.privacyController.trim() || !t.privacyHosting.trim() || !t.privacyAuthority.trim();
}
