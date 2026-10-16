# Datenschutzkonzept und Checkliste

> Keine Rechtsberatung. Diese App ist nach **Privacy by Design / by Default** gebaut. Ob der Betrieb rechtskonform ist, hängt von Organisation, Verträgen und Inhalten ab. Die folgende Checkliste nennt, was **vor einem echten Produktivbetrieb** geklärt werden muss. Die Aussage „100 % DSGVO-konform“ wäre unseriös und wird bewusst nicht getroffen.

## 1. Rollen (offene rechtliche Frage!)

| Beteiligte | Wahrscheinliche Rolle | Hinweis |
|---|---|---|
| Arbeitgeber | **Verantwortlicher** (Art. 4 Nr. 7 DSGVO) auch für Verarbeitungen des Betriebsrats | § 79a Satz 2 BetrVG (seit 2021). Der Betriebsrat entscheidet aber selbst über Inhalte; die genaue Abgrenzung ist umstritten. |
| Betriebsrat | Teil der verantwortlichen Stelle, eigene Pflicht zur Einhaltung des Datenschutzes (§ 79a Satz 1 BetrVG) | Muss technische und organisatorische Maßnahmen umsetzen bzw. nachweisen. |
| Betreiber / Hoster (z. B. Sie oder ein VPS-Anbieter) | **Auftragsverarbeiter** (Art. 28 DSGVO) | **AV-Vertrag** nötig (Hetzner etc. bieten Standard-AVV). Betreiben Sie selbst die Plattform für mehrere Betriebsräte, sind Sie Auftragsverarbeiter jedes Betriebsrats. |
| Push-Dienste (Google, Apple, Mozilla, Microsoft) | Übermittlungsdienst; Inhalte Ende-zu-Ende-verschlüsselt | Sehen Endpunkt und Zeitpunkt. Drittlandbezug (USA) prüfen; Einwilligung der Nutzer liegt vor (freiwillige Aktivierung). |

➡ **Klären:** Wer schließt den AVV mit dem Hoster? Wer ist Ansprechpartner für Betroffenenrechte? Ist der/die betriebliche Datenschutzbeauftragte eingebunden?

## 2. Welche Daten werden verarbeitet?

| Datenart | Wessen | Zweck | Rechtsgrundlage (Vorschlag, prüfen) | Löschung |
|---|---|---|---|---|
| Mitteilungen | – (sollen keine Personendaten enthalten) | Information der Belegschaft | § 80, § 2 BetrVG i. V. m. Art. 6 Abs. 1 lit. c/e bzw. f | durch BR (Löschen) |
| Name, E-Mail, Passwort-Hash, Rolle | BR-Mitglieder | Zugang zur Redaktion | Art. 6 Abs. 1 lit. b/f bzw. § 26 BDSG (wenn Beschäftigte) | beim Entfernen aus dem Team |
| Änderungsprotokoll | BR-Mitglieder | Nachvollziehbarkeit, Missbrauchsschutz | Art. 6 Abs. 1 lit. f | 12 Monate |
| Sitzungen | BR-Mitglieder | Anmeldung | Art. 6 Abs. 1 lit. b/f | 24 h Inaktivität / 7 Tage |
| Push-Abo (Endpunkt, Schlüssel, Themen, Tagesdatum) | Leser/innen, pseudonym | Benachrichtigung | Einwilligung Art. 6 Abs. 1 lit. a, § 25 Abs. 1 TDDDG | Abmeldung, 404/410, 5 Fehler, 180 Tage |
| HMAC aus IP / E-Mail | Besucher | Schutz vor Brute-Force | Art. 6 Abs. 1 lit. f | 24 h |
| Belegschafts-Cookie | Leser/innen, ohne Personenbezug | Zugangsschutz | § 25 Abs. 2 Nr. 2 TDDDG | 180 Tage / Codewechsel |
| „Letzter Besuch“ | nur im Browser | „Neu“-Markierung | § 25 Abs. 2 Nr. 2 TDDDG (prüfen) | durch Nutzer/Browser |
| Kontaktdaten Ansprechpartner | BR-Mitglieder | Erreichbarkeit | Einwilligung der eingetragenen Person empfohlen | durch Admin |

**Nicht verarbeitet:** Klarnamen von Beschäftigten, private Telefonnummern/E-Mails, Standort, Geräte-IDs, Leseverhalten, Analyse-/Werbe-Cookies, Daten an KI-Anbieter.

## 3. Prüfung technischer Kennungen

| Kennung | Personenbezogen? | Maßnahme |
|---|---|---|
| IP-Adresse | ja (EuGH Breyer) | App speichert keine; nur HMAC für Ratenbegrenzung (24 h). **Caddy-Zugriffslogs sind aus.** Hoster-Logs prüfen. |
| Push-Endpunkt | ja (pseudonym, einem Gerät zuordenbar beim Push-Dienst) | keine Verknüpfung mit Namen; nur Tagesdatum; Löschfristen; Abmeldung löscht sofort |
| Sitzungs-Token | indirekt | nur SHA-256 gespeichert |
| User-Agent | ggf. | wird nicht gespeichert (nur im Browser zur iPhone-Erkennung ausgewertet) |
| Server-Fehlerlogs | evtl. | Fehlermeldungen enthalten keine Inhalte/Personendaten (nur Meldungstext) |

## 4. Technische und organisatorische Maßnahmen (umgesetzt)

- HTTPS-Erzwingung (Caddy + HSTS), sichere Cookies (`HttpOnly`, `Secure`, `SameSite=Lax`)
- Passwörter mit scrypt (N=2¹⁷), Mindestlänge 12, Ratenbegrenzung Anmeldung (5/15 min je Konto, 30/15 min je IP)
- Rollen/Rechte serverseitig, Mandantentrennung, automatisierte Tests
- Content-Security-Policy mit Nonce, Herkunftsprüfung (CSRF), keine HTML-Ausgabe von Inhalten (XSS)
- Explizite Wahl des Veröffentlichungsbereichs; Standard intern; Bestätigungspflicht für „öffentlich“
- Warnprüfung auf personenbezogene/vertrauliche Inhalte vor Veröffentlichung an die Belegschaft
- Anhänge: Typprüfung per Inhalt, 5 MB, nur über berechtigte Route, `Content-Disposition: attachment`, Sandbox-CSP
- Service Worker speichert keine Inhalte
- Automatische Löschfristen (`src/lib/services/maintenance.ts`, stündlich)
- Endgültiges Löschen von Mitteilungen, Mitgliedern und ganzen Betriebsräten
- Keine externen Skripte, Schriftarten, CDNs, Tracker (alles vom eigenen Server)

## 5. Checkliste vor dem Produktivbetrieb

- [ ] Verantwortlichkeit klären (§ 79a BetrVG), Datenschutzbeauftragte/n einbinden
- [ ] **AV-Vertrag** mit dem Hoster abschließen (Serverstandort EU/Deutschland wählen)
- [ ] Datenschutzerklärung (`/datenschutz`, Entwurf) vervollständigen und prüfen lassen
- [ ] Impressum (`/impressum`) ausfüllen, Pflicht prüfen
- [ ] Eintrag im **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 DSGVO)
- [ ] Prüfen, ob eine **DSFA** (Art. 35) nötig ist (vermutlich nicht, da keine Überwachung/Profilbildung – dokumentieren)
- [ ] Drittlandübermittlung durch Push-Dienste bewerten (EU-US DPF) und in der Erklärung nennen
- [ ] Hoster-/Proxy-Logs: IP-Speicherdauer minimieren (≤ 7 Tage) oder abschalten
- [ ] Interne Regel: keine Personalangelegenheiten einzelner Beschäftigter in Mitteilungen; vertrauliches nur „Gremium intern“
- [ ] Einwilligung der als Ansprechpartner eingetragenen Personen einholen
- [ ] Belegschafts-Code regelmäßig ändern; Hinweis, dass ein gemeinsamer Code keine starke Vertraulichkeit bietet
- [ ] Backup verschlüsselt und getrennt lagern, Wiederherstellung testen
- [ ] Prozess für Auskunfts-/Löschanfragen festlegen
- [ ] Mitbestimmung beachten: Die App erfasst kein Leseverhalten, ist also nicht zur Leistungs-/Verhaltenskontrolle geeignet (§ 87 Abs. 1 Nr. 6 BetrVG) – das ist bewusst so gebaut; trotzdem transparent kommunizieren
- [ ] Auf Arbeitgeber-Geräten (MDM) können Arbeitgeber ggf. App-Nutzung sehen – Beschäftigte darauf hinweisen, dass private Geräte freiwillig sind

## 6. Offene Fragen

1. Gilt der Arbeitgeber auch für diese App als Verantwortlicher, obwohl der Betriebsrat sie unabhängig betreibt? (umstritten; Auswirkung auf AVV und Datenschutzerklärung)
2. Ist der gemeinsame Belegschafts-Code als Zugangsschutz für die geplanten Inhalte ausreichend? (für wirklich vertrauliche Inhalte: **nein**)
3. Reicht § 25 Abs. 2 Nr. 2 TDDDG für die lokale „Neu“-Markierung, oder sollte sie per Schalter abschaltbar sein?
4. Muss die Datenschutzerklärung die konkreten Push-Dienstleister je Browser nennen?
