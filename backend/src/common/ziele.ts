/**
 * Ziele & Erinnerungen je Betrieb (Welle 1). Landet als Objekt im verschluesselten
 * JSON `tenant.settings.ziele` – KEIN Schema-Change (Muster: steuer/impressum/
 * mahnwesen/mitgliedProfil). Fehlt der Block, liefert resolveZiele sichere Defaults
 * (alles aus), sodass Altbestand unveraendert bleibt.
 *
 * Inhalt:
 *  - Auslastungsziel (Prozent) fuer den optionalen Kalender-/Dashboard-Nudge.
 *  - §19-Umsatzgrenzen-Warnung (nur ein Schalter – der eigentliche Status kommt
 *    aus dem bestehenden §19-Waechter, invoices.kleinunternehmerStatus).
 *  - Bis zu 12 selbst gepflegte Steuer-Termine (Art + Datum + wiederkehrend/aktiv)
 *    fuer die In-App-Erinnerung in der Glocke.
 *
 * Bewusst OHNE E-Mail-Versand: Erinnerungen sind reine In-App-Hinweise
 * (Review-before-send-Prinzip).
 */

/** Grenzen des Auslastungsziels (Prozent). Leer/ungueltig -> Default. */
export const AUSLASTUNG_ZIEL_MIN = 50;
export const AUSLASTUNG_ZIEL_MAX = 100;
export const AUSLASTUNG_ZIEL_DEFAULT = 90;

/** Obergrenze der selbst gepflegten Steuer-Termine + Feldlaengen. */
export const STEUER_TERMINE_MAX = 12;
export const STEUER_TERMIN_ART_MAX = 60;
export const STEUER_TERMIN_DATUM_MAX = 10;

/**
 * Ein selbst gepflegter Steuer-Termin. `datum` ist entweder `MM-TT` (wiederkehrend,
 * z. B. jaehrlich) oder `YYYY-MM-TT` (einmalig). Die Datums-Mathematik (naechstes
 * Vorkommen) passiert client-seitig in der Glocke – hier nur robuste Ablage.
 */
export interface SteuerTermin {
  art: string;
  datum: string;
  wiederkehrend: boolean;
  aktiv: boolean;
}

/** Aufgeloeste Ziele-/Erinnerungs-Konfiguration je Betrieb (settings.ziele). */
export interface ZieleConfig {
  auslastungAktiv: boolean;
  auslastungZielProzent: number;
  par19WarnungAktiv: boolean;
  steuerTermine: SteuerTermin[];
}

/** Betreiber-Defaults = heutiges Verhalten (alles aus, Ziel 90 %). */
export const ZIELE_DEFAULTS: ZieleConfig = {
  auslastungAktiv: false,
  auslastungZielProzent: AUSLASTUNG_ZIEL_DEFAULT,
  par19WarnungAktiv: false,
  steuerTermine: [],
};

function toStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Klammert das Auslastungsziel defensiv auf [50..100]; leer/ungueltig -> Default. */
function clampProzent(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return AUSLASTUNG_ZIEL_DEFAULT;
  return Math.min(AUSLASTUNG_ZIEL_MAX, Math.max(AUSLASTUNG_ZIEL_MIN, n));
}

/**
 * Loest einen einzelnen Termin defensiv auf. Ein Termin ganz ohne Art UND Datum
 * gilt als leer und wird verworfen (null). `aktiv` ist standardmaessig true
 * (nur explizit false schaltet ab).
 */
function resolveTermin(raw: unknown): SteuerTermin | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const art = toStr(o.art, STEUER_TERMIN_ART_MAX);
  const datum = toStr(o.datum, STEUER_TERMIN_DATUM_MAX);
  if (!art && !datum) return null;
  return {
    art,
    datum,
    wiederkehrend: o.wiederkehrend === true,
    aktiv: o.aktiv !== false,
  };
}

/** Loest die Termin-Liste defensiv auf (leere Eintraege raus, auf 12 gekappt). */
function resolveTermine(raw: unknown): SteuerTermin[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(resolveTermin)
    .filter((t): t is SteuerTermin => t !== null)
    .slice(0, STEUER_TERMINE_MAX);
}

/**
 * Liest die Ziele-Konfiguration DEFENSIV aus dem Rohwert (tenant.settings.ziele).
 * Fehlende/ungueltige Keys fallen je Feld auf die Defaults zurueck; wirft NIE
 * (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveZiele(raw: unknown): ZieleConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    auslastungAktiv: o.auslastungAktiv === true,
    auslastungZielProzent:
      o.auslastungZielProzent === undefined
        ? AUSLASTUNG_ZIEL_DEFAULT
        : clampProzent(o.auslastungZielProzent),
    par19WarnungAktiv: o.par19WarnungAktiv === true,
    steuerTermine: resolveTermine(o.steuerTermine),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface ZielePatch {
  auslastungAktiv?: boolean;
  auslastungZielProzent?: number;
  par19WarnungAktiv?: boolean;
  steuerTermine?: unknown[];
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update. Die
 * Termin-Liste wird als Ganzes ERSETZT (Listen-Editor), sonst felderweise gemergt.
 */
export function mergeZiele(base: ZieleConfig, patch: ZielePatch): ZieleConfig {
  return {
    auslastungAktiv:
      typeof patch.auslastungAktiv === 'boolean' ? patch.auslastungAktiv : base.auslastungAktiv,
    auslastungZielProzent:
      patch.auslastungZielProzent !== undefined
        ? clampProzent(patch.auslastungZielProzent)
        : base.auslastungZielProzent,
    par19WarnungAktiv:
      typeof patch.par19WarnungAktiv === 'boolean' ? patch.par19WarnungAktiv : base.par19WarnungAktiv,
    steuerTermine:
      patch.steuerTermine !== undefined ? resolveTermine(patch.steuerTermine) : base.steuerTermine,
  };
}
