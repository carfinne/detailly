# Runbook Produktion — Detailly Backend

Betriebs-Handbuch fuer die produktive Instanz (hoster-agnostisch, auf einem
Linux-Server wie Hetzner Cloud lauffaehig). Deckt Voraussetzungen, die
vollstaendige ENV-Referenz, Erst-Setup, Deploy, Backup/Restore, Reverse-Proxy,
Monitoring, Update und Rollback ab.

> **Verwandte Dokumente (nicht duplizieren):**
> - `DEPLOYMENT.md` — kompakter Go-Live-Ablauf (Erst-Einrichtung Schritt fuer Schritt).
> - `docs/archiv/RUNBOOK_P3-8_BASELINE.md` — Erzeugen der Baseline-Migration gegen eine echte Postgres.
> - `docs/RECHTLICHE_ABSICHERUNG.md` — DSGVO/AVV, Impressum, SMTP-/Stripe-Dienstleister.
>
> **Braucht noch eine Inhaber-Entscheidung (nicht baubar ohne dich):**
> - **Hoster** (z. B. Hetzner Cloud CX/CPX) und **Server-Groesse**.
> - **Domain** + DNS (A/AAAA-Record, ggf. MX/SPF/DKIM fuer Mailversand).
> - **Stripe**-Konto (Live-Keys + Webhook) — nur noetig, wenn das Abo scharf geht.
> - **SMTP**-Zugang (Anbieter + AVV) fuer System-Mails.

---

## 1. Voraussetzungen

| Komponente   | Version / Hinweis |
|--------------|-------------------|
| Node.js      | **20 LTS** (empfohlen; CI baut/testet auf Node 20). 22 LTS moeglich, aber vorher testen. |
| PostgreSQL   | **15+** (die Baseline-Migration nutzt `uuid-ossp` + `pgcrypto`, Standard ab PG 13). |
| Betriebssystem | Aktuelles Linux (Ubuntu 22.04/24.04 o. ae.). |
| Reverse-Proxy | Caddy **oder** nginx (TLS-Terminierung). |
| Prozess-Manager | systemd (empfohlen) oder pm2. |

Die Response-Kompression (gzip) macht die App selbst — der Proxy muss **nicht**
zwingend komprimieren (doppeltes gzip vermeiden).

---

## 2. ENV-Referenz (vollstaendig)

Quelle: alle `process.env`-Zugriffe im Backend, inventarisiert. Der
**Boot-Preflight** (`backend/src/config/production-preflight.ts`) erzwingt die
Pflichtfelder bei `NODE_ENV=production` und **bricht den Start sonst mit klarer
Meldung ab**; fuer empfohlene Felder gibt er nur eine Warnung aus.

### 2.1 Pflicht in Produktion (Boot bricht sonst ab)

| ENV            | Beispiel / Regel | Zweck |
|----------------|------------------|-------|
| `NODE_ENV`     | `production` | Aktiviert Prod-Haertung (kein Auto-Seed, keine Swagger-UI, kein synchronize). |
| `DB_TYPE`      | `postgres` (Pflicht — SQLite ist Dev-only) | Datenbank-Treiber. |
| `DB_HOST`      | `127.0.0.1` / DB-Host | Postgres-Host. |
| `DB_USER`      | `detailly_app` | Postgres-Benutzer. |
| `DB_PASS`      | starkes Passwort (**nicht** `detailly`) | Postgres-Passwort. |
| `DB_NAME`      | `detailly_prod` | Postgres-Datenbank. |
| `JWT_SECRET`   | `openssl rand -hex 32` (>= 16 Zeichen, kein Dev-Default) | Signatur der Login-Token. |
| `DATA_ENC_KEY` | `openssl rand -hex 32` (>= 32 Zeichen, ideal 64 Hex) | AES-256-GCM-Feldverschluesselung (Kundendaten/Rechnungen/SMTP-Passwoerter). **Schluesselverlust = Datenverlust!** |

### 2.2 Empfohlen / optional (Boot warnt, laeuft aber weiter)

| ENV | Default | Zweck |
|-----|---------|-------|
| `PORT` | `3001` | Listen-Port des Backends. |
| `DB_PORT` | `5432` | Postgres-Port. |
| `FRONTEND_URL` | *(leer)* | Zusaetzliche erlaubte CORS-Origin. Leer in Prod = nur eigene Origin (Single-Origin-Setup empfohlen). |
| `APP_BASE_URL` | Fallback `FRONTEND_URL` bzw. localhost | Basis-URL fuer Stripe-Redirects. |
| `JWT_EXPIRES_IN` | `7d` | Gueltigkeit der Login-Token. |
| `TRUST_PROXY_HOPS` | `1` | Anzahl vorgelagerter Proxies (**muss stimmen** — siehe Abschnitt 7). |
| `SEED_ADMIN_PASSWORD` | *(leer)* | Passwort fuer den ersten Admin (Erst-Setup, Abschnitt 4). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | – / `587` / `false` / – / – / – | Plattform-SMTP fuer System-Mails. Ohne `SMTP_HOST` ist der Plattform-Versand ein No-op (Betriebe koennen eigene SMTP-Daten hinterlegen). Details zu DKIM/eigener Domain: siehe `docs/RECHTLICHE_ABSICHERUNG.md`. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | *(leer)* | Self-Service-Abo. Ohne diese ist Billing deaktiviert. |
| `ANTHROPIC_API_KEY` | *(leer)* | Interner Support-Assistent. Ohne = deaktiviert (kein Crash). |
| `SECURITY_ALERT_EMAIL` | *(leer)* | Empfaenger fuer Sentinel-Sicherheitswarnungen. |

### 2.3 Sentinel-Tuning (optional, sinnvolle Defaults)

| ENV | Default | Zweck |
|-----|---------|-------|
| `LOGIN_GUARD_IP_THRESHOLD` | `50` | Fehl-Login-Schwelle je IP (hoeher fuer grosse NAT/Buero-IPs). |
| `IP_BLOCK_CACHE_TTL_MS` | `30000` | Cache-Fenster der IP-Sperrpruefung. |
| `SECURITY_EVENT_TTL_DAYS` | `60` | Aufbewahrung der Security-Events (DSGVO). |
| `SECURITY_EVENT_PURGE_INTERVAL_MS` | `21600000` (6h) | Purge-Intervall. |
| `SENTINEL_THREAT_INTERVAL_MS` | `60000` | Scan-Intervall der Auto-IP-Sperre. |
| `SENTINEL_LOGINFAIL_THRESHOLD` / `SENTINEL_LOGINFAIL_WINDOW_MS` | `30` / `600000` | Auto-Sperre bei Fehl-Login-Flut. |
| `SENTINEL_SCAN4XX_THRESHOLD` / `SENTINEL_SCAN4XX_WINDOW_MS` | `100` / `600000` | Auto-Sperre bei 401/404-Scan-Flut. |
| `SENTINEL_AUTOBLOCK_TTL_MS` | `3600000` (1h) | Dauer der Auto-Sperre. |
| `*_DISABLED` (`SENTINEL_THREAT_DISABLED`, `SECURITY_EVENT_PURGE_DISABLED`, `IP_BLOCK_PURGE_DISABLED`) | *(aus)* | Hintergrundjobs abschalten (nur zu Debug-Zwecken). |

### 2.4 Hintergrundjobs (optional)

`MAHN_JOB_*`, `TERMIN_ERINNERUNG_*`, `DSGVO_RETENTION_*`, `BOOKING_RETENTION_*`,
`KYB_RETENTION_*`, `DATENPANNE_DETECTION_*` — jeweils `_DISABLED` (aus/an) und
`_INTERVAL_MS` (Takt). Standardmaessig aktiv mit sinnvollen Intervallen; nur bei
Bedarf anfassen.

---

## 3. Datenbank anlegen (einmalig)

```sql
CREATE ROLE detailly_app LOGIN PASSWORD 'STARKES_PASSWORT';
CREATE DATABASE detailly_prod OWNER detailly_app;
```

Die benoetigten Extensions (`uuid-ossp`, `pgcrypto`) legt die erste Migration
(`CreateExtensions...`) automatisch an — kein manueller Schritt noetig, sofern
die DB-Rolle Extensions anlegen darf. Andernfalls einmalig als Superuser:

```sql
\c detailly_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## 4. Erst-Setup

1. **Baseline-Migration** muss committet sein. Sie wird **gegen eine echte,
   leere Postgres** generiert (lokal ist keine da) — der Ablauf steht in
   `docs/archiv/RUNBOOK_P3-8_BASELINE.md` bzw. laeuft ueber den GitHub-Workflow
   `.github/workflows/p3-8-baseline.yml` (manuell ausloesbar).
2. **Migrationen ausfuehren** (Schema anlegen):
   ```bash
   cd backend
   npm run migration:run
   ```
   Hinweis: In Produktion laufen die Migrationen **auch automatisch beim
   App-Start** (`migrationsRun` ist bei `NODE_ENV=production`+Postgres an). Fuer
   kontrollierte Deploys empfiehlt sich trotzdem der explizite Lauf **vor** dem
   App-Start (Abschnitt 6).
3. **Ersten Admin anlegen** — **kein** Auto-Seed in Prod. Mit gesetztem
   `SEED_ADMIN_PASSWORD` das Seed-Skript ausfuehren:
   ```bash
   SEED_ADMIN_PASSWORD='...' npm run seed
   ```
   > **Demo-Seed gehoert NICHT in Produktion.** Der Seed legt in Prod nur den
   > Admin an (siehe `src/database/seed.ts`); keine Demo-Betriebe/-Kunden.

---

## 5. Bauen (Produktions-Artefakt)

```bash
# im Repo-Root
cd backend && npm ci --legacy-peer-deps
cd ../frontend && npm ci --legacy-peer-deps
cd ../backend && npm run build:all   # Frontend statisch bauen + Backend bauen + Frontend nach backend/client kopieren
```

Ergebnis: `backend/dist/` (Server) und `backend/client/` (statisches Frontend,
wird von derselben Origin ausgeliefert).

---

## 6. Deploy-Ablauf (Reihenfolge beachten)

**Migrationen laufen VOR dem App-Start** (Zero-/Low-Downtime, kein halbfertiges
Schema):

```bash
cd backend
# 1) Neues Artefakt liegt bereit (Abschnitt 5)
npm run migration:run     # 2) Schema aktualisieren
npm run start:prod        # 3) App starten (node dist/main)
```

**Fertige Deploy-Artefakte (echte Dateien unter `deploy/`, hoster-agnostisch):**

| Datei | Zweck |
|-------|-------|
| `deploy/detailly.service` | systemd-Unit fuer das Backend (inkl. Sicherheits-Haertung). Nach `/etc/systemd/system/` kopieren, `systemctl enable --now detailly`. |
| `deploy/deploy.sh` | **Idempotentes** Update-Skript: Pre-Deploy-Backup -> `git pull` -> Deps -> `build:all` -> `migration:run` (VOR Neustart) -> `systemctl restart` -> wartet auf `/api/v1/health/ready`. Aufruf: `sudo -u detailly bash deploy/deploy.sh`. |
| `deploy/Caddyfile` | TLS-Terminierung + Reverse-Proxy + Security-Header (Abschnitt 7). |
| `deploy/detailly-backup.{service,timer}` bzw. `deploy/detailly-backup.cron` | Automatische Backups (Abschnitt 9). |

Der **Boot-Preflight** validiert vor dem eigentlichen Start alle Pflicht-ENVs
(Abschnitt 2.1) und bricht mit klarer Meldung ab, wenn etwas fehlt/unsicher ist.

> **CI-Absicherung (GO-LIVE):** Der Workflow `.github/workflows/migrations-postgres.yml`
> faehrt bei jedem Backend-Push/PR eine echte `postgres:15` hoch und laesst die volle
> committete Migrationskette (`npm run migration:run`) dagegen laufen. Ein
> Postgres-schemabrechender Commit wird so ROT, bevor er den Prod-Boot erreicht.

---

## 7. Reverse-Proxy / TLS

Client-IP-basierte Abwehr (Rate-Limit + Sentinel) haengt an einer korrekten
`TRUST_PROXY_HOPS`. Bei genau **einem** Proxy (Caddy/nginx direkt vor der App):
`TRUST_PROXY_HOPS=1`. Bei zusaetzlichem CDN entsprechend erhoehen — **zu hoch =
IP-Spoofing moeglich, zu niedrig = kollektive Sperren**.

### Caddy (`/etc/caddy/Caddyfile`)

Fertige Datei: **`deploy/Caddyfile`** (nach `/etc/caddy/Caddyfile` kopieren, die
`<PLATZHALTER: app.deine-domain.de>` durch die echte Domain ersetzen). Sie enthaelt
Reverse-Proxy auf `127.0.0.1:3001`, Readiness-Health-Check, Security-Header am Edge
und begrenzt die Request-Groesse. Bewusst OHNE `encode` (die App komprimiert selbst).
Fuer diese Ein-Proxy-Kette gilt `TRUST_PROXY_HOPS=1`.

Caddy holt/erneuert das TLS-Zertifikat automatisch (Let's Encrypt).

### nginx (Auszug)

```nginx
server {
    listen 443 ssl http2;
    server_name app.deine-domain.de;

    ssl_certificate     /etc/letsencrypt/live/app.deine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.deine-domain.de/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Health-Checks / Monitoring

| URL | Zweck | Auth | Antwort |
|-----|-------|------|---------|
| `GET /api/v1/health` | **Liveness** (Prozess erreichbar) | nein | `200 {"status":"ok","version":"..."}` |
| `GET /api/v1/health/ready` | **Readiness** (Prozess + DB) | nein | `200 {"status":"ready"}` bzw. **`503`** bei DB-Ausfall |
| `GET /health` | Bare-Liveness (fuer LB, die konventionell `/health` pingen) | nein | `200 {"status":"ok","version":"..."}` |

- **Load-Balancer** auf `/api/v1/health/ready` zeigen lassen (nimmt Instanzen mit
  DB-Problemen automatisch aus der Rotation).
- Die Health-Pfade sind bewusst von der **IP-Sperr-Middleware** und vom
  **Rate-Limiter** ausgenommen — haeufige LB-Pings loesen nie eine Sperre aus.
- Die Antworten enthalten **keine Interna** (kein Host, kein Stacktrace, keine
  DB-Details) — keine Recon-Flaeche.

---

## 9. Backup + Restore

### 9.1 Automatisches, verschluesseltes Backup

Das Skript **`scripts/backup.sh`** erzeugt pro Lauf EIN verschluesseltes Archiv
(DB-Dump `pg_dump -Fc` + `uploads/` + DSGVO-`private-uploads/`), rotiert es
(GFS-lite: `KEEP_DAILY=7` taeglich, `KEEP_WEEKLY=4` woechentlich) und pusht
optional offsite (`BACKUP_OFFSITE_TARGET`, `<PLATZHALTER>` vom Betreiber).

**Verschluesselung (Pflicht):** openssl AES-256 gegen `BACKUP_ENC_KEY`. Dieser
Schluessel ist **eigenstaendig** und darf **NICHT** gleich `DATA_ENC_KEY` sein
(das Skript verweigert Gleichheit). Zweck-Trennung: ein kompromittiertes Offsite-
Backup gibt nicht zugleich den Live-Feldschluessel preis; beide rotieren
unabhaengig. DSGVO-Rechtsgrundlage der (zeitlich begrenzten) Aufbewahrung:
Art. 6 Abs. 1 lit. f i. V. m. Art. 32 (Datensicherheit/Wiederherstellbarkeit).

**Automatik (eine Variante waehlen):**
- systemd (empfohlen): `deploy/detailly-backup.service` + `deploy/detailly-backup.timer`
  (taeglich 03:15, `Persistent=true` holt verpasste Laeufe nach) nach
  `/etc/systemd/system/` kopieren, `systemctl enable --now detailly-backup.timer`.
- oder cron: `deploy/detailly-backup.cron` nach `/etc/cron.d/detailly-backup`.

`BACKUP_ENC_KEY` (+ `BACKUP_DIR`/Offsite) gehoeren in eine **getrennte** Datei
`/opt/detailly/backend/.env.backup` (0600) — nicht neben `DATA_ENC_KEY`. **Ohne
den passenden `DATA_ENC_KEY` der Backup-Zeit sind die feldverschluesselten Spalten
aus dem Dump nicht lesbar** — `DATA_ENC_KEY` dauerhaft + getrennt sichern.

### 9.2 Restore-Test (regelmaessig ueben!)

Das Skript **`scripts/restore.sh`** entschluesselt ein Archiv und spielt es in
eine **Test-DB** ein (Default `detailly_restore_test`). Ohne `ALLOW_DB_RESTORE=1`
ist es ein Dry-Run (entpackt + zeigt den `pg_restore`-Befehl, ueberschreibt nichts):

```bash
createdb detailly_restore_test
ALLOW_DB_RESTORE=1 BACKUP_ENC_KEY=... sh scripts/restore.sh \
  /var/backups/detailly/daily/detailly_YYYYMMDD-HHMMSS.tar.gz.enc
# -> spielt ein + zaehlt SELECT count(*) FROM tenants;
dropdb detailly_restore_test
```

Ein Backup, das nie zurueckgespielt wurde, ist kein Backup. **Den Restore einmal
echt durchspielen** (Test-DB) und ins Betriebs-Log eintragen; danach in den
Kalender (regelmaessig).

---

## 10. Update-Ablauf

> **Empfohlen:** `sudo -u detailly bash deploy/deploy.sh` erledigt genau die
> folgenden Schritte idempotent (inkl. Pre-Deploy-Backup, Migrationen VOR
> Neustart und Warten auf `/api/v1/health/ready`). Die manuelle Abfolge zur
> Referenz:

```bash
cd /opt/detailly
git pull                         # neuer Stand
cd backend && npm ci --legacy-peer-deps
cd ../frontend && npm ci --legacy-peer-deps
cd ../backend && npm run build:all
# --- Wartungsfenster ---
pg_dump -Fc -U detailly_app detailly_prod -f /var/backups/detailly/pre_update_$(date +%Y%m%d_%H%M).dump
npm run migration:run            # Migrationen VOR Neustart
systemctl restart detailly       # Neustart (fuehrt Preflight aus)
curl -fsS http://127.0.0.1:3001/api/v1/health/ready   # Smoke-Test
```

Immer **direkt vor dem Update** einen frischen Dump ziehen (Abschnitt 10, Zeile
`pre_update_...`).

---

## 11. Rollback

1. **App** auf das vorige Artefakt/Commit zuruecksetzen (`git checkout <alt>` +
   `npm run build:all`) und Dienst neu starten.
2. **Schema**: die letzte Migration zuruecknehmen (nur wenn die neue Version ein
   inkompatibles Schema brachte):
   ```bash
   cd backend
   npm run migration:revert    # nimmt GENAU die zuletzt gelaufene Migration zurueck
   ```
   > Achtung: Der **Abo-Backfill** (`AboBackfill...`) hat bewusst ein
   > **No-op-`down`** (kein automatischer Rollback der Default-Abos) — Details im
   > Datei-Kommentar. Datenrueckbau nur manuell im Wartungsfenster.
3. **Notfall (Schema-Korruption)**: DB aus dem letzten `pre_update`-Dump
   wiederherstellen (Abschnitt 9.2) und die vorige App-Version starten.

---

## 12. Checkliste vor dem ersten Go-Live

- [ ] `.env` mit allen Pflicht-ENVs (Abschnitt 2.1) — Preflight laeuft durch.
- [ ] `JWT_SECRET` + `DATA_ENC_KEY` frisch erzeugt (`openssl rand -hex 32`) und sicher hinterlegt.
- [ ] `BACKUP_ENC_KEY` frisch erzeugt (**≠ `DATA_ENC_KEY`**), in `.env.backup` (0600) getrennt hinterlegt.
- [ ] Baseline-Migration generiert + committet, `migration:run` erfolgreich; CI `migrations-postgres` gruen.
- [ ] Erster Admin ueber `SEED_ADMIN_PASSWORD` angelegt (kein Demo-Seed).
- [ ] `deploy/detailly.service` installiert + aktiv; `deploy/Caddyfile` mit echter Domain, TLS aktiv, `TRUST_PROXY_HOPS` korrekt.
- [ ] `GET /api/v1/health/ready` liefert 200 hinter der echten Domain.
- [ ] Backup-Timer (`deploy/detailly-backup.timer`) aktiv **und** ein Restore-Test via `scripts/restore.sh` erfolgreich durchgespielt.
- [ ] Offsite-Ziel (`BACKUP_OFFSITE_TARGET`) gesetzt (Serververlust/Brand abgedeckt).
- [ ] (Optional) SMTP getestet, Stripe-Webhook eingerichtet.
