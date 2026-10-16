# Testbericht

Lauf vom **16.10.2026** in der Entwicklungsumgebung (Linux, Node.js 22.22, PostgreSQL 16.15, Chromium/Playwright 1.64). Ergebnisse unverändert übernommen.

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Lint (ESLint) | `npm run lint` | ✅ 0 Fehler, 0 Warnungen |
| Typprüfung | `npm run typecheck` | ✅ fehlerfrei |
| Unit- + Integrationstests, eingebettete DB | `npm test` | ✅ **76 / 76** bestanden (8 Dateien) |
| dieselben Tests gegen PostgreSQL 16 | `npm run test:pg` | ✅ **76 / 76** bestanden |
| Produktions-Build | `npm run build` | ✅ erfolgreich, alle Seiten dynamisch gerendert |
| End-to-End (Browser) gegen PostgreSQL | `npm run test:e2e` | ✅ **9 bestanden**, ⚠️ **1 übersprungen** (siehe unten) |
| Standalone-Server (= Docker-Laufzeit) mit Auto-Migration auf leerer DB | manuell | ✅ Health ok, 13 Tabellen angelegt, Startseite 200 |
| `npm audit --omit=dev` | | ✅ 0 Schwachstellen in Produktionsabhängigkeiten |
| `npm audit` (inkl. Entwicklungswerkzeuge) | | ⚠️ 9 Befunde nur in Dev-Tools (siehe `SICHERHEIT.md`) |
| Docker-Build | `docker compose up --build` | ❌ **nicht ausgeführt** – kein Docker-Daemon in der Umgebung |

## Testdateien

| Datei | Tests | Inhalt |
|---|---:|---|
| `tests/unit/permissions.test.ts` | 5 | Rollenrechte, Mandantenprüfung |
| `tests/unit/content.test.ts` | 7 | sicheres Textformat, kein HTML/`javascript:`, Warnprüfung sensibler Inhalte |
| `tests/unit/validation.test.ts` | 10 | Eingabevalidierung, Dateityp per Inhalt, Dateinamen, Passwort-Hashing |
| `tests/unit/time.test.ts` | 4 | Sommer-/Winterzeit Europe/Berlin |
| `tests/integration/tenant-isolation.test.ts` | 11 | Mandantentrennung (Lesen, Ändern, Veröffentlichen, Löschen, Kategorien, Kontakte, Team, Push, Anhänge, Zugangscode, Protokoll) |
| `tests/integration/messages-workflow.test.ts` | 19 | Einladungen, Rollen, Entwurf/Freigabe/Veröffentlichung, Bestätigungen, Sichtbarkeit, Planung, Ablauf, Suche (inkl. SQL-Sonderzeichen), Archiv, Rückzug, Löschen, Anhänge |
| `tests/integration/push.test.ts` | 13 | **echte Web-Push-Verschlüsselung + VAPID-Signaturprüfung** gegen lokalen HTTPS-Push-Dienst, neutrale Texte, Doppelversand (inkl. paralleler Läufe), 404/410/500/nicht erreichbar, Kategorien/Wichtig-Filter, Belegschafts-Zugang + Codewechsel, Gremium nie, Planung, Rückzug, Versandbegrenzung, Abmeldung, ein Gerät = ein Abo |
| `tests/integration/auth-retention.test.ts` | 7 | Anmeldung, Token-Hashing, gleiche Fehlermeldungen, Sperre nach 5 Fehlversuchen, HMAC statt Klartext, Sitzungsablauf, Löschfristen, Konto-Löschung, Mandanten-Löschung |
| `e2e/main.spec.ts` | 10 | siehe unten |

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

## Während der Entwicklung durch Tests gefundene und behobene Fehler
- Ungültiges `ORDER BY 0` in der Archivsuche (Integrationstest)
- Versandbegrenzung-Test teilte Zustand mit anderen Tests (Testfehler, isoliert)
- Formulare verloren nach Fehlermeldungen alle Eingaben (E2E) → eigene `ActionForm`-Komponente
- Dekoratives Logo ohne Textalternative (axe/E2E) → für Screenreader ausgeblendet
- Admin-Navigation verursachte horizontales Scrollen (Screenshot-Prüfung)
- Geplanter Push wäre bei nachträglich verschobenem Termin verworfen worden (Code-Review) → wird mitverschoben
- Ratenbegrenzungen hätten bei gemeinsamer Firmen-IP zu früh gegriffen (Review) → angepasst
