# Detailly – Lastenheft

Dieses Dokument enthält das vollständige Lastenheft für Detailly V1.

## Inhaltsverzeichnis

1. Ziel des Projekts
2. Projektkontext
3. Soll-Prozess
4. Datenobjekte und Stammdaten
5. Module und Seitenstruktur
6. Rollen- und Rechtekonzept
7. Nicht-funktionale Anforderungen
8. Schnittstellen und Integrationen
9. MVP-Abgrenzung
10. Technische Zielarchitektur

> Vollständiges Lastenheft siehe docs/lastenheft_vollstaendig.md

## Ziel

Detailly ist als cloudfähige Werkstattsoftware für Aufbereitung, Folierung und PPF konzipiert.
Ziel ist es, den operativen Kernprozess von der Anfrage bis zur Archivierung digital abzubilden.

## Tech Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | NestJS + Node.js |
| Datenbank | PostgreSQL |
| Auth | JWT |

## MVP-Module

- Dashboard
- Kundenverwaltung
- Fahrzeugverwaltung
- Auftragsverwaltung
- Kalkulation (Aufbereitung / Folierung / PPF)
- Plantafel
- Mitarbeiterverwaltung
- Shop / Lager / Bestellfreigaben
- Rollen und Rechte
- Audit-Log
