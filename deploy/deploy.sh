#!/usr/bin/env bash
# =============================================================
# Detailly - idempotentes Deploy/Update-Skript
#
# Ablauf (Reihenfolge ist Absicht - Migrationen VOR dem Neustart):
#   0) Pre-Deploy-Backup (verschluesselt) ziehen
#   1) git pull (fast-forward)
#   2) Abhaengigkeiten installieren (Backend + Frontend)
#   3) build:all (Frontend statisch + Backend + Client-Kopie)
#   4) migration:run  (Schema aktualisieren, VOR Neustart)
#   5) systemctl restart (Preflight validiert die ENV)
#   6) Health-Check /api/v1/health/ready abwarten (mit Timeout)
#
# Idempotent: mehrfaches Ausfuehren ohne neuen Commit ist gefahrlos
# (git pull = no-op, build ueberschreibt, migration:run = "no pending",
#  restart ist unkritisch). Bricht bei jedem Fehler ab (set -euo pipefail).
#
# Aufruf:  sudo -u detailly bash deploy/deploy.sh
# Konfiguration ueber ENV (Defaults in Klammern):
#   APP_DIR (/opt/detailly)  SERVICE (detailly)
#   HEALTH_URL (http://127.0.0.1:3001/api/v1/health/ready)  HEALTH_TIMEOUT (60 s)
# =============================================================
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/detailly}
SERVICE=${SERVICE:-detailly}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3001/api/v1/health/ready}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}

log() { echo "[deploy] $*"; }

cd "$APP_DIR"

# --- 0) Pre-Deploy-Backup (best effort, aber laut warnen) -------------------
log "Pre-Deploy-Backup ..."
if [ -f "$APP_DIR/backend/.env.backup" ]; then
  # shellcheck disable=SC1091
  ( cd "$APP_DIR/backend" && set -a && . ./.env && . ./.env.backup && set +a && sh scripts/backup.sh ) \
    || log "WARNUNG: Pre-Deploy-Backup fehlgeschlagen - Deploy wird fortgesetzt, bitte pruefen."
else
  log "WARNUNG: .env.backup fehlt - Pre-Deploy-Backup uebersprungen (BACKUP_ENC_KEY einrichten!)."
fi

# --- 1) Neuer Stand ---------------------------------------------------------
log "git pull ..."
git pull --ff-only

# --- 2) Dependencies --------------------------------------------------------
log "Backend-Dependencies ..."
( cd "$APP_DIR/backend" && npm ci --legacy-peer-deps )
log "Frontend-Dependencies ..."
( cd "$APP_DIR/frontend" && npm ci --legacy-peer-deps )

# --- 3) Bauen ---------------------------------------------------------------
log "build:all ..."
( cd "$APP_DIR/backend" && npm run build:all )

# --- 4) Migrationen VOR dem Neustart ---------------------------------------
# TYPEORM_CLI=true -> die CLI-DataSource laeuft OHNE auto-synchronize/auto-run;
# migration:run wendet die offenen Migrationen genau einmal an. ENV aus der .env.
log "Migrationen anwenden ..."
( cd "$APP_DIR/backend" && set -a && . ./.env && set +a && TYPEORM_CLI=true npm run migration:run )

# --- 5) Neustart ------------------------------------------------------------
log "systemctl restart $SERVICE ..."
sudo systemctl restart "$SERVICE"

# --- 6) Health-Check abwarten ----------------------------------------------
log "Warte auf $HEALTH_URL (Timeout ${HEALTH_TIMEOUT}s) ..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while true; do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then
    log "OK - Readiness erreicht. Deploy abgeschlossen."
    exit 0
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    log "FEHLER: Health-Check nicht innerhalb ${HEALTH_TIMEOUT}s gruen."
    log "  Logs pruefen:  journalctl -u $SERVICE -n 80 --no-pager"
    exit 1
  fi
  sleep 3
done
