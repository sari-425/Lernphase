/** Alle Zeiten werden für Deutschland (Europe/Berlin, inkl. Sommerzeit) angezeigt und eingegeben. */
export const TZ = "Europe/Berlin";

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** "2026-03-29T10:00" (deutsche Ortszeit) → Date */
export function parseBerlinLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  let date = new Date(guess - offsetMinutes(new Date(guess)) * 60_000);
  // zweiter Schritt korrigiert Fälle rund um die Zeitumstellung
  date = new Date(guess - offsetMinutes(date) * 60_000);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "2026-03-29T10:00" in deutscher Ortszeit (für <input type="datetime-local">) */
export function toBerlinLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  const local = new Date(date.getTime() + offsetMinutes(date) * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(date) + " Uhr";
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(date);
}
