# Go-Live / Deployment — Detailly

Diese Anleitung führt Schritt für Schritt zum Produktivbetrieb. Architektur:
**ein Server** (NestJS-Backend) liefert die API **und** das statische Frontend
auf derselben Domain aus. Datenbank in Produktion: **PostgreSQL**.

> Was nur **du** liefern kannst (kann/darf ich nicht für dich eintragen):
> Hosting-Entscheidung & Domain, echte **Secrets/Accounts** (SMTP, Stripe),
> sowie die **Impressums-/Datenschutz-Daten** (Adresse, HRB, Hosting-Anbieter).

---

## 1. Voraussetzungen
- Node.js (wie in der CI), npm
- Eine erreichbare **PostgreSQL**-Datenbank (leer)
- Eine Domain mit TLS (HTTPS) — üblich via Reverse-Proxy (Caddy/nginx/Traefik)

## 2. Secrets erzeugen
```bash
openssl rand -hex 32   # -> JWT_SECRET
openssl rand -hex 32   # -> DATA_ENC_KEY  (NIEMALS verlieren = Datenverlust!)
```

## 3. `.env` anlegen
`/.env` aus `.env.example` kopieren und für Produktion setzen (Details/Kommentare
stehen in `.env.example`):
```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://deine-domain.de
APP_BASE_URL=https://deine-domain.de

DB_TYPE=postgres
DB_HOST=...   DB_PORT=5432   DB_USER=...   DB_PASS=<stark, nicht "detailly">   DB_NAME=...

JWT_SECRET=<openssl-Ausgabe>
DATA_ENC_KEY=<openssl-Ausgabe>     # Pflicht bei Postgres/Production

# Single-Origin: NEXT_PUBLIC_API_URL LEER lassen (Frontend nutzt relative /api/v1-Pfade)
NEXT_PUBLIC_API_URL=

# Optional, sobald vorhanden:
# SMTP_HOST=... SMTP_PORT=587 SMTP_SECURE=false SMTP_USER=... SMTP_PASS=... MAIL_FROM="Detailly <no-reply@deine-domain.de>"
# STRIPE_SECRET_KEY=sk_live_...  STRIPE_WEBHOOK_SECRET=whsec_...
```
Die ENV-Validierung beim Boot bricht mit klarer Meldung ab, falls etwas
Pflicht-Wichtiges fehlt oder ein bekannter Dev-Default verwendet wird.

## 4. Postgres-Baseline-Migration erzeugen (EINMALIG)
In Produktion ist `synchronize` aus; das Schema kommt aus Migrationen. Die erste
(Baseline-)Migration wird **gegen die echte Postgres-DB** generiert:
```bash
cd backend
npm ci --legacy-peer-deps
DB_TYPE=postgres DB_HOST=... DB_PORT=5432 DB_USER=... DB_PASS=... DB_NAME=... \
  npm run migration:generate
```
Die erzeugte Datei unter `backend/src/database/migrations/` prüfen und committen.
Sie enthält dann alle Tabellen — auch die zuletzt ergänzten
(`order_times`, `order_materials`, `products`/`order_*`, Token-Spalten,
`users.stundenlohn` …).

## 5. Bauen (Produktions-Artefakt)
```bash
# Frontend-Abhängigkeiten + Backend-Abhängigkeiten installieren
cd frontend && npm ci --legacy-peer-deps && cd ../backend && npm ci --legacy-peer-deps
# Frontend statisch bauen, Backend bauen, Frontend ins Backend kopieren:
npm run build:all
```
Ergebnis: `backend/dist/` (Server) + `backend/client/` (statisches Frontend, vom
Backend ausgeliefert).

## 6. Migrationen + Start
In Produktion laufen die Migrationen beim Start automatisch (`migrationsRun`).
```bash
cd backend
npm run start:prod         # node dist/main
```

## 7. Erst-Account
Entweder per Seed (Demo-Daten):
```bash
SEED_ADMIN_PASSWORD=<stark> npm run seed
```
…oder ganz ohne Seed: den ersten Betrieb über die Seite **/registrieren** anlegen.

## 8. Reverse-Proxy / HTTPS
Den öffentlichen TLS-Endpunkt (Domain) auf den Backend-Port (`PORT`, Standard
3001) weiterleiten. Da Frontend + API gleiche Origin sind, ist kein CORS nötig
(in Produktion ist CORS ohnehin restriktiv: nur `FRONTEND_URL`).

## 9. Stripe (optional, falls Abo aktiv)
1. Im Stripe-Dashboard Produkte/Preise anlegen, die **Price-IDs** in die Pläne
   eintragen (Seed/DB: `stripePriceId`, `stripePriceIdYearly`).
2. Webhook-Endpunkt: `https://deine-domain.de/api/v1/billing/webhook` →
   `STRIPE_WEBHOOK_SECRET` ins ENV.

## 10. Rechtliches (deine Daten)
- **Impressum** (`/impressum`) und **Datenschutz** (`/datenschutz`) mit echten
  Daten: Anschrift, Geschäftsführer, HRB, USt-IdNr., Kontakt, **Hosting-Anbieter**
  und Auftragsverarbeiter (SMTP-/Stripe-/sevDesk-Dienstleister, soweit genutzt).

---

### Checkliste „nur du"
- [ ] Hosting + Domain
- [ ] Postgres bereitgestellt
- [ ] `JWT_SECRET`, `DATA_ENC_KEY` erzeugt & sicher hinterlegt (DATA_ENC_KEY = Backup!)
- [ ] SMTP-Zugang (für E-Mail-Versand: Belege, Mahnungen, Verifizierung)
- [ ] Stripe Live-Keys + Webhook (falls Abo)
- [ ] Impressum/Datenschutz mit echten Daten gefüllt
