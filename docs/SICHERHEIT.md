# Sicherheits-Checkliste

## Umgesetzt und automatisiert getestet

| Bereich | Maßnahme | Test |
|---|---|---|
| Authentifizierung | scrypt-Hashes, Timing-sicherer Vergleich, gleiche Fehlermeldung für unbekannte E-Mail/falsches Passwort | `auth-retention.test.ts` |
| Brute-Force | Ratenbegrenzung Login (E-Mail + IP), Belegschafts-Code, Push-Abo, Einrichtung, Einladungen | `auth-retention.test.ts` |
| Sitzungen | 256-Bit-Token, nur Hash in DB, 24 h Inaktivität, 7 Tage absolut, Abmeldung löscht serverseitig | Unit + E2E |
| Autorisierung | Rechte im Service-Layer, nie nur UI | `permissions.test.ts`, `messages-workflow.test.ts`, E2E Redakteur |
| Mandantentrennung | tenant_id in jeder Abfrage, 404 bei fremdem Mandanten | `tenant-isolation.test.ts` |
| XSS | Kein HTML-Rendering von Inhalten, CSP mit Nonce + `strict-dynamic`, nur http(s)-Links | `content.test.ts`, E2E |
| CSRF | SameSite=Lax, Origin-Prüfung in `proxy.ts` + Next.js Server Actions | E2E |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | Header-Prüfung |
| Open Redirect | Weiterleitung nach Codeeingabe nur innerhalb des eigenen Betriebsrats | Code-Review |
| Uploads | Magic-Byte-Prüfung, 5 MB, 3 Dateien, Dateiname bereinigt, `attachment` + `nosniff` + Sandbox-CSP, Sichtbarkeit wie Mitteilung | `validation.test.ts`, `messages-workflow.test.ts` |
| Vertraulichkeit | Bereich muss explizit gewählt werden, „öffentlich“ braucht Bestätigung, Warnprüfung, nachträgliches Öffentlich-Machen gesperrt | Workflow + E2E |
| Push | VAPID, Ende-zu-Ende-Verschlüsselung, Doppelversand-Schutz, Ratenbegrenzung, abgelaufene Abos entfernen | `push.test.ts` (echte Verschlüsselung) |
| Geheimnisse | nur über Umgebungsvariablen, `.env` in `.gitignore`, keine Schlüssel im Code (auch nicht in Tests) | – |
| Abhängigkeiten | `npm audit` in CI, Dependabot wöchentlich | CI |
| Container | läuft als unprivilegierter Benutzer, DB nicht nach außen offen | – |

## Stand `npm audit` (16.10.2026)

- **Produktionsabhängigkeiten: 0 Schwachstellen.**
- 9 Befunde (5 hoch, 4 mittel) ausschließlich in Entwicklungswerkzeugen (`eslint-config-next` → `braces`/`micromatch`, `drizzle-kit` → altes `esbuild`). Sie laufen nicht im Server und sind nur bei der Entwicklung relevant; Behebung erfordert brechende Upgrades → bei nächstem Update von Next.js/Drizzle-Kit erneut prüfen.

## Vor dem Produktivbetrieb (manuell)

- [ ] `SESSION_SECRET`, VAPID-Schlüssel neu erzeugen (`npm run secrets`), niemals wiederverwenden
- [ ] `SETUP_TOKEN` nach der Einrichtung **leeren** und App neu starten
- [ ] Domain mit HTTPS (Caddy), Port 3000/5432 nicht öffentlich
- [ ] Server: automatische Sicherheitsupdates (`unattended-upgrades`), SSH nur mit Schlüssel, Firewall (nur 22/80/443)
- [ ] Backup einrichten **und Wiederherstellung einmal testen**
- [ ] Administratoren: starke, einzigartige Passwörter (Passwortmanager)
- [ ] Monatlich: `git pull`, `npm audit`, Container neu bauen (siehe `docs/BETRIEB.md`)

## Bekannte Grenzen

- Kein Zwei-Faktor-Login (geplant). Ausgleich: lange Passwörter, Ratenbegrenzung.
- Kein „Passwort vergessen“ per E-Mail (bewusst, kein Mailserver). Ausgleich: Admin entfernt und lädt neu ein.
- Der Belegschafts-Code ist ein gemeinsames Geheimnis – kein Ersatz für persönliche Konten.
- Die IP-Ermittlung für die Ratenbegrenzung ist ohne `TRUST_PROXY=true` hinter einem Proxy ungenau (Limit pro E-Mail greift trotzdem).
- Viele Beschäftigte teilen sich oft eine Firmen-IP (NAT). Daher: Push-Abo bis 600/Stunde je IP, beim Belegschafts-Code zählen nur Fehlversuche (20/15 min je IP). Werte in `src/lib/services/rate-limit.ts` anpassbar.
