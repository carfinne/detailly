/**
 * Kalender-Einstellungen je Betrieb (Plantafel/Terminplanung). Wird im JSON
 * `tenant.settings` unter dem Schluessel `kalender` abgelegt und ueber den
 * bestehenden Settings-GET/PATCH gelesen/geschrieben (analog `kalkulation`).
 *
 * Enthaelt Arbeitszeiten je Wochentag, das Verhalten bei Terminkonflikten
 * (warnen/blockieren), den optionalen Standort-Konflikt-Check sowie Slot-/Puffer-
 * Vorgaben fuer die Plantafel. Der Lese-Pfad (`resolveKalender`) ist defensiv:
 * fehlende/ungueltige Werte fallen je Feld auf die Defaults zurueck und wirft NIE.
 */

export type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';

/** Wochentage in fester Reihenfolge (Mo -> So) fuer Iteration/Serialisierung. */
export const WOCHENTAGE: Wochentag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

/** Arbeitszeitfenster eines Wochentags. `von`/`bis` als 'HH:MM' (24h). */
export interface Arbeitszeit {
  von: string;
  bis: string;
  aktiv: boolean;
}

export type Arbeitszeiten = Record<Wochentag, Arbeitszeit>;

export type Konfliktverhalten = 'warnen' | 'blockieren';

export interface KalenderConfig {
  arbeitszeiten: Arbeitszeiten;
  /** Verhalten bei Terminkonflikt: 'warnen' (Default, bestaetigbar) | 'blockieren'. */
  konfliktverhalten: Konfliktverhalten;
  /** Zusaetzlich je Standort auf Ueberschneidung pruefen (Default aus). */
  standortKonflikt: boolean;
  /** Raster der Plantafel in Minuten. */
  slotDauerMin: number;
  /** Puffer zwischen Terminen in Minuten (nur Anzeige/Planung). */
  pufferMin: number;
}

/** Plausible Grenzen (auch in der DTO-Validierung gespiegelt). */
export const SLOT_DAUER_MIN_MIN = 5;
export const SLOT_DAUER_MIN_MAX = 480;
export const PUFFER_MIN_MIN = 0;
export const PUFFER_MIN_MAX = 240;

const DEFAULT_VON = '08:00';
const DEFAULT_BIS = '18:00';
/** 'HH:MM' im 24h-Format (00:00 .. 23:59). */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function werktag(aktiv: boolean): Arbeitszeit {
  return { von: DEFAULT_VON, bis: DEFAULT_BIS, aktiv };
}

/** Default-Arbeitszeiten: Mo–Fr 08–18 aktiv, Sa/So inaktiv. */
export function defaultArbeitszeiten(): Arbeitszeiten {
  return {
    mo: werktag(true),
    di: werktag(true),
    mi: werktag(true),
    do: werktag(true),
    fr: werktag(true),
    sa: werktag(false),
    so: werktag(false),
  };
}

export const KALENDER_DEFAULTS: KalenderConfig = {
  arbeitszeiten: defaultArbeitszeiten(),
  konfliktverhalten: 'warnen',
  standortKonflikt: false,
  slotDauerMin: 30,
  pufferMin: 0,
};

function toZeit(v: unknown, def: string): string {
  return typeof v === 'string' && HHMM.test(v) ? v : def;
}

function toBool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toIntClamped(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  if (!Number.isFinite(n)) return def;
  return clampInt(n, min, max);
}

function resolveArbeitszeit(raw: unknown, def: Arbeitszeit): Arbeitszeit {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    von: toZeit(o.von, def.von),
    bis: toZeit(o.bis, def.bis),
    aktiv: toBool(o.aktiv, def.aktiv),
  };
}

/**
 * Liest die Kalender-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.kalender). Fehlende/ungueltige Keys fallen je Feld auf die
 * Defaults zurueck; wirft NIE (auch fuer Altbestand robust).
 */
export function resolveKalender(raw: unknown): KalenderConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const azRaw =
    o.arbeitszeiten && typeof o.arbeitszeiten === 'object'
      ? (o.arbeitszeiten as Record<string, unknown>)
      : {};
  const defAz = KALENDER_DEFAULTS.arbeitszeiten;
  const arbeitszeiten = {} as Arbeitszeiten;
  for (const tag of WOCHENTAGE) {
    arbeitszeiten[tag] = resolveArbeitszeit(azRaw[tag], defAz[tag]);
  }
  return {
    arbeitszeiten,
    konfliktverhalten: o.konfliktverhalten === 'blockieren' ? 'blockieren' : 'warnen',
    standortKonflikt: toBool(o.standortKonflikt, false),
    slotDauerMin: toIntClamped(o.slotDauerMin, 30, SLOT_DAUER_MIN_MIN, SLOT_DAUER_MIN_MAX),
    pufferMin: toIntClamped(o.pufferMin, 0, PUFFER_MIN_MIN, PUFFER_MIN_MAX),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface ArbeitszeitPatch {
  von?: string;
  bis?: string;
  aktiv?: boolean;
}

export interface KalenderPatch {
  arbeitszeiten?: Partial<Record<Wochentag, ArbeitszeitPatch>>;
  konfliktverhalten?: Konfliktverhalten;
  standortKonflikt?: boolean;
  slotDauerMin?: number;
  pufferMin?: number;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert (echtes Teil-Update), Zeiten/Zahlen
 * werden dabei validiert bzw. geklammert.
 */
export function mergeKalender(base: KalenderConfig, patch: KalenderPatch): KalenderConfig {
  const arbeitszeiten: Arbeitszeiten = { ...base.arbeitszeiten };
  if (patch.arbeitszeiten && typeof patch.arbeitszeiten === 'object') {
    for (const tag of WOCHENTAGE) {
      const p = patch.arbeitszeiten[tag];
      if (!p) continue;
      const b = arbeitszeiten[tag];
      arbeitszeiten[tag] = {
        von: typeof p.von === 'string' && HHMM.test(p.von) ? p.von : b.von,
        bis: typeof p.bis === 'string' && HHMM.test(p.bis) ? p.bis : b.bis,
        aktiv: typeof p.aktiv === 'boolean' ? p.aktiv : b.aktiv,
      };
    }
  }
  return {
    arbeitszeiten,
    konfliktverhalten:
      patch.konfliktverhalten === 'warnen' || patch.konfliktverhalten === 'blockieren'
        ? patch.konfliktverhalten
        : base.konfliktverhalten,
    standortKonflikt:
      typeof patch.standortKonflikt === 'boolean' ? patch.standortKonflikt : base.standortKonflikt,
    slotDauerMin:
      typeof patch.slotDauerMin === 'number' && Number.isFinite(patch.slotDauerMin)
        ? clampInt(patch.slotDauerMin, SLOT_DAUER_MIN_MIN, SLOT_DAUER_MIN_MAX)
        : base.slotDauerMin,
    pufferMin:
      typeof patch.pufferMin === 'number' && Number.isFinite(patch.pufferMin)
        ? clampInt(patch.pufferMin, PUFFER_MIN_MIN, PUFFER_MIN_MAX)
        : base.pufferMin,
  };
}
