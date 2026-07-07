# Konzept: Zusammenführung Fahrzeugannahme (2D) & Schadenserfassung (3D) — T-019

**Status:** ✅ Entschieden (Orchestrator, 2026-07-03): **Option (b)** · **Autor:** Architektur (P3-7)
**Entscheidung:** Ein Datenmodell (`inspection`), zwei Erfassungsmodi. Sofortmaßnahme (Nav/Hinweise)
läuft im Frontend-Paket A; die Migration (Pakete 2–4 unten) ist eigenes Arbeitspaket und muss
**vor der T-001-Migrations-Baseline** gemergt werden.

## 1 · Bestandsaufnahme (verifiziert im Code)

| | **Fahrzeugannahme (2D)** `backend/src/intake/` | **Schadenserfassung (3D)** `backend/src/inspection/` |
|---|---|---|
| Tabelle(n) | `vehicle_intakes` (1 Tabelle, Marker als JSON-Blob) | `damage_inspections`, `damage_items`, `damage_photos`, `damage_item_photos` |
| Schadenspunkte | JSON-Array `SchadensMarker` (Ansicht, x/y %, Zone, 6 Arten) | Eigene Zeilen, Bauteil-verankert (`partId`), 10 Arten, Reparaturart, Kostenschätzung, Status je Schaden |
| Fotos | ❌ | ✅ inkl. n:m-Zuordnung zu Schäden, tenant-sicheres Streaming + Thumb |
| Signatur | ❌ | ✅ PNG + Consent-Text + Sperrlogik (read-only) + Owner-Widerruf |
| Carry-over Vorschäden | ❌ | ✅ Annahme → Ausgang (`previousInspectionId`, `carriedFromItemId`) |
| Status/Lifecycle | ❌ (nur `createdAt`) | ✅ entwurf → abgeschlossen → freigegeben |
| API | GET list, GET :id, POST — kein Update/Delete | Volles CRUD + Signatur + Fotos + Filter |
| Frontend | 352 Z., Formular write-only → redirect `/auftraege`; gespeicherte Protokolle werden **nirgends angezeigt** (Daten-Sackgasse) | 851 Z.: Liste, 3D-Canvas, 2D-Fallback, Schaden-Editor, Fotos, Signatur-Flow |
| Harte Abhängigkeiten | Keine — Orders/Termine referenzieren keines der Module | Keine |

**Zwei entscheidende Vorarbeiten (machen die Migration billig):**
1. `DamageInspection` ist laut Docstring als *additive Erweiterung von `VehicleIntake`* entworfen:
   `typ='annahme'` deckt den Intake-Fall ab, `kmStand`/`tankstand`/`notiz` existieren bereits.
2. `DamageItem` hat einen expliziten 2D-Modus (`positionMode='2d'`, `ansicht2d`/`x2d`/`y2d`) —
   jeder 2D-Marker ist verlustfrei als DamageItem abbildbar.

**Schema-Kontext (T-001):** `backend/src/database/migrations/` ist leer — Zusammenlegung **vor**
der Baseline kostet schema-seitig fast nichts (−1 Tabelle); danach jede Änderung eine echte Migration.

## 2 · Optionen

- **(a) 3D wird DER Standard, `vehicle_intakes` wird abgelöst.** Migration M, kein Datenverlust,
  UX maximal klar. Risiko: die 851-Zeilen-Experten-UI macht die schnelle Hallen-Annahme *langsamer*.
- **(b) 2D bleibt eigene Schnell-Annahme, aber EIN Datenmodell (inspection).** `/fahrzeugannahme`
  behält das schlanke Formular, speichert aber `POST /inspections` (`typ='annahme'`, Items
  `positionMode='2d'`). Intake-Backend stirbt. Migration M, kein Datenverlust, Annahme bleibt
  30-Sekunden-schnell, 3D bleibt Verkaufs-Feature. **← GEWÄHLT**
- **(c) Nur Nav/UI zusammenlegen, zwei Backends behalten.** Aufwand S, aber fachlich falsch:
  2D-Annahmen ohne Historie/Carry-over/Signatur; Doppelstruktur würde in der T-001-Baseline zementiert.
- **(d, verworfen) Intake zum führenden Modell ausbauen** — hieße Signatur/Fotos/Carry-over im
  schwächeren Modul nachbauen; strategisch rückwärts.

## 3 · Entscheidung: Option (b) — Begründung

- **Nutzerziel Halle:** 30-Sekunden-Annahme bleibt (schlankes 2D-Formular mit `FahrzeugDiagramm`).
  Erzwungener 3D-Einstieg auf Werkstatt-Tablets wäre eine Verschlechterung.
- **Verkaufsargument:** 3D bleibt sichtbar und wird stärker — auch Schnell-Annahmen bekommen
  Signatur, Fotos und Carry-over geschenkt („jede Annahme ist upgradebar").
- **T-001-Timing:** Jetzt zusammenlegen = die Baseline enthält nur noch die 4 Inspection-Tabellen.
- Das Datenmodell wurde für genau diesen Weg gebaut — wir vollenden eine begonnene Absicht.

**Umsetzungsplan (Pakete):**

| # | Paket | Aufwand | Wann |
|---|---|---|---|
| 1 | Sofortmaßnahme: Nav-Umbenennung („Annahme (schnell)" / „Annahme & Gutachten (3D)"), Querverweis-Hinweiskarten, 2D-Seite zeigt letzte Protokolle | S | ✅ im Frontend-Paket A/B |
| 2 | 2D-Seite auf `POST /inspections` + `items(positionMode='2d')` umstellen; Erfolgs-Redirect auf Detailansicht | M | eigenes Paket „P3-7-Umsetzung" |
| 3 | Alt-Daten-Skript `vehicle_intakes` → inspections/items; Intake-Modul + GDPR-Zweig entfernen; Dashboard-CTAs umbiegen | S–M | **zwingend vor T-001-Baseline** |
| 4 | Eine Nav-Route mit Einstiegswahl Schnell/3D; 3D-Seite zeigt alle Annahmen (auch 2D-erfasste) | M | mit Paket 2/3 |
| 5 | Signatur + Fotos auch im Schnell-Modus (Feature-Parität per Wiederverwendung) | M | später |
| 6 | Annahmeprotokoll-PDF, Kalkulations-Anbindung an `kostenSchaetzung` | L | Roadmap v2 |
| 7 | 851-Zeilen-Seite in Komponenten zerlegen; `Fallback2D` durch `FahrzeugDiagramm` ersetzen | M | opportunistisch |
