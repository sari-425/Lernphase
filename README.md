# Betriebsrat Direkt

Kostenlose, datenschutzfreundliche Informations-App für Betriebsräte und Beschäftigte.
Der Betriebsrat veröffentlicht Mitteilungen – Beschäftigte lesen sie ohne Konto auf dem Smartphone und können freiwillig Push-Benachrichtigungen aktivieren.

**Keine Werbung · kein Tracking · keine Abos · keine KI-Dienste · Open-Source-Bausteine**

| Für Beschäftigte | Für den Betriebsrat |
|---|---|
| Lesen ohne Konto, als App auf dem Home-Bildschirm | Mitteilungen schreiben, Vorschau, planen, veröffentlichen |
| Wichtige Infos sofort oben | Priorität (normal / wichtig / dringend), Kategorien, Ablaufdatum |
| Themen, Archiv, Volltextsuche | Bereich wählen: öffentlich / Belegschaft (Code) / Gremium intern |
| Ansprechpartner | Push gezielt auslösen, neutrale Sperrbildschirm-Texte |
| Push freiwillig, nach Themen, jederzeit abschaltbar | Team mit Rollen (Admin, Redakteur mit/ohne Veröffentlichungsrecht) |
| iPhone-Anleitung für Push | Archivieren, Zurückziehen, endgültig Löschen, Änderungsprotokoll |
| Anonyme Umfragen (Stimmungsbild) | Umfragen anlegen, starten, beenden, Ergebnis |
| | Zwei-Faktor-Anmeldung, Passwort-Reset-Link, „Mein Konto“ |
| | Druckbarer Aushang mit QR-Code, Push-Test an das eigene Gerät |

## Schnellstart auf dem MacBook (ca. 10 Minuten)

**Voraussetzung:** [Node.js 22 LTS](https://nodejs.org) installieren (Installer herunterladen, Doppelklick). Prüfen im Terminal: `node -v` → `v22…`.

```bash
# 1. Code holen (oder als ZIP von GitHub herunterladen)
git clone https://github.com/sari-425/Lernphase.git betriebsrat-direkt
cd betriebsrat-direkt
git checkout claude/betriebsrat-direkt   # bis die Änderungen in den Hauptzweig übernommen sind

# 2. Abhängigkeiten installieren
npm install

# 3. Konfiguration anlegen
cp .env.example .env.local
npm run secrets
#   → die ausgegebenen Zeilen in .env.local einfügen (überschreiben die leeren Werte)
#   → zusätzlich in .env.local: COOKIE_SECURE=false

# 4. Starten (Entwicklungsmodus, eingebettete Datenbank – keine Installation nötig)
npm run dev
```

Dann im Browser:
1. http://localhost:3000/einrichtung öffnen, den `SETUP_TOKEN` aus `.env.local` eingeben, Betriebsrat und Admin anlegen.
2. Sie landen in der Verwaltung. Erste Mitteilung schreiben → Vorschau → veröffentlichen.
3. Ansicht für Beschäftigte: http://localhost:3000/b/IHRE-KURZADRESSE
4. Push testen: Seite „Benachrichtigungen“ in Chrome/Firefox/Safari am Mac öffnen → Aktivieren. (`localhost` gilt als sicher; im Netzwerk/auf dem Handy ist HTTPS nötig, siehe `docs/BETRIEB.md`.)

Die Daten liegen im Ordner `.data/` (eingebettete PostgreSQL-Datenbank „PGlite“). Zum Zurücksetzen: Server stoppen, `.data/` löschen.

> Die eingebettete Datenbank kann nur von **einem** Prozess gleichzeitig genutzt werden. Für die CLI-Werkzeuge parallel zum Server oder für den Dauerbetrieb echte PostgreSQL verwenden – z. B. die kostenlose [Postgres.app](https://postgresapp.com) für macOS: installieren, starten, `createdb betriebsrat` und in `.env.local` `DATABASE_URL=postgres://IHR_BENUTZERNAME@localhost:5432/betriebsrat` eintragen.

### Produktionsmodus lokal testen
```bash
npm run build
npm start          # http://localhost:3000
```

## Umgebungsvariablen

Alle Variablen sind in [`.env.example`](.env.example) erklärt. Die wichtigsten:

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `DATABASE_URL` | Produktion | `postgres://…` (lokal optional, sonst eingebettete DB) |
| `SESSION_SECRET` | Produktion | mind. 32 Zeichen, `npm run secrets` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | für Push | `npm run secrets`; danach nie mehr ändern |
| `VAPID_SUBJECT` | für Push | `mailto:` Kontaktadresse |
| `APP_URL` | empfohlen | öffentliche Adresse, für Einladungslinks |
| `SETUP_TOKEN` | nur zur Einrichtung | danach leeren |
| `COOKIE_SECURE=false` | nur lokal ohne HTTPS | |

## Tests

```bash
npm test             # 97 Unit- & Integrationstests (eingebettete DB, ca. 30 s)
npm run test:e2e     # 13 Browser-Tests (baut vorher: npm run build); einmalig: npx playwright install chromium
npm run lint && npm run typecheck
npm run check        # alles zusammen inkl. Build

# Integrationstests gegen echtes PostgreSQL (leere Testdatenbank!):
TEST_DATABASE_URL=postgres://localhost:5432/brd_test npm run test:pg
```

Was getestet wird: Anmeldung, Zwei-Faktor (inkl. RFC-6238-Testvektoren), Passwort-Reset, Sitzungen, Ratenbegrenzung, Rollen, **Mandantentrennung**, Entwurf → Freigabe → Veröffentlichung, Planung, Ablauf/Archiv, Zurückziehen, Löschen, Anhänge, **Push Ende-zu-Ende mit echter Verschlüsselung und VAPID-Prüfung** gegen einen lokalen Push-Dienst, Doppelversand, abgelaufene Abos (404/410), Versandbegrenzung, Push-Selbsttest, Umfragen (eine Stimme pro Gerät, Anonymisierung), Löschfristen, Eingabevalidierung, XSS, CSRF, Barrierefreiheit (axe, WCAG 2.2 AA-Regeln).
Ergebnisse des letzten Laufs: siehe [`docs/TESTBERICHT.md`](docs/TESTBERICHT.md).

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) | Aufbau, Entscheidungen, Datenmodell, Rollen, Mandanten, Push-Ablauf |
| [docs/KOSTEN.md](docs/KOSTEN.md) | ehrliche Kostenübersicht und kostenfreies Betriebskonzept |
| [docs/DATENSCHUTZ.md](docs/DATENSCHUTZ.md) | Datenschutzkonzept, Löschfristen, Checkliste, offene Rechtsfragen |
| [docs/SICHERHEIT.md](docs/SICHERHEIT.md) | Sicherheitsmaßnahmen und -checkliste |
| [docs/BETRIEB.md](docs/BETRIEB.md) | Server, Domain, HTTPS, Push-Test auf Geräten, Backups, Updates |
| [docs/TESTBERICHT.md](docs/TESTBERICHT.md) | tatsächliche Testergebnisse |
| `/datenschutz` in der App | Entwurf der Datenschutzerklärung |

## Status: Was ist fertig, was ist offen?

**Fertig und getestet:** siehe Tabelle oben und `docs/TESTBERICHT.md`.

**Offen – braucht Sie / externe Einrichtung** (kann ich nicht für Sie erledigen):
- [ ] Server, Domain und AV-Vertrag (Kosten ca. 5–10 €/Monat, siehe `KOSTEN.md`) – nichts davon wurde registriert. Anleitung: `docs/BETRIEB.md`.
- [ ] **Push auf echten Geräten** einmal prüfen – nach dem Deployment in der Verwaltung mit „Test-Benachrichtigung an dieses Gerät“ (die Testumgebung hatte keinen Zugang zu den Push-Diensten von Google/Apple).
- [ ] Datenschutzerklärung und Impressum vervollständigen und rechtlich prüfen lassen; Rollen nach § 79a BetrVG klären (Checkliste: `docs/DATENSCHUTZ.md`).
- [ ] Lizenz festlegen (siehe unten).

**Bewusst nicht enthalten:** E-Mail-Versand (keine Kosten, kein Dienstleister – Einladungen und Passwort-Reset per Link), native App-Store-Apps (PWA genügt), Wahlen/verbindliche Abstimmungen (Umfragen sind ausdrücklich nur Stimmungsbilder).

## Lizenz
Noch festzulegen (Empfehlung für ein Gemeinwohl-Projekt: AGPL-3.0 oder MIT).
