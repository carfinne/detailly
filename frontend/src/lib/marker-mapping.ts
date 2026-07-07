// Zentrale Abbildung eines 2D-Schadensmarkers (Fahrzeugannahme) auf den
// Feldsatz eines DamageItem (Inspektions-API, positionMode='2d').
//
// EINE Quelle der Wahrheit fuer das Frontend-Mapping – dasselbe Schema, das der
// serverseitige Datenumzug (vehicle_intakes -> damage_items) verwendet. Wird die
// Abbildung hier geaendert, muss das Migrationsskript identisch nachgezogen werden.
//
// Kontrakt (CreateDamageItemDto): partId ist bei 2D optional – ein Marker hat nur
// eine `zone` (Bauteilname) und wird NICHT mit partId gesendet; der Service
// defaultet fehlende partId serverseitig auf ansicht2d/'unbekannt'.

import type { SchadensMarker, DamageArt, DamageSchweregrad } from './types';

// Die 2D-Annahme erzeugt nur eine Teilmenge der 10 DamageArt-Werte
// (kratzer|delle|steinschlag|lackschaden|rost|sonstiges). Unbekannte Werte
// (z. B. aus Altbestand) werden defensiv auf 'sonstiges' gemappt, damit ein
// Item-POST nie am Enum-Constraint scheitert.
const DAMAGE_ARTEN: readonly DamageArt[] = [
  'kratzer',
  'delle',
  'steinschlag',
  'lackschaden',
  'rost',
  'riss',
  'bruch',
  'verzogen',
  'fehlteil',
  'sonstiges',
];

const DAMAGE_GRADE: readonly DamageSchweregrad[] = ['leicht', 'mittel', 'schwer'];

function normArt(art: string): DamageArt {
  return (DAMAGE_ARTEN as readonly string[]).includes(art) ? (art as DamageArt) : 'sonstiges';
}

function normGrad(grad: string): DamageSchweregrad {
  return (DAMAGE_GRADE as readonly string[]).includes(grad)
    ? (grad as DamageSchweregrad)
    : 'mittel';
}

/**
 * Baut den POST-Body fuer `POST /inspections/:id/items` aus einem 2D-Marker.
 * `clientUuid` traegt die Marker-ID als Idempotenz-Schluessel (gefahrloser
 * Re-Sync bei Teil-Fehlern). `partId` wird bewusst weggelassen (2D-Fall).
 */
export function markerZuDamageItem(m: SchadensMarker): Record<string, unknown> {
  return {
    positionMode: '2d',
    ansicht2d: m.ansicht,
    x2d: m.x,
    y2d: m.y,
    // partLabel traegt die Zone als lesbaren Bauteilnamen (falls gesetzt).
    ...(m.zone ? { partLabel: m.zone } : {}),
    origin: 'neu',
    art: normArt(m.art),
    schweregrad: normGrad(m.schweregrad),
    ...(m.notiz ? { notiz: m.notiz } : {}),
    clientUuid: m.id,
  };
}
