# Detailly E2E-Smoke-Suite

Schlanke End-to-End-Smoke-Tests, die die Kern-Flows als echter Browser-Nutzer
durchklicken (Chromium headless). Bewusst **dependency-frei**: reine
Python-Playwright-Skripte (sync API), **kein** `@playwright/test`, **kein**
Jest/pytest-Zwang und **keine** neuen npm-Pakete (Detailly-Hausregel).

## Was getestet wird

| Flow | Datei | Inhalt |
|------|-------|--------|
| 1 | `smoke_01_login.py` | Landing → Login → Dashboard (KPI-Karten gerendert) |
| 2 | `smoke_02_kunde.py` | Kunde anlegen (Modal, Pflichtfeld) → erscheint in Liste |
| 3 | `smoke_03_auftrag.py` | Auftrag anlegen → Detail → Status weiterschalten |
| 4 | `smoke_04_rechnung.py` | aus Auftrag Rechnung erstellen → erscheint in Beleg-Liste |
| 5 | `smoke_05_i18n.py` | Sprache DE→EN (Dashboard-Label wechselt) → zurück auf DE |
| 6 | `smoke_06_a11y.py` | Skip-Link per Tab erreichbar + bei Fokus sichtbar |

Assertions stützen sich auf stabile IDs, ARIA-Rollen und sichtbaren Text mit
Playwright-Auto-Waits (keine blinden `sleep`). Fehlschläge legen einen
Full-Page-Screenshot in `artifacts/` ab (gitignored).

## Voraussetzungen

- Python 3.12 mit installiertem Playwright + Chromium (bereits eingerichtet).
- Ein laufender Detailly-Stack:
  - **Backend** (NestJS) auf Port **3001** — startet mit Auto-Seed, sobald die
    SQLite-DB leer ist. Für einen sauberen Stand die DB-Datei (`detailly.db`
    inkl. `-wal`/`-shm`) vor dem Start löschen.
  - **Frontend** (Next.js Dev) auf Port **3000**. Die Frontend-`.env.local`
    muss `NEXT_PUBLIC_API_URL=http://localhost:3001` setzen (getrennter
    Dev-Betrieb; der statische Prod-Export ist für E2E nicht nötig).
- Login-Demo-Konto: `admin@detailly.de` / `Detailly2026!`.

## Lokal ausführen

```bash
# Backend (Worktree mit node_modules), frische DB:
rm -f detailly.db detailly.db-wal detailly.db-shm
npm run start:dev          # Port 3001, seedet automatisch

# Frontend (eigener Worktree mit node_modules):
npm run dev                # Port 3000

# Suite (Repo-Root):
python e2e/run_all.py
```

Einzelnen Flow ausführen:

```bash
python e2e/smoke_03_auftrag.py
```

## Konfiguration (Umgebungsvariablen)

| Variable | Default | Zweck |
|----------|---------|-------|
| `E2E_BASE_URL` | `http://localhost:3000` | Frontend-URL (Fallback-Ports: z. B. `http://localhost:3020`) |
| `E2E_EMAIL` | `admin@detailly.de` | Login-E-Mail |
| `E2E_PASSWORD` | `Detailly2026!` | Login-Passwort |
| `E2E_HEADLESS` | `1` | `0` = sichtbarer Browser (Debugging) |
| `E2E_SLOWMO` | `0` | ms Verzögerung pro Aktion (Debugging) |

Beispiel mit Fallback-Ports (falls 3000/3001 belegt sind):

```bash
E2E_BASE_URL=http://localhost:3020 python e2e/run_all.py
```

## Exit-Code

`run_all.py` endet mit `0`, wenn alle Flows grün sind, sonst `1` (CI-tauglich).

## Bewusst NICHT abgedeckt (Scope)

- Nur Chromium headless — keine Cross-Browser- oder Visual-Regression-Tests.
- Kein PDF-/XRechnung-Inhalt, kein realer E-Mail-Versand, keine Zahlungs-Webhooks.
- Keine Tenant-Isolation / Auth-Härtung (das gehört auf die API-Ebene und wird
  separat per Backend-Tests/curl-Proben abgedeckt).
- **CI-Integration ist bewusst ein Folge-Ticket** (Server-Bootstrap + Seed in der
  Pipeline, Artefakt-Upload der Screenshots). Diese Suite bringt die lokal
  ausführbare Grundlage.
