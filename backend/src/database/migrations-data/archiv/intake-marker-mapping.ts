/**
 * Reine (DB-freie) Abbildungs-Logik `SchadensMarker` -> `DamageItem`-Feldsatz
 * fuer den Intake->Inspection-Datenumzug. Bewusst ohne TypeORM/DataSource, damit
 * sie DB-frei unit-testbar ist (Enum-Validierung ist der kritische Pfad).
 *
 * REVIEW §3: Alt-`art`/`schweregrad` sind ungeprueftes Freitext (Intake-DTO nutzte
 * `@IsString()`). Unbekannte Werte wuerden beim Insert den Postgres-enum/CHECK-
 * Constraint verletzen und das Skript MITTEN im Lauf abbrechen. Deshalb werden sie
 * hier gegen die erlaubten Enums validiert, unbekannte auf `sonstiges`/`mittel`
 * gemappt und der Originalwert in `notiz` protokolliert.
 */
import {
  DamageArt,
  DamageSchweregrad,
} from '../../../inspection/entities/damage-item.entity';

/** Struktur eines Alt-Markers (Kopie aus vehicle-intake.entity.ts, bewusst lokal
 *  gehalten, damit dieses Modul nach der Intake-Loeschung importfrei bleibt). */
export interface IntakeMarker {
  id: string;
  ansicht: string;
  x: number;
  y: number;
  zone?: string;
  art: string;
  schweregrad: string;
  notiz?: string;
}

/** Erlaubte Zielwerte, 1:1 aus dem DamageItem-Enum (Single Source of Truth). */
export const ERLAUBTE_ART: readonly DamageArt[] = [
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
export const ERLAUBTE_SCHWEREGRAD: readonly DamageSchweregrad[] = [
  'leicht',
  'mittel',
  'schwer',
];

/** Fallbacks fuer unbekannte Alt-Werte (REVIEW §3). */
export const ART_FALLBACK: DamageArt = 'sonstiges';
export const SCHWEREGRAD_FALLBACK: DamageSchweregrad = 'mittel';

/** Der aus einem Marker erzeugte, direkt insertbare DamageItem-Feldsatz. */
export interface MappedDamageItemFields {
  partId: string;
  partLabel: string | null;
  positionMode: '2d';
  ansicht2d: string | null;
  x2d: number | null;
  y2d: number | null;
  origin: 'neu';
  art: DamageArt;
  schweregrad: DamageSchweregrad;
  status: 'offen';
  notiz: string | null;
  /** true, wenn art/schweregrad auf einen Fallback gemappt wurde (Report-Zaehler). */
  wurdeGemappt: boolean;
}

/**
 * Bildet einen Alt-Marker auf einen vollstaendigen DamageItem-Feldsatz ab.
 *
 * REVIEW §3(a): ALLE Zielwerte werden EXPLIZIT gesetzt (`positionMode='2d'`,
 * `origin='neu'`, `status='offen'`) – nie auf Entity-Defaults verlassen, weil das
 * Skript direkt ueber die DataSource inserted (Default `positionMode='3d'` wuerde
 * sonst greifen und die 2D-Koordinaten unrenderbar machen).
 * REVIEW §3(b): `art`/`schweregrad` gegen die Enums validiert; unbekannte -> Fallback,
 * Original in `notiz` protokolliert.
 */
export function mapMarkerToDamageItemFields(marker: IntakeMarker): MappedDamageItemFields {
  const artGueltig = ERLAUBTE_ART.includes(marker.art as DamageArt);
  const schweregradGueltig = ERLAUBTE_SCHWEREGRAD.includes(
    marker.schweregrad as DamageSchweregrad,
  );

  const art: DamageArt = artGueltig ? (marker.art as DamageArt) : ART_FALLBACK;
  const schweregrad: DamageSchweregrad = schweregradGueltig
    ? (marker.schweregrad as DamageSchweregrad)
    : SCHWEREGRAD_FALLBACK;

  // Original-Freitextwerte im Klartext protokollieren, wenn gemappt wurde.
  const protokoll: string[] = [];
  if (!artGueltig) protokoll.push(`Original-Art: "${marker.art}"`);
  if (!schweregradGueltig) protokoll.push(`Original-Schweregrad: "${marker.schweregrad}"`);

  const bestehendeNotiz = (marker.notiz ?? '').trim();
  const notizTeile = [bestehendeNotiz, ...protokoll].filter((t) => t.length > 0);
  const notiz = notizTeile.length ? notizTeile.join(' | ') : null;

  // zone -> partId/partLabel (fachliche Verankerung, robust gegen Modellwechsel).
  const zone = marker.zone && marker.zone.trim().length ? marker.zone.trim() : null;

  return {
    partId: zone ?? 'unbekannt',
    partLabel: zone,
    positionMode: '2d',
    ansicht2d: marker.ansicht ?? null,
    x2d: typeof marker.x === 'number' ? marker.x : null,
    y2d: typeof marker.y === 'number' ? marker.y : null,
    origin: 'neu',
    art,
    schweregrad,
    status: 'offen',
    notiz,
    wurdeGemappt: !artGueltig || !schweregradGueltig,
  };
}

/** Deterministischer Idempotenz-Schluessel je Inspektion (aus einem Intake). */
export const inspectionClientUuid = (intakeId: string): string => `intake:${intakeId}`;

/**
 * Deterministischer, KOLLISIONSSICHERER Idempotenz-Schluessel je DamageItem.
 *
 * Der stabile Array-Index (`idx`) des Markers geht IMMER in den Schluessel ein.
 * Grund (Review-Fix): zwei id-lose Marker auf exakt gleicher Ansicht+Position
 * wuerden sonst denselben Fallback-Schluessel bilden -> der zweite wuerde beim
 * Re-Run als "vorhanden" uebersprungen und ein migrierter Schaden fehlte (stiller
 * Datenverlust). Die JSON-Array-Reihenfolge ist stabil, also ist der Index
 * idempotenzsicher. Hat der Marker eine `id`, wird sie als lesbarer Zusatz
 * angehaengt (Nachvollziehbarkeit), aendert aber die Eindeutigkeit nicht.
 */
export const itemClientUuid = (intakeId: string, idx: number, markerId?: string): string => {
  const suffix = markerId && String(markerId).length ? `${idx}_${markerId}` : `${idx}`;
  return `intake:${intakeId}:${suffix}`;
};
