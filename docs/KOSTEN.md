# Kostenübersicht – Betriebsrat Direkt

> Stand: Oktober 2026. Preise von Anbietern ändern sich (Hetzner hat z. B. im April 2026 die Preise erhöht). **Vor jeder Entscheidung die aktuellen Preise auf der Anbieterseite prüfen.** Nichts hier ist eine Garantie, dass ein Dienst dauerhaft kostenlos bleibt.

## Kurzfassung

| Was | Realistische Kosten |
|---|---|
| Software (diese App) | **0 €** – eigener Quellcode, nur Open-Source-Bausteine |
| Push-Benachrichtigungen (Web Push) | **0 €** – Push-Dienste von Google/Apple/Mozilla/Microsoft sind für Web Push kostenlos, kein Vertrag nötig |
| HTTPS-Zertifikat | **0 €** – Let's Encrypt über Caddy, automatisch erneuert |
| Server (empfohlen: kleiner VPS in Deutschland) | **ca. 4–8 € / Monat** |
| Domain (optional, aber empfohlen) | **ca. 1–2 € / Monat** (z. B. `.de` ca. 5–15 € / Jahr) |
| Native Apps (nicht nötig, nicht umgesetzt) | Apple: 99 USD / Jahr, Google Play: 25 USD einmalig |

**Ehrliches Fazit:** Ein seriöser Dauerbetrieb ist für **ca. 5–10 € pro Monat** möglich. Ein *garantiert* dauerhaft kostenloser Betrieb mit derselben Zuverlässigkeit ist nicht realistisch – aber es gibt Wege, diese Kosten nicht selbst zu tragen (siehe Punkt 5).

---

## 1. Tatsächlich kostenlos nutzbare Komponenten

| Komponente | Lizenz / Bedingung |
|---|---|
| Next.js, React, Tailwind CSS, Drizzle ORM, Zod | Open Source (MIT) |
| PostgreSQL | Open Source (PostgreSQL-Lizenz) |
| PGlite (eingebettete Datenbank für Tests/Schnellstart) | Open Source (Apache 2.0 / PostgreSQL) |
| `web-push` (Versand mit VAPID) | Open Source (MPL 2.0) |
| Caddy (Webserver, automatisches HTTPS) | Open Source (Apache 2.0) |
| Let's Encrypt | kostenlos, gemeinnützig |
| Web-Push-Zustellung durch Browserhersteller | kostenlos, ohne Anmeldung beim Anbieter |
| Playwright, Vitest, axe-core (Tests) | Open Source |
| GitHub-Repository + GitHub Actions (CI) | für öffentliche Repos frei; für private Repos begrenztes Freikontingent (Minuten/Monat) |

## 2. Kostenlose Angebote mit Nutzungslimits

Diese können für **Tests oder sehr kleine Betriebe** reichen – mit Risiken:

| Angebot | Limit / Haken |
|---|---|
| **Vercel Hobby** (Hosting) | Laut Nutzungsbedingungen nur **persönlich, nicht-kommerziell**. Eine App für einen Betriebsrat eines Unternehmens ist damit rechtlich zweifelhaft → **nicht empfohlen**. Außerdem US-Anbieter. |
| **Neon Free** (PostgreSQL) | ca. 0,5 GB Speicher, 100 CU-Stunden/Monat, schläft nach 5 Min. Inaktivität. Für eine Belegschaft mit wenigen hundert Mitteilungen ausreichend, aber Konditionen können sich ändern. |
| **Oracle Cloud „Always Free“** (VM) | kostenlose VM möglich, aber Kreditkarte nötig, Konto-Sperrungen bei Inaktivität kommen vor, US-Konzern. |
| **GitHub Actions** | private Repos: begrenzte Freiminuten |

## 3. Mögliche spätere Kosten

- **Server** bei mehr Last (unwahrscheinlich: ein Betriebsrat mit 5.000 Beschäftigten erzeugt wenig Last; ein kleiner VPS reicht für viele Betriebsräte).
- **Backups außerhalb des Servers** (z. B. Hetzner Storage Box ab ca. 3–4 €/Monat oder ein vorhandener NAS/Cloud-Speicher).
- **Domain-Verlängerung** jährlich.
- **Wartungszeit** (Updates einspielen, ca. 1–2 Std./Monat) – kein Geld, aber Aufwand.
- **Native Apps**, falls irgendwann gewünscht (Apple 99 USD/Jahr, Google 25 USD einmalig, plus Review-Aufwand).
- **E-Mail-Versand** – bewusst **nicht** eingebaut (Einladungen per Link), damit keine Kosten und kein Dienstleister nötig ist.

## 4. Alternativen zur Reduzierung laufender Kosten

1. **Ein Server für mehrere Betriebsräte**: Die App ist mandantenfähig. Ein VPS für 5 € kann viele Betriebsräte bedienen – Kosten pro Betriebsrat sinken auf Cent-Beträge.
2. **Vorhandene Infrastruktur nutzen**: Ein Server der Gewerkschaft, eines befreundeten Betriebsrats oder ein Raspberry Pi / Mini-PC mit DynDNS (dann aber eigene Verantwortung für Verfügbarkeit und Sicherheit).
3. **Keine Domain**: Mit einer kostenlosen Subdomain eines DynDNS-Anbieters möglich – weniger vertrauenswürdig wirkend, nicht empfohlen.
4. **Neon Free + günstiges Hosting** statt eigener Datenbank.
5. **Weg von einzelnen Anbietern**: Die App nutzt nur Standard-PostgreSQL und Standard-Node.js. Ein Umzug zu jedem anderen Anbieter ist mit Backup + Wiederherstellung in unter einer Stunde möglich (siehe `docs/BETRIEB.md`). Ändert ein kostenloser Anbieter seine Konditionen, ist man nicht gefangen.

## 5. Realistisches Betriebskonzept ohne verpflichtende laufende Gebühren

**Wichtig – § 40 BetrVG:** Der Arbeitgeber trägt die Kosten der Betriebsratstätigkeit, einschließlich der erforderlichen Sachmittel und Informations- und Kommunikationstechnik (§ 40 Abs. 2 BetrVG). Die Erforderlichkeit muss der Betriebsrat begründen; im Streitfall entscheidet das Arbeitsgericht. Eine Informations-App für die Belegschaft kann darunter fallen – **das ist eine rechtliche Frage für den Einzelfall (Gewerkschaft/Anwalt fragen)**.

Empfohlenes Modell:

| Stufe | Wer zahlt | Kosten |
|---|---|---|
| Entwicklung, Tests, Demo | niemand | 0 € (lokal auf dem MacBook, eingebettete Datenbank) |
| Pilotbetrieb | Betriebsrat über § 40 BetrVG (Arbeitgeber) **oder** Neon Free + günstiger VPS | 0–6 €/Monat |
| Dauerbetrieb | Arbeitgeber nach § 40 BetrVG, oder Gewerkschaft, oder mehrere Betriebsräte teilen sich einen Server | ca. 5–10 €/Monat insgesamt |

Für Hersteller (Sie) und Beschäftigte entstehen in jedem Fall **keine Kosten**: keine Lizenzgebühren, keine Abos, keine Werbung, keine Datenverkäufe.

## Quellen (Stand Okt. 2026, bitte selbst prüfen)
- Hetzner Cloud Preise: https://www.hetzner.com/cloud (CX22 eingestellt, Nachfolger CX23 ca. 4–5,50 € netto)
- Vercel Hobby (nicht-kommerziell): https://vercel.com/legal/terms , https://vercel.com/pricing
- Neon Free Plan: https://neon.com/pricing
- Let's Encrypt: https://letsencrypt.org
- § 40 BetrVG: https://www.gesetze-im-internet.de/betrvg/__40.html
