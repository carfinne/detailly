# Konzept: 3D-Schadenskalkulation für Detailly

> **Produktionsreifes Konzept** für ein interaktives 3D-Fahrzeugmodul zur Schadenserfassung,
> -dokumentation und -kalkulation. Erweitert die bestehende 2D-Fahrzeugannahme
> (`VehicleIntake`/`SchadensMarker`) additiv und ohne Datenverlust.
>
> Erarbeitet aus fünf parallelen Fachanalysen (3D-Technologie · Datenmodell · UI/UX · Architektur · Werkstatt-/Gutachter-Workflows).

---

## Kurzfassung (TL;DR)

- **3D-Stack:** **three.js + react-three-fiber (R3F) + drei**, als Client-only-Komponente im Next.js-App-Router. Modelle als **Draco-komprimierte GLB**, Bauteile als **benannte Meshes** (`mesh.name === partId`), Auswahl per **Raycasting**. Kein `<model-viewer>` (Anzeige-Tool, kein Editor), keine Game-Engine (Overkill).
- **Fachliche Wahrheit ist bauteilbasiert, nicht koordinatenbasiert:** Ein Schaden gehört primär zu einem **Bauteil** (`partId`), die 3D-Position ist nur Visualisierung. Das macht Daten robust gegen Modellwechsel und direkt kalkulierbar.
- **Saubere Trennung Vorschaden/Neuschaden** über das Feld **`origin`** + eine **Carry-over-Kette** zwischen Inspektionen + **doppelte visuelle Codierung** (Form *und* Sättigung).
- **Schnelle Fotozuordnung:** Das Foto „fällt zum Schaden" — Tablet-Kamera direkt am Bauteil, Drag&Drop, Mehrfachzuordnung; nie ein anonymer Upload-Pool.
- **Vier neue Entities** (`DamageInspection`, `DamageItem`, `DamagePhoto`, `DamageItemPhoto`), voll mandantengetrennt (`tenantId` + `tenant-scope.ts`-Helfer), **offlinefähig** (Client-UUIDs, IndexedDB, Sync-Queue).
- **2D bleibt erhalten** als gleichwertiger Fallback (kein WebGL / Altdaten).

---

## Inhalt
1. [Ziel & Einordnung](#1-ziel--einordnung)
2. [UI/UX-Konzept](#2-uiux-konzept)
3. [3D-Technologie](#3-3d-technologie)
4. [Datenmodell](#4-datenmodell)
5. [Technische Architektur](#5-technische-architektur)
6. [Workflows: Werkstatt & Gutachter](#6-workflows-werkstatt--gutachter)
7. [Vorschaden ↔ Neuschaden – die Mechanik](#7-vorschaden--neuschaden--die-mechanik)
8. [Umsetzungs-Roadmap](#8-umsetzungs-roadmap)
9. [Risiken & offene Punkte](#9-risiken--offene-punkte)

---

## 1. Ziel & Einordnung

Das Modul **„3D-Schadenserfassung"** (Backend-Modul `inspection`) erweitert die heutige
2D-Fahrzeugannahme zu einem interaktiven 3D-Erlebnis: drehen, zoomen, **Bauteile anklicken**
und je Bauteil **aktuelle Schäden, Vorschäden und Fotos** hinterlegen.

**Designgrundsätze (Auftraggeber-Schwerpunkte):**
1. **Einfache Bedienung** – ein Schaden in ≤ 3 Schritten, Touch-first.
2. **Klare visuelle Markierung** – Vor/Neu, Schweregrad und Auswahl über *getrennte* visuelle Kanäle.
3. **Schnelle Fotozuordnung** – das Foto landet automatisch am aktiven Schaden/Bauteil.
4. **Saubere Trennung Vorschaden/Neuschaden** – fachlich, datenseitig und visuell, haftungssicher.

**Anschluss an Detailly:** gleiche Mandantentrennung (`tenantId`, `tenant-scope.ts`),
gleiches dunkles Design mit **einem Kupfer-Akzent**, Fotos unter `/uploads`,
Anbindung an das Order-/Kalkulationsmodul. Zielgeräte: Desktop + **Werkstatt-Tablets (Touch, teils offline)**.

---

## 2. UI/UX-Konzept

### 2.1 Designsprache-Vertrag

Das Modul übernimmt 1:1 die bestehenden Tokens, damit es kein Fremdkörper ist:

| Element | Verwendung im 3D-Modul |
|---|---|
| `ink-950/850/800` Flächen | Viewport-Bühne `ink-950`, Panels `ink-850` |
| **EIN Akzent** `copper` | **ausschließlich** für *Auswahl / aktiv / Neuschaden-Bestätigung* |
| `chrome-50…600` Text | identisch (Hierarchie) |
| `SectionCard`, `Modal`, `Empty`, `Loading`, `ErrorBox` | Panels, Lightbox, Zustände |
| `SCHWEREGRAD`-Hex (leicht `#4FB477` / mittel `#E0A93B` / schwer `#E06A6A`) | Marker-Ring/-Punkt |
| Motion `180/220ms · ease-emphasized` | Kameraflüge, Panel-Slide |

> **Der Ein-Akzent-Grundsatz bleibt intakt.** Kupfer ist *kein* Schadenstyp-Farbcode.
> Schweregrad nutzt die im Produkt bereits etablierten semantischen Hex-Werte (Konsistenz, kein zweiter Akzent).
> Vorschaden wird bewusst **entsättigt/neutral** gehalten, damit Kupfer dominant bleibt.

### 2.2 Bildschirm-Layout

**Desktop (≥ 1280 px) – Drei-Zonen:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Header:  ‹Icon› Schadenserfassung 3D · BMW 320d · W-AB 1234           │
│          [ Geführt ●○ Frei ]            [ 2D-Ansicht ]  [ Speichern ] │
├──────────────────────────────┬───────────────────────────────────────┤
│   3D-VIEWPORT (~62 %)         │  SEITENPANEL (380 px)                 │
│   ink-950 Bühne, dezenter    │  • Kontext: Bauteil ODER Schaden      │
│   copper-Glow, Kontaktschatten│  • Bauteil-/Schadensliste            │
│   ┌ Orbit-Gizmo (o.r.)        │    (gruppiert, Filter Alle│Vor│Neu)   │
│   └ Legende (u.l., einklappb.)│                                       │
├──────────────────────────────┴───────────────────────────────────────┤
│  FOTO-STRIP (global, 96 px) [📷] [Foto][Foto]…  → Drop-Ziel „aktiv“   │
└──────────────────────────────────────────────────────────────────────┘
```

**Touch-Tablet (quer) – Bühne zuerst:** Viewport Vollbreite; Seitenpanel als **Bottom-Sheet**
(3 Rasten: Peek/Halb/Voll); Foto-Strip als vertikale Daumenspalte rechts mit großem `📷`-Button;
Touch-Targets ≥ 44 px, Marker-Hitbox ≥ 44 px (visuell kleiner, Trefferfläche größer).

### 2.3 Interaktion

| Aktion | Desktop | Touch |
|---|---|---|
| Drehen | LMB-Drag / Gizmo | 1-Finger-Drag |
| Zoom | Mausrad | Pinch |
| Pan | RMB / Space+Drag | 2-Finger-Drag |
| Snap-Ansicht | Gizmo-Würfel | Chips: Front·Heck·Links·Rechts·Dach |
| Reset | `⌂` / Doppelklick leer | `⌂` / Doppel-Tap |

Kamera gedämpft (Inertia), Rotation sinnvoll begrenzt; Snap = sanfter **Kameraflug (~220 ms)**, kein harter Cut.

**Schaden setzen in 3 Schritten** (Schnellpfad: 2):
```
1  TIPPEN     Bauteil antippen  → hebt sich in Kupfer hervor, Rest dimmt, Panel öffnet
2  SETZEN     „+ Schaden“ → Pin-Modus → Stelle am Bauteil antippen
              (Raycast trifft Mesh-Oberfläche → exakte 3D-Position + Normale + partId)
3  KLASSIF.   Inline-Editor: Art [▾] · Grad (Leicht·Mittel·Schwer) · ⊕ Foto · Notiz
              → Auto-Save nach 800 ms
```
*Long-Press* auf ein Bauteil setzt sofort einen Marker mit Defaults (zuletzt genutzte Art, Grad „mittel") → **2 Schritte**. Neue Marker sind im Annahme-Kontext automatisch **Neuschaden**.

### 2.4 Visuelles Markierungsschema – drei orthogonale Kanäle

| Dimension | Visueller Kanal | Wirkung |
|---|---|---|
| **Herkunft** (Vor/Neu) | **Form + Sättigung** | Vorschaden = **Hohl-Ring**, entsättigt; Neu = **voller Punkt**, akzentuiert |
| **Schweregrad** | **Größe + Ring** | leicht (klein) · mittel (Ring) · schwer (großer/pulsierender Ring) |
| **Auswahl/aktiv** | **Kupfer-Glow-Halo** | wie überall im Produkt „aktiv" |

Vorschaden vs. Neuschaden ist damit **doppelt codiert** (Form *und* Sättigung) → auf einen Blick
scannbar **und** barrierefrei (auch bei Farbfehlsichtigkeit). Schweregrad nutzt die vorhandenen
`SCHWEREGRAD`-Farben; Vorschaden zeigt dieselben Farben um ~60 % entsättigt, behält aber den Größen-Code.

```
LEGENDE ▾
─ Herkunft ──   ◯ Vorschaden (Bestand)   ● Neuschaden
─ Schweregrad ─ ·  leicht    ●  mittel    ⬤  schwer
─ Status ─────  ◉ ausgewählt (kupfer)
```

### 2.5 Schnelle Fotozuordnung

**Leitprinzip: Das Foto fällt zum Schaden, nie in einen anonymen Pool.**

- **Tablet-Kamera am Bauteil:** `📷` im Editor/Strip → native Kamera (`<input capture="environment">`,
  baut auf dem bestehenden `FotoBereich`-Flow auf) → Aufnahme wird **sofort** dem aktiven Schaden zugeordnet (copper-Bestätigungsglow am Marker).
- **Drag & Drop (Desktop):** Thumbnails (oder Dateien vom Desktop) auf **aktiven Schaden**, **Marker im 3D** (leuchten beim Ziehen als Ziele) oder **Bauteil** ziehen.
- **Mehrfachauswahl:** Shift/Cmd-Klick bzw. Long-Press → Aktionsleiste „3 Fotos → aktiver Schaden · → Bauteil · als Vorher · Löschen".
- **Persistente Zielanzeige** oben im Strip: `Aktiv ▸ Tür vorne links · Kratzer (neu)` – man sieht immer, wohin ein Foto fällt.
- **Vorher/Nachher** mappt auf `bilderVorher[]`/`bilderNachher[]`; `FotoLightbox` (Modal) mit Vorher/Nachher-Schieberegler (ideal für Gutachten).

### 2.6 Geführt vs. Frei

- **Geführter Rundgang** (Default Tablet/Annahme): Schritt-für-Schritt um das Fahrzeug, je Stopp
  relevantes Segment hervorgehoben, **`✓ Keine Schäden`** erzwingt bewusste Entscheidung je Zone
  (lückenlose Doku für Haftung). Abschluss-Zusammenfassung + „Foto empfohlen"-Hinweise.
- **Frei-Modus** (Default Desktop/Gutachter): beliebige Reihenfolge, Liste + Filter als primäre Navigation.

### 2.7 Zustände & Barrierefreiheit

- **Zustände:** Leer (`Empty` + CTA „Rundgang starten"), Laden (Fahrzeug-Silhouette-Skeleton, progressiv Low→High-Poly), Foto-Upload (Shimmer + temporärer Marker-Ring), Fehler (`ErrorBox` + Auto-2D-Fallback), **Offline** (`badge-caution` „wird synchronisiert", Marker mit Sync-Punkt `◌`), Kein-WebGL (sofort 2D).
- **3D ist nie der einzige Weg:** Die `SchadenListe` ist vollwertige, tastaturbedienbare Parallel-Eingabe (Bauteil-Dropdown statt Mesh-Klick). `Canvas` trägt `role="application"` + `aria-live`-Statusmeldungen. Farbe nie allein (Form/Größe redundant). `prefers-reduced-motion` → Kameraflüge werden Schnitte.

---

### 2.8 Umschalter 3D ⇄ 2D (Robustheit)

Ein **Schiebeschalter im Kopf** (wie „Geführt ⇄ Frei") wechselt jederzeit **manuell** zwischen 3D und 2D. Zusätzlich greift ein **automatischer Fallback**, falls das 3D klemmt:
- **Kein WebGL / Ladefehler** → sofort 2D.
- **Hänger-Watchdog:** Wird der Viewport nicht innerhalb von ~4 s interaktiv (Modell geladen + erstes Frame), schaltet die App **automatisch** auf 2D + dezenter Hinweis „3D nicht verfügbar — 2D aktiv".
- **Geteiltes Datenmodell, kein Datenverlust:** Marker erscheinen in **beiden** Ansichten (`DamageItem.positionMode` 3d/2d; 3D-Marker projizieren auf die nächstgelegene 2D-Ansicht, reine 2D-Marker erscheinen im 3D auf der Bauteilmitte). Die 2D-Seite ist das bestehende, bewährte `FahrzeugDiagramm.tsx`.

So **läuft die Erfassung immer** — egal ob 3D verfügbar ist.

---

## 3. 3D-Technologie

### 3.1 Empfehlung & Begründung

**Primär: three.js (r17x) + react-three-fiber 9 + drei 10**, ausgeliefert als
`dynamic(() => import('...'), { ssr: false })` im App-Router. Begründung in einem Satz:
R3F fügt sich **nativ** in den React/Next-Stack und in `components/ui.tsx` ein, gibt volle
Kontrolle über DOM-Overlays (Foto-Panel, Vor/Neu-Toggle, Kupfer-Akzent) und hält das Bundle klein
(~150–170 kB gz Core, tree-shakeable) – genau das, was „einfache Bedienung, klare Markierung,
schnelle Fotozuordnung" verlangt.

| Kriterium | **three+R3F+drei** ✅ | `<model-viewer>` | Babylon.js | PlayCanvas |
|---|---|---|---|---|
| Lizenz | **MIT** | Apache-2.0 | Apache-2.0 | Engine MIT, **Editor/Cloud kommerziell** |
| React/Next-Fit | **nativ, deklarativ** | Web-Component, imperativ | imperativ | Editor-zentriert |
| Bundle (gz) | **~150–170 kB**, tree-shake | klein, monolithisch | größer | ~1–2 MB |
| **Mesh anklicken → partId** | **volles Raycasting** | nur Hotspots/Surface-Picking | voll | voll |
| Custom-UI-Overlays | **volle Freiheit** (`drei/Html`) | auf Hotspot-Slots beschränkt | frei | frei |
| Touch/Tablet | sehr gut (`OrbitControls`) | exzellent (Viewer) | gut | gut |
| Offline/PWA | **voll** | geht | voll | Cloud erschwert |

**Warum nicht `<model-viewer>`?** Hervorragend zum *Anzeigen* (AR), aber unser Modul ist eine
*Editor*-Oberfläche (beliebige Karosseriefläche anklicken → partId + exakte Stelle). Das Hotspot-Modell
arbeitet gegen uns. Sinnvoll höchstens als Read-only-Viewer für Gutachter oder AR-Beigabe.
**Warum nicht Babylon/PlayCanvas?** Spiel-Engines mit Physik/ECS, die wir nicht brauchen; schwerer bzw. Cloud-Lock-in.

### 3.2 Anklickbare Bauteile: benannte Meshes + Raycasting

- In R3F: `onPointerDown`/`onClick` liefert `e.object.name` (= **partId**), `e.point` (Weltkoordinate),
  `e.face.normal` (Oberflächennormale). Jedes Karosserie-Bauteil ist ein **eigenes benanntes Mesh**;
  die partId steht im glTF-Node-Namen (= Blender-Objektname).
- **Hover (Desktop):** zartes Kupfer-Kantenlicht (Fresnel-Rim, `drei/Outlines`) + Label-Tag.
  **Touch:** Tap = direkte Auswahl + Label-Toast.
- **Build-Validierung:** Ein Script prüft beim Build, dass jeder erwartete partId-Node existiert (Schema-Check gegen die Taxonomie). Symmetrische Teile als separate Nodes (`_l`/`_r`), nicht gespiegelt-instanziiert.

### 3.3 Modellquellen & Format

- **Ein generisches Karosserie-Set** mit wenigen Typvarianten (**Limousine / Kombi / SUV / Transporter**) –
  **nicht** pro Marke/Modell. Werkstatt-Schadensaufnahme braucht Zonen-Wiedererkennung, nicht Markentreue.
  Vier saubere GLBs mit **identischem Node-Namensschema** → gleiche partIds → gleiche Backend-Logik.
- **Format:** **GLB**, **Draco-komprimiert** (60–90 % kleinere Geometrie, kritisch für Tablet/Offline),
  Polycount konservativ (~50–150k Tris), 2 LOD-Stufen reichen. Flat-/Kupfer-Look braucht kaum Texturen.
- **Auswahl:** `vehicle.bodyType` (oder Heuristik aus Marke/Modell) → `bodyType`-Enum → `modelKey`
  (versioniert, z. B. `suv-5door@1`). Fallback `generic-5door`, nie Hard-Fail.

### 3.4 Schadensmarker in 3D

Marker werden als **Weltpunkt + Normale + partId** gespeichert (nicht als UV/Decal), gerendert als
3D-Sprite/Billboard. Die `partId` ist die **fachliche** Verankerung (robust gegen Modellwechsel);
`position3d {x,y,z, nx,ny,nz}` nur die exakte visuelle Platzierung. Altdaten ohne 3D-Koordinate
erscheinen auf der **Bauteilmitte** (partId reicht zur Verortung).

### 3.5 Part-ID-Taxonomie (kanonisch, Auszug)

Konvention `<bauteil>_<seite>` mit Seite `vl|vr|hl|hr` (vorne/hinten · links/rechts), Mittelteile ohne Suffix.
Dieselben IDs gelten für alle vier Karosserietypen **und** für die 2D-Zonen → eine Single Source of Truth.

```
Front:   stossfaenger_vorne, motorhaube, kuehlergrill,
         scheinwerfer_vl, scheinwerfer_vr, kotfluegel_vl, kotfluegel_vr
Seite:   tuer_vl, tuer_vr, tuer_hl, tuer_hr, schweller_l, schweller_r,
         spiegel_l, spiegel_r, felge_vl, felge_vr, felge_hl, felge_hr
Heck:    stossfaenger_hinten, heckklappe, kofferraumdeckel,
         ruecklicht_hl, ruecklicht_hr, seitenwand_hl, seitenwand_hr
Glas:    windschutzscheibe, heckscheibe, seitenscheibe_vl, …
Dach:    dach, schiebedach
```

### 3.6 Offline-Fähigkeit

GLB-Assets + App-Shell via Service-Worker (`CacheFirst`, immutable) → komplett offline nutzbar.
Erfassung lokal (IndexedDB), Sync bei Reconnect (siehe [§5.5](#55-offline--sync)). Fallback auf das
bestehende 2D-`FahrzeugDiagramm` bei fehlendem WebGL.

---

## 4. Datenmodell

Vier neue Entities, in Kontinuität zu `VehicleIntake`/`SchadensMarker`. Konventionen übernommen:
`@PrimaryGeneratedColumn('uuid')`, `@Index() tenantId`, DB-kompatible Spaltentypen
(`enumColumnType`/`jsonColumnType`/`timestampColumnType`), FK als String-IDs, Fotos als `/uploads`-Pfad.

```
DamageInspection  (1 Begutachtung je Fahrzeug/Auftrag/Typ: annahme|gutachten|ausgang)
  └─ 1:n DamageItem        (1 Schaden, an partId verankert, 3D-Pos ODER 2D-Fallback)
        └─ n:m DamagePhoto (via DamageItemPhoto — Foto ↔ Schaden, Mehrfachzuordnung)
  └─ 1:n DamagePhoto       (Fotos der Inspektion; optional an Bauteil statt Schaden)

Trennung Vorschaden/Neuschaden:  DamageItem.origin = vorschaden | neu
Carry-over / Versionierung:      DamageItem.carriedFromItemId + DamageInspection.previousInspectionId
```

### 4.1 `DamageInspection`

```ts
export type InspectionTyp = 'annahme' | 'gutachten' | 'ausgang';
export type InspectionStatus = 'entwurf' | 'abgeschlossen' | 'freigegeben';

@Entity('damage_inspections')
@Index(['tenantId', 'vehicleId', 'typ'])
export class DamageInspection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;

  @Column() customerId: string;                 // FK, tenant-validiert via assertRefInTenant
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) orderId: string;

  @Column({ type: enumColumnType(), enum: ['annahme','gutachten','ausgang'], default: 'annahme' })
  typ: InspectionTyp;
  @Column({ type: enumColumnType(), enum: ['entwurf','abgeschlossen','freigegeben'], default: 'entwurf' })
  status: InspectionStatus;

  @Column({ nullable: true }) previousInspectionId: string;  // Kette annahme→ausgang
  @Column({ nullable: true }) modelKey: string;              // 3D-Modell-Identifier

  @Column({ type: 'int', nullable: true }) kmStand: number;  // aus VehicleIntake übernommen
  @Column({ type: 'int', nullable: true }) tankstand: number;
  @Column({ type: 'text', nullable: true }) notiz: string;

  @Column({ nullable: true }) erfasstVonUserId: string;
  @Column({ nullable: true }) erfasstVonRolle: string;       // technician|receptionist|manager|gutachter

  @Index() @Column({ nullable: true }) clientUuid: string;   // Offline-Sync-Idempotenz
  @CreateDateColumn() createdAt: Date; @UpdateDateColumn() updatedAt: Date;
}
```

### 4.2 `DamageItem`

```ts
export type DamageOrigin = 'vorschaden' | 'neu';
export type DamageArt = 'kratzer'|'delle'|'steinschlag'|'lackschaden'|'rost'|'riss'|'bruch'|'verzogen'|'fehlteil'|'sonstiges';
export type DamageSchweregrad = 'leicht' | 'mittel' | 'schwer';
export type DamageReparaturart = 'polieren'|'smart_repair'|'lackieren'|'instandsetzen'|'austausch'|'keine';
export type DamageItemStatus = 'offen'|'in_arbeit'|'erledigt'|'abgelehnt'|'uebernommen';
export interface Position3D { x:number; y:number; z:number; nx:number; ny:number; nz:number; }

@Entity('damage_items')
@Index(['tenantId', 'inspectionId'])
@Index(['tenantId', 'partId'])
export class DamageItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() inspectionId: string;

  // Bauteil-Verankerung (FACHLICHE Wahrheit)
  @Column() partId: string;                         // z.B. "tuer_vl", "stossfaenger_hinten"
  @Column({ nullable: true }) partLabel: string;    // denormalisiert "Tür vorne links"

  // Positionierung: 3D ODER 2D-Fallback (kompatibel zu SchadensMarker)
  @Column({ type: enumColumnType(), enum: ['3d','2d'], default: '3d' }) positionMode: '3d'|'2d';
  @Column({ type: jsonColumnType(), nullable: true }) position3d: Position3D | null;
  @Column({ nullable: true }) ansicht2d: string;    // front|heck|links|rechts|dach
  @Column({ type: 'float', nullable: true }) x2d: number;  // 0..100 %
  @Column({ type: 'float', nullable: true }) y2d: number;

  // Fachliche Klassifikation
  @Column({ type: enumColumnType(), enum: ['vorschaden','neu'], default: 'neu' }) origin: DamageOrigin;
  @Column({ type: enumColumnType(), enum: ['kratzer','delle','steinschlag','lackschaden','rost','riss','bruch','verzogen','fehlteil','sonstiges'] }) art: DamageArt;
  @Column({ type: enumColumnType(), enum: ['leicht','mittel','schwer'] }) schweregrad: DamageSchweregrad;
  @Column({ type: 'int', nullable: true }) groesseLaengeMm: number;
  @Column({ type: 'int', nullable: true }) groesseBreiteMm: number;
  @Column({ nullable: true }) ausmass: string;      // "handflächengroß", "Streifschaden 30cm"
  @Column({ type: enumColumnType(), enum: ['polieren','smart_repair','lackieren','instandsetzen','austausch','keine'], nullable: true }) reparaturart: DamageReparaturart;
  @Column({ type: enumColumnType(), enum: ['offen','in_arbeit','erledigt','abgelehnt','uebernommen'], default: 'offen' }) status: DamageItemStatus;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) kostenSchaetzung: string;
  @Column({ type: 'text', nullable: true }) notiz: string;

  // Carry-over / Versionierung
  @Index() @Column({ nullable: true }) carriedFromItemId: string;   // identischer Schaden in Vor-Inspektion
  @Column({ type: 'boolean', default: false }) istUebernommen: boolean;
  @Column({ type: 'boolean', nullable: true }) behobenBeiAusgang: boolean;  // Soll/Ist
  @Column({ nullable: true }) clientUuid: string;
  @CreateDateColumn() createdAt: Date; @UpdateDateColumn() updatedAt: Date;
}
```

### 4.3 `DamagePhoto` + `DamageItemPhoto` (n:m)

```ts
@Entity('damage_photos')
@Index(['tenantId', 'inspectionId'])
export class DamagePhoto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() inspectionId: string;
  @Column() pfad: string;                              // "/uploads/{tenantId}/insp/{id}/IMG.webp"
  @Column({ nullable: true }) thumbnailPfad: string;
  @Index() @Column({ nullable: true }) partId: string; // Bauteil-Foto OHNE konkreten Schaden
  @Column({ type: enumColumnType(), enum: ['detail','uebersicht','vin','tacho','kennzeichen'], default: 'detail' }) kategorie: string;
  @Column({ type: 'int', nullable: true }) breite: number;
  @Column({ type: 'int', nullable: true }) hoehe: number;
  @Column({ type: 'int', nullable: true }) reihenfolge: number;
  @Column({ nullable: true }) clientUuid: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('damage_item_photos')
@Index(['damageItemId', 'photoId'], { unique: true })   // verhindert Doppelzuordnung beim Re-Sync
export class DamageItemPhoto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() damageItemId: string;
  @Column() photoId: string;
  @Column({ type: 'boolean', default: false }) istHauptfoto: boolean;
  @CreateDateColumn() createdAt: Date;
}
```

**Schnelle Mehrfachzuordnung:** Ein Foto hängt zunächst an der Inspektion (nicht zwingend an einem
Schaden); `DamageItemPhoto` verknüpft danach **n:m** – ein Foto kann mehreren Schäden, ein Schaden
mehreren Fotos zugeordnet sein. `partId` am Foto erlaubt zusätzlich „Bauteil-Foto ohne konkreten Schaden".

### 4.4 DTO-Auszug (Stil wie `create-intake.dto.ts`)

```ts
export class CreateDamageItemDto {
  @IsString() partId: string;
  @IsOptional() @IsString() partLabel?: string;
  @IsIn(['3d','2d']) positionMode: '3d'|'2d';
  @IsOptional() @ValidateNested() @Type(() => Position3DDto) position3d?: Position3DDto;
  @IsOptional() @IsString() ansicht2d?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) x2d?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) y2d?: number;
  @IsIn(['vorschaden','neu']) origin: DamageOrigin;
  @IsIn(['kratzer','delle','steinschlag','lackschaden','rost','riss','bruch','verzogen','fehlteil','sonstiges']) art: DamageArt;
  @IsIn(['leicht','mittel','schwer']) schweregrad: DamageSchweregrad;
  @IsOptional() @IsInt() groesseLaengeMm?: number;
  @IsOptional() @IsIn(['polieren','smart_repair','lackieren','instandsetzen','austausch','keine']) reparaturart?: DamageReparaturart;
  @IsOptional() @IsString() notiz?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) photoIds?: string[];  // direkte Mehrfachzuordnung
  @IsOptional() @IsString() clientUuid?: string;
}
```
Service-seitig gelten die bestehenden Tenant-Regeln: `withTenant()` beim Anlegen,
`assertRefInTenant(...)` für **jede** FK (customer/vehicle/order **und** inspectionId/photoId) →
verhindert Cross-Tenant-Reference-Injection auch zwischen den neuen Entities.

### 4.5 JSON-Beispiel 1 — Annahme (3D): 1 Vorschaden + 2 Neuschäden + Fotos (mit n:m)

```json
{
  "inspection": {
    "id": "9f1c2a00-0001-...-a1", "tenantId": "tenant_muster_kfz",
    "customerId": "cust_4711", "vehicleId": "veh_wvwzzz_1k", "orderId": "ord_2026_0345",
    "typ": "annahme", "status": "abgeschlossen", "previousInspectionId": null,
    "modelKey": "vw_golf_8_v3", "kmStand": 84120, "tankstand": 45,
    "erfasstVonRolle": "technician", "clientUuid": "tab2-insp-001"
  },
  "items": [
    { "id": "dmg-0001", "partId": "tuer_vl", "partLabel": "Tür vorne links",
      "positionMode": "3d", "position3d": { "x": -0.812, "y": 0.430, "z": 0.155, "nx": -1, "ny": 0, "nz": 0 },
      "origin": "vorschaden", "art": "kratzer", "schweregrad": "leicht",
      "groesseLaengeMm": 120, "reparaturart": "polieren", "status": "uebernommen",
      "notiz": "Vorschaden, Kunde bei Annahme hingewiesen.", "carriedFromItemId": null, "istUebernommen": false },
    { "id": "dmg-0002", "partId": "stossfaenger_hinten", "partLabel": "Stoßfänger hinten",
      "positionMode": "3d", "position3d": { "x": 0.02, "y": 0.21, "z": -1.94, "nx": 0, "ny": 0.2, "nz": -0.98 },
      "origin": "neu", "art": "delle", "schweregrad": "mittel", "ausmass": "handtellergroß",
      "reparaturart": "instandsetzen", "status": "offen", "kostenSchaetzung": "180.00" },
    { "id": "dmg-0003", "partId": "windschutzscheibe", "partLabel": "Windschutzscheibe",
      "positionMode": "3d", "position3d": { "x": 0.35, "y": 1.05, "z": 0.62, "nx": 0.1, "ny": 0.6, "nz": 0.79 },
      "origin": "neu", "art": "steinschlag", "schweregrad": "leicht",
      "reparaturart": "smart_repair", "status": "offen", "kostenSchaetzung": "89.00" }
  ],
  "photos": [
    { "id": "ph-0001", "pfad": "/uploads/.../IMG_0042.jpg", "thumbnailPfad": "/uploads/.../thumb_0042.webp", "partId": "tuer_vl", "kategorie": "detail" },
    { "id": "ph-0002", "pfad": "/uploads/.../IMG_0043.jpg", "thumbnailPfad": "/uploads/.../thumb_0043.webp", "partId": "stossfaenger_hinten", "kategorie": "detail" }
  ],
  "itemPhotos": [
    { "damageItemId": "dmg-0001", "photoId": "ph-0001", "istHauptfoto": true },
    { "damageItemId": "dmg-0002", "photoId": "ph-0002", "istHauptfoto": true },
    { "damageItemId": "dmg-0003", "photoId": "ph-0002", "istHauptfoto": false }
  ]
}
```
> `ph-0002` ist **zwei** Schäden zugeordnet (`dmg-0002` + `dmg-0003`) → demonstriert die n:m-Mehrfachzuordnung.

### 4.6 JSON-Beispiel 2 — Ausgang mit Carry-over + Soll/Ist

```json
{
  "inspection": {
    "id": "9f1c2a00-0002-...-b2", "tenantId": "tenant_muster_kfz",
    "customerId": "cust_4711", "vehicleId": "veh_wvwzzz_1k", "orderId": "ord_2026_0345",
    "typ": "ausgang", "status": "freigegeben",
    "previousInspectionId": "9f1c2a00-0001-...-a1", "modelKey": "vw_golf_8_v3",
    "kmStand": 84126, "erfasstVonRolle": "manager"
  },
  "items": [
    { "id": "dmg-1001", "partId": "tuer_vl", "origin": "vorschaden", "art": "kratzer", "schweregrad": "leicht",
      "reparaturart": "keine", "status": "uebernommen", "notiz": "Vorschaden unverändert, nicht beauftragt.",
      "carriedFromItemId": "dmg-0001", "istUebernommen": true, "behobenBeiAusgang": false },
    { "id": "dmg-1002", "partId": "stossfaenger_hinten", "origin": "vorschaden", "art": "delle", "schweregrad": "mittel",
      "reparaturart": "instandsetzen", "status": "erledigt", "notiz": "Delle aus Annahme behoben.",
      "carriedFromItemId": "dmg-0002", "istUebernommen": true, "behobenBeiAusgang": true },
    { "id": "dmg-1003", "partId": "kotfluegel_vr", "origin": "neu", "art": "lackschaden", "schweregrad": "leicht",
      "reparaturart": "smart_repair", "status": "offen",
      "notiz": "NEU bei Ausgang festgestellt – nicht in Annahme vorhanden. Klärung mit Werkstatt.",
      "carriedFromItemId": null, "istUebernommen": false }
  ]
}
```
> Soll/Ist: `dmg-1002.behobenBeiAusgang=true` (Auftrag erledigt), `dmg-1001.behobenBeiAusgang=false`
> (Vorschaden bewusst belassen), `dmg-1003.origin='neu'` ohne `carriedFromItemId` = strittiger Neuschaden.

### 4.7 Migration vom 2D-`SchadensMarker` (additiv, nicht-destruktiv)

`VehicleIntake.marker[]` bleibt erhalten; eine Backfill-Migration erzeugt je Intake eine
`DamageInspection(typ='annahme')` und je `SchadensMarker` ein `DamageItem` im **2D-Fallback** (`positionMode='2d'`):

| `SchadensMarker` | → `DamageItem` |
|---|---|
| `ansicht`, `x`, `y` | `ansicht2d`, `x2d`, `y2d` (`positionMode='2d'`, `position3d=null`) |
| `zone` | `partId` (über Zone→partId-Lookup; fehlt → `unbekannt_<ansicht>`) |
| `art`, `schweregrad`, `notiz` | 1:1 |
| — | `origin='neu'`, `istUebernommen=false` |

Beide Modi koexistieren in derselben Inspektion: `FahrzeugDiagramm.tsx` rendert `positionMode='2d'`
unverändert weiter, neue Erfassungen schreiben `'3d'`. **Fließender Umstieg ohne Datenverlust.**

---

## 5. Technische Architektur

### 5.1 Komponenten & Datenfluss

```
┌──────────────── Werkstatt-Tablet (PWA, Next.js) ────────────────┐
│ InspectionViewer3D (R3F)  ·  FotoBereich3D  ·  BauteilSchadenPanel│
│        │                        │                  │             │
│        ▼  IndexedDB (Dexie) ◄── Outbox/Mutation-Queue ──► SW (Workbox)
│  inspections · damages · photos(Blobs) · assets(Cache Storage)   │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ HTTPS · JWT · batched sync
                                 ▼
┌───────────────────────── NestJS API ─────────────────────────────┐
│ InspectionController · DamageController · PhotoController          │
│   tenant-scope (withTenant / findOneScoped / assertRefInTenant)   │
│ InspectionService · DamageService · PhotoService · PhotoPipeline  │
│   TypeORM (SQLite dev / Postgres prod)        (sharp: rotate/thumb)│
│ CalculationBridge → Orders/OrderItem    ReportService → PDF       │
│ StorageAdapter (LocalDisk → S3)                                   │
└───────────────────────────────────────────────────────────────────┘
   /uploads/3d-assets  (statisch, public)   ·   Fotos NUR über Guard
```

**Kern-Designentscheidung:** `DamageItem` ist eine **eigene Tabelle** (nicht JSON-Array wie heute
`marker[]`) – weil kalkulationsrelevant, einzeln referenzierbar, **indexierbar** und **konfliktfrei
synchronisierbar** (additiv statt Listen-Merge). `partId` ist die kanonische Brücke zwischen 2D-Zonen,
3D-Meshes und Kalkulations-Mapping.

### 5.2 API-Oberfläche

Alle Endpunkte: `@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)`, `tenantId` **nie** aus dem
Body, FKs über `assertRefInTenant`, Lesen über `findOneScoped`/`scopedQuery`.

```
# Inspektionen
POST   /inspections                  { id?, customerId, vehicleId, orderId?, typ, modelKey }
GET    /inspections?orderId=&vehicleId=&typ=&status=
GET    /inspections/:id              inkl. items + photo-Thumbs
PATCH  /inspections/:id              { kmStand?, status?, version }   (optimistic lock)

# Schäden  (idempotent über clientUuid → gefahrloser Re-Sync)
POST   /inspections/:id/items        { id?, partId, positionMode, position3d?, origin, art, schweregrad, photoIds? }
GET    /inspections/:id/items?origin=neu
PATCH  /items/:id                    { art?, schweregrad?, origin?, status?, behobenBeiAusgang?, version }
DELETE /items/:id                    soft delete (Tombstone für Sync)

# Fotos  (idempotent über contentHash)
POST   /inspections/:id/photos       multipart: file + { damageItemId?, partId?, contentHash?, takenAt? }
GET    /photos/:id        /photos/:id/thumb     ← NUR über Guard, NICHT statisch
POST   /items/:id/photos             { photoIds[] }   n:m-Mehrfachzuordnung in einem Call

# Kalkulation & Report
POST   /inspections/:id/calculate    → CalculationBridge: Neuschäden → OrderItems → bestehende Order
GET    /inspections/:id/report.pdf   → Gutachten/Protokoll-PDF

# 3D-Assets (read-only, cache-fähig)
GET    /assets/models                Katalog { bodyType → modelKey, url, partIds[] }
GET    /assets/models/:key.glb       (CDN/immutable)
```

### 5.3 Foto-Pipeline

1. **Client:** `<input capture>`/Drag → `createImageBitmap` → downscale ≤ 2560 px, WebP ~0.8 → Blob in IndexedDB; `contentHash` (SHA-256) client-seitig; Vorschau aus Blob (kein Roundtrip).
2. **Upload:** multipart (`multer`), MIME-/Größen-Whitelist (`jpeg|png|webp|heic`).
3. **Verarbeitung (`sharp`):** EXIF lesen (`takenAt`), `.rotate()` Auto-Orientierung, **EXIF strippen (inkl. GPS – Privacy)**, Original→WebP ≤ 2560 px, **Thumbnail 320 px**; HEIC→WebP.
4. **Speicherung (`StorageAdapter`):** `/uploads/{tenantId}/inspections/{inspectionId}/{photoId}.webp` (+ `_thumb`). tenantId im Pfad → einfache Quota/Löschung, kein Cross-Tenant-Enumerieren.
5. **Zuordnung:** Pfade an `DamagePhoto`; bei gesetztem `damageItemId` zusätzlich `DamageItemPhoto`-Row.

**S3-fähig:** `StorageAdapter`-Interface (`put/get/getSignedUrl/delete`). Dev = LocalDisk; Prod-S3
liefert kurzlebige, **ownership-geprüfte** Signed-URLs. Kein Controller-Code ändert sich.

### 5.4 3D-Asset-Pipeline

Wenige GLBs je Karosserietyp (Draco/meshopt), Bauteile = benannte Nodes (`mesh.name === partId`).
Mapping `vehicle.bodyType → bodyType-Enum → modelKey@<version>` als konfigurierbare Tabelle (Seed,
später je Tenant überschreibbar), Fallback `generic-5door`. GLBs versioniert + `Cache-Control: immutable`,
clientseitig in **Cache Storage** (`CacheFirst`) → offline.

### 5.5 Offline & Sync

- **PWA:** Workbox Service Worker; App-Shell + 3D-Assets `CacheFirst`, API `NetworkFirst` mit IndexedDB-Fallback.
- **Lokaler Store (Dexie):** `inspections`, `damages`, `photos(blobs)` + **Outbox** (Mutation-Queue).
- **IDs client-seitig (UUIDv4 auf dem Tablet):** Schema lässt `id?` zu → **kein ID-Remapping**, gleiche ID lokal wie serverseitig.
- **Idempotenz:** `POST` mit bekannter `id`/`clientUuid` (Item/Inspection) bzw. `contentHash` (Foto) → Server upsertet/erkennt Dublette → Retries gefahrlos.
- **Konflikte:** neue Schäden/Fotos **additiv = konfliktfrei** (eigener Datensatz, kein Listen-Merge);
  Feld-Updates per **optimistic lock** (`version`, `409` → Merge-Hinweis statt stiller Überschreibung);
  Löschen = **Soft-Delete + Tombstone** (kein „Wiederauferstehen" nach Re-Sync).
- **Sync-Loop:** Outbox FIFO respektiert Abhängigkeit (Inspection → Item → Photo), Background-Sync-API, Backoff bei 5xx/Netz.

### 5.6 Sicherheit

- **Fahrzeugfotos NICHT statisch ausliefern.** Static-Mount auf `/uploads/3d-assets` beschränken; Fotos
  über `PhotoController` (`GET /photos/:id`) mit `findOneScoped` → Pfad-Enumeration wirkungslos.
- `tenantId` immer aus JWT; alle FK über `assertRefInTenant` (existenz-orakel-sicher).
- EXIF-GPS strippen; MIME/Größen-Whitelist; Signed-URLs (Prod) kurzlebig nach Ownership-Check.

### 5.7 Kalkulations-Anbindung & Report

- **`CalculationBridge`** (`POST /inspections/:id/calculate`): Mapping `(partId, art, schweregrad) →
  Reparaturposition` mit **Arbeitswerten (AW)** + Material (je Tenant konfigurierbar, sonst Branchen-Default).
  Erzeugt je **Neuschaden** (Vorschäden standardmäßig ausgeschlossen, zuschaltbar) `OrderItem`-Datensätze
  im **bestehenden Orders-Modul**; AW × Stundensatz → Preis; Order-Status → `KALKULIERT`.
  Rückverlinkung `OrderItem ↔ damageItemId` → Re-Kalkulation idempotent.
- **`ReportService`** (PDF): Stammdaten, 3D-Schadenskizze (Vorschaden grau / Neu Kupfer als Legende),
  Foto-Anhang mit Zeit/Position, Vorschaden-Abgrenzungstabelle, Kalkulationssumme. Nach Export
  schreibgeschützt (Nachtrag = neue Version) → Beweiskraft.

### 5.8 Modul-/Dateistruktur

```
backend/src/inspection/
  inspection.module.ts
  controllers/  inspection.controller.ts  damage.controller.ts  photo.controller.ts
  services/     inspection.service.ts  damage.service.ts  photo.service.ts
  pipeline/     photo-pipeline.service.ts  storage.adapter.ts (LocalDisk|S3)
  calculation/  calculation-bridge.service.ts  report.service.ts
  assets/       asset-catalog.service.ts   (bodyType→modelKey, partId-Katalog)
  entities/     damage-inspection.entity.ts  damage-item.entity.ts  damage-photo.entity.ts  damage-item-photo.entity.ts
  dto/          create-inspection.dto.ts  create-damage-item.dto.ts  …
frontend/src/app/(app)/schadenserfassung/page.tsx
frontend/src/components/Inspection3D/  InspectionViewer3D.tsx  PartHighlight.tsx  DamageMarker3D.tsx
                                       BauteilSchadenPanel.tsx  VorVsNeuToggle.tsx  FotoBereich3D.tsx
frontend/src/lib/offline/  db.ts (Dexie)  outbox.ts  sync.ts  uuid.ts
```

---

## 6. Workflows: Werkstatt & Gutachter

**Leitprinzip:** *Eine Hand, ein Blick, ein Tap.* Jeder Schaden entsteht in einer Geste, jedes Foto hängt
automatisch am richtigen Bauteil, Vor/Neu ist jederzeit farblich **und** im Datenmodell getrennt.

### 6.1 Rollen & Rechte (serverseitig erzwungen)

| Rolle | Fahrzeug/Insp. anlegen | Neuschaden setzen | Vorschaden bearbeiten | Vorschaden löschen | Kalkulation | Ausgang freigeben |
|---|---|---|---|---|---|---|
| `receptionist` | ✅ | ✅ | nur sehen | ✗ | ✗ | ✗ |
| `technician` | ✗ | ✅ | ✗ | ✗ | ✗ | ✅ (Soll/Ist) |
| `manager` | ✅ | ✅ | ✅ (mit Begründung + Audit) | ✅ (Audit) | ✗ | ✅ |
| `gutachter` | ✅ (eigener Vorgang) | ✅ (Befund) | ✅ (Abgrenzung) | ✗ | ✅ | – |

> **Harte Regel:** Ein übernommener Vorschaden ist für Werkstatt-Rollen **schreibgeschützt**. Nur
> `manager` darf ihn mit Pflicht-Begründung + Audit-Eintrag korrigieren → niemand kann stillschweigend
> einen Neuschaden zum Vorschaden umdeklarieren (Haftungsfalle).

### 6.2 Werkstatt: Annahme → Reparatur → Ausgang

**Annahme (Tablet, ggf. offline):**
1. **Fahrzeug wählen/anlegen** (Kennzeichen/VIN), `kmStand`/`tankstand`.
2. **Vorschäden aus Historie laden** – System holt automatisch alle Marker früherer Inspektionen desselben
   Fahrzeugs (mandantengetrennt), zeigt sie **gedämpft/grau**, `origin=vorschaden`, schreibgeschützt. Schalter „Vorschäden ein/aus".
3. **Neue Schäden setzen** – Bauteil antippen → Quick-Sheet **Art → Schweregrad** (zwei Taps), `origin` automatisch `neu`, sofort **Kupfer/voll**.
4. **Fotos** – aktiver Marker → Kamera → automatisch an Marker + Bauteil; landen in `bilderVorher[]`.
5. **Plausibilitätscheck** (Pflichtfelder, Neuschaden ohne Foto = Warnung, km-Plausibilität) → Mängelliste mit Sprung-Links.
6. **Kunde-Unterschrift** – Zusammenfassung zeigt nur **Neuschäden** prominent (haftungsrelevanter Befund), Vorschäden eingeklappt; PDF-Annahmeprotokoll.
7. **Übergabe an Reparatur** – Neuschäden = Soll-Liste.

**Reparatur:** Techniker sieht Neuschäden als Arbeitsliste, setzt `status: offen → erledigt`, optional Reparaturfotos.

**Ausgang (Soll/Ist):**
8. Split-Ansicht **Soll** (Annahme-Neuschäden) ↔ **Ist** (aktuell). Jede Position quittieren
   `erledigt`/`nicht_repariert`; kein Ausgang mit offenen Positionen. Bei Reparatur entstandene Schäden = frische Neuschäden mit Erfasser=Werkstatt. Behobene Vorschäden → `behobenBeiAusgang=true` (bleiben in der Historie).
9. **Ausgangs-Unterschrift**, `status=abgeschlossen`, `bilderNachher[]` gefüllt.

### 6.3 Gutachter: unabhängige Begutachtung

1. **Vorgang anlegen** (eigener Typ `gutachten`); Werkstatt-Historie nur als **Referenz** (nicht änderbar).
2. **Beweissicherung** – Foto-Pflicht je Befund (**blockierend**), jedes Foto mit Zeitstempel + Positionsbezug (partId + Koordinate). Foto-Set-Vorlage „Übersicht → Detail → Detail mit Maßstab".
3. **Vorschaden-Abgrenzung** (Kernkompetenz) – je Bauteil aktiv klassifizieren: bestätigter Vorschaden vs. eigener aktueller Befund (`origin=neu`); strukturierte Felder (Alter/Korrosion, Plausibilität zum Hergang, Unfallkompatibilität). Hinweis (kein Block), wenn „neu" deklariert, aber Foto Alterung zeigt.
4. **Kalkulation** je Befund (Ersetzen/Lackieren/Instandsetzen, AW, Material); nur Neu-/strittige Befunde fließen in die Summe, Vorschäden getrennt ausgewiesen. Block: Reparaturkosten + Wertminderung.
5. **Plausibilität & Pflichtfelder** vor Export (Foto + Klassifikation + Begründung + vollständige Kalkulation).
6. **Gutachten-PDF** (versioniert, nach Export schreibgeschützt).

### 6.4 Was die Bedienung schnell macht

- **Zwei-Tap-Schaden**, **Auto-Fotozuordnung**, **Presets pro Bauteil** („Stoßstange: Kratzer leicht" als 1-Tap), **Foto-Set-Vorlagen**.
- Touch-Shortcuts: 1-Finger drehen · Pinch zoomen · Doppeltap = ganzes Bauteil · Long-Press = löschen · Wisch = nächstes Bauteil.
- Tastatur: `1/2/3` Schweregrad · `K/D/S/L/R` Art · `F` Foto · `V` Vorschäden ein/aus · `Entf` löschen · `Strg+S` speichern.
- **Wiedervorlage** je Vorgang (`wiedervorlage_am` + Grund), Dashboard-Liste „heute fällig/überfällig"; Auto-Vorschlag bei „Neuschaden ohne Foto" / „Ausgang mit nicht_repariert".

---

## 7. Vorschaden ↔ Neuschaden – die Mechanik

Die saubere Trennung ist **drei-fach** verankert:

1. **Fachlich (Datenfeld):** `DamageItem.origin = 'vorschaden' | 'neu'` ist Pflichtfeld, immer gesetzt.
2. **Historisch (Carry-over):** Beim Anlegen einer Ausgangs-Inspektion kopiert der Service alle Items der
   `previousInspectionId` als `origin='vorschaden'`, `istUebernommen=true`, `carriedFromItemId=<alte id>`.
   Neu hinzugefügte → `origin='neu'`. Der Soll/Ist-Vergleich Annahme↔Ausgang läuft über
   `carriedFromItemId` (**kein Diff-Algorithmus nötig**); `behobenBeiAusgang` schließt die Kette
   „war Vorschaden → jetzt behoben".
3. **Visuell (doppelt codiert):** Vorschaden = **Hohl-Ring, entsättigt, gedämpft**; Neuschaden =
   **voller Punkt, akzentuiert**. Form *und* Sättigung → auf einen Blick und barrierefrei eindeutig.

**Schutz vor Streitfällen:** Keine stille Umwidmung (nur `manager` + Begründung + Audit-Log);
Vorschäden für Werkstatt read-only; Gutachter klassifiziert unabhängig.

---

## 8. Umsetzungs-Roadmap

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 · Fundament** | Entities + Migration (2D→DamageItem), API (CRUD Inspektion/Item/Photo), tenant-sicher | Backend steht, 2D-Altdaten migriert |
| **1 · Foto-Pipeline** | Upload + `sharp` (rotate/strip/thumb) + Guard-Serving, Vorher/Nachher | Schnelle, sichere Fotodoku |
| **2 · 3D-Viewer (MVP)** | R3F-Canvas, 1 generisches GLB, Bauteil-Klick → partId, Marker setzen, Editor, Markierungsschema | Erfassen am 3D-Modell |
| **3 · Workflow-Logik** | Vorschaden-Carry-over, geführter Rundgang, Soll/Ist-Ausgang, Rollen-Guards, Plausibilität | Werkstatt-Ablauf produktiv |
| **4 · Offline/PWA** | Dexie + Outbox + Service Worker, Asset-Cache, Sync/Idempotenz | Hallen-tauglich offline |
| **5 · Kalkulation & Gutachten** | CalculationBridge → OrderItems, Report-PDF, Gutachter-Modus | Schaden → Kosten → Beleg |
| **6 · Politik & Skin** | weitere Karosserietypen, Heatmap-Layer, AR-Beigabe (model-viewer), S3 | Ausbau |

**Empfehlung:** Phase 0–2 als erster lieferbarer Durchstich (erfassen + Foto am 3D-Modell), dann iterativ.

---

## 9. Risiken & offene Punkte

- ⚖️ **3D-Modell-Lizenzen** (wichtigster Punkt): „free"-Marktplatz-Modelle haben oft **non-commercial**-
  oder „editorial only"-Klauseln und enthalten teils geschützte Markendesigns. Für eine kommerzielle SaaS:
  **CC0/CC-BY mit dokumentierter Attribution**, ein **gekauftes Royalty-Free-Pack mit Commercial-Lizenz**,
  oder **eigens beauftragte generische Modelle** (sauberste Option, volle IP). Lizenz je Asset im `LICENSES`-Manifest.
- **Tablet-Performance:** konservativer Polycount, Draco, `frameloop="demand"` (nur bei Interaktion rendern),
  Instancing für Marker → Akku/GPU schonen. Auf Mittelklasse-Geräten testen.
- **Reparaturpositions-Mapping** `(partId, art, schweregrad) → AW/Material` muss fachlich gepflegt werden
  (Branchen-Default + je Tenant überschreibbar). Anfangs konservativ, iterativ verfeinern.
- **eIDAS/Signatur** (Annahme-/Ausgangsunterschrift) und Aufbewahrungsfristen rechtlich prüfen
  (passt zum bestehenden Consent-/Signatur-Strang im Master-Konzept).
- **Modellabdeckung:** vier generische Karosserien decken den Bestand, aber Sonderfahrzeuge brauchen den
  `generic`-Fallback; partId-Katalog als Single Source of Truth pflegen.

---

*Erstellt für Detailly · baut auf der bestehenden Fahrzeugannahme auf · alle neuen Entities mandantengetrennt
(`tenant-scope.ts`) · Fotos tenant-geschützt · 2D bleibt als gleichwertiger Fallback erhalten.*
