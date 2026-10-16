# Testbericht

Lauf vom **16.10.2026** (zweiter Durchgang nach Fertigstellung aller Funktionen) in der Entwicklungsumgebung (Linux, Node.js 22.22, PostgreSQL 16.15, Chromium/Playwright 1.64). Ergebnisse unverändert übernommen.

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Lint (ESLint) | `npm run lint` | ✅ 0 Fehler, 0 Warnungen |
| Typprüfung | `npm run typecheck` | ✅ fehlerfrei |
| Unit- + Integrationstests, eingebettete DB | `npm test` | ✅ **97 / 97** bestanden (11 Dateien) |
| dieselben Tests gegen PostgreSQL 16 | `npm run test:pg` | ✅ **97 / 97** bestanden |
| Produktions-Build | `npm run build` | ✅ erfolgreich, alle Seiten dynamisch gerendert |
| End-to-End (Browser) gegen PostgreSQL | `npm run test:e2e` | ✅ **12 bestanden**, ⚠️ **1 übersprungen** (siehe unten) |
| Standalone-Server (= Docker-Laufzeit) mit Auto-Migration auf leerer DB | manuell | ✅ Health ok, 13 Tabellen angelegt, Startseite 200 |
| `npm audit --omit=dev` | | ✅ 0 Schwachstellen in Produktionsabhängigkeiten |
| `npm audit` (inkl. Entwicklungswerkzeuge) | | ⚠️ 9 Befunde nur in Dev-Tools (siehe `SICHERHEIT.md`) |
| Docker-Image bauen | `docker build` | ✅ erfolgreich (378 MB) – in der Testumgebung mit zusätzlichem Proxy-Zertifikat, das echte `Dockerfile` ist unverändert |
| Kompletter Stack | `docker compose up -d` (App + PostgreSQL + Caddy, Domain `localhost`) | ✅ App/DB „healthy“, HTTPS mit HSTS, HTTP→HTTPS-Umleitung, CSP; Einrichtung + Veröffentlichung im Browser durchgespielt |
| Backup & Wiederherstellung | `deploy/backup.sh` + Befehle aus `BETRIEB.md` | ✅ Daten gelöscht → wiederhergestellt → wieder sichtbar |
| Schnellstart `npm run dev` (eingebettete DB) | README | ✅ Einrichtung im Browser, keine Konsolenfehler |

## Testdateien

| Datei | Tests | Inhalt |
|---|---:|---|
| `tests/unit/permissions.test.ts` | 5 | Rollenrechte, Mandantenprüfung |
| `tests/unit/content.test.ts` | 7 | sicheres Textformat, kein HTML/`javascript:`, Warnprüfung sensibler Inhalte |
| `tests/unit/validation.test.ts` | 10 | Eingabevalidierung, Dateityp per Inhalt, Dateinamen, Passwort-Hashing |
| `tests/unit/time.test.ts` | 4 | Sommer-/Winterzeit Europe/Berlin |
| `tests/integration/tenant-isolation.test.ts` | 11 | Mandantentrennung (Lesen, Ändern, Veröffentlichen, Löschen, Kategorien, Kontakte, Team, Push, Anhänge, Zugangscode, Protokoll) |
| `tests/integration/messages-workflow.test.ts` | 19 | Einladungen, Rollen, Entwurf/Freigabe/Veröffentlichung, Bestätigungen, Sichtbarkeit, Planung, Ablauf, Suche (inkl. SQL-Sonderzeichen), Archiv, Rückzug, Löschen, Anhänge |
| `tests/integration/push.test.ts` | 14 | **echte Web-Push-Verschlüsselung + VAPID-Signaturprüfung** gegen lokalen HTTPS-Push-Dienst, neutrale Texte, Doppelversand (inkl. paralleler Läufe), 404/410/500/nicht erreichbar, Kategorien/Wichtig-Filter, Belegschafts-Zugang + Codewechsel, Gremium nie, Planung, Rückzug, Versandbegrenzung, Abmeldung, ein Gerät = ein Abo |
| `tests/unit/totp.test.ts` | 5 | RFC-6238-Testvektoren, Zeitfenster, Wiederverwendung, Verschlüsselung, Wiederherstellungscodes |
| `tests/integration/account.test.ts` | 9 | 2FA einrichten/anmelden/sperren/ausschalten, Passwort ändern, andere Geräte abmelden, Reset-Link (einmalig, Rechte, keine Übernahme über Mandantengrenzen) |
| `tests/integration/polls.test.ts` | 6 | Validierung, Entwürfe unsichtbar, Rechte, eine Stimme pro Gerät, Belegschafts-Zugang, öffentliche Bestätigung, Anonymisierung bei Ende/Ablauf, Mandantentrennung |
| `tests/integration/auth-retention.test.ts` | 7 | Anmeldung, Token-Hashing, gleiche Fehlermeldungen, Sperre nach 5 Fehlversuchen, HMAC statt Klartext, Sitzungsablauf, Löschfristen, Konto-Löschung, Mandanten-Löschung |
| `e2e/main.spec.ts` | 13 | siehe unten |

## E2E-Abläufe
1. ✅ Ersteinrichtung (falsches Token abgelehnt, Eingaben bleiben erhalten)
2. ✅ Startseite ohne Konto, „Betriebsrat finden“, **axe-Prüfung WCAG 2.2 AA ohne schwere Verstöße**
3. ✅ Verwaltung ohne Anmeldung → Login; falsches Passwort
4. ✅ Öffentliche Mitteilung: Entwurf unsichtbar (404) → Vorschau → Pflichtbestätigung → sichtbar; XSS als Text; Suche; axe-Prüfung
5. ✅ Belegschafts-Code (falsch/richtig), Gremiums-Inhalt bleibt auch mit Code unsichtbar
6. ✅ Redakteur per Einladungslink: keine Team-Rechte, kann nicht veröffentlichen, reicht zur Freigabe ein; Link nur einmal nutzbar
7. ✅ CSRF (fremde Herkunft → 403), ungültige Push-Daten → 400, Cron ohne Geheimnis → 401
8. ✅ Push-Seite: Erklärung vor Abfrage, iPhone-Anleitung (simuliertes iPhone), mobile Navigation
9. ⚠️ **Übersprungen:** echtes Push-Abo im Browser. Das Open-Source-Chromium der Testumgebung meldet `AbortError: Registration failed - permission denied`, weil ihm die Zugangsdaten für Googles Push-Dienst (FCM) fehlen. Das betrifft nur diese Testumgebung. **Offen: manueller Test auf echten Geräten** (Anleitung in `BETRIEB.md`).
10. ✅ Zurückziehen → sofort 404; Abmelden beendet Sitzung
11. ✅ Umfrage: anlegen, starten, nur mit Belegschafts-Code sichtbar, abstimmen, zweite Stimme verhindert, Ergebnis, beenden; axe-Prüfung
12. ✅ Aushang mit QR-Code; axe-Prüfung aller Verwaltungsseiten; Passwort-Reset-Link (einmalig)
13. ✅ Zwei-Faktor einrichten (QR/Schlüssel), Anmeldung ohne Code verweigert, falscher Code abgelehnt, richtiger Code → Zugang

Alle Seiten mit axe-Prüfung werden zusätzlich auf verschachtelte Formulare geprüft.

## Während der Entwicklung durch Tests gefundene und behobene Fehler
- Ungültiges `ORDER BY 0` in der Archivsuche (Integrationstest)
- Versandbegrenzung-Test teilte Zustand mit anderen Tests (Testfehler, isoliert)
- Formulare verloren nach Fehlermeldungen alle Eingaben (E2E) → eigene `ActionForm`-Komponente
- Dekoratives Logo ohne Textalternative (axe/E2E) → für Screenreader ausgeblendet
- Admin-Navigation verursachte horizontales Scrollen (Screenshot-Prüfung)
- Geplanter Push wäre bei nachträglich verschobenem Termin verworfen worden (Code-Review) → wird mitverschoben
- Ratenbegrenzungen hätten bei gemeinsamer Firmen-IP zu früh gegriffen (Review) → angepasst
- Zwei-Faktor-Einrichtung: verschachtelte Formulare starteten die Einrichtung neu (E2E) → getrennt, neuer Prüfschritt in allen E2E-Tests
- Code-Eingabeseite übergab eine Funktion an eine Client-Komponente (E2E/Serverfehler) → eigene Client-Komponente
- Danke-Meldung nach Abstimmung verschwand durch Neuladen (E2E) → eindeutiger Status „Stimme gezählt“
- TOTP-Wiederverwendung war nicht atomar (Review) → bedingte Aktualisierung in der Datenbank
- Docker: Basis-Images wegen Docker-Hub-Limit über Google-Spiegel bezogen (nur Testumgebung)
