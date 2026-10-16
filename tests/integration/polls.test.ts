import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DbHandle } from "@/lib/db/client";
import { freshDb, makeTenant, SECRET } from "../helpers/db";
import { anonymizeEndedPolls, closePoll, createPoll, deletePoll, hasVoted, listVisiblePolls, newDeviceToken, openPoll, pollResults, updatePoll, vote } from "@/lib/services/polls";
import { acceptInvitation, createInvitation } from "@/lib/services/tenants";
import { getActor } from "@/lib/services/auth";
import { runRetention } from "@/lib/services/maintenance";
import { pollVotes } from "@/lib/db/schema";
import { pollInputSchema } from "@/lib/validation/schemas";
import type { Actor } from "@/lib/auth/permissions";
import type { Tenant } from "@/lib/db/schema";

let h: DbHandle;
let tenant: Tenant;
let admin: Actor;
let editor: Actor;
const ANON = { staff: false, council: false };
const STAFF = { staff: true, council: false };
const input = (over: Record<string, unknown> = {}) =>
  pollInputSchema.parse({ question: "Wann soll die Betriebsversammlung stattfinden?", options: ["Vormittag", "Nachmittag"], visibility: "staff", ...over });

beforeAll(async () => {
  h = await freshDb();
  ({ tenant, admin } = await makeTenant(h, "umfrage"));
  const t = await createInvitation(h.db, admin, { role: "editor", canPublish: false, note: "" });
  editor = (await getActor(h.db, (await acceptInvitation(h.db, t, { email: "e@u.test", displayName: "E", password: "editor-passwort-123" })).userId, tenant.id))!;
});
afterAll(async () => h.close());

describe("Umfragen", () => {
  it("Validierung: mind. 2, verschiedene Antworten", () => {
    expect(pollInputSchema.safeParse({ question: "Frage?", options: ["A"], visibility: "staff" }).success).toBe(false);
    expect(pollInputSchema.safeParse({ question: "Frage?", options: ["A", "a"], visibility: "staff" }).success).toBe(false);
    expect(pollInputSchema.safeParse({ question: "Frage?", options: ["A", "B"], visibility: "council" }).success).toBe(false);
  });

  it("Entwürfe sind unsichtbar; Redakteur darf nicht starten", async () => {
    const p = await createPoll(h.db, editor, input());
    expect((await listVisiblePolls(h.db, tenant.id, STAFF)).some((x) => x.id === p.id)).toBe(false);
    await expect(openPoll(h.db, editor, p.id)).rejects.toThrow(/Berechtigung/);
    await expect(vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o1", deviceToken: newDeviceToken(), access: STAFF })).rejects.toThrow(/nicht gefunden/);
  });

  it("eine Stimme pro Gerät, Belegschafts-Umfrage nur mit Zugang", async () => {
    const p = await createPoll(h.db, admin, input());
    await openPoll(h.db, admin, p.id);
    await expect(updatePoll(h.db, admin, p.id, input())).rejects.toThrow(/nicht mehr geändert/);
    const dev1 = newDeviceToken();
    await expect(vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o1", deviceToken: dev1, access: ANON })).rejects.toThrow(/nicht gefunden/);
    await vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o1", deviceToken: dev1, access: STAFF });
    await expect(vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o2", deviceToken: dev1, access: STAFF })).rejects.toThrow(/bereits abgestimmt/);
    await vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o2", deviceToken: newDeviceToken(), access: STAFF });
    await expect(vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o9", deviceToken: newDeviceToken(), access: STAFF })).rejects.toThrow(/Antwort/);
    expect(await hasVoted(h.db, SECRET, p.id, dev1)).toBe(true);
    expect(await pollResults(h.db, p.id)).toEqual({ total: 2, counts: { o1: 1, o2: 1 } });
    // gespeichert wird weder das Geräte-Token noch eine Person
    const rows = await h.db.select().from(pollVotes).where(eq(pollVotes.pollId, p.id));
    expect(rows.every((r) => r.voterHash !== dev1)).toBe(true);
  });

  it("öffentliche Umfrage braucht Bestätigung; Beenden anonymisiert vollständig", async () => {
    const p = await createPoll(h.db, admin, input({ visibility: "public" }));
    await expect(openPoll(h.db, admin, p.id)).rejects.toThrow(/bestätigen/);
    await openPoll(h.db, admin, p.id, { confirmPublic: true });
    const dev = newDeviceToken();
    await vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o2", deviceToken: dev, access: ANON });
    await closePoll(h.db, admin, p.id);
    const rows = await h.db.select().from(pollVotes).where(eq(pollVotes.pollId, p.id));
    expect(rows.every((r) => r.voterHash === null)).toBe(true);
    expect((await pollResults(h.db, p.id)).total).toBe(1);
    await expect(vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o1", deviceToken: newDeviceToken(), access: ANON })).rejects.toThrow(/beendet/);
  });

  it("Ablaufdatum beendet die Umfrage; Löschfrist entfernt Gerätekennungen", async () => {
    const p = await createPoll(h.db, admin, input({ closesAt: "2099-01-01T10:00" }));
    await openPoll(h.db, admin, p.id);
    await vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o1", deviceToken: newDeviceToken(), access: STAFF });
    const later = new Date("2099-01-02T00:00:00Z");
    await expect(vote(h.db, SECRET, { tenantId: tenant.id, pollId: p.id, optionId: "o1", deviceToken: newDeviceToken(), access: STAFF }, later)).rejects.toThrow(/beendet/);
    expect((await listVisiblePolls(h.db, tenant.id, STAFF, later)).find((x) => x.id === p.id)?.isOpen).toBe(false);
    expect(await anonymizeEndedPolls(h.db, new Date())).toBe(0);
    const r = await runRetention(h.db, later);
    expect(r.anonymizedVotes).toBeGreaterThanOrEqual(1);
  });

  it("Mandantentrennung und Löschen", async () => {
    const other = await makeTenant(h, "umfrage-b");
    const p = await createPoll(h.db, admin, input());
    await openPoll(h.db, admin, p.id);
    await expect(closePoll(h.db, other.admin, p.id)).rejects.toThrow(/nicht gefunden/);
    await expect(deletePoll(h.db, other.admin, p.id)).rejects.toThrow(/nicht gefunden/);
    await expect(vote(h.db, SECRET, { tenantId: other.tenant.id, pollId: p.id, optionId: "o1", deviceToken: newDeviceToken(), access: STAFF })).rejects.toThrow(/nicht gefunden/);
    expect((await listVisiblePolls(h.db, other.tenant.id, { staff: true, council: true })).length).toBe(0);
    await expect(deletePoll(h.db, editor, p.id)).rejects.toThrow(/Berechtigung/);
    await deletePoll(h.db, admin, p.id);
    expect((await listVisiblePolls(h.db, tenant.id, STAFF)).some((x) => x.id === p.id)).toBe(false);
  });
});
