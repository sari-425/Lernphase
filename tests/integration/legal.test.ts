import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant } from "../helpers/db";
import { acceptInvitation, createInvitation, getTenantBySlug, updateLegalTexts } from "@/lib/services/tenants";
import { getActor } from "@/lib/services/auth";
import { legalTextsSchema } from "@/lib/validation/schemas";
import { legalIncomplete } from "@/lib/content/legal";
import type { Actor } from "@/lib/auth/permissions";

let h: DbHandle;
let adminA: Actor;
let editorA: Actor;

const INPUT = legalTextsSchema.parse({
  imprintText: "Betriebsrat A\nMusterstraße 1",
  privacyController: "Firma A GmbH",
  privacyCouncilContact: "betriebsrat@a.test",
  privacyDpo: "",
  privacyAuthority: "Landesbeauftragte/r für den Datenschutz",
  privacyHosting: "Hoster GmbH, Deutschland",
});

beforeAll(async () => {
  h = await freshDb();
  ({ admin: adminA } = await makeTenant(h, "recht-a"));
  await makeTenant(h, "recht-b");
  const t = await createInvitation(h.db, adminA, { role: "editor", canPublish: true, note: "" });
  const { userId } = await acceptInvitation(h.db, t, { email: "ed@recht-a.test", displayName: "Ed", password: "editor-passwort-123" });
  editorA = (await getActor(h.db, userId, adminA.tenantId)) as Actor;
});
afterAll(async () => h.close());

describe("Impressum und Datenschutz-Angaben", () => {
  it("neue Betriebsräte gelten als unvollständig", async () => {
    const t = await getTenantBySlug(h.db, "recht-a");
    expect(legalIncomplete(t, "imprint")).toBe(true);
    expect(legalIncomplete(t, "privacy")).toBe(true);
    expect(legalIncomplete(null, "privacy")).toBe(true);
  });

  it("Redakteur darf die Angaben nicht ändern", async () => {
    await expect(updateLegalTexts(h.db, editorA, INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Admin speichert Angaben nur für den eigenen Betriebsrat", async () => {
    const now = new Date("2026-10-18T10:00:00Z");
    await updateLegalTexts(h.db, adminA, INPUT, now);
    const a = await getTenantBySlug(h.db, "recht-a");
    const b = await getTenantBySlug(h.db, "recht-b");
    expect(a?.imprintText).toBe("Betriebsrat A\nMusterstraße 1");
    expect(a?.legalUpdatedAt?.toISOString()).toBe(now.toISOString());
    expect(legalIncomplete(a, "imprint")).toBe(false);
    expect(legalIncomplete(a, "privacy")).toBe(false);
    expect(b?.imprintText).toBe("");
    expect(b?.privacyController).toBe("");
    expect(b?.legalUpdatedAt).toBeNull();
  });

  it("Eingaben werden begrenzt und getrimmt", () => {
    expect(legalTextsSchema.parse({ imprintText: "  Text  " }).imprintText).toBe("Text");
    expect(() => legalTextsSchema.parse({ imprintText: "x".repeat(3001) })).toThrow();
    expect(() => legalTextsSchema.parse({ privacyHosting: "x".repeat(1001) })).toThrow();
  });
});
