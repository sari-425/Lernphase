# Betrieb: Bereitstellung, HTTPS, Backups, Wartung

## Empfohlener Weg: kleiner Server (VPS) in Deutschland mit Docker

Ergebnis: `https://ihre-domain.de` mit automatischem HTTPS, PostgreSQL, täglichem Backup. Kosten: ca. 5–10 €/Monat (siehe `KOSTEN.md`).

### Benötigte Konten (von Ihnen anzulegen – ich habe nichts registriert)
1. **Server-Anbieter** (z. B. Hetzner, netcup, IONOS) – VPS mit Ubuntu 24.04, 2 GB RAM genügen. AV-Vertrag im Kundenkonto abschließen.
2. **Domain** (oft beim selben Anbieter). Alternativ eine Subdomain einer bestehenden Domain.
3. Optional: **GitHub** für Code und automatische Tests (vorhanden: `sari-425/Lernphase`).

### Schritt für Schritt
1. **DNS:** Beim Domain-Anbieter einen `A`-Eintrag `betriebsrat.ihre-domain.de → <IP des Servers>` anlegen (ggf. auch `AAAA` für IPv6).
2. **Server vorbereiten** (per SSH als root):
   ```bash
   apt update && apt -y upgrade && apt -y install docker.io docker-compose-v2 git unattended-upgrades ufw
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
   ```
3. **Code holen:**
   ```bash
   git clone https://github.com/sari-425/Lernphase.git /opt/betriebsrat && cd /opt/betriebsrat
   ```
4. **Konfiguration:**
   ```bash
   cp .env.example .env
   docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci --ignore-scripts >/dev/null && npx tsx scripts/generate-secrets.mts"
   ```
   Ausgabe in `.env` übernehmen. Zusätzlich setzen: `POSTGRES_PASSWORD` (langes Zufallspasswort), `DOMAIN=betriebsrat.ihre-domain.de`, `APP_URL=https://betriebsrat.ihre-domain.de`, `VAPID_SUBJECT=mailto:…`, `TRUST_PROXY=true`.
   ```bash
   chmod 600 .env
   ```
5. **Starten:** `docker compose up -d --build` – Caddy holt das Zertifikat automatisch (Port 80/443 müssen erreichbar sein).
6. **Prüfen:** `https://betriebsrat.ihre-domain.de/api/health` → `{"ok":true,"push":true}`
7. **Betriebsrat anlegen:** `https://…/einrichtung` mit dem `SETUP_TOKEN` öffnen. Danach `SETUP_TOKEN=` in `.env` leeren und `docker compose up -d` ausführen.
8. **Aushang:** In der Verwaltung → „Aushang mit QR-Code“ → drucken und aushängen.
9. **Backups** einrichten (siehe unten).
10. **Zwei-Faktor-Anmeldung** für alle Admins unter „Mein Konto“ aktivieren.

### Alternative ohne Docker (z. B. vorhandener Server mit Node.js 22 + PostgreSQL)
```bash
npm ci && npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && cp -r drizzle .next/standalone/
cd .next/standalone && NODE_ENV=production PORT=3000 AUTO_MIGRATE=true <weitere Variablen> node server.js
```
Davor einen Reverse Proxy mit HTTPS (Caddy oder Nginx + certbot) und einen Prozessmanager (systemd) setzen.

### Serverless (z. B. Vercel) – nur mit Vorbehalt
Technisch möglich (`ENABLE_INTERNAL_SCHEDULER=false`, externe PostgreSQL wie Neon, `/api/cron` jede Minute per externem Cron mit `Authorization: Bearer $CRON_SECRET` aufrufen). Der kostenlose Vercel-Hobby-Tarif ist laut Bedingungen aber nur für nicht-kommerzielle private Nutzung – siehe `KOSTEN.md`.

## Push-Schlüssel (VAPID)
- Erzeugen: `npm run secrets` (oder Schritt 4 oben).
- **Nie ändern**, solange es Abonnenten gibt: Mit neuen Schlüsseln werden alle bestehenden Abos ungültig und Beschäftigte müssen Push neu aktivieren.
- Der private Schlüssel gehört nur in `.env`/Server-Konfiguration.

## Push auf echten Geräten testen (manuell, noch offen)
Automatisiert getestet ist der Versand inkl. Verschlüsselung gegen einen lokalen Push-Dienst. Die Zustellung über die echten Dienste von Google/Apple/Mozilla muss einmal auf echten Geräten geprüft werden – **Push funktioniert nur über HTTPS** (Ausnahme: `localhost`):

| Gerät | Ablauf | Erwartung |
|---|---|---|
| Android + Chrome | Seite öffnen → Benachrichtigungen → Aktivieren → Erlauben | Status „aktiv“; Admin sieht „Push-Geräte: 1“ |
| iPhone (iOS ≥ 16.4) | Safari → Teilen → „Zum Home-Bildschirm“ → App vom Home-Bildschirm öffnen → Aktivieren | Abfrage erscheint erst in der installierten App |
| Windows/macOS + Chrome/Edge/Firefox | Aktivieren → Erlauben | Benachrichtigung des Betriebssystems |
| macOS Safari | Aktivieren → Erlauben | wie oben |

**Schnellster Test:** Auf dem Gerät Benachrichtigungen aktivieren, dann als Betriebsratsmitglied auf demselben Gerät anmelden → Übersicht → „Test-Benachrichtigung an dieses Gerät“. Die App meldet, ob der Push-Dienst die Nachricht angenommen hat (bzw. die genaue Fehlerursache).

Danach im Admin eine öffentliche Testmitteilung mit Push veröffentlichen; im Dashboard „Letzte Push-Versände“ muss „übergeben x von y“ stehen und auf den Geräten eine Benachrichtigung erscheinen. Klick öffnet die Mitteilung. Danach „Benachrichtigungen deaktivieren“ testen.

## Backups und Wiederherstellung

*(Ablauf am 16.10.2026 mit dem Docker-Stack getestet: Backup → Daten gelöscht → Wiederherstellung → Daten wieder vorhanden.)*

**Backup** (täglich per cron):
```bash
crontab -e
0 3 * * * cd /opt/betriebsrat && ./deploy/backup.sh >> backup.log 2>&1
```
Backups liegen in `/opt/betriebsrat/backups` (14 Tage). **Zusätzlich außerhalb des Servers** speichern (z. B. `rsync`/`rclone` auf eine Storage Box oder einen NAS, möglichst verschlüsselt). Ein Backup auf demselben Server schützt nicht vor dessen Verlust.

**Wiederherstellung:**
```bash
docker compose stop app
gunzip -c backups/betriebsrat-JJJJMMTT-HHMMSS.sql.gz | docker compose exec -T db psql -U betriebsrat -d betriebsrat -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;" -f -
docker compose start app
```
(Vorsicht: ersetzt alle aktuellen Daten.) **Wiederherstellung mindestens einmal testen**, am besten auf einem zweiten Rechner.

Hinweis: Auch `.env` sichern (sonst gehen VAPID-Schlüssel und `SESSION_SECRET` verloren) – getrennt und geschützt aufbewahren.

## Wartung und Updates (ca. monatlich, 15 Minuten)
```bash
cd /opt/betriebsrat
./deploy/backup.sh
git pull
docker compose up -d --build
docker image prune -f
curl -s https://betriebsrat.ihre-domain.de/api/health
```
- Dependabot öffnet auf GitHub automatisch Update-Vorschläge; die CI prüft sie (Lint, Typen, Tests, Build, E2E).
- Betriebssystem: `unattended-upgrades` installiert Sicherheitsupdates automatisch.
- Datenbank-Updates (Schemaänderungen) laufen beim Start automatisch (`AUTO_MIGRATE=true`).

## Betreiber-Werkzeuge (CLI)
```bash
npm run tenant -- list
ADMIN_PASSWORD='…' npm run tenant -- create <kurzadresse> "Betriebsrat XY" admin@xy.de "Vorname Name" "XY GmbH"
npm run tenant -- delete <kurzadresse> --ja      # löscht ALLES dieses Betriebsrats
npm run db:migrate
```
Mit Docker: `docker compose exec app …` funktioniert nicht für diese Skripte (das Image enthält nur den fertigen Server). Stattdessen auf dem Server mit `DATABASE_URL=postgres://…` und Node.js ausführen oder die Weboberfläche `/einrichtung` nutzen.

## Fehlersuche
- `docker compose logs -f app` – Anwendungsmeldungen (enthalten keine Inhalte oder Personendaten)
- Health: `/api/health` → `push:false` bedeutet: VAPID-Schlüssel fehlen
- Zertifikat: `docker compose logs caddy` (DNS korrekt? Ports 80/443 offen?)
