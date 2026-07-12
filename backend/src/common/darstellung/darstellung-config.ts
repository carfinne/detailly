/**
 * Darstellungs-Einstellungen der Plantafel je Betrieb. Wird im JSON
 * `tenant.settings` unter dem Schluessel `darstellung` abgelegt und ueber den
 * bestehenden Settings-GET/PATCH gelesen/geschrieben (analog `kalkulation`).
 *
 * Der Lese-Pfad (`resolveDarstellung`) ist defensiv: fehlende/ungueltige Werte
 * fallen je Feld auf die Defaults zurueck; die felduebergreifende Invariante
 * (Endstunde > Startstunde) wird beim Aufloesen/Mergen erzwungen.
 */

export type Wochenstart = 'montag' | 'sonntag';
export type Zeitformat = '24h' | '12h';

export interface DarstellungConfig {
  wochenstart: Wochenstart;
  zeitformat: Zeitformat;
  /** Erste sichtbare Stunde der Plantafel (0..23). */
  kalenderStartStunde: number;
  /** Letzte sichtbare Stunde der Plantafel (1..24, immer > Startstunde). */
  kalenderEndStunde: number;
}

/** Plausible Grenzen (auch in der DTO-Validierung gespiegelt). */
export const START_STUNDE_MIN = 0;
export const START_STUNDE_MAX = 23;
export const END_STUNDE_MIN = 1;
export const END_STUNDE_MAX = 24;

export const DARSTELLUNG_DEFAULTS: DarstellungConfig = {
  wochenstart: 'montag',
  zeitformat: '24h',
  kalenderStartStunde: 7,
  kalenderEndStunde: 19,
};

function toStunde(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Normalisiert Start-/Endstunde: beide werden in ihren Bereich geklammert und die
 * Invariante Endstunde > Startstunde wird erzwungen (sonst Endstunde = Start + 1,
 * gedeckelt auf END_STUNDE_MAX).
 */
function normalizeStunden(startRaw: number, endRaw: number): { start: number; end: number } {
  const start = Math.min(START_STUNDE_MAX, Math.max(START_STUNDE_MIN, Math.round(startRaw)));
  let end = Math.min(END_STUNDE_MAX, Math.max(END_STUNDE_MIN, Math.round(endRaw)));
  if (end <= start) end = Math.min(END_STUNDE_MAX, start + 1);
  return { start, end };
}

/**
 * Liest die Darstellungs-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.darstellung). Fehlende/ungueltige Keys fallen je Feld auf die
 * Defaults zurueck; wirft NIE.
 */
export function resolveDarstellung(raw: unknown): DarstellungConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const { start, end } = normalizeStunden(
    toStunde(o.kalenderStartStunde, DARSTELLUNG_DEFAULTS.kalenderStartStunde, START_STUNDE_MIN, START_STUNDE_MAX),
    toStunde(o.kalenderEndStunde, DARSTELLUNG_DEFAULTS.kalenderEndStunde, END_STUNDE_MIN, END_STUNDE_MAX),
  );
  return {
    wochenstart: o.wochenstart === 'sonntag' ? 'sonntag' : 'montag',
    zeitformat: o.zeitformat === '12h' ? '12h' : '24h',
    kalenderStartStunde: start,
    kalenderEndStunde: end,
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface DarstellungPatch {
  wochenstart?: Wochenstart;
  zeitformat?: Zeitformat;
  kalenderStartStunde?: number;
  kalenderEndStunde?: number;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert; die Stunden-Invariante wird auf
 * dem zusammengefuehrten Ergebnis erzwungen.
 */
export function mergeDarstellung(base: DarstellungConfig, patch: DarstellungPatch): DarstellungConfig {
  const startRaw =
    typeof patch.kalenderStartStunde === 'number' && Number.isFinite(patch.kalenderStartStunde)
      ? patch.kalenderStartStunde
      : base.kalenderStartStunde;
  const endRaw =
    typeof patch.kalenderEndStunde === 'number' && Number.isFinite(patch.kalenderEndStunde)
      ? patch.kalenderEndStunde
      : base.kalenderEndStunde;
  const { start, end } = normalizeStunden(startRaw, endRaw);
  return {
    wochenstart:
      patch.wochenstart === 'montag' || patch.wochenstart === 'sonntag'
        ? patch.wochenstart
        : base.wochenstart,
    zeitformat:
      patch.zeitformat === '24h' || patch.zeitformat === '12h' ? patch.zeitformat : base.zeitformat,
    kalenderStartStunde: start,
    kalenderEndStunde: end,
  };
}
