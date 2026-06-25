#!/usr/bin/env sh
# =============================================================
# Detailly - Backup-Skript (dep-frei, POSIX sh)
#
# Sichert DB + Foto-Verzeichnisse:
#   - DB: pg_dump (Postgres) ODER sqlite3 .backup (SQLite)
#   - uploads/         (oeffentliche Auftrags-Fotos)
#   - private-uploads/ (DSGVO: Inspektionsfotos, personenbezogen!)
#
# Aufruf (im backend/-Verzeichnis, ENV wie der Server):
#   sh scripts/backup.sh
# Im Container:
#   docker compose exec backend sh scripts/backup.sh
#
# WICHTIG (DSGVO): private-uploads enthaelt personenbezogene Fotos. Das
# Backup-Archiv ist damit personenbezogen -> verschluesselt/zugriffsbeschraenkt
# ablegen (z.B. gpg) und versioniert AUSSERHALB des Servers aufbewahren.
# =============================================================
set -e

TS=$(date +%Y%m%d-%H%M%S)
OUT=${BACKUP_DIR:-./backups}/$TS
mkdir -p "$OUT"

if [ "${DB_TYPE:-sqlite}" = "postgres" ]; then
  # Logisches Dump im Custom-Format (-F c) -> mit pg_restore wiederherstellbar.
  PGPASSWORD="$DB_PASS" pg_dump \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-detailly}" \
    -d "${DB_NAME:-detailly}" \
    -F c -f "$OUT/db.dump"
else
  # SQLite: konsistente Kopie via .backup (sperrt nicht hart).
  # Fallback: einfache Dateikopie (Dienst sollte dafuer gestoppt sein).
  DBFILE=${DB_DATABASE:-detailly.db}
  sqlite3 "$DBFILE" ".backup '$OUT/detailly.db'" || cp "$DBFILE" "$OUT/detailly.db"
fi

# Foto-Verzeichnisse (relativ zum backend/-Arbeitsverzeichnis = process.cwd).
tar -czf "$OUT/uploads.tar.gz" -C . uploads 2>/dev/null || true
tar -czf "$OUT/private-uploads.tar.gz" -C . private-uploads 2>/dev/null || true

echo "Backup abgelegt unter $OUT"
