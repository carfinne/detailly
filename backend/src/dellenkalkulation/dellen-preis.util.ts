/**
 * Reine, DB-freie Preis-Engine der Dellenkalkulation (Smart Repair / PDR).
 *
 * Bewusst ohne Fremd-Paket und ohne KI: die PDR-Kalkulation ist regelbasiert und
 * je Betrieb ueber eine Preismatrix konfigurierbar. Alle Funktionen sind rein und
 * damit direkt unit-testbar (siehe *.util.spec.ts). Der Service normalisiert die
 * (als decimal-Strings geladene) Tenant-Matrix in `DellenPreismatrixWerte` und
 * ruft ausschliesslich diese Funktionen auf – der Preis wird NIE dem Client
 * geglaubt, sondern immer hier serverseitig berechnet.
 */

/**
 * Groessenklassen einer Delle nach Muenz-/Referenzgroesse (aufsteigend). BEWUSST
 * Text-Union + @IsIn im DTO (kein DB-Enum): neue Klassen erfordern so keine
 * Enum-Schema-Migration und keinen Dev-Reseed.
 */
export const GROESSENKLASSEN = ['1euro', '2euro', '5euro', 'golfball', 'groesser'] as const;
export type Groessenklasse = (typeof GROESSENKLASSEN)[number];

/** Modus der Kalkulation: Einzeldellen (Parkschaden) vs. Hagel-Staffel. */
export const DELLEN_MODI = ['einzel', 'hagel'] as const;
export type DellenModus = (typeof DELLEN_MODI)[number];

/** Bearbeitungsstatus einer Kalkulation. */
export const DELLEN_STATUS = ['entwurf', 'final'] as const;
export type DellenStatus = (typeof DELLEN_STATUS)[number];

/** Positionierung eines Markers: 3D-Weltpunkt ODER 2D-Zonen-Fallback. */
export const POSITION_MODES = ['3d', '2d'] as const;
export type PositionMode = (typeof POSITION_MODES)[number];

/** Eine Staffel-Stufe des Hagel-Modus (Panel-Pauschale je Dellen-Anzahl). */
export interface HagelStaffelStufe {
  /** Obere Grenze der Dellen-Anzahl (inklusiv); null = "und mehr" (oberste Stufe). */
  maxDellen: number | null;
  /** Panel-Pauschale in Euro fuer diese Stufe. */
  pauschale: number;
}

/**
 * Normalisierte, rein numerische Preismatrix (Grundlage der Berechnung). Die
 * persistierte Tenant-Matrix (decimal-Spalten -> Strings) wird im Service in
 * genau diese Form ueberfuehrt, damit die Engine mit reinen `number` rechnet.
 */
export interface DellenPreismatrixWerte {
  /** Basispreis je Groessenklasse (reines PDR, ohne Zuschlaege). */
  basispreise: Record<Groessenklasse, number>;
  /** Faktor fuer Kanten-/Sicken-Dellen (schwerer zugaenglich), z.B. 1.5. */
  kantenFaktor: number;
  /** Faktor fuer Aluminium-Bauteile (schwerer), z.B. 1.4. */
  aluFaktor: number;
  /** Additiver Aufschlag je Delle mit Lackschaden (kein reines PDR moeglich). */
  lackschadenAufschlag: number;
  /** Optionale Mindestpauschale je Kalkulation (0 = keine). */
  mindestpauschale: number;
  /** Optionale Anfahrtspauschale je Kalkulation (0 = keine). */
  anfahrtspauschale: number;
  /** Hagel-Staffel: Panel-Pauschale nach Dellen-Anzahl je Bauteil. */
  hagelStaffel: HagelStaffelStufe[];
}

/**
 * Werkstattnahe Default-Preismatrix (seedbar + Fallback, wenn ein Betrieb noch
 * keine eigene Matrix gepflegt hat). Richtwerte fuer Smart Repair / PDR – jeder
 * Betrieb passt sie in den Einstellungen an. Preise in Euro.
 */
export const DEFAULT_DELLEN_PREISMATRIX: DellenPreismatrixWerte = {
  basispreise: {
    '1euro': 35,
    '2euro': 55,
    '5euro': 80,
    golfball: 120,
    groesser: 170,
  },
  kantenFaktor: 1.5,
  aluFaktor: 1.4,
  lackschadenAufschlag: 60,
  mindestpauschale: 0,
  anfahrtspauschale: 0,
  hagelStaffel: [
    { maxDellen: 5, pauschale: 250 },
    { maxDellen: 15, pauschale: 450 },
    { maxDellen: 30, pauschale: 700 },
    { maxDellen: null, pauschale: 1100 },
  ],
};

/** Preisrelevante Attribute eines einzelnen Markers (Einzel- ODER Hagel-Modus). */
export interface DellenMarkerBerechnung {
  /** Einzel-Modus: Groessenklasse der Delle. */
  groessenklasse?: Groessenklasse | null;
  kante?: boolean | null;
  alu?: boolean | null;
  lackschaden?: boolean | null;
  /** Hagel-Modus: Anzahl der Dellen an diesem Bauteil (Panel). */
  dellenAnzahl?: number | null;
}

/** Kaufmaennisch auf 2 Nachkommastellen runden (Geldbetrag). */
export function runde2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Endliche, nicht-negative Zahl aus beliebigem Eingang (decimal-String/number). */
function nn(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Normalisiert eine (evtl. unsaubere) Matrix: Zahlen werden auf endliche,
 * nicht-negative Werte gezwungen, Faktoren mindestens 0, und die Hagel-Staffel
 * wird aufsteigend sortiert (null-Grenze immer zuletzt). Idempotent.
 */
export function normalisiereMatrix(m: DellenPreismatrixWerte): DellenPreismatrixWerte {
  const basispreise = {} as Record<Groessenklasse, number>;
  for (const k of GROESSENKLASSEN) basispreise[k] = nn(m.basispreise?.[k]);
  const staffel = (Array.isArray(m.hagelStaffel) ? m.hagelStaffel : [])
    .map((s) => ({
      maxDellen:
        s.maxDellen === null || s.maxDellen === undefined
          ? null
          : Math.max(1, Math.floor(nn(s.maxDellen, 1))),
      pauschale: nn(s.pauschale),
    }))
    // null (= "und mehr") ans Ende, sonst nach Grenze aufsteigend.
    .sort((a, b) => {
      if (a.maxDellen === null) return 1;
      if (b.maxDellen === null) return -1;
      return a.maxDellen - b.maxDellen;
    });
  return {
    basispreise,
    kantenFaktor: nn(m.kantenFaktor, 1),
    aluFaktor: nn(m.aluFaktor, 1),
    lackschadenAufschlag: nn(m.lackschadenAufschlag),
    mindestpauschale: nn(m.mindestpauschale),
    anfahrtspauschale: nn(m.anfahrtspauschale),
    hagelStaffel: staffel,
  };
}

/**
 * Einzelpreis einer einzelnen Delle (Einzel-/Parkschaden-Modus):
 *   basispreis(Groessenklasse) * (Kante? kantenFaktor) * (Alu? aluFaktor)
 *   + (Lackschaden? lackschadenAufschlag)
 * Reihenfolge bewusst: Faktoren wirken auf die reine PDR-Basis, der
 * Lackschaden-Aufschlag kommt additiv obendrauf (dann kein reines PDR).
 */
export function einzelMarkerPreis(
  matrix: DellenPreismatrixWerte,
  m: DellenMarkerBerechnung,
): number {
  const klasse = m.groessenklasse;
  const basis = klasse && klasse in matrix.basispreise ? matrix.basispreise[klasse] : 0;
  let preis = basis;
  if (m.kante) preis *= matrix.kantenFaktor;
  if (m.alu) preis *= matrix.aluFaktor;
  if (m.lackschaden) preis += matrix.lackschadenAufschlag;
  return runde2(preis);
}

/**
 * Panel-Pauschale eines Bauteils im Hagel-Modus: die erste Staffel-Stufe, deren
 * `maxDellen`-Grenze die Dellen-Anzahl abdeckt (null = oberste Stufe). 0 Dellen
 * -> 0 Euro (kein Panel).
 */
export function hagelPanelPreis(matrix: DellenPreismatrixWerte, dellenAnzahl?: number | null): number {
  const n = Math.max(0, Math.floor(nn(dellenAnzahl)));
  if (n <= 0) return 0;
  for (const stufe of matrix.hagelStaffel) {
    if (stufe.maxDellen === null || n <= stufe.maxDellen) return runde2(stufe.pauschale);
  }
  const last = matrix.hagelStaffel[matrix.hagelStaffel.length - 1];
  return last ? runde2(last.pauschale) : 0;
}

/** Preis eines Markers je nach Modus (Einzeldelle vs. Hagel-Panel). */
export function markerPreis(
  matrix: DellenPreismatrixWerte,
  modus: DellenModus,
  m: DellenMarkerBerechnung,
): number {
  return modus === 'hagel' ? hagelPanelPreis(matrix, m.dellenAnzahl) : einzelMarkerPreis(matrix, m);
}

/** Ergebnis der Gesamtberechnung: Einzelpreise je Marker + Gesamtpreis. */
export interface DellenBerechnung {
  markerPreise: number[];
  gesamtpreis: number;
}

/**
 * Berechnet die Einzelpreise aller Marker und den Gesamtpreis der Kalkulation.
 * - Einzel-Modus: Summe der Einzeldellen-Preise.
 * - Hagel-Modus: Summe der Panel-Pauschalen.
 * Zzgl. optionaler Anfahrtspauschale; auf die optionale Mindestpauschale
 * angehoben. Ohne Marker ist der Gesamtpreis 0 (leerer Entwurf).
 */
export function berechneGesamt(
  matrix: DellenPreismatrixWerte,
  modus: DellenModus,
  markers: DellenMarkerBerechnung[],
): DellenBerechnung {
  const markerPreise = markers.map((m) => markerPreis(matrix, modus, m));
  if (markerPreise.length === 0) return { markerPreise: [], gesamtpreis: 0 };
  const summe = markerPreise.reduce((a, b) => a + b, 0);
  let gesamt = summe + matrix.anfahrtspauschale;
  if (matrix.mindestpauschale > 0 && gesamt < matrix.mindestpauschale) {
    gesamt = matrix.mindestpauschale;
  }
  return { markerPreise, gesamtpreis: runde2(gesamt) };
}
