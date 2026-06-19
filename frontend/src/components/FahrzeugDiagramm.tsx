'use client';

import { useRef } from 'react';
import type { SchadensMarker } from '@/lib/types';
import { SCHWEREGRAD_COLOR } from '@/lib/labels';

// Eigens gezeichnete Fahrzeug-Silhouetten (Draufsicht + linke/rechte Seite).
// Reine SVG-Pfade – keine externe Grafik-Bibliothek.

type Ansicht = 'oben' | 'links' | 'rechts';

export const ANSICHTEN: { key: Ansicht; label: string }[] = [
  { key: 'oben', label: 'Draufsicht' },
  { key: 'links', label: 'Linke Seite' },
  { key: 'rechts', label: 'Rechte Seite' },
];

// Anklickbare Zonen je Ansicht (Beschriftung erscheint als Titel/Tooltip).
// Koordinaten im 100×100-Koordinatensystem (viewBox), damit Marker in Prozent passen.
type Zone = { id: string; label: string; d: string };

const ZONEN: Record<Ansicht, Zone[]> = {
  oben: [
    { id: 'stossstange_v', label: 'Stoßstange vorne', d: 'M30 6 H70 V14 H30 Z' },
    { id: 'motorhaube', label: 'Motorhaube', d: 'M30 14 H70 V30 H30 Z' },
    { id: 'dach', label: 'Dach', d: 'M32 40 H68 V64 H32 Z' },
    { id: 'windschutz', label: 'Windschutzscheibe', d: 'M30 30 H70 V40 H30 Z' },
    { id: 'heckscheibe', label: 'Heckscheibe', d: 'M30 64 H70 V74 H30 Z' },
    { id: 'heckklappe', label: 'Heckklappe', d: 'M30 74 H70 V86 H30 Z' },
    { id: 'stossstange_h', label: 'Stoßstange hinten', d: 'M30 86 H70 V94 H30 Z' },
    { id: 'kotfluegel_vl', label: 'Kotflügel vorne links', d: 'M18 14 H30 V34 H18 Z' },
    { id: 'kotfluegel_vr', label: 'Kotflügel vorne rechts', d: 'M70 14 H82 V34 H70 Z' },
    { id: 'tuer_vl', label: 'Tür vorne links', d: 'M18 34 H30 V54 H18 Z' },
    { id: 'tuer_vr', label: 'Tür vorne rechts', d: 'M70 34 H82 V54 H70 Z' },
    { id: 'tuer_hl', label: 'Tür hinten links', d: 'M18 54 H30 V74 H18 Z' },
    { id: 'tuer_hr', label: 'Tür hinten rechts', d: 'M70 54 H82 V74 H70 Z' },
    { id: 'kotfluegel_hl', label: 'Kotflügel hinten links', d: 'M18 74 H30 V88 H18 Z' },
    { id: 'kotfluegel_hr', label: 'Kotflügel hinten rechts', d: 'M70 74 H82 V88 H70 Z' },
  ],
  links: [
    { id: 'stossstange_v', label: 'Stoßstange vorne', d: 'M4 50 H14 V70 H4 Z' },
    { id: 'kotfluegel_vl', label: 'Kotflügel vorne', d: 'M14 48 H30 V72 H14 Z' },
    { id: 'tuer_vl', label: 'Vordertür', d: 'M30 46 H52 V72 H30 Z' },
    { id: 'tuer_hl', label: 'Hintertür', d: 'M52 46 H72 V72 H52 Z' },
    { id: 'fenster_l', label: 'Seitenfenster', d: 'M32 30 H70 V46 H32 Z' },
    { id: 'dach', label: 'Dach', d: 'M34 22 H66 V30 H34 Z' },
    { id: 'kotfluegel_hl', label: 'Kotflügel hinten', d: 'M72 48 H88 V72 H72 Z' },
    { id: 'stossstange_h', label: 'Stoßstange hinten', d: 'M88 50 H96 V70 H88 Z' },
    { id: 'schweller_l', label: 'Schweller', d: 'M16 72 H86 V78 H16 Z' },
    { id: 'spiegel_l', label: 'Außenspiegel', d: 'M28 40 H34 V46 H28 Z' },
  ],
  rechts: [
    { id: 'stossstange_h', label: 'Stoßstange hinten', d: 'M4 50 H14 V70 H4 Z' },
    { id: 'kotfluegel_hr', label: 'Kotflügel hinten', d: 'M14 48 H30 V72 H14 Z' },
    { id: 'tuer_hr', label: 'Hintertür', d: 'M30 46 H52 V72 H30 Z' },
    { id: 'tuer_vr', label: 'Vordertür', d: 'M52 46 H72 V72 H52 Z' },
    { id: 'fenster_r', label: 'Seitenfenster', d: 'M32 30 H70 V46 H32 Z' },
    { id: 'dach', label: 'Dach', d: 'M34 22 H66 V30 H34 Z' },
    { id: 'kotfluegel_vr', label: 'Kotflügel vorne', d: 'M72 48 H88 V72 H72 Z' },
    { id: 'stossstange_v', label: 'Stoßstange vorne', d: 'M88 50 H96 V70 H88 Z' },
    { id: 'schweller_r', label: 'Schweller', d: 'M16 72 H86 V78 H16 Z' },
    { id: 'spiegel_r', label: 'Außenspiegel', d: 'M66 40 H72 V46 H66 Z' },
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
      {/* Kontur */}
      <path
        d={KONTUR[ansicht]}
        fill="#1b2230"
        stroke="#3a4456"
        strokeWidth="0.8"
      />
      {/* Anklickbare Zonen */}
      {ZONEN[ansicht].map((z) => (
        <path
          key={z.id}
          d={z.d}
          fill="transparent"
          stroke="#2c3545"
          strokeWidth="0.4"
          className="transition-colors hover:fill-copper/15"
          onClick={(e) => {
            e.stopPropagation();
            handleClick(e, z.id);
          }}
        >
          <title>{z.label}</title>
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
              fill={SCHWEREGRAD_COLOR[m.schweregrad] ?? '#E8923B'}
              stroke="#0b0d11"
              strokeWidth="0.6"
            />
            {aktiv && (
              <circle
                cx={m.x}
                cy={m.y}
                r={5}
                fill="none"
                stroke={SCHWEREGRAD_COLOR[m.schweregrad] ?? '#E8923B'}
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
