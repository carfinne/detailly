/**
 * Konfiguration der Umsatz-Erinnerungen (Welle 2-B) je Betrieb. Bewusst als
 * kleines JSON in `tenant.settings.nachfass` (KEINE eigene Spalte – ein einzelner
 * Zahlwert reicht), gelesen/geschrieben ueber den bestehenden Settings-GET/PATCH.
 *
 * ABSOLUTE REGEL (Review-before-send): Diese Erinnerungen ERKENNEN und SCHLAGEN
 * VOR – es geht NICHTS automatisch an den Endkunden. Der Betrieb sieht eine
 * In-App-Liste/Glocke und handelt selbst (wie Mahnwesen + DSGVO-Pruefliste).
 *
 * TEIL 1 (Angebots-Nachfassen): `tageOffen` = ab wie vielen Tagen ein noch OFFENES
 * Angebot als "nachfassreif" gilt (Default 7). TEIL 2 (Nachsorge) braucht KEINE
 * Betriebs-Konfig – die Wiedervorlage ist Opt-in je Auftrag (Monate frei waehlbar).
 */

/** Nachfass-Konfiguration je Betrieb (Teil 1). */
export interface NachfassConfig {
  /** Tage, ab denen ein offenes Angebot als nachfassreif gilt. */
  tageOffen: number;
}

/** Betreiber-Default: nach 7 Tagen ohne Reaktion nachfassen. */
export const NACHFASS_DEFAULTS: NachfassConfig = {
  tageOffen: 7,
};

/** Plausible Ober-/Untergrenzen (auch in der DTO-Validierung gespiegelt). */
export const NACHFASS_TAGE_MIN = 1;
export const NACHFASS_TAGE_MAX = 90;

/**
 * Nachsorge-Wiedervorlage (Teil 2): erlaubter Bereich fuer "in N Monaten".
 * Der konkrete Wert ist Opt-in je Auftrag; hier nur die Validierungs-Grenzen
 * (z. B. Keramik/PPF-Auffrischung nach 12 Monaten – bis zu 5 Jahre moeglich).
 */
export const NACHSORGE_MONATE_MIN = 1;
export const NACHSORGE_MONATE_MAX = 60;

function toTage(v: unknown, def: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.min(NACHFASS_TAGE_MAX, Math.max(NACHFASS_TAGE_MIN, i));
}

/**
 * Liest die Nachfass-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.nachfass). Fehlende/ungueltige Werte fallen auf die Defaults
 * zurueck; wirft NIE (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveNachfass(raw: unknown): NachfassConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    tageOffen: toTage(o.tageOffen, NACHFASS_DEFAULTS.tageOffen),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface NachfassPatch {
  tageOffen?: number;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeNachfass(base: NachfassConfig, patch: NachfassPatch): NachfassConfig {
  return {
    tageOffen:
      typeof patch.tageOffen === 'number' && Number.isFinite(patch.tageOffen)
        ? patch.tageOffen
        : base.tageOffen,
  };
}

/**
 * Reine Funktion: die "Nachfass-Schwelle" als Zeitpunkt. Angebote, die AELTER
 * als diese Schwelle sind (COALESCE(datum, createdAt) <= schwelle), gelten als
 * nachfassreif. Herausgezogen, damit Liste (InvoicesService) und Glocken-Zaehler
 * (RemindersService) exakt dieselbe Grenze verwenden (keine Divergenz).
 */
export function nachfassSchwelle(now: Date, tageOffen: number): Date {
  return new Date(now.getTime() - tageOffen * 24 * 60 * 60 * 1000);
}
