'use client';

import { useRef } from 'react';
import type { SchadensMarker } from '@/lib/types';
import { SCHWEREGRAD_COLOR } from '@/lib/labels';
import { partLabel } from '@/lib/vehicle-parts';

// Eigens gezeichnete Fahrzeug-Silhouetten (Draufsicht + linke/rechte Seite).
// Reine SVG-Pfade – keine externe Grafik-Bibliothek.

type Ansicht = 'oben' | 'links' | 'rechts';

// labelKey verweist auf den i18n-Namespace; die Auflösung (t()) erfolgt im
// konsumierenden Client-Component (fahrzeugannahme/page.tsx).
export const ANSICHTEN: { key: Ansicht; labelKey: string }[] = [
  { key: 'oben', labelKey: 'fahrzeugannahme.ansicht.oben' },
  { key: 'links', labelKey: 'fahrzeugannahme.ansicht.links' },
  { key: 'rechts', labelKey: 'fahrzeugannahme.ansicht.rechts' },
];

// Anklickbare Zonen je Ansicht. Die `id` ist die KANONISCHE partId aus
// lib/vehicle-parts.ts (fuer den Tooltip liefert partLabel() das deutsche
// Label) – so teilen 2D-Annahme, 2D-Fallback und 3D dieselbe Taxonomie.
// `d` ist die 2D-Geometrie (rein layout-spezifisch, bleibt lokal). Koordinaten
// im 100×100-viewBox, damit Marker in Prozent passen.
//
// Hinweis Rueckwaertskompatibilitaet: Alt-Marker tragen im `zone`-Feld die
// frueheren Bezeichner (z. B. `stossstange_v`). Sie werden NICHT gerendert-
// abhaengig ausgewertet (Marker positionieren sich ueber x/y/ansicht) und via
// PART_ID_ALIASES weiterhin korrekt aufgeloest, falls das Label je gezeigt wird.
type Zone = { id: string; d: string };

const ZONEN: Record<Ansicht, Zone[]> = {
  oben: [
    { id: 'stossfaenger_vorne', d: 'M30 6 H70 V14 H30 Z' },
    { id: 'motorhaube', d: 'M30 14 H70 V30 H30 Z' },
    { id: 'dach', d: 'M32 40 H68 V64 H32 Z' },
    { id: 'windschutzscheibe', d: 'M30 30 H70 V40 H30 Z' },
    { id: 'heckscheibe', d: 'M30 64 H70 V74 H30 Z' },
    { id: 'heckklappe', d: 'M30 74 H70 V86 H30 Z' },
    { id: 'stossfaenger_hinten', d: 'M30 86 H70 V94 H30 Z' },
    { id: 'kotfluegel_vl', d: 'M18 14 H30 V34 H18 Z' },
    { id: 'kotfluegel_vr', d: 'M70 14 H82 V34 H70 Z' },
    { id: 'tuer_vl', d: 'M18 34 H30 V54 H18 Z' },
    { id: 'tuer_vr', d: 'M70 34 H82 V54 H70 Z' },
    { id: 'tuer_hl', d: 'M18 54 H30 V74 H18 Z' },
    { id: 'tuer_hr', d: 'M70 54 H82 V74 H70 Z' },
    { id: 'seitenwand_hl', d: 'M18 74 H30 V88 H18 Z' },
    { id: 'seitenwand_hr', d: 'M70 74 H82 V88 H70 Z' },
  ],
  links: [
    { id: 'stossfaenger_vorne', d: 'M4 50 H14 V70 H4 Z' },
    { id: 'kotfluegel_vl', d: 'M14 48 H30 V72 H14 Z' },
    { id: 'tuer_vl', d: 'M30 46 H52 V72 H30 Z' },
    { id: 'tuer_hl', d: 'M52 46 H72 V72 H52 Z' },
    { id: 'seitenscheibe_l', d: 'M32 30 H70 V46 H32 Z' },
    { id: 'dach', d: 'M34 22 H66 V30 H34 Z' },
    { id: 'seitenwand_hl', d: 'M72 48 H88 V72 H72 Z' },
    { id: 'stossfaenger_hinten', d: 'M88 50 H96 V70 H88 Z' },
    { id: 'schweller_l', d: 'M16 72 H86 V78 H16 Z' },
    { id: 'aussenspiegel_l', d: 'M28 40 H34 V46 H28 Z' },
  ],
  rechts: [
    { id: 'stossfaenger_hinten', d: 'M4 50 H14 V70 H4 Z' },
    { id: 'seitenwand_hr', d: 'M14 48 H30 V72 H14 Z' },
    { id: 'tuer_hr', d: 'M30 46 H52 V72 H30 Z' },
    { id: 'tuer_vr', d: 'M52 46 H72 V72 H52 Z' },
    { id: 'seitenscheibe_r', d: 'M32 30 H70 V46 H32 Z' },
    { id: 'dach', d: 'M34 22 H66 V30 H34 Z' },
    { id: 'kotfluegel_vr', d: 'M72 48 H88 V72 H72 Z' },
    { id: 'stossfaenger_vorne', d: 'M88 50 H96 V70 H88 Z' },
    { id: 'schweller_r', d: 'M16 72 H86 V78 H16 Z' },
    { id: 'aussenspiegel_r', d: 'M66 40 H72 V46 H66 Z' },
  ],
};

// Aeussere Silhouette (Kontur) je Ansicht – rein dekorativ.
const KONTUR: Record<Ansicht, string> = {
  oben: 'M28 6 Q50 2 72 6 Q84 10 84 28 L84 86 Q84 96 72 96 L28 96 Q16 96 16 86 L16 28 Q16 10 28 6 Z',
  links:
    'M4 70 Q4 48 14 46 L30 44 Q32 24 50 24 L62 24 Q70 24 74 46 L92 48 Q96 50 96 70 L96 74 Q96 80 90 80 L12 80 Q4 80 4 74 Z',
  rechts:
    'M4 70 Q4 48 14 46 L30 44 Q34 24 50 24 L62 24 Q80 24 86 46 L92 48 Q96 50 96 70 L96 74 Q96 80 90 80 L12 80 Q4 80 4 74 Z',
};

export function FahrzeugDiagramm({
  ansicht,
  marker,
  onAdd,
  onMarkerClick,
  aktiverMarkerId,
}: {
  ansicht: Ansicht;
  marker: SchadensMarker[];
  onAdd: (x: number, y: number, zone?: string) => void;
  onMarkerClick?: (id: string) => void;
  aktiverMarkerId?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Klick auf die Zeichenflaeche -> Position in Prozent ermitteln und Marker setzen.
  // Nimmt nur die Maus-Koordinaten entgegen, damit Klicks auf SVG und Zonen-Pfade
  // gleich behandelt werden koennen.
  function handleClick(e: { clientX: number; clientY: number }, zone?: string) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onAdd(Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y)), zone);
  }

  const sichtbar = marker.filter((m) => m.ansicht === ansicht);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className="h-full w-full cursor-crosshair select-none"
      onClick={(e) => handleClick(e)}
    >
      {/* Kontur – theme-faehig (dunkle Flaeche im Dark-, helle im Light-Modus). */}
      <path
        d={KONTUR[ansicht]}
        style={{ fill: 'rgb(var(--ink-750))', stroke: 'rgb(var(--ink-600))' }}
        strokeWidth="0.8"
      />
      {/* Anklickbare Zonen */}
      {ZONEN[ansicht].map((z) => (
        <path
          key={z.id}
          d={z.d}
          fill="transparent"
          style={{ stroke: 'rgb(var(--ink-600))' }}
          strokeWidth="0.4"
          className="transition-colors hover:fill-copper/15"
          onClick={(e) => {
            e.stopPropagation();
            handleClick(e, z.id);
          }}
        >
          <title>{partLabel(z.id)}</title>
        </path>
      ))}
      {/* Schadensmarker */}
      {sichtbar.map((m) => {
        const aktiv = m.id === aktiverMarkerId;
        return (
          <g
            key={m.id}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick?.(m.id);
            }}
            className="cursor-pointer"
          >
            <circle
              cx={m.x}
              cy={m.y}
              r={aktiv ? 3.4 : 2.6}
              style={{
                fill: SCHWEREGRAD_COLOR[m.schweregrad] ?? 'rgb(var(--copper-500))',
                stroke: 'rgb(var(--ink-900))',
              }}
              strokeWidth="0.6"
            />
            {aktiv && (
              <circle
                cx={m.x}
                cy={m.y}
                r={5}
                fill="none"
                style={{ stroke: SCHWEREGRAD_COLOR[m.schweregrad] ?? 'rgb(var(--copper-500))' }}
                strokeWidth="0.6"
                opacity="0.6"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export type { Ansicht };
