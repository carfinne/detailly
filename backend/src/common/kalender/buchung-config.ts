/**
 * Buchungsportal-Einstellungen je Betrieb (Kalender 2.0, Welle 2). Wird im JSON
 * `tenant.settings` unter dem Schluessel `buchung` abgelegt und ueber den
 * bestehenden Settings-GET/PATCH gelesen/geschrieben (analog `kalender`).
 *
 * Steuert, wie weit im Voraus Kunden im oeffentlichen Buchungsportal freie
 * Slots sehen: `vorlaufMinStunden` (fruehester Slot ab jetzt) und
 * `vorlaufMaxTage` (spaetester Slot ab jetzt). Der Lese-Pfad (`resolveBuchung`)
 * ist defensiv: fehlende/ungueltige Werte fallen je Feld auf die Defaults
 * zurueck und wirft NIE.
 */

/**
 * Rechtlicher Abschluss-Modus der oeffentlichen Buchungsseite je Betrieb:
 *  - `anfrage`     : UNVERBINDLICHE Terminanfrage. Es kommt im Flow KEIN
 *                    entgeltlicher Vertrag zustande (der Betrieb bestaetigt spaeter).
 *                    §312j-Button-Pflicht greift nicht; klare "unverbindlich"-
 *                    Kennzeichnung (Irrefuehrungsverbot). DEFAULT (heutiger Ist-Stand).
 *  - `verbindlich` : ENTGELTLICHER Fernabsatzvertrag direkt im Flow. Volle
 *                    Button-Loesung (§312j Abs. 3: "Zahlungspflichtig buchen"),
 *                    Pflichtinfos unmittelbar vor dem Button (Art. 246a EGBGB) und
 *                    Widerrufsbelehrung/-formular (§312g/§355). Opt-in des Betriebs.
 */
export type BuchungModus = 'anfrage' | 'verbindlich';

/** Zulaessige Modi (auch in der DTO-Validierung via @IsIn gespiegelt). */
export const BUCHUNG_MODI: readonly BuchungModus[] = ['anfrage', 'verbindlich'] as const;

export interface BuchungConfig {
  /** Mindest-Vorlauf in Stunden: Slots vor `jetzt + Vorlauf` sind nicht buchbar. */
  vorlaufMinStunden: number;
  /** Maximaler Vorlauf in Tagen: Slots nach `jetzt + Vorlauf` sind nicht buchbar. */
  vorlaufMaxTage: number;
  /** Rechtlicher Abschluss-Modus der Buchungsseite (Default: `anfrage`). */
  modus: BuchungModus;
}

/** Plausible Grenzen (auch in der DTO-Validierung gespiegelt). */
export const VORLAUF_MIN_STUNDEN_MIN = 0;
export const VORLAUF_MIN_STUNDEN_MAX = 720; // 30 Tage
export const VORLAUF_MAX_TAGE_MIN = 1;
export const VORLAUF_MAX_TAGE_MAX = 365;

export const BUCHUNG_DEFAULTS: BuchungConfig = {
  vorlaufMinStunden: 24,
  vorlaufMaxTage: 60,
  // BEWUSSTER Default: der heutige Ist-Stand ist die unverbindliche Anfrage.
  // Ein Betrieb schaltet `verbindlich` nur aktiv frei (Opt-in).
  modus: 'anfrage',
};

/** Normalisiert einen Roh-Modus defensiv auf einen zulaessigen Wert (sonst Default). */
function toModus(v: unknown): BuchungModus {
  return v === 'verbindlich' ? 'verbindlich' : 'anfrage';
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toIntClamped(v: unknown, def: number, min: number, max: number): number {
  // Nur echte Zahlen akzeptieren: Number(null) waere 0 und wuerde einen fehlenden
  // Wert still auf die Untergrenze klammern statt auf den Default zu fallen.
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  return clampInt(v, min, max);
}

/**
 * Liest die Buchungs-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.buchung). Fehlende/ungueltige Keys fallen je Feld auf die
 * Defaults zurueck; wirft NIE (auch fuer Altbestand robust).
 */
export function resolveBuchung(raw: unknown): BuchungConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    vorlaufMinStunden: toIntClamped(
      o.vorlaufMinStunden,
      BUCHUNG_DEFAULTS.vorlaufMinStunden,
      VORLAUF_MIN_STUNDEN_MIN,
      VORLAUF_MIN_STUNDEN_MAX,
    ),
    vorlaufMaxTage: toIntClamped(
      o.vorlaufMaxTage,
      BUCHUNG_DEFAULTS.vorlaufMaxTage,
      VORLAUF_MAX_TAGE_MIN,
      VORLAUF_MAX_TAGE_MAX,
    ),
    modus: toModus(o.modus),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface BuchungPatch {
  vorlaufMinStunden?: number;
  vorlaufMaxTage?: number;
  modus?: BuchungModus;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert (echtes Teil-Update); Zahlen
 * werden geklammert.
 */
export function mergeBuchung(base: BuchungConfig, patch: BuchungPatch): BuchungConfig {
  return {
    vorlaufMinStunden:
      typeof patch.vorlaufMinStunden === 'number' && Number.isFinite(patch.vorlaufMinStunden)
        ? clampInt(patch.vorlaufMinStunden, VORLAUF_MIN_STUNDEN_MIN, VORLAUF_MIN_STUNDEN_MAX)
        : base.vorlaufMinStunden,
    vorlaufMaxTage:
      typeof patch.vorlaufMaxTage === 'number' && Number.isFinite(patch.vorlaufMaxTage)
        ? clampInt(patch.vorlaufMaxTage, VORLAUF_MAX_TAGE_MIN, VORLAUF_MAX_TAGE_MAX)
        : base.vorlaufMaxTage,
    // Nur zulaessige Modi uebernehmen; ungueltige/fehlende lassen den Bestand.
    modus: patch.modus === 'anfrage' || patch.modus === 'verbindlich' ? patch.modus : base.modus,
  };
}
