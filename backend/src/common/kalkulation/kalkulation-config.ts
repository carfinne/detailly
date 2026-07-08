/**
 * Kalkulations-Richtwerte je Betrieb (3D-Sofortpreis): EUR/qm-Saetze fuer
 * Folierung, PPF/Lackschutz und Aufbereitung. Wird im JSON `tenant.settings`
 * unter dem Schluessel `kalkulation` abgelegt und ueber den bestehenden
 * Settings-GET/PATCH gelesen/geschrieben (analog `mahnwesen`/`mailConfig`).
 *
 * Die Defaults spiegeln die bisherigen Frontend-Konstanten
 * (frontend/src/lib/flaechen-preise.ts): Folierung 60, PPF 130, Aufbereitung 25.
 */
export interface KalkulationConfig {
  /** EUR/qm netto fuer Folierung (Farb-/Designfolierung). */
  folierungProQm: number;
  /** EUR/qm netto fuer PPF / Lackschutzfolie. */
  ppfProQm: number;
  /** EUR/qm netto fuer Aufbereitung (Politur/Pflege je Flaeche). */
  aufbereitungProQm: number;
}

/** Betreiber-Defaults – identisch zu den bisherigen Frontend-Richtwerten. */
export const KALKULATION_DEFAULTS: KalkulationConfig = {
  folierungProQm: 60,
  ppfProQm: 130,
  aufbereitungProQm: 25,
};

/** Plausible Ober-/Untergrenzen (auch in der DTO-Validierung gespiegelt: @Min(0)). */
export const QM_PREIS_MIN = 0;
export const QM_PREIS_MAX = 100000;

/** Normalisiert einen EUR/qm-Wert defensiv: Zahl/numerischer String, auf Cent, geklammert. */
function toPreis(v: unknown, def: number): number {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  if (!Number.isFinite(n)) return def;
  const p = Math.round(n * 100) / 100; // auf Cent normalisieren
  return Math.min(QM_PREIS_MAX, Math.max(QM_PREIS_MIN, p));
}

/**
 * Liest die Kalkulations-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.kalkulation). Fehlende/ungueltige Keys fallen je Feld auf die
 * Defaults zurueck; wirft NIE (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveKalkulation(raw: unknown): KalkulationConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const D = KALKULATION_DEFAULTS;
  return {
    folierungProQm: toPreis(o.folierungProQm, D.folierungProQm),
    ppfProQm: toPreis(o.ppfProQm, D.ppfProQm),
    aufbereitungProQm: toPreis(o.aufbereitungProQm, D.aufbereitungProQm),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface KalkulationPatch {
  folierungProQm?: number;
  ppfProQm?: number;
  aufbereitungProQm?: number;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeKalkulation(base: KalkulationConfig, patch: KalkulationPatch): KalkulationConfig {
  const num = (v: unknown, def: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? toPreis(v, def) : def;
  return {
    folierungProQm: num(patch.folierungProQm, base.folierungProQm),
    ppfProQm: num(patch.ppfProQm, base.ppfProQm),
    aufbereitungProQm: num(patch.aufbereitungProQm, base.aufbereitungProQm),
  };
}
