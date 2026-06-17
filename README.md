# Detailly

> Werkstattsoftware für Aufbereitung, Folierung und PPF – franchisefähig

## Projektbeschreibung

Detailly ist eine Werkstattsoftware für Betriebe im Bereich Fahrzeugaufbereitung,
Folierung und Paint Protection Film (PPF). Das System bildet den operativen
Kernprozess von der Anfrage bis zur Rechnung digital ab und ist mehrstandort-
und franchisefähig (Mandantentrennung über `tenantId`).

## Status

✅ **Lauffähiges MVP** – Backend (NestJS) und Frontend (Next.js) sind vollständig
implementiert und ohne externe Datenbank startklar (SQLite als Standard).

## Tech Stack

| Schicht    | Technologie                          |
| ---------- | ------------------------------------ |
| Frontend   | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend    | NestJS 10 + TypeORM                  |
| Datenbank  | SQLite (Standard) **oder** PostgreSQL (per ENV umschaltbar) |
| Auth       | JWT (Passport)                       |
| API-Doku   | Swagger unter `/api/docs`            |

## Schnellstart (Demo, ohne Docker / ohne externe DB)

Es wird Node.js 18+ benötigt. Standardmäßig läuft alles über eine lokale
SQLite-Datei (`backend/detailly.db`) – es ist **keine** Datenbank-Installation nötig.

### 1) Backend

```bash
cd backend
cp ../.env.example .env        # Standardwerte sind demo-tauglich (DB_TYPE=sqlite)
npm install
npm run seed                   # legt Demo-Daten an (idempotent: setzt Schema zurück)
npm run start:dev              # API auf http://localhost:3001 (Prefix /api/v1)
```

Swagger-Doku: <http://localhost:3001/api/docs>

### 2) Frontend (in einem zweiten Terminal)

```bash
cd frontend
npm install
npm run dev                    # Web-App auf http://localhost:3000
```

### 3) Anmelden

Im Browser <http://localhost:3000> öffnen und anmelden:

| Rolle             | E-Mail                    | Passwort       |
| ----------------- | ------------------------- | -------------- |
| Franchise-Inhaber | `admin@detailly.de`       | `Detailly2026!` |
| Manager           | `manager@detailly.de`     | `Detailly2026!` |
| Techniker         | `technik@detailly.de`     | `Detailly2026!` |
| Rezeption         | `empfang@detailly.de`     | `Detailly2026!` |
| Super-Admin       | `superadmin@detailly.de`  | `Detailly2026!` |

## Datenbank umschalten (SQLite ↔ PostgreSQL)

Gesteuert über `DB_TYPE` in der `.env`:

```dotenv
# SQLite (Standard, keine externe DB nötig)
DB_TYPE=sqlite
DB_DATABASE=detailly.db

# PostgreSQL
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=detailly
DB_PASS=detailly
DB_NAME=detailly
```

Die Entities sind so geschrieben, dass sie auf SQLite **und** PostgreSQL laufen
(simple-enum/simple-json statt nativer Enum-/JSONB-Typen).

## Module (alle implementiert)

- **Dashboard** – KPIs (offene Aufträge, Termine heute, Kunden, Umsatz) + offene Aufträge
- **Kundenverwaltung** – Privat-/Geschäftskunden, Suche, Soft-Delete
- **Fahrzeugverwaltung** inkl. **Fahrzeugakte** (Stammdaten + Auftragshistorie)
- **Auftragsverwaltung** – zentrale Einheit mit geprüftem Status-Workflow
- **Kalkulation** – Positionen, Material, Netto/MwSt (19 %)/Brutto
- **Belege** – Angebote & Rechnungen, fortlaufende Nummern, aus Auftrag erzeugbar
- **Plantafel** – Wochenübersicht der Termine
- **Mitarbeiterverwaltung** – Benutzer + Rollen
- **Shop / Lager** – Produkte, Mindestbestand, Bestellungen mit Freigabe-Workflow, Vermietung
- **Rollen- & Rechtekonzept (RBAC)** – Guards je Endpunkt, `super_admin` mit Vollzugriff
- **Audit-Log** – nachvollziehbare Aktivitäten (Manager/Inhaber)

## sevdesk-Integration

Aktuell als **Stub/Platzhalter** umgesetzt: ohne `SEVDESK_API_TOKEN` arbeitet der
`SevdeskService` als No-op (nur Logging). Es werden **keine** echten API-Calls
ausgeführt. Die Felder `sevdeskContactId` / `sevdeskInvoiceId` sind vorbereitet.

## Build & Tests

```bash
# Backend
cd backend && npm run build      # nest build
cd backend && npm test           # Jest (passWithNoTests)

# Frontend
cd frontend && npm run build     # next build
```

## Projektstruktur

```
detailly/
├── frontend/          # Next.js Web-App (App Router, Tailwind)
├── backend/           # NestJS API (TypeORM, JWT, Swagger)
├── docs/              # Dokumentation, Lastenheft, Backlog
└── README.md
```

## Lizenz

Privat – alle Rechte vorbehalten.
