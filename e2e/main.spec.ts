import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SETUP_TOKEN } from "../playwright.config";

/**
 * Zentrale Abläufe Ende-zu-Ende, in fester Reihenfolge (teilen sich eine Datenbank).
 */
test.describe.configure({ mode: "serial" });

const SLUG = "e2e-betrieb";
const ADMIN = { email: "admin@e2e.test", password: "E2E-Admin-Passwort-123" };
const STAFF_CODE = "Belegschaft-E2E-2026";
let adminCtx: BrowserContext;
let admin: Page;

async function expectNoA11yViolations(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${label}: ${v.id} – ${v.help} (${v.nodes.length}×)`)).toEqual([]);
}

async function createMessage(page: Page, opts: { title: string; body: string; visibility: "public" | "staff" | "council"; push?: boolean; priority?: "normal" | "high" | "urgent" }) {
  await page.goto(`/admin/${SLUG}/mitteilungen/neu`);
  await page.getByLabel("Titel").fill(opts.title);
  await page.getByLabel("Inhalt").fill(opts.body);
  const visLabel = { public: "Öffentlich", staff: "Belegschaft", council: "Gremium intern" }[opts.visibility];
  await page.locator(`input[name="visibility"][value="${opts.visibility}"]`).check();
  expect(visLabel).toBeTruthy();
  if (opts.priority && opts.priority !== "normal") await page.locator(`input[name="priority"][value="${opts.priority}"]`).check();
  if (opts.push) await page.getByLabel("Bei Veröffentlichung eine Push-Benachrichtigung senden").check();
  await page.getByRole("button", { name: "Speichern & Vorschau" }).click();
  await expect(page.getByRole("heading", { name: /Vorschau/ })).toBeVisible();
  return page.url().split("/mitteilungen/")[1].split("/")[0];
}

test.beforeAll(async ({ browser }) => {
  adminCtx = await browser.newContext();
  admin = await adminCtx.newPage();
});
test.afterAll(async () => adminCtx.close());

test("Ersteinrichtung legt Betriebsrat und Administrator an", async () => {
  await admin.goto("/einrichtung");
  await admin.getByLabel("Einrichtungs-Token").fill("falsch-falsch-falsch");
  await admin.getByLabel("Name", { exact: false }).first().fill("Betriebsrat E2E GmbH");
  await admin.getByLabel("Betrieb / Unternehmen (optional)").fill("E2E GmbH");
  await admin.getByLabel("Kurzadresse").fill(SLUG);
  await admin.locator("#adminName").fill("Erika Admin");
  await admin.getByLabel("E-Mail-Adresse").fill(ADMIN.email);
  await admin.getByLabel("Passwort").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Betriebsrat einrichten" }).click();
  await expect(admin.getByText("Das Einrichtungs-Token ist falsch.")).toBeVisible();

  await admin.getByLabel("Einrichtungs-Token").fill(SETUP_TOKEN);
  await admin.getByLabel("Passwort").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Betriebsrat einrichten" }).click();
  await expect(admin.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await expect(admin.getByText("Ihr Bereich ist eingerichtet")).toBeVisible();
});

test("Öffentliche Startseite ohne Konto, leere Zustände und Barrierefreiheit", async ({ page }) => {
  await page.goto(`/b/${SLUG}`);
  await expect(page.getByText("Derzeit keine aktuellen Mitteilungen")).toBeVisible();
  await expect(page.getByRole("link", { name: "Verwaltung" })).toHaveCount(0);
  await expectNoA11yViolations(page, "Startseite");
  await page.goto("/");
  await page.getByLabel("Ihren Betriebsrat öffnen").fill(SLUG);
  await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${SLUG}$`));
  await page.goto("/finden?adresse=gibt-es-nicht");
  await expect(page.getByText("Unter dieser Kurzadresse wurde kein Betriebsrat gefunden.")).toBeVisible();
});

test("Verwaltung ist ohne Anmeldung nicht erreichbar", async ({ page }) => {
  await page.goto(`/admin/${SLUG}/mitteilungen/neu`);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-Mail-Adresse").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill("falsches-passwort");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("E-Mail-Adresse oder Passwort ist falsch.")).toBeVisible();
});

test("Öffentliche Mitteilung: Entwurf → Vorschau → Bestätigung → veröffentlicht", async ({ page }) => {
  const id = await createMessage(admin, {
    title: "Einladung zur Betriebsversammlung",
    body: "## Tagesordnung\n- Bericht des Betriebsrats\n- Arbeitszeit\n\n<script>alert('xss')</script> Details: https://example.org/info",
    visibility: "public",
    priority: "high",
  });
  // Entwurf ist öffentlich NICHT sichtbar
  const res = await page.goto(`/b/${SLUG}/mitteilungen/${id}`);
  expect(res?.status()).toBe(404);

  // Veröffentlichen ohne Bestätigung verhindert der Browser (Pflichtfeld); Server prüft zusätzlich
  await admin.getByRole("button", { name: "Jetzt veröffentlichen" }).click();
  await expect(admin.getByRole("heading", { name: /Vorschau/ })).toBeVisible();
  await admin.getByLabel(/Ich bestätige/).check();
  await admin.getByRole("button", { name: "Jetzt veröffentlichen" }).click();
  await expect(admin.getByRole("heading", { name: "Mitteilung bearbeiten" })).toBeVisible();

  await page.goto(`/b/${SLUG}`);
  await expect(page.getByRole("heading", { name: /Wichtige Informationen/ })).toBeVisible();
  await page.getByRole("link", { name: "Einladung zur Betriebsversammlung" }).click();
  await expect(page.getByRole("heading", { name: "Einladung zur Betriebsversammlung" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tagesordnung" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Bericht des Betriebsrats" })).toBeVisible();
  // XSS wird als Text angezeigt, nicht ausgeführt
  await expect(page.getByText("<script>alert('xss')</script>", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll("article script").length)).toBe(0);
  await expectNoA11yViolations(page, "Mitteilung");

  // Suche
  await page.goto(`/b/${SLUG}/archiv?q=Betriebsversammlung`);
  await expect(page.getByRole("link", { name: "Einladung zur Betriebsversammlung" })).toBeVisible();
});

test("Belegschafts-Mitteilung nur mit Zugangscode, Gremium nie öffentlich", async ({ page }) => {
  await admin.goto(`/admin/${SLUG}/einstellungen`);
  await admin.getByLabel("Neuer Code").fill(STAFF_CODE);
  await admin.getByRole("button", { name: "Code festlegen" }).click();
  await expect(admin.getByText("Neuer Zugangscode gespeichert")).toBeVisible();

  const staffId = await createMessage(admin, { title: "Neue Schichtplanung (nur Belegschaft)", body: "Interne Details zur Schichtplanung.", visibility: "staff" });
  await admin.getByRole("button", { name: "Jetzt veröffentlichen" }).click();
  await expect(admin.getByRole("heading", { name: "Mitteilung bearbeiten" })).toBeVisible();

  const councilId = await createMessage(admin, { title: "Gremium: Vorbereitung Verhandlung", body: "Verhandlungsstrategie.", visibility: "council" });
  await admin.getByRole("button", { name: "Jetzt veröffentlichen" }).click();
  await expect(admin.getByRole("heading", { name: "Mitteilung bearbeiten" })).toBeVisible();

  await page.goto(`/b/${SLUG}/mitteilungen`);
  await expect(page.getByText("Neue Schichtplanung")).toHaveCount(0);
  await expect(page.getByText("Gremium: Vorbereitung")).toHaveCount(0);

  await page.goto(`/b/${SLUG}/mitteilungen/${staffId}`);
  await expect(page.getByText("Diese Mitteilung ist nur für die Belegschaft")).toBeVisible();
  await page.getByRole("link", { name: "Zugangscode eingeben" }).click();
  await page.getByLabel("Belegschafts-Zugangscode").fill("falscher-code");
  await page.getByRole("button", { name: "Zugang freischalten" }).click();
  await expect(page.getByText("Der Zugangscode ist nicht korrekt.")).toBeVisible();
  await page.getByLabel("Belegschafts-Zugangscode").fill(STAFF_CODE);
  await page.getByRole("button", { name: "Zugang freischalten" }).click();
  await expect(page.getByRole("heading", { name: "Neue Schichtplanung (nur Belegschaft)" })).toBeVisible();

  // Gremiums-Inhalt bleibt auch mit Belegschafts-Code unsichtbar
  const r = await page.goto(`/b/${SLUG}/mitteilungen/${councilId}`);
  expect(r?.status()).toBe(404);
  // Admin (Gremium) sieht ihn
  await admin.goto(`/b/${SLUG}/mitteilungen/${councilId}`);
  await expect(admin.getByRole("heading", { name: "Gremium: Vorbereitung Verhandlung" })).toBeVisible();
});

test("Redakteur ohne Veröffentlichungsrecht: Einladung, Entwurf, Freigabe", async ({ browser }) => {
  await admin.goto(`/admin/${SLUG}/team`);
  await admin.getByRole("button", { name: "Einladungslink erstellen" }).click();
  const link = await admin.locator("code").filter({ hasText: "/einladung/" }).innerText();
  const ctx = await browser.newContext();
  const ed = await ctx.newPage();
  await ed.goto(link);
  await ed.getByLabel("Ihr Name").fill("Rudi Redaktion");
  await ed.getByLabel("E-Mail-Adresse").fill("redaktion@e2e.test");
  await ed.getByLabel("Passwort").fill("Redaktion-Passwort-123");
  await ed.getByRole("button", { name: "Einladung annehmen" }).click();
  await expect(ed.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  // Kein Zugriff auf Team-/Einstellungsverwaltung
  await expect(ed.getByRole("link", { name: "Team" })).toHaveCount(0);
  await ed.goto(`/admin/${SLUG}/team`);
  await expect(ed.getByText("Keine Berechtigung")).toBeVisible();

  await createMessage(ed, { title: "Entwurf der Redaktion", body: "Bitte prüfen.", visibility: "public" });
  await expect(ed.getByRole("button", { name: "Jetzt veröffentlichen" })).toHaveCount(0);
  await ed.getByRole("button", { name: "Zur Freigabe einreichen" }).click();
  await expect(ed.getByText("Zur Freigabe eingereicht.")).toBeVisible();

  // Einladungslink ist verbraucht
  const p2 = await browser.newPage();
  await p2.goto(link);
  await expect(p2.getByText("Einladung ungültig")).toBeVisible();
  await p2.close();

  await admin.goto(`/admin/${SLUG}`);
  await expect(admin.getByRole("link", { name: "Entwurf der Redaktion" })).toBeVisible();
  await ctx.close();
});

test("Fremde Herkunft (CSRF) wird abgelehnt, API validiert Eingaben", async ({ request }) => {
  const evil = await request.post("/api/push/subscribe", {
    headers: { Origin: "https://boese.example", "Content-Type": "application/json" },
    data: { slug: SLUG },
  });
  expect(evil.status()).toBe(403);
  const bad = await request.post("/api/push/subscribe", {
    headers: { "Content-Type": "application/json" },
    data: { slug: SLUG, subscription: { endpoint: "http://unsicher.example/x", keys: { p256dh: "x", auth: "y" } } },
  });
  expect(bad.status()).toBe(400);
  const cron = await request.post("/api/cron", { headers: { Authorization: "Bearer falsch" } });
  expect(cron.status()).toBe(401);
});

test("Push-Einstellungsseite erklärt vor der Abfrage und zeigt iPhone-Anleitung", async ({ browser }) => {
  const iphone = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await iphone.newPage();
  await p.goto(`/b/${SLUG}/benachrichtigungen`);
  await expect(p.getByText("Bevor Sie aktivieren")).toBeVisible();
  await expect(p.getByText("zuerst zum Home-Bildschirm hinzufügen")).toBeVisible();
  // mobile Navigation unten sichtbar
  await expect(p.getByRole("navigation", { name: "Hauptnavigation" }).last()).toBeVisible();
  await iphone.close();
});

test("Push-Abo im Browser: aktivieren, Status, deaktivieren", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ permissions: ["notifications"] });
  const p = await ctx.newPage();
  await p.goto(`/b/${SLUG}/benachrichtigungen`);
  await expect(p.getByText("Status:")).toBeVisible();
  await p.getByRole("button", { name: "Benachrichtigungen aktivieren" }).click();
  const outcome = p.getByText(/Benachrichtigungen sind aktiviert|fehlgeschlagen|push service|Registration failed|AbortError/i).first();
  await expect(outcome).toBeVisible({ timeout: 30_000 });
  const text = await outcome.innerText();
  test.info().annotations.push({ type: "push-subscribe", description: text });
  if (!/aktiviert/.test(text)) {
    // In einer abgeschotteten Umgebung ohne Zugang zum Push-Dienst von Google (FCM) kann der
    // Browser kein Abo erzeugen. Das ist eine Grenze der Testumgebung, nicht der App.
    test.skip(true, `Browser-Push-Dienst nicht erreichbar: ${text}`);
  }
  await expect(p.getByText("aktiv auf diesem Gerät")).toBeVisible();
  // Admin sieht anonymes Gerät in der Zählung
  await admin.goto(`/admin/${SLUG}`);
  await expect(admin.locator("dt", { hasText: "Push-Geräte" }).locator("xpath=following-sibling::dd")).toHaveText("1");
  await p.getByRole("button", { name: "Benachrichtigungen deaktivieren" }).click();
  await expect(p.getByText("Ihr Abo wurde gelöscht")).toBeVisible();
  expect(baseURL).toBeTruthy();
  await ctx.close();
});

test("Zurückziehen macht Mitteilung sofort unsichtbar; Abmelden beendet Sitzung", async ({ page }) => {
  const id = await createMessage(admin, { title: "Wird zurückgezogen", body: "Kurzlebig.", visibility: "public" });
  await admin.getByLabel(/Ich bestätige/).check();
  await admin.getByRole("button", { name: "Jetzt veröffentlichen" }).click();
  await expect(admin.getByRole("heading", { name: "Mitteilung bearbeiten" })).toBeVisible();
  expect((await page.goto(`/b/${SLUG}/mitteilungen/${id}`))?.status()).toBe(200);
  await admin.getByRole("button", { name: /Zurückziehen/ }).click();
  await expect(admin.getByText("Mitteilung zurückgezogen")).toBeVisible();
  expect((await page.goto(`/b/${SLUG}/mitteilungen/${id}`))?.status()).toBe(404);

  await admin.getByRole("button", { name: "Abmelden" }).click();
  await expect(admin.getByText("Sie wurden abgemeldet.")).toBeVisible();
  await admin.goto(`/admin/${SLUG}`);
  await expect(admin).toHaveURL(/\/login$/);
});
