import { describe, expect, it } from "vitest";
import { assertCan, assertTenant, can, type Actor } from "@/lib/auth/permissions";

const admin: Actor = { userId: "u1", tenantId: "t1", role: "admin", canPublish: true };
const editor: Actor = { userId: "u2", tenantId: "t1", role: "editor", canPublish: false };
const publisher: Actor = { userId: "u3", tenantId: "t1", role: "editor", canPublish: true };

describe("Rollen und Berechtigungen", () => {
  it("Administrator darf alles im eigenen Mandanten", () => {
    for (const p of ["message.publish", "team.manage", "settings.manage", "message.delete", "push.send"] as const) {
      expect(can(admin, p)).toBe(true);
    }
  });
  it("Redakteur ohne Veröffentlichungsrecht darf nur verfassen", () => {
    expect(can(editor, "message.create")).toBe(true);
    expect(can(editor, "message.edit")).toBe(true);
    expect(can(editor, "message.publish")).toBe(false);
    expect(can(editor, "push.send")).toBe(false);
    expect(can(editor, "message.archive")).toBe(false);
    expect(can(editor, "team.manage")).toBe(false);
  });
  it("Redakteur mit Veröffentlichungsrecht darf veröffentlichen, aber kein Team verwalten", () => {
    expect(can(publisher, "message.publish")).toBe(true);
    expect(can(publisher, "push.send")).toBe(true);
    expect(can(publisher, "team.manage")).toBe(false);
    expect(can(publisher, "message.delete")).toBe(false);
  });
  it("Ohne Akteur gibt es keinerlei Rechte", () => {
    expect(can(null, "message.read_internal")).toBe(false);
    expect(() => assertCan(null, "message.create")).toThrow(/Berechtigung/);
  });
  it("Mandantenprüfung schlägt bei fremdem Mandanten fehl", () => {
    expect(() => assertTenant(admin, "t2")).toThrow(/Kein Zugriff/);
    expect(() => assertTenant(admin, "t1")).not.toThrow();
  });
});
