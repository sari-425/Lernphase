import { z } from "zod";

/**
 * Zentrale, validierte Konfiguration aus Umgebungsvariablen.
 * Geheimnisse werden ausschließlich hier gelesen und niemals an den Browser gegeben
 * (Ausnahme: der ÖFFENTLICHE VAPID-Schlüssel, der für Push zwingend öffentlich ist).
 */
const boolish = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((v) => v === "true" || v === "1" || v === "yes");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  SETUP_TOKEN: z.string().optional(),
  DEFAULT_TENANT_SLUG: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ENABLE_INTERNAL_SCHEDULER: boolish.optional(),
  AUTO_MIGRATE: boolish.optional(),
  COOKIE_SECURE: boolish.optional(),
  TRUST_PROXY: boolish.optional(),
  PUSH_MAX_PER_TENANT_PER_DAY: z.coerce.number().int().min(1).max(100).default(10),
  PUSH_MIN_INTERVAL_MINUTES: z.coerce.number().int().min(0).max(1440).default(5),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  // In der Entwicklung nicht zwischenspeichern: Next.js lädt eine geänderte .env.local
  // neu, und die App soll das sofort übernehmen.
  if (cached && process.env.NODE_ENV === "production") return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Ungültige Konfiguration: " +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  cached = parsed.data;
  return cached;
}

/** Nur für Tests: Konfiguration neu einlesen. */
export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => env().NODE_ENV === "production";

const DEV_SECRET = "dev-only-insecure-secret-change-me-0123456789abcdef";

/**
 * Serverseitiges Geheimnis für Sitzungs-, Zugangs- und Hash-Funktionen.
 * In Produktion zwingend (mind. 32 Zeichen) – sonst startet die App nicht.
 */
export function sessionSecret(): string {
  const s = env().SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (isProduction() && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  }
  return DEV_SECRET;
}

export function cookieSecure(): boolean {
  const v = env().COOKIE_SECURE;
  return v ?? isProduction();
}

export function databaseUrl(): string {
  const url = env().DATABASE_URL;
  if (url) return url;
  if (isProduction() && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("DATABASE_URL fehlt.");
  }
  // Komfort für die lokale Entwicklung: eingebettete Datenbank ohne Installation
  return "pglite://.data/pglite";
}

export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const e = env();
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: e.VAPID_PUBLIC_KEY,
    privateKey: e.VAPID_PRIVATE_KEY,
    subject: e.VAPID_SUBJECT || "mailto:betrieb@example.invalid",
  };
}
