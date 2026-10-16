import { z } from "zod";
import { parseBerlinLocal } from "@/lib/time";

const trimmed = (max: number) => z.string().trim().max(max, `Höchstens ${max} Zeichen.`);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Die Kurzadresse braucht mindestens 3 Zeichen.")
  .max(48, "Die Kurzadresse darf höchstens 48 Zeichen haben.")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Bitte eine gültige E-Mail-Adresse eingeben.");

export const passwordSchema = z
  .string()
  .min(12, "Das Passwort braucht mindestens 12 Zeichen.")
  .max(200, "Das Passwort ist zu lang.");

export const displayNameSchema = trimmed(80).min(2, "Bitte einen Namen angeben (mind. 2 Zeichen).");

export const staffCodeSchema = z
  .string()
  .trim()
  .min(8, "Der Zugangscode braucht mindestens 8 Zeichen.")
  .max(64, "Der Zugangscode ist zu lang.");

const optionalDate = z
  .union([z.literal(""), z.string()])
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    // Eingabe aus <input type="datetime-local"> = deutsche Ortszeit; ISO-Zeitstempel mit Zone ebenfalls erlaubt
    const d = /[zZ]|[+-]\d{2}:\d{2}$/.test(v) ? new Date(v) : parseBerlinLocal(v);
    if (!d || Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Ungültiges Datum." });
      return z.NEVER;
    }
    return d;
  });

const optionalHttpsUrl = z
  .union([z.literal(""), z.string().trim().max(2000)])
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    try {
      const u = new URL(v);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      return u.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Bitte einen vollständigen Link (https://…) angeben." });
      return z.NEVER;
    }
  });

export const messageInputSchema = z
  .object({
    title: trimmed(160).min(3, "Der Titel braucht mindestens 3 Zeichen."),
    body: z.string().trim().min(1, "Bitte einen Inhalt eingeben.").max(20000, "Der Inhalt ist zu lang (max. 20.000 Zeichen)."),
    categoryId: z.union([z.literal(""), z.string().uuid()]).optional().transform((v) => v || null),
    priority: z.enum(["normal", "high", "urgent"]).default("normal"),
    visibility: z.enum(["public", "staff", "council"], {
      message: "Bitte den Veröffentlichungsbereich ausdrücklich wählen.",
    }),
    publishAt: optionalDate,
    expiresAt: optionalDate,
    linkUrl: optionalHttpsUrl,
    pushEnabled: z.boolean().default(false),
    pushTitle: trimmed(80).default(""),
    pushBody: trimmed(180).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.publishAt && v.expiresAt && v.expiresAt <= v.publishAt) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Der Ablauf muss nach der Veröffentlichung liegen." });
    }
    if (v.pushEnabled && v.visibility === "council") {
      ctx.addIssue({
        code: "custom",
        path: ["pushEnabled"],
        message: "Interne Gremiums-Mitteilungen können nicht per Push an die Belegschaft gehen.",
      });
    }
  });

export type MessageInput = z.output<typeof messageInputSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((v) => v.startsWith("https://"), "Push-Endpunkt muss HTTPS verwenden."),
  keys: z.object({
    p256dh: z.string().min(20).max(200).regex(/^[A-Za-z0-9_-]+=*$/),
    auth: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+=*$/),
  }),
  categoryIds: z.array(z.string().uuid()).max(50).nullable().default(null),
  onlyImportant: z.boolean().default(false),
});

export const contactSchema = z.object({
  name: trimmed(100).min(2, "Bitte einen Namen angeben."),
  roleTitle: trimmed(100).default(""),
  phone: trimmed(40).default(""),
  email: z.union([z.literal(""), emailSchema]).default(""),
  location: trimmed(120).default(""),
  availability: trimmed(200).default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const categorySchema = z.object({
  name: trimmed(60).min(2, "Bitte einen Namen angeben."),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const tenantSettingsSchema = z.object({
  name: trimmed(120).min(3, "Bitte einen Namen angeben."),
  companyName: trimmed(120).default(""),
  slogan: trimmed(80).default(""),
  sloganSub: trimmed(120).default(""),
  welcomeText: trimmed(1000).default(""),
});

export const setupSchema = z.object({
  token: z.string().min(1, "Einrichtungs-Token fehlt."),
  tenantName: trimmed(120).min(3, "Bitte den Namen des Betriebsrats angeben."),
  companyName: trimmed(120).default(""),
  slug: slugSchema,
  adminName: displayNameSchema,
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
});

/** Ersten Zod-Fehler in eine verständliche Meldung übersetzen. */
export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Ungültige Eingabe.";
}

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export const pollInputSchema = z.object({
  question: z.string().trim().min(5, "Die Frage braucht mindestens 5 Zeichen.").max(200, "Die Frage ist zu lang (max. 200 Zeichen)."),
  description: z.string().trim().max(1000, "Die Beschreibung ist zu lang.").default(""),
  options: z
    .array(z.string().trim().min(1).max(100, "Eine Antwort ist zu lang (max. 100 Zeichen)."))
    .min(2, "Bitte mindestens 2 Antwortmöglichkeiten angeben (eine pro Zeile).")
    .max(10, "Höchstens 10 Antwortmöglichkeiten.")
    .refine((a) => new Set(a.map((x) => x.toLowerCase())).size === a.length, "Antwortmöglichkeiten müssen sich unterscheiden."),
  visibility: z.enum(["public", "staff"], { message: "Bitte auswählen, wer teilnehmen darf." }),
  closesAt: z
    .union([z.literal(""), z.string()])
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = parseBerlinLocal(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Ungültiges Datum." });
        return z.NEVER;
      }
      return d;
    }),
  resultsPublic: z.boolean().default(true),
});

export type PollInput = z.output<typeof pollInputSchema>;
