#!/bin/sh
# Tägliches Datenbank-Backup (per cron auf dem Server aufrufen), behält 14 Tage.
#   0 3 * * * cd /opt/betriebsrat && ./deploy/backup.sh >> backup.log 2>&1
# Wiederherstellung siehe docs/BETRIEB.md
set -eu
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
FILE="$DIR/betriebsrat-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U betriebsrat --no-owner betriebsrat | gzip > "$FILE"
chmod 600 "$FILE"
find "$DIR" -name 'betriebsrat-*.sql.gz' -mtime +14 -delete
echo "Backup erstellt: $FILE"
