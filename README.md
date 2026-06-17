# Detailly

> Werkstattsoftware für Aufbereitung, Folierung und PPF

## Projektbeschreibung

Detailly ist eine cloudfähige Werkstattsoftware speziell für Betriebe im Bereich Fahrzeugaufbereitung, Folierung und Paint Protection Film (PPF). Das System bildet den operativen Kernprozess von der Anfrage bis zur Archivierung digital ab und ist von Anfang an mehrstandort- und franchisefähig ausgelegt.

## Status

🚧 **In Entwicklung – Sprint 0**

## Tech Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | NestJS + Node.js |
| Datenbank | PostgreSQL |
| Auth | JWT |
| Infrastruktur | Cloud (TBD) |

## Projektstruktur

```
detailly/
├── frontend/          # Next.js Web-App
├── backend/           # NestJS API
├── docs/              # Dokumentation, Lastenheft, Backlog
└── README.md
```

## MVP-Module

- Dashboard
- Kundenverwaltung
- Fahrzeugverwaltung inkl. Fahrzeugakte
- Auftragsverwaltung
- Kalkulation (Aufbereitung / Folierung / PPF)
- Plantafel mit Drag-and-drop
- Mitarbeiterverwaltung
- Shop / Lager / Bestellfreigaben
- Rollen- und Rechtekonzept
- Audit-Log

## Integrationen (geplant)

- sevdesk (Angebote, Auftragsbestätigungen, Rechnungen)
- Zeiterfassungssystem (extern)
- PPF-/Pattern-Systeme (z. B. XPEL DAP)

## Roadmap

| Phase | Inhalt |
|---|---|
| Sprint 0 | Technische Basis, Setup, CI/CD |
| Sprint 1 | Benutzer, Rollen, Auth |
| Sprint 2 | Kundenverwaltung |
| Sprint 3 | Fahrzeugverwaltung |
| Sprint 4 | Auftragsverwaltung |
| Sprint 5 | Kalkulation |
| Sprint 6 | Plantafel |
| Sprint 7 | Mitarbeiter & Ressourcen |
| Sprint 8 | Shop, Lager, Bestellfreigaben |
| Sprint 9 | Audit-Log & Sicherheit |
| Sprint 10 | Integrationen |

## Lizenz

Privat – alle Rechte vorbehalten.
