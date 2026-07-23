#!/usr/bin/env sh
# =============================================================
# Detailly - Restore-Skript (dep-frei, POSIX sh)
#
# Entschluesselt ein von scripts/backup.sh erzeugtes Archiv (*.tar.gz.enc) und
# spielt es zurueck:
#   - DB (Postgres): pg_restore in eine ZIEL-DB
#   - Foto-Verzeichnisse: uploads/ + private-uploads/ nach RESTORE_TARGET_DIR
#
# Aufruf:
#   BACKUP_ENC_KEY=... sh scripts/restore.sh <archiv.tar.gz.enc>
#
# WICHTIGE Sicherheits-/Vorgehens-Hinweise:
#   1) Standardmaessig laeuft der Restore in eine TEST-DB (RESTORE_DB_NAME,
#      Default "detailly_restore_test") - NICHT ueber die Live-DB. Das ist der
#      empfohlene, gefahrlose Weg fuer den regelmaessigen Restore-Test.
#   2) Der DB-Restore ist erst mit ALLOW_DB_RESTORE=1 scharf. Ohne dieses Flag
#      wird das Archiv nur entschluesselt/entpackt und der pg_restore-Befehl NUR
#      ANGEZEIGT (dry-run) - kein versehentliches Ueberschreiben.
#   3) Feldverschluesselte Spalten (IBAN, Rechnungsempfaenger, SMTP-Passwoerter ...)
#      sind nach dem Restore nur mit dem PASSENDEN DATA_ENC_KEY der Backup-Zeit
#      lesbar. DATA_ENC_KEY getrennt und dauerhaft aufbewahren!
#
#   >>> Ein Backup, das nie zurueckgespielt wurde, ist kein Backup. Diesen
#       Restore EINMAL echt durchspielen (Test-DB) und ins Betriebs-Log eintragen. <<<
# =============================================================
set -e

ARCHIVE=$1
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Aufruf: BACKUP_ENC_KEY=... sh scripts/restore.sh <archiv.tar.gz.enc>" >&2
  echo "  <archiv.tar.gz.enc> muss ein existierendes, verschluesseltes Backup sein." >&2
  exit 1
fi
if [ -z "${BACKUP_ENC_KEY:-}" ]; then
  echo "FEHLER: BACKUP_ENC_KEY ist nicht gesetzt (derselbe Schluessel wie beim Backup-Lauf)." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "FEHLER: 'openssl' nicht gefunden - fuer die Entschluesselung erforderlich." >&2
  exit 1
fi

RESTORE_TARGET_DIR=${RESTORE_TARGET_DIR:-./restore-out}
RESTORE_DB_NAME=${RESTORE_DB_NAME:-detailly_restore_test}
ALLOW_DB_RESTORE=${ALLOW_DB_RESTORE:-0}

# --- 1) Entschluesseln + entpacken in ein Arbeitsverzeichnis ---------------
WORK=$(mktemp -d "${TMPDIR:-/tmp}/detailly-restore.XXXXXX")
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM

echo "Entschluessele + entpacke $ARCHIVE ..."
openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENC_KEY -in "$ARCHIVE" \
  | tar -xzf - -C "$WORK"
echo "Inhalt:"
ls -1 "$WORK"

# --- 2) Foto-Verzeichnisse wiederherstellen --------------------------------
mkdir -p "$RESTORE_TARGET_DIR"
[ -f "$WORK/uploads.tar.gz" ] && tar -xzf "$WORK/uploads.tar.gz" -C "$RESTORE_TARGET_DIR" && \
  echo "uploads/ -> $RESTORE_TARGET_DIR/uploads"
[ -f "$WORK/private-uploads.tar.gz" ] && tar -xzf "$WORK/private-uploads.tar.gz" -C "$RESTORE_TARGET_DIR" && \
  echo "private-uploads/ -> $RESTORE_TARGET_DIR/private-uploads (DSGVO: personenbezogen, zugriffsbeschraenkt ablegen!)"

# --- 3) Datenbank wiederherstellen -----------------------------------------
if [ -f "$WORK/db.dump" ]; then
  RESTORE_CMD="PGPASSWORD=***** pg_restore -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-detailly} -d ${RESTORE_DB_NAME} --clean --if-exists --no-owner \"$WORK/db.dump\""
  if [ "$ALLOW_DB_RESTORE" = "1" ]; then
    echo "Spiele Postgres-Dump in DB '${RESTORE_DB_NAME}' ein (ALLOW_DB_RESTORE=1) ..."
    echo "  Hinweis: Ziel-DB muss existieren (createdb ${RESTORE_DB_NAME})."
    PGPASSWORD="$DB_PASS" pg_restore \
      -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-detailly}" \
      -d "${RESTORE_DB_NAME}" --clean --if-exists --no-owner "$WORK/db.dump"
    echo "Plausi-Check:"
    PGPASSWORD="$DB_PASS" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
      -U "${DB_USER:-detailly}" -d "${RESTORE_DB_NAME}" \
      -c "SELECT count(*) AS tenants FROM tenants;" || true
    echo "DB-Restore abgeschlossen. Test-DB nach Pruefung verwerfen: dropdb ${RESTORE_DB_NAME}"
  else
    echo "DRY-RUN (ALLOW_DB_RESTORE!=1): DB-Dump entpackt unter $WORK/db.dump - kein Einspielen."
    echo "  Zum echten Restore-Test Ziel-DB anlegen und Flag setzen:"
    echo "    createdb ${RESTORE_DB_NAME}"
    echo "    ALLOW_DB_RESTORE=1 BACKUP_ENC_KEY=... sh scripts/restore.sh \"$ARCHIVE\""
    echo "  Auszufuehrender Befehl waere:"
    echo "    $RESTORE_CMD"
  fi
else
  echo "Kein db.dump im Archiv (SQLite-Backup?) - pruefe $WORK auf detailly.db."
fi

echo "Fertig. Restore-Test bitte im Betriebs-Log dokumentieren (Datum + Ergebnis)."
