# Architektur – Betriebsrat Direkt

## Überblick

```
 Smartphone / PC (Browser oder installierte PWA)
   │  HTTPS
   ▼
 Caddy (Reverse Proxy, automatisches HTTPS, keine Zugriffs-Logs)
   │
   ▼
 Next.js-Server (Node.js, ein Prozess)
   ├─ proxy.ts ............ CSP-Nonce, Herkunftsprüfung (CSRF)
   ├─ Seiten (React Server Components) – öffentlich /b/<kurzadresse>/…, Verwaltung /admin/<kurzadresse>/…
   ├─ Server Actions ...... alle Änderungen (prüfen Anmeldung + Rolle neu)
   ├─ API-Routen .......... Push-Abo (anonym), Cron, Health
   ├─ Services (src/lib/services) – gesamte Fachlogik, mandantengebunden, getestet
   └─ Planer (instrumentation.ts) – jede Minute: geplante Pushes, Löschfristen
   │
   ▼
 PostgreSQL                                 Push-Dienste der Browserhersteller
 (alle Daten, inkl. Anhänge)  ◄── web-push ──► (FCM, Apple, Mozilla, Microsoft)
                                  verschlüsselt (RFC 8291) + VAPID (RFC 8292)
```

Bewusst **ein** Deployment, **eine** Datenbank, keine Warteschlangen-Dienste, kein Objektspeicher, kein E-Mail-Dienst. Das ist für eine Einzelperson wartbar.

## Wichtige Entscheidungen (ADR-Kurzform)

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | **PWA statt nativer Apps** | Eine Codebasis für iPhone, Android, Desktop; keine App-Store-Kosten. Native Hülle später möglich (z. B. Capacitor), da die App nur Standard-Web-APIs nutzt. |
| 2 | **Next.js 16, App Router, Server Actions** | Formulare und Berechtigungen serverseitig, wenig Client-JavaScript (gut für schwache Geräte). |
| 3 | **Cache Components AUS, alles dynamisch gerendert** | Keine Gefahr, dass vertrauliche Inhalte in einem gemeinsamen Cache landen. Last ist gering. |
| 4 | **PostgreSQL + Drizzle ORM** | Standard-SQL, überall günstig hostbar, kein Lock-in. Drizzle ist schlank und typsicher. |
| 5 | **PGlite für Tests und Schnellstart** | `npm install && npm run dev` läuft ohne Datenbankinstallation; alle Tests laufen ohne externe Dienste. Dieselben Tests laufen zusätzlich gegen echtes PostgreSQL. |
| 6 | **Eigene, minimale Authentifizierung** (scrypt, DB-Sitzungen) | Keine externen Identitätsanbieter, keine Daten bei Dritten. Sitzungstoken nur gehasht gespeichert. |
| 7 | **Beschäftigte ohne Konto** | Datenminimierung. Belegschafts-Inhalte über einen gemeinsamen Zugangscode (Cookie ohne Personenbezug). |
| 8 | **Einladungen per Link statt E-Mail** | Kein E-Mail-Dienstleister, keine Kosten, keine zusätzliche Datenübermittlung. |
| 9 | **Anhänge in der Datenbank** | Erben die Sichtbarkeit der Mitteilung; kein versehentlich öffentlicher Speicher-Bucket; Backup inklusive. Begrenzt auf 3 × 5 MB. |
| 10 | **Eigenes, sicheres Textformat statt HTML/Markdown-Bibliothek** | Kein `dangerouslySetInnerHTML` → kein XSS über Inhalte. |
| 11 | **Interner Planer + optionale Cron-Route** | VPS: läuft von selbst; Serverless: `/api/cron` extern anstoßen. |
| 12 | **Mandanten über Pfad `/b/<kurzadresse>`** | Ein Zertifikat, eine Domain, einfach. Kein öffentliches Verzeichnis aller Betriebsräte. |

## Datenmodell

```
tenants ───┬── memberships ── users ── sessions
           ├── invitations
           ├── categories
           ├── messages ──┬── attachments
           │              └── push_dispatches (1 pro Mitteilung, UNIQUE)
           ├── contacts
           ├── push_subscriptions (anonym)
           └── audit_log
rate_limit_events (nur HMAC-Schlüssel)
```

| Tabelle | Inhalt | Personenbezug |
|---|---|---|
| tenants | Name, Kurzadresse, Darstellung, Hash des Belegschafts-Codes | nein |
| users | E-Mail, Name, scrypt-Passwort-Hash | ja (nur BR-Mitglieder) |
| memberships | Rolle je Betriebsrat (admin/editor + canPublish) | ja |
| sessions | SHA-256 des Tokens, Ablauf | indirekt |
| messages | Titel, Inhalt, Kategorie, Priorität, Status, Bereich, Zeiten, Push-Texte | soll keinen haben (Warnprüfung) |
| attachments | Datei (bytea), Typ per Magic Bytes geprüft | soll keinen haben |
| push_subscriptions | Endpunkt + Schlüssel, Themenwahl, Tagesdatum | pseudonym (Endpunkt) |
| push_dispatches | nur Zähler (übergeben/fehlgeschlagen/entfernt) | nein |
| audit_log | wer/wann/was (keine Inhalte) | ja (BR-Mitglieder) |
| rate_limit_events | HMAC aus IP bzw. E-Mail, Zeitpunkt (24 h) | nicht rückrechenbar ohne Server-Geheimnis |

**Mitteilungsstatus:** `draft` → `review` (Redakteur ohne Recht) → `published` (mit `publish_at`; Zukunft = „geplant“) → `archived` | `withdrawn`. Abgelaufene (`expires_at`) erscheinen nur im Archiv.

**Sichtbarkeit (`visibility`):** `public` (Link genügt) · `staff` (Belegschafts-Code) · `council` (nur angemeldete Mitglieder dieses Betriebsrats). Standard in der Datenbank ist `council`; im Editor muss der Bereich **ausdrücklich** gewählt werden.

## Rollen und Berechtigungen

| Recht | Beschäftigte | Redakteur | Redakteur + Veröffentlichen | Admin |
|---|:-:|:-:|:-:|:-:|
| Öffentliche Mitteilungen lesen | ✔ | ✔ | ✔ | ✔ |
| Belegschafts-Mitteilungen lesen | mit Code | ✔ | ✔ | ✔ |
| Gremiums-Mitteilungen lesen | – | ✔ | ✔ | ✔ |
| Push abonnieren | ✔ (anonym) | ✔ | ✔ | ✔ |
| Mitteilungen verfassen, Entwürfe bearbeiten | – | ✔ | ✔ | ✔ |
| Veröffentlichen / planen / archivieren / zurückziehen / Push auslösen | – | – | ✔ | ✔ |
| Endgültig löschen | – | – | – | ✔ |
| Team, Einstellungen, Kontakte, Kategorien, Protokoll | – | – | – | ✔ |

Durchsetzung: `src/lib/auth/permissions.ts` + jede Service-Funktion ruft `assertCan(...)` auf und filtert **jede** Abfrage nach `tenant_id` des Akteurs. Die Oberfläche blendet Knöpfe nur zusätzlich aus.

## Mandantentrennung

- Jede Tabelle mit Inhalten hat `tenant_id`; jede Lese-/Schreibabfrage enthält `tenant_id = <Mandant des Akteurs>`.
- Rolle wird pro Anfrage aus `memberships(tenant_id, user_id)` geladen; kein Eintrag → 404 (der Bereich wird nicht einmal bestätigt).
- Belegschafts-Cookie = HMAC(Server-Geheimnis, Mandant + Codeversion) → gilt nur für genau einen Betriebsrat.
- Automatisierte Tests: `tests/integration/tenant-isolation.test.ts` (11 Fälle: Lesen, Ändern, Veröffentlichen, Löschen, Kategorien, Kontakte, Team, Push, Anhänge, Zugangscode, Protokoll).

## Betriebsrat finden

Es gibt **kein öffentliches Verzeichnis**. Beschäftigte erhalten die Kurzadresse bzw. einen QR-Code über Aushang, Intranet oder Betriebsversammlung und öffnen `/b/<kurzadresse>` (oder geben sie auf der Startseite ein). Optional leitet `DEFAULT_TENANT_SLUG` die Startseite direkt weiter (sinnvoll, wenn der Server nur einem Betriebsrat dient).

## Push-Ablauf

1. Beschäftigte öffnen „Benachrichtigungen“, lesen die Erklärung, tippen „Aktivieren“ → erst dann Browser-Abfrage.
2. Browser erzeugt Abo beim Push-Dienst; App speichert Endpunkt + Schlüssel + Themenwahl (anonym).
3. Veröffentlichung mit Push → genau **ein** Versandauftrag (`UNIQUE(message_id)`).
4. Planer/sofortiger Versand: Auftrag wird atomar von `pending` auf `sending` gesetzt; nur der Gewinner sendet.
5. Begrenzung: max. `PUSH_MAX_PER_TENANT_PER_DAY` Aufträge/24 h und `PUSH_MIN_INTERVAL_MINUTES` Abstand (dringende Mitteilungen ausgenommen vom Abstand).
6. Antwort 404/410 → Abo sofort gelöscht; andere Fehler zählen hoch, nach 5 Fehlern gelöscht.
7. Protokolliert werden **nur Zähler**. „Übergeben“ ≠ „zugestellt“ ≠ „gelesen“ – Lesen wird nicht erfasst.
8. Push-Inhalt: neutraler Standardtext, Link zur Mitteilung. Sperrbildschirm zeigt keine Inhalte, außer der Betriebsrat formuliert bewusst einen eigenen Text.

## Ordnerstruktur

```
src/
  app/                 Seiten und Server Actions (Next.js App Router)
    b/[slug]/          Bereich für Beschäftigte
    admin/[slug]/      Verwaltung (actions.ts = alle Verwaltungsaktionen)
    api/               Push-Abo, Cron, Health
  components/          UI-Bausteine
  lib/
    db/                Schema + Datenbankverbindung
    services/          Fachlogik (testbar ohne Next.js)
    auth/              Krypto, Berechtigungen
    push/              Web-Push-Versand
    content/           sicheres Textformat, Warnprüfung
    validation/        Zod-Schemas
    server/            Next.js-spezifische Hilfen (Cookies, Kontext)
  proxy.ts             CSP + CSRF-Schutz
  instrumentation.ts   Planer
public/sw.js           Service Worker
drizzle/               SQL-Migrationen
tests/                 Unit- und Integrationstests (Vitest)
e2e/                   Browser-Tests (Playwright)
scripts/               CLI: Migration, Betriebsräte, Geheimnisse, Icons
deploy/                Caddy, Backup
```

## Spätere Erweiterungen (vorbereitet, nicht umgesetzt)

- Native Hülle (Capacitor) für App-Store-Präsenz – nur falls nötig.
- Umfragen/Abstimmungen: bewusst **nicht** umgesetzt. Ohne Identität sind Mehrfachabstimmungen nicht verhinderbar; mit Identität entsteht ein Datenschutz- und Vertrauensproblem. Für unverbindliche Stimmungsbilder kann ein Link auf ein datenschutzfreundliches Umfragetool gesetzt werden.
- Zwei-Faktor-Anmeldung (TOTP) für Administratoren.
- Eigene Subdomains je Betriebsrat.
