import type { Role } from "@/lib/db/schema";
import { forbidden } from "@/lib/errors";

/**
 * Rollen- und Berechtigungskonzept (serverseitig geprüft, nie nur über ausgeblendete Buttons).
 *
 *  Beschäftigte: kein Konto. Lesen öffentlich; Belegschafts-Inhalte mit Zugangscode.
 *  Redakteur:    verfassen, Entwürfe bearbeiten, zur Freigabe einreichen.
 *                Veröffentlichen/Archivieren/Push nur mit canPublish (vom Admin vergeben).
 *  Administrator: alles innerhalb SEINES Betriebsrats (Mandanten).
 */
export type Permission =
  | "message.read_internal"
  | "message.create"
  | "message.edit"
  | "message.publish"
  | "message.archive"
  | "message.delete"
  | "push.send"
  | "team.manage"
  | "settings.manage"
  | "contacts.manage"
  | "categories.manage"
  | "audit.read";

export interface Actor {
  userId: string;
  tenantId: string;
  role: Role;
  canPublish: boolean;
}

const EDITOR_BASE: Permission[] = ["message.read_internal", "message.create", "message.edit"];
const PUBLISHER: Permission[] = ["message.publish", "message.archive", "push.send"];

export function permissionsFor(role: Role, canPublish: boolean): Set<Permission> {
  if (role === "admin") {
    return new Set<Permission>([
      ...EDITOR_BASE,
      ...PUBLISHER,
      "message.delete",
      "team.manage",
      "settings.manage",
      "contacts.manage",
      "categories.manage",
      "audit.read",
    ]);
  }
  return new Set<Permission>([...EDITOR_BASE, ...(canPublish ? PUBLISHER : [])]);
}

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return permissionsFor(actor.role, actor.canPublish).has(permission);
}

export function assertCan(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!can(actor, permission)) throw forbidden();
}

/** Mandantenprüfung: Ein Akteur darf ausschließlich in seinem eigenen Mandanten handeln. */
export function assertTenant(actor: Actor, tenantId: string) {
  if (actor.tenantId !== tenantId) throw forbidden("Kein Zugriff auf diesen Betriebsrat.");
}
