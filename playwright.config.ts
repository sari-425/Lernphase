import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// Schlüssel nur für diesen Testlauf erzeugen – nichts davon steht im Quellcode.
const vapid = webpush.generateVAPIDKeys();

/**
 * End-to-End-Tests gegen einen echten Produktions-Server.
 * Standard: eingebettete Datenbank (frisch bei jedem Lauf).
 * Mit E2E_DATABASE_URL=postgres://… gegen echtes PostgreSQL (Datenbank muss leer sein).
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
export const SETUP_TOKEN = "e2e-setup-token-0123456789";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  // Voller Chromium statt der Headless Shell: Diese meldet Notification.permission
  // immer als "denied" – der Push-Test könnte dann nie aktivieren.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "pglite://memory",
      AUTO_MIGRATE: "true",
      SESSION_SECRET: "e2e-session-secret-0123456789-0123456789-abc",
      SETUP_TOKEN,
      COOKIE_SECURE: "false",
      APP_URL: `http://localhost:${PORT}`,
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      PUSH_MIN_INTERVAL_MINUTES: "0",
    },
  },
});
