import { describe, expect, it } from "vitest";
import { parseBerlinLocal, toBerlinLocalInput, formatDateTime } from "@/lib/time";

describe("Zeitzone Europe/Berlin", () => {
  it("rechnet Winterzeit (UTC+1) korrekt um", () => {
    expect(parseBerlinLocal("2026-01-15T10:00")!.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });
  it("rechnet Sommerzeit (UTC+2) korrekt um", () => {
    expect(parseBerlinLocal("2026-07-15T10:00")!.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });
  it("ist umkehrbar", () => {
    const d = parseBerlinLocal("2026-10-25T14:30")!;
    expect(toBerlinLocalInput(d)).toBe("2026-10-25T14:30");
  });
  it("lehnt Unsinn ab und formatiert deutsch", () => {
    expect(parseBerlinLocal("morgen")).toBeNull();
    expect(formatDateTime(new Date("2026-07-15T08:00:00Z"))).toContain("10:00 Uhr");
  });
});
