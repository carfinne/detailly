// Geteilte 3D-Karosserie-Geometrie fuer die R3F-Szenen (Schadensviewer +
// Dellenviewer + Schichtdicke-Heatmap). EINE Quelle der Wahrheit, damit alle
// Szenen nie divergieren (Lektion aus lib/vehicle-parts.ts).
//
// NEU (Fahrzeugtypen): Statt EINER generischen Karosserie liefert dieses Modul
// je Fahrzeugtyp (Limousine, Kombi, SUV, Coupé, Kompakt, Transporter, Pickup)
// eine eigene, prozedurale Karosserie mit realistischeren Proportionen. Alle
// Typen teilen sich DIESELBE Bauteil-Topologie (identische partId-Menge = die 14
// im 3D dargestellten Bauteile aus lib/vehicle-parts.ts). Nur Position/Groesse je
// Bauteil unterscheiden sich pro Typ. Das garantiert:
//   • Raycasting liefert weiterhin kanonische partIds (mesh.name === partId).
//   • Bestehende Marker (position3d = Weltkoordinaten) rendern fuer JEDEN Typ.
//   • Der Wechsel zwischen Typen ist ein reiner Prop-Update auf denselben,
//     per part.id gekeyten Meshes -> fluessig, kein Remount.
//
// RECHTSSICHER: rein prozedural aus Primitiven (Box/RoundedBox/Zylinder) – KEINE
// markengenauen/gebrandeten Modelle, keine externen Assets.
//
// DEFAULT = 'limousine' == die HEUTIGE Karosserie (byte-identische pos/size).
// Damit passen bereits gespeicherte 3D-Marker (Altdaten ohne bzw. mit
// Legacy-`modelKey`) unveraendert weiter.

import { VEHICLE_PARTS, canonicalPartId } from '@/lib/vehicle-parts';

// --- Karosserie-Lackton (neutral, damit Kupfer der einzige Akzent bleibt) ---
export const BODY_COLOR = '#3a4456';
export const GLASS_COLOR = '#1b2230';

export type Vec3 = [number, number, number];

// Ein klickbares Karosserie-Bauteil. position/size in Welt-Einheiten.
export type Part = {
  id: string;
  pos: Vec3;
  size: Vec3;
  glass?: boolean;
  /** Kantenrundung dieses Bauteils (Bevel-Radius in Welt-Einheiten). */
  radius: number;
};

/** Rein dekoratives Rad (nicht klickbar). */
export type WheelSpec = { x: number; y: number; z: number; r: number; width: number };

/** Rein dekorative Zusatzflaeche (z. B. Pickup-Ladeflaeche); nicht klickbar. */
export type ShellSpec = { pos: Vec3; size: Vec3; radius: number; glass?: boolean };

/** Vollstaendige Geometrie eines Fahrzeugtyps. */
export interface VehicleGeometry {
  /** Grundkoerper (Fahrgastzelle/Unterboden) – nicht klickbar, nur Masse. */
  base: { pos: Vec3; size: Vec3; radius: number };
  /** Klickbare, benannte Bauteile (name === partId). */
  parts: Part[];
  /** Raeder (Deko). */
  wheels: WheelSpec[];
  /** Zusatz-Deko (nur Pickup nutzt sie aktuell). */
  shells: ShellSpec[];
}

// --- Fahrzeugtyp-Registry --------------------------------------------------
// Motorrad ist BEWUSST NICHT enthalten: seine Topologie (kein Dach/Tueren/Haube)
// passt nicht auf die gemeinsame 14-Bauteil-Marker-Topologie. Ein eigenes
// Marker-Modell waere ein separates Feature.
export type Fahrzeugtyp =
  | 'limousine'
  | 'kombi'
  | 'suv'
  | 'coupe'
  | 'kompakt'
  | 'transporter'
  | 'pickup';

export const DEFAULT_FAHRZEUGTYP: Fahrzeugtyp = 'limousine';

/** Reihenfolge fuer die Auswahl-UI + i18n-Key je Typ. */
export const FAHRZEUGTYPEN: { id: Fahrzeugtyp; labelKey: string }[] = [
  { id: 'limousine', labelKey: 'fahrzeugtyp.limousine' },
  { id: 'kombi', labelKey: 'fahrzeugtyp.kombi' },
  { id: 'suv', labelKey: 'fahrzeugtyp.suv' },
  { id: 'coupe', labelKey: 'fahrzeugtyp.coupe' },
  { id: 'kompakt', labelKey: 'fahrzeugtyp.kompakt' },
  { id: 'transporter', labelKey: 'fahrzeugtyp.transporter' },
  { id: 'pickup', labelKey: 'fahrzeugtyp.pickup' },
];

const FAHRZEUGTYP_IDS = new Set<string>(FAHRZEUGTYPEN.map((f) => f.id));

/**
 * Loest einen (evtl. veralteten) `modelKey` auf einen Fahrzeugtyp auf.
 * Unbekannte/Legacy-Werte (`null`, `'generic-5door'`, alte Modell-Ids …) fallen
 * konservativ auf den DEFAULT (Limousine = heutige Karosserie) zurueck, damit
 * Altdaten unveraendert korrekt gerendert werden.
 */
export function fahrzeugtypFromModelKey(modelKey?: string | null): Fahrzeugtyp {
  if (!modelKey) return DEFAULT_FAHRZEUGTYP;
  // Optionales, selbstbeschreibendes Praefix 'typ:' unterstuetzen.
  const raw = modelKey.startsWith('typ:') ? modelKey.slice(4) : modelKey;
  return FAHRZEUGTYP_IDS.has(raw) ? (raw as Fahrzeugtyp) : DEFAULT_FAHRZEUGTYP;
}

/** Persistenz-Wert (modelKey) fuer einen Fahrzeugtyp. */
export function modelKeyForFahrzeugtyp(typ: Fahrzeugtyp): string {
  return `typ:${typ}`;
}

// --- Kompakte Typ-Spezifikation (in Welt-Einheiten) ------------------------
// `mid`  = Mittellinien-/Vollbauteile (bereits fertige pos/size).
// `pair` = LINKE Seite je Bauteil-Basis (z. B. 'tuer_v'); die rechte Seite wird
//          durch Spiegeln der X-Achse erzeugt (-> 'tuer_vl'/'tuer_vr').
// `rundung` ∈ [0..1] steuert die Kantenrundung (1 = weich, ~0.55 = kantig/SUV).
type G = { pos: Vec3; size: Vec3 };
interface TypSpec {
  base: G;
  wheels: { r: number; y: number; fz: number; rz: number; x: number };
  mid: Record<string, G>;
  pair: Record<string, G>;
  shells?: G[];
  rundung: number;
}

const MID_IDS = [
  'stossfaenger_vorne',
  'motorhaube',
  'windschutzscheibe',
  'dach',
  'heckklappe',
  'stossfaenger_hinten',
] as const;

const PAIR_IDS = ['kotfluegel_v', 'tuer_v', 'tuer_h', 'seitenwand_h'] as const;

const GLASS_IDS = new Set(
  VEHICLE_PARTS.filter((p) => p.glass).map((p) => p.id),
);

// Kantenrundung aus Bauteilgroesse ableiten (nie groesser als die halbe
// kleinste Kante -> RoundedBox bleibt valide).
function panelRadius(size: Vec3, rundung: number): number {
  const min = Math.min(size[0], size[1], size[2]);
  return Math.min(min * 0.42, 0.07) * rundung;
}
function bodyRadius(size: Vec3, rundung: number): number {
  const min = Math.min(size[0], size[1], size[2]);
  return Math.min(min * 0.42, 0.24) * rundung;
}

function buildGeometry(spec: TypSpec): VehicleGeometry {
  const parts: Part[] = [];

  for (const id of MID_IDS) {
    const g = spec.mid[id];
    parts.push({
      id,
      pos: g.pos,
      size: g.size,
      glass: GLASS_IDS.has(canonicalPartId(id)),
      radius: panelRadius(g.size, spec.rundung),
    });
  }

  for (const key of PAIR_IDS) {
    const g = spec.pair[key];
    const glass = GLASS_IDS.has(canonicalPartId(`${key}l`));
    // Links (Spec) + gespiegelt rechts (X invertiert).
    parts.push({
      id: `${key}l`,
      pos: g.pos,
      size: g.size,
      glass,
      radius: panelRadius(g.size, spec.rundung),
    });
    parts.push({
      id: `${key}r`,
      pos: [-g.pos[0], g.pos[1], g.pos[2]],
      size: g.size,
      glass,
      radius: panelRadius(g.size, spec.rundung),
    });
  }

  const { r, y, fz, rz, x } = spec.wheels;
  const width = r * 0.68;
  const wheels: WheelSpec[] = [
    { x: -x, y, z: fz, r, width },
    { x, y, z: fz, r, width },
    { x: -x, y, z: rz, r, width },
    { x, y, z: rz, r, width },
  ];

  const shells: ShellSpec[] = (spec.shells ?? []).map((s) => ({
    pos: s.pos,
    size: s.size,
    radius: panelRadius(s.size, spec.rundung),
  }));

  return {
    base: {
      pos: spec.base.pos,
      size: spec.base.size,
      radius: bodyRadius(spec.base.size, spec.rundung),
    },
    parts,
    wheels,
    shells,
  };
}

// ===========================================================================
// Typ-Spezifikationen. LIMOUSINE ist 1:1 die bisherige Karosserie (Altdaten!).
// ===========================================================================
const SPECS: Record<Fahrzeugtyp, TypSpec> = {
  // --- Limousine: identisch zur bisherigen generischen Karosserie ---------
  limousine: {
    base: { pos: [0, 0.55, -0.1], size: [1.8, 0.55, 3.7] },
    wheels: { r: 0.32, y: 0.32, fz: 1.25, rz: -1.25, x: 0.95 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.35, 2.05], size: [1.9, 0.5, 0.35] },
      motorhaube: { pos: [0, 0.78, 1.35], size: [1.85, 0.18, 1.2] },
      windschutzscheibe: { pos: [0, 1.18, 0.75], size: [1.55, 0.7, 0.12] },
      dach: { pos: [0, 1.5, -0.1], size: [1.6, 0.14, 1.5] },
      heckklappe: { pos: [0, 0.95, -1.78], size: [1.7, 0.75, 0.14] },
      stossfaenger_hinten: { pos: [0, 0.35, -2.05], size: [1.9, 0.5, 0.35] },
    },
    pair: {
      kotfluegel_v: { pos: [-0.98, 0.6, 1.35], size: [0.12, 0.7, 1.0] },
      tuer_v: { pos: [-0.97, 0.78, 0.35], size: [0.1, 0.85, 0.9] },
      tuer_h: { pos: [-0.97, 0.78, -0.6], size: [0.1, 0.85, 0.9] },
      seitenwand_h: { pos: [-0.98, 0.7, -1.35], size: [0.12, 0.7, 0.9] },
    },
    rundung: 1.0,
  },

  // --- Kombi: langes Dach bis zum Heck, hohe Fondpartie, aufrechte Klappe --
  kombi: {
    base: { pos: [0, 0.56, -0.15], size: [1.8, 0.56, 3.95] },
    wheels: { r: 0.32, y: 0.32, fz: 1.3, rz: -1.4, x: 0.95 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.35, 2.15], size: [1.9, 0.5, 0.35] },
      motorhaube: { pos: [0, 0.78, 1.42], size: [1.85, 0.18, 1.25] },
      windschutzscheibe: { pos: [0, 1.2, 0.8], size: [1.56, 0.72, 0.12] },
      dach: { pos: [0, 1.52, -0.55], size: [1.62, 0.14, 2.35] },
      heckklappe: { pos: [0, 1.02, -2.02], size: [1.72, 1.1, 0.14] },
      stossfaenger_hinten: { pos: [0, 0.35, -2.18], size: [1.9, 0.5, 0.35] },
    },
    pair: {
      kotfluegel_v: { pos: [-0.98, 0.6, 1.42], size: [0.12, 0.72, 1.0] },
      tuer_v: { pos: [-0.97, 0.8, 0.4], size: [0.1, 0.88, 0.95] },
      tuer_h: { pos: [-0.97, 0.8, -0.6], size: [0.1, 0.88, 0.95] },
      seitenwand_h: { pos: [-0.98, 0.92, -1.5], size: [0.12, 1.02, 1.15] },
    },
    rundung: 0.9,
  },

  // --- SUV: hoch, kantig, grosse Raeder, aufrechte Front/Heck --------------
  suv: {
    base: { pos: [0, 0.76, -0.1], size: [1.84, 0.74, 3.8] },
    wheels: { r: 0.42, y: 0.42, fz: 1.32, rz: -1.34, x: 1.0 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.52, 2.12], size: [1.96, 0.66, 0.38] },
      motorhaube: { pos: [0, 1.04, 1.4], size: [1.88, 0.2, 1.15] },
      windschutzscheibe: { pos: [0, 1.52, 0.72], size: [1.62, 0.8, 0.14] },
      dach: { pos: [0, 1.92, -0.28], size: [1.72, 0.16, 2.05] },
      heckklappe: { pos: [0, 1.3, -1.92], size: [1.78, 1.12, 0.16] },
      stossfaenger_hinten: { pos: [0, 0.52, -2.12], size: [1.96, 0.66, 0.38] },
    },
    pair: {
      kotfluegel_v: { pos: [-1.0, 0.88, 1.4], size: [0.14, 0.92, 1.05] },
      tuer_v: { pos: [-0.99, 1.05, 0.35], size: [0.12, 1.05, 0.92] },
      tuer_h: { pos: [-0.99, 1.05, -0.62], size: [0.12, 1.05, 0.92] },
      seitenwand_h: { pos: [-1.0, 0.98, -1.35], size: [0.14, 0.98, 0.98] },
    },
    rundung: 0.55,
  },

  // --- Coupé: flach, lang, lange Motorhaube, kurze Dachlinie, 2-Tuerer -----
  coupe: {
    base: { pos: [0, 0.5, -0.05], size: [1.8, 0.5, 3.85] },
    wheels: { r: 0.35, y: 0.35, fz: 1.32, rz: -1.32, x: 0.97 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.34, 2.16], size: [1.9, 0.48, 0.34] },
      motorhaube: { pos: [0, 0.74, 1.5], size: [1.86, 0.16, 1.35] },
      windschutzscheibe: { pos: [0, 1.12, 0.72], size: [1.5, 0.66, 0.16] },
      dach: { pos: [0, 1.36, 0.02], size: [1.5, 0.12, 1.25] },
      heckklappe: { pos: [0, 0.86, -1.82], size: [1.66, 0.7, 0.16] },
      stossfaenger_hinten: { pos: [0, 0.34, -2.16], size: [1.9, 0.48, 0.34] },
    },
    pair: {
      kotfluegel_v: { pos: [-0.98, 0.56, 1.45], size: [0.12, 0.66, 1.05] },
      // Lange, einzelne Tuer (2-Tuerer-Silhouette).
      tuer_v: { pos: [-0.97, 0.74, 0.45], size: [0.1, 0.8, 1.25] },
      // Kleine hintere Seitenpartie statt vollwertiger Fondtuer.
      tuer_h: { pos: [-0.97, 0.66, -0.75], size: [0.1, 0.6, 0.6] },
      seitenwand_h: { pos: [-0.98, 0.66, -1.4], size: [0.12, 0.66, 0.95] },
    },
    rundung: 1.0,
  },

  // --- Kompakt/Kleinwagen: kurz, kurze Haube, aufrechte Heckklappe ---------
  kompakt: {
    base: { pos: [0, 0.54, 0.0], size: [1.74, 0.54, 3.15] },
    wheels: { r: 0.3, y: 0.3, fz: 1.05, rz: -1.05, x: 0.92 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.34, 1.75], size: [1.82, 0.48, 0.32] },
      motorhaube: { pos: [0, 0.76, 1.2], size: [1.78, 0.16, 0.85] },
      windschutzscheibe: { pos: [0, 1.16, 0.68], size: [1.5, 0.66, 0.12] },
      dach: { pos: [0, 1.5, -0.12], size: [1.54, 0.14, 1.35] },
      heckklappe: { pos: [0, 1.0, -1.5], size: [1.64, 0.95, 0.14] },
      stossfaenger_hinten: { pos: [0, 0.34, -1.72], size: [1.82, 0.48, 0.32] },
    },
    pair: {
      kotfluegel_v: { pos: [-0.95, 0.58, 1.2], size: [0.12, 0.66, 0.85] },
      tuer_v: { pos: [-0.94, 0.78, 0.35], size: [0.1, 0.82, 0.85] },
      tuer_h: { pos: [-0.94, 0.78, -0.55], size: [0.1, 0.82, 0.8] },
      seitenwand_h: { pos: [-0.95, 0.72, -1.15], size: [0.12, 0.7, 0.7] },
    },
    rundung: 1.0,
  },

  // --- Transporter/Van: hoch + lang, kurze steile Nase, hohes langes Dach --
  transporter: {
    base: { pos: [0, 0.88, -0.15], size: [1.86, 1.2, 4.0] },
    wheels: { r: 0.36, y: 0.36, fz: 1.45, rz: -1.4, x: 0.97 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.42, 2.2], size: [1.92, 0.6, 0.36] },
      motorhaube: { pos: [0, 1.0, 1.9], size: [1.88, 0.5, 0.4] },
      windschutzscheibe: { pos: [0, 1.55, 1.62], size: [1.7, 0.9, 0.16] },
      dach: { pos: [0, 2.02, -0.3], size: [1.74, 0.16, 3.0] },
      heckklappe: { pos: [0, 1.25, -2.15], size: [1.8, 1.6, 0.15] },
      stossfaenger_hinten: { pos: [0, 0.42, -2.15], size: [1.92, 0.6, 0.36] },
    },
    pair: {
      kotfluegel_v: { pos: [-1.0, 0.75, 1.75], size: [0.14, 0.9, 0.7] },
      tuer_v: { pos: [-0.99, 1.05, 0.9], size: [0.12, 1.4, 0.9] },
      tuer_h: { pos: [-0.99, 1.05, -0.5], size: [0.12, 1.5, 1.6] },
      seitenwand_h: { pos: [-1.0, 1.1, -1.75], size: [0.14, 1.5, 0.8] },
    },
    rundung: 0.55,
  },

  // --- Pickup: hohe Fahrerkabine vorn + offene Ladeflaeche hinten ----------
  pickup: {
    base: { pos: [0, 0.62, -0.05], size: [1.8, 0.5, 3.9] },
    wheels: { r: 0.4, y: 0.4, fz: 1.3, rz: -1.35, x: 0.98 },
    mid: {
      stossfaenger_vorne: { pos: [0, 0.5, 2.12], size: [1.94, 0.62, 0.38] },
      motorhaube: { pos: [0, 1.0, 1.4], size: [1.88, 0.2, 1.15] },
      windschutzscheibe: { pos: [0, 1.45, 0.78], size: [1.6, 0.72, 0.15] },
      // Dach nur ueber der vorderen Kabine.
      dach: { pos: [0, 1.72, 0.35], size: [1.62, 0.15, 1.0] },
      // Niedrige Heckklappe am Ende der Ladeflaeche.
      heckklappe: { pos: [0, 0.78, -1.92], size: [1.72, 0.55, 0.12] },
      stossfaenger_hinten: { pos: [0, 0.5, -2.12], size: [1.94, 0.62, 0.38] },
    },
    pair: {
      kotfluegel_v: { pos: [-1.0, 0.85, 1.4], size: [0.14, 0.9, 1.05] },
      tuer_v: { pos: [-0.99, 1.0, 0.5], size: [0.12, 0.95, 0.95] },
      // Kleine hintere Kabinentuer (Doppelkabine).
      tuer_h: { pos: [-0.99, 0.98, -0.35], size: [0.12, 0.9, 0.6] },
      // Niedrige, lange Ladeflaechen-Seitenwand.
      seitenwand_h: { pos: [-1.0, 0.72, -1.3], size: [0.14, 0.5, 1.25] },
    },
    // Ladeflaechen-Boden + Kabinenrueckwand (Deko).
    shells: [
      { pos: [0, 0.6, -1.3], size: [1.7, 0.12, 1.3] },
      { pos: [0, 1.1, -0.05], size: [1.6, 0.9, 0.12] },
    ],
    rundung: 0.6,
  },
};

// Geometrie je Typ einmalig bauen (rein statisch) und cachen.
const GEOMETRY_CACHE = new Map<Fahrzeugtyp, VehicleGeometry>();

/** Vollstaendige, prozedurale Karosserie-Geometrie fuer einen Fahrzeugtyp. */
export function getVehicleGeometry(typ: Fahrzeugtyp): VehicleGeometry {
  const key = FAHRZEUGTYP_IDS.has(typ) ? typ : DEFAULT_FAHRZEUGTYP;
  let geo = GEOMETRY_CACHE.get(key);
  if (!geo) {
    geo = buildGeometry(SPECS[key]);
    GEOMETRY_CACHE.set(key, geo);
  }
  return geo;
}

// --- Rueckwaertskompatible Exporte (Limousine-Default) ---------------------
// Bestandscode, der PARTS/WHEELS direkt referenziert, bleibt lauffaehig.
const DEFAULT_GEOMETRY = getVehicleGeometry(DEFAULT_FAHRZEUGTYP);
export const PARTS: Part[] = DEFAULT_GEOMETRY.parts;
export const WHEELS: Vec3[] = DEFAULT_GEOMETRY.wheels.map((w) => [w.x, w.y, w.z]);
