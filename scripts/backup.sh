#!/usr/bin/env sh
# =============================================================
# Detailly - Backup-Skript (dep-frei, POSIX sh)
#
# Erzeugt pro Lauf EIN verschluesseltes Archiv mit:
#   - DB-Dump:         pg_dump (Postgres, Custom-Format) ODER sqlite3 .backup
#   - uploads/         (oeffentliche Auftrags-Fotos)
#   - private-uploads/ (DSGVO: Inspektionsfotos, personenbezogen!)
#
# Aufruf (im backend/-Verzeichnis, ENV wie der Server):
#   BACKUP_ENC_KEY=... sh scripts/backup.sh
# Automatisiert ueber systemd-Timer/cron: siehe deploy/detailly-backup.{service,timer}
#   bzw. deploy/detailly-backup.cron.
#
# ---------------------------------------------------------------
# VERSCHLUESSELUNG (Pflicht): Das Archiv enthaelt personenbezogene Fotos +
# (Postgres) Rechnungsdaten -> es ist selbst personenbezogen. Es wird mit
# openssl AES-256-CBC (PBKDF2) gegen BACKUP_ENC_KEY verschluesselt.
#
#   >>> BACKUP_ENC_KEY ist ein EIGENER Schluessel und darf NIEMALS mit
#       DATA_ENC_KEY (Feldverschluesselung) identisch sein. <<<
#   Grund: (1) Schluessel-Trennung nach Zweck (ein kompromittiertes Offsite-
#   Backup gibt nicht zugleich den Live-Feldschluessel preis, und umgekehrt).
#   (2) Rotationszyklen sind verschieden (DATA_ENC_KEY praktisch nie rotierbar
#   ohne Re-Encrypt aller Felder; BACKUP_ENC_KEY frei rotierbar). Das Skript
#   verweigert den Lauf, wenn beide gleich sind.
#
# DSGVO-Rechtsgrundlage der Aufbewahrung: Art. 6 Abs. 1 lit. f (berechtigtes
# Interesse an Datensicherheit/Wiederherstellbarkeit; Integritaet & Vertraulichkeit
# nach Art. 32). Aufbewahrung ist ueber die Rotation zeitlich BEGRENZT.
#
# ROTATION (GFS-lite): KEEP_DAILY taegliche + KEEP_WEEKLY woechentliche Archive.
# OFFSITE: optionaler Push an <PLATZHALTER> (BACKUP_OFFSITE_TARGET), s.u.
# =============================================================
set -e

# --- Konfiguration (ENV, mit sinnvollen Defaults) --------------------------
BACKUP_DIR=${BACKUP_DIR:-/var/backups/detailly}
KEEP_DAILY=${KEEP_DAILY:-7}          # 7 taegliche Archive vorhalten
KEEP_WEEKLY=${KEEP_WEEKLY:-4}        # 4 woechentliche Archive vorhalten
WEEKLY_DOW=${WEEKLY_DOW:-7}          # Wochen-Kopie an diesem Wochentag (1=Mo..7=So)
# BACKUP_OFFSITE_TARGET: <PLATZHALTER: vom Betreiber setzen> - z. B.
#   "rsync://backup-host/detailly" oder ein rclone-Remote "s3remote:detailly".
# Leer = kein Offsite-Push (nur lokal). Offsite ist fuer echte Ausfallsicherheit
# (Serververlust/Brand) Pflicht - siehe docs/RUNBOOK_PRODUKTION.md.
BACKUP_OFFSITE_TARGET=${BACKUP_OFFSITE_TARGET:-}

# --- Guard: Verschluesselungsschluessel vorhanden & getrennt ---------------
if [ -z "${BACKUP_ENC_KEY:-}" ]; then
  echo "FEHLER: BACKUP_ENC_KEY ist nicht gesetzt. Backups muessen verschluesselt werden." >&2
  echo "  Erzeugen (einmalig, sicher hinterlegen): openssl rand -hex 32" >&2
  exit 1
fi
if [ -n "${DATA_ENC_KEY:-}" ] && [ "${BACKUP_ENC_KEY}" = "${DATA_ENC_KEY}" ]; then
  echo "FEHLER: BACKUP_ENC_KEY ist identisch mit DATA_ENC_KEY." >&2
  echo "  Backup- und Feldverschluesselung MUESSEN verschiedene Schluessel nutzen." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "FEHLER: 'openssl' nicht gefunden - fuer die Backup-Verschluesselung erforderlich." >&2
  exit 1
fi

TS=$(date +%Y%m%d-%H%M%S)
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

# --- Staging-Verzeichnis (wird am Ende immer aufgeraeumt) ------------------
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/detailly-backup.XXXXXX")
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT INT TERM

# --- 1) Datenbank-Dump ins Staging -----------------------------------------
if [ "${DB_TYPE:-sqlite}" = "postgres" ]; then
  # Logisches Dump im Custom-Format (-F c) -> mit pg_restore wiederherstellbar.
  PGPASSWORD="$DB_PASS" pg_dump \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-detailly}" \
    -d "${DB_NAME:-detailly}" \
    -F c -f "$STAGE/db.dump"
else
  # SQLite: konsistente Kopie via .backup (sperrt nicht hart).
  # Fallback: einfache Dateikopie (Dienst sollte dafuer gestoppt sein).
  DBFILE=${DB_DATABASE:-detailly.db}
  sqlite3 "$DBFILE" ".backup '$STAGE/detailly.db'" || cp "$DBFILE" "$STAGE/detailly.db"
fi

# --- 2) Foto-Verzeichnisse ins Staging ------------------------------------
# Basis = STORAGE_LOCAL_PATH (persistentes Volume) ODER backend/ (= process.cwd,
# Default). MUSS mit der App-Konfig uebereinstimmen, sonst sichert das Backup ein
# leeres/falsches Verzeichnis. uploads/ = oeffentliche Assets (heute ungenutzt),
# private-uploads/ = DSGVO-/aufbewahrungspflichtige Belege (Fotos, Eingangs-
# rechnungen, KYB). Siehe docs/RUNBOOK_PRODUKTION.md Abschnitt „Dateispeicher".
#
# WICHTIG: Wert trimmen (konsistent zur App: leer/Whitespace -> cwd) und die
# Verzeichnisse auf Existenz PRUEFEN. Frueher verschluckte `|| true` einen Fehler
# STILL -> das Archiv enthielt dann heimlich keine aufbewahrungspflichtigen Belege.
# Jetzt: fehlt private-uploads -> LAUTE Meldung + der Lauf endet mit Exit != 0
# (Schritt 7), der DB-Dump + das Archiv werden aber trotzdem noch erzeugt.
STORAGE_BASE=$(printf '%s' "${STORAGE_LOCAL_PATH:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
[ -z "$STORAGE_BASE" ] && STORAGE_BASE=.
PRIVATE_UPLOADS_MISSING=0

if [ -d "$STORAGE_BASE/private-uploads" ]; then
  tar -czf "$STAGE/private-uploads.tar.gz" -C "$STORAGE_BASE" private-uploads
  echo "Gesichert: $STORAGE_BASE/private-uploads"
else
  PRIVATE_UPLOADS_MISSING=1
  echo "FEHLER: '$STORAGE_BASE/private-uploads' nicht gefunden -> das Backup enthaelt KEINE" >&2
  echo "  aufbewahrungspflichtigen Belege (Fotos, Eingangsrechnungen, KYB)!" >&2
  echo "  Pruefen: STORAGE_LOCAL_PATH muss mit der App-Konfig (persistentes Volume)" >&2
  echo "  uebereinstimmen. Aktuell verwendete Basis: '$STORAGE_BASE'." >&2
fi

# uploads/ (oeffentliche Assets) ist heute ungenutzt -> Fehlen nur als Hinweis.
if [ -d "$STORAGE_BASE/uploads" ]; then
  tar -czf "$STAGE/uploads.tar.gz" -C "$STORAGE_BASE" uploads
else
  echo "Hinweis: '$STORAGE_BASE/uploads' nicht vorhanden (oeffentliche Assets, ungenutzt) - uebersprungen." >&2
fi

# --- 3) Alles zu EINEM verschluesselten Archiv buendeln --------------------
# tar streamt das Staging-Verzeichnis direkt in openssl (kein unverschluesseltes
# Zwischenarchiv auf Platte). -pbkdf2 + -salt gegen Woerterbuch-/Rainbow-Angriffe.
ARCHIVE="$DAILY_DIR/detailly-$TS.tar.gz.enc"
tar -czf - -C "$STAGE" . \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENC_KEY -out "$ARCHIVE"
chmod 600 "$ARCHIVE"
echo "Backup (verschluesselt) abgelegt: $ARCHIVE"

# --- 4) Woechentliche Kopie (GFS) am festgelegten Wochentag ----------------
if [ "$(date +%u)" = "$WEEKLY_DOW" ]; then
  cp "$ARCHIVE" "$WEEKLY_DIR/detailly-$TS.tar.gz.enc"
  chmod 600 "$WEEKLY_DIR/detailly-$TS.tar.gz.enc"
  echo "Woechentliche Kopie: $WEEKLY_DIR/detailly-$TS.tar.gz.enc"
fi

# --- 5) Rotation: aeltere ueber die Vorhaltezahl hinaus loeschen -----------
prune() {
  DIR=$1; KEEP=$2
  # Neueste zuerst; alles ab Position KEEP+1 loeschen (deterministisch ueber Anzahl).
  ls -1t "$DIR"/detailly-*.tar.gz.enc 2>/dev/null | tail -n +"$((KEEP + 1))" | while IFS= read -r f; do
    [ -n "$f" ] && rm -f "$f" && echo "rotiert (geloescht): $f"
  done
}
prune "$DAILY_DIR" "$KEEP_DAILY"
prune "$WEEKLY_DIR" "$KEEP_WEEKLY"

# --- 6) Offsite-Push (optional, Betreiber) ---------------------------------
# Ohne Offsite ist ein Serververlust (Ausfall/Brand/Loeschung) NICHT abgedeckt.
if [ -n "$BACKUP_OFFSITE_TARGET" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$ARCHIVE" "$BACKUP_OFFSITE_TARGET" && echo "Offsite (rclone) -> $BACKUP_OFFSITE_TARGET"
  elif command -v rsync >/dev/null 2>&1; then
    rsync -a "$ARCHIVE" "$BACKUP_OFFSITE_TARGET" && echo "Offsite (rsync) -> $BACKUP_OFFSITE_TARGET"
  else
    echo "WARNUNG: BACKUP_OFFSITE_TARGET gesetzt, aber weder rclone noch rsync gefunden - Offsite uebersprungen." >&2
  fi
fi

# --- 7) Abschluss-Status ---------------------------------------------------
# DB-Dump + Archiv (+ Offsite) sind erledigt. Fehlten die aufbewahrungspflichtigen
# Belege (private-uploads), endet der Lauf BEWUSST mit Exit != 0, damit
# systemd-Timer/cron + Monitoring den unvollstaendigen Backup-Lauf melden. Das
# Archiv bleibt erhalten (der DB-Teil ist gueltig) - der Fehler ist nur sichtbar.
if [ "$PRIVATE_UPLOADS_MISSING" = "1" ]; then
  echo "ACHTUNG: Backup-Lauf UNVOLLSTAENDIG - private-uploads (aufbewahrungspflichtig) fehlten." >&2
  echo "  STORAGE_LOCAL_PATH pruefen (Abgleich mit der App). Archiv: $ARCHIVE" >&2
  exit 3
fi
