// Geteilte 3D-Karosserie-Geometrie fuer die R3F-Szenen (Schadensviewer +
// Schichtdicke-Heatmap). EINE Quelle der Wahrheit, damit beide Szenen nie
// divergieren (Lektion aus lib/vehicle-parts.ts). Reiner Verschiebe-Refactor
// aus Scene3D.tsx – KEINE Verhaltensaenderung: mesh.name === partId bleibt die
// fachliche Wahrheit, Positionen/Groessen sind unveraendert.

import { VEHICLE_PARTS } from '@/lib/vehicle-parts';

// --- Karosserie-Lackton (neutral, damit Kupfer der einzige Akzent bleibt) ---
export const BODY_COLOR = '#3a4456';
export const GLASS_COLOR = '#1b2230';

// Ein klickbares Karosserie-Bauteil. position/size in Welt-Einheiten.
export type Part = {
  id: string;
  pos: [number, number, number];
  size: [number, number, number];
  glass?: boolean;
};

// 3D-Geometrie je Bauteil (pos/size in Welt-Einheiten). Rein rendering-spezifisch
// – die fachliche Wahrheit (welche partIds existieren, Labels, Glas-Flag) kommt
// aus lib/vehicle-parts.ts. Nur die im 3D-Modell dargestellten Bauteile sind hier
// vertreten (das 3D-Auto zeigt z. B. keine Seitenscheiben).
export const PART_GEOMETRY: Record<
  string,
  { pos: [number, number, number]; size: [number, number, number] }
> = {
  // Front
  stossfaenger_vorne: { pos: [0, 0.35, 2.05], size: [1.9, 0.5, 0.35] },
  motorhaube: { pos: [0, 0.78, 1.35], size: [1.85, 0.18, 1.2] },
  kotfluegel_vl: { pos: [-0.98, 0.6, 1.35], size: [0.12, 0.7, 1.0] },
  kotfluegel_vr: { pos: [0.98, 0.6, 1.35], size: [0.12, 0.7, 1.0] },
  // Dach + Scheibe
  windschutzscheibe: { pos: [0, 1.18, 0.75], size: [1.55, 0.7, 0.12] },
  dach: { pos: [0, 1.5, -0.1], size: [1.6, 0.14, 1.5] },
  // Tueren
  tuer_vl: { pos: [-0.97, 0.78, 0.35], size: [0.1, 0.85, 0.9] },
  tuer_vr: { pos: [0.97, 0.78, 0.35], size: [0.1, 0.85, 0.9] },
  tuer_hl: { pos: [-0.97, 0.78, -0.6], size: [0.1, 0.85, 0.9] },
  tuer_hr: { pos: [0.97, 0.78, -0.6], size: [0.1, 0.85, 0.9] },
  // Seitenwand hinten
  seitenwand_hl: { pos: [-0.98, 0.7, -1.35], size: [0.12, 0.7, 0.9] },
  seitenwand_hr: { pos: [0.98, 0.7, -1.35], size: [0.12, 0.7, 0.9] },
  // Heck
  heckklappe: { pos: [0, 0.95, -1.78], size: [1.7, 0.75, 0.14] },
  stossfaenger_hinten: { pos: [0, 0.35, -2.05], size: [1.9, 0.5, 0.35] },
};

// Klickbare Karosserie: von der kanonischen Taxonomie getrieben (Reihenfolge,
// Existenz, Glas-Flag), nur die Geometrie kommt aus PART_GEOMETRY. So bleibt die
// partId (= mesh.name) die fachliche Wahrheit und deckt sich mit den anderen
// Konsumenten.
export const PARTS: Part[] = VEHICLE_PARTS.filter((p) => PART_GEOMETRY[p.id]).map((p) => ({
  id: p.id,
  glass: p.glass,
  ...PART_GEOMETRY[p.id],
}));

// Raeder (reine Deko, nicht klickbar).
export const WHEELS: [number, number, number][] = [
  [-0.95, 0.32, 1.25],
  [0.95, 0.32, 1.25],
  [-0.95, 0.32, -1.25],
  [0.95, 0.32, -1.25],
];
