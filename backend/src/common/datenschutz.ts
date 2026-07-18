/**
 * Datenschutz-Einstellungen je Betrieb (DSGVO Art. 5 Abs. 1 lit. e –
 * Speicherbegrenzung). Landet als Objekt im verschluesselten JSON
 * `tenant.settings` – KEIN Schema-Change (Muster: steuer/impressum/mahnwesen/
 * ziele/kundenkommunikation). Fehlt der Block, liefert resolveDatenschutz sichere
 * Defaults, sodass Altbestand unveraendert bleibt.
 *
 * Einzige Einstellung: `aufbewahrungInaktiveKundenJahre` – nach wie vielen Jahren
 * ohne Kontakt ein Kunde in die Datenschutz-Pruefliste faellt. 0 = Automatik AUS.
 * Es wird NIE automatisch geloescht (nur die Pruefliste befuellt); die Loeschung
 * bestaetigt der Betrieb im Cockpit (Review-before-send fuer unumkehrbares Loeschen).
 */

/** Grenzen der Aufbewahrungsfrist (Jahre). 0 = aus; Obergrenze schuetzt vor Tippfehlern. */
export const AUFBEWAHRUNG_JAHRE_MIN = 0;
export const AUFBEWAHRUNG_JAHRE_MAX = 20;
/** Betreiber-Default: 3 Jahre nach letztem Kontakt (uebliche Verjaehrungs-/Praxisfrist). */
export const AUFBEWAHRUNG_JAHRE_DEFAULT = 3;

/** Aufgeloeste Datenschutz-Konfiguration je Betrieb (settings.datenschutz). */
export interface DatenschutzConfig {
  /** Jahre ohne Kontakt bis zur Pruefliste. 0 = Automatik aus. Geklammert [0..20]. */
  aufbewahrungInaktiveKundenJahre: number;
}

/** Default = 3 Jahre. */
export const DATENSCHUTZ_DEFAULTS: DatenschutzConfig = {
  aufbewahrungInaktiveKundenJahre: AUFBEWAHRUNG_JAHRE_DEFAULT,
};

/** Klammert die Frist defensiv auf [0..20]; leer/ungueltig -> Default. */
function clampJahre(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return AUFBEWAHRUNG_JAHRE_DEFAULT;
  return Math.min(AUFBEWAHRUNG_JAHRE_MAX, Math.max(AUFBEWAHRUNG_JAHRE_MIN, n));
}

/**
 * Liest die Datenschutz-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.datenschutz). Fehlende/ungueltige Keys fallen auf die Defaults
 * zurueck; wirft NIE (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveDatenschutz(raw: unknown): DatenschutzConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    aufbewahrungInaktiveKundenJahre:
      o.aufbewahrungInaktiveKundenJahre === undefined
        ? AUFBEWAHRUNG_JAHRE_DEFAULT
        : clampJahre(o.aufbewahrungInaktiveKundenJahre),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface DatenschutzPatch {
  aufbewahrungInaktiveKundenJahre?: number;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeDatenschutz(
  base: DatenschutzConfig,
  patch: DatenschutzPatch,
): DatenschutzConfig {
  return {
    aufbewahrungInaktiveKundenJahre:
      patch.aufbewahrungInaktiveKundenJahre !== undefined
        ? clampJahre(patch.aufbewahrungInaktiveKundenJahre)
        : base.aufbewahrungInaktiveKundenJahre,
  };
}
