// Reine Rechen-Helfer fuer den lfm-/Verschnitt-Rechner (Folierer-Welle 2, B2).
//
// Branchenstandard: aus einer Flaeche (qm) den Materialbedarf in LAUFMETER (lfm)
// bei gegebener Rollenbreite ableiten, plus einen Verschnitt-Zuschlag; daraus die
// Materialkosten (Einkauf), einen VK-Vorschlag und die Marge.
//
// Bewusst OHNE React/i18n: nur Zahlen rein, Zahlen raus -> testbar und in mehreren
// Kontexten wiederverwendbar (Kalkulations-Seite UND Auftrags-Materialkarte).

/** Voreinstellung/Grenzen des Verschnitt-Zuschlags (Prozent). */
export const VERSCHNITT_DEFAULT = 15;
export const VERSCHNITT_MIN = 0;
export const VERSCHNITT_MAX = 50;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tolerante Zahl-Umwandlung. WICHTIG: TypeORM liefert decimal-Spalten (breiteCm,
 * einkaufspreis, verkaufspreis, bestand) als STRING ueber die API. Ohne diese
 * Coercion wuerde jede Multiplikation NaN ergeben.
 */
export function toNum(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface LfmEingabe {
  /** Zu beklebende Flaeche in Quadratmetern. */
  flaecheQm: number;
  /** Rollenbreite der Folie in Zentimetern (Product.breiteCm). */
  breiteCm: number;
  /** Verschnitt-Zuschlag in Prozent (0–50). */
  verschnittProzent: number;
  /** Einkaufspreis je Laufmeter (netto). */
  einkaufspreis: number;
  /** Verkaufspreis je Laufmeter (netto) – Grundlage des VK-Vorschlags. */
  verkaufspreis: number;
}

export interface LfmErgebnis {
  /** Nutzbare Bahnenbreite in Metern (breiteCm / 100). */
  bahnenBreiteM: number;
  /** Laufmeter ohne Verschnitt (Flaeche / Bahnenbreite). */
  lfmRoh: number;
  /** Laufmeter inkl. Verschnitt-Zuschlag – die zu bestellende/buchende Menge. */
  lfmMitVerschnitt: number;
  /** Materialkosten (Einkauf) fuer die lfm inkl. Verschnitt. */
  ekKosten: number;
  /** VK-Vorschlag (Material) fuer die lfm inkl. Verschnitt. */
  vkVorschlag: number;
  /** Rohertrag Material (VK − EK). */
  marge: number;
  /** Marge in Prozent vom VK (0, falls VK 0). */
  margeProzent: number;
  /** false, wenn Flaeche oder Rollenbreite fehlen/unplausibel sind. */
  gueltig: boolean;
}

/**
 * Kernrechnung: Flaeche → Laufmeter (+ Verschnitt) → Materialkosten/VK/Marge.
 * Alle Eingaben werden tolerant gecoerct und geklemmt; fehlt eine gueltige
 * Flaeche oder Rollenbreite, ist das Ergebnis 0 und `gueltig=false`.
 */
export function berechneLfm(e: LfmEingabe): LfmErgebnis {
  const flaeche = Math.max(0, toNum(e.flaecheQm));
  const breiteCm = toNum(e.breiteCm);
  const verschnitt = Math.min(VERSCHNITT_MAX, Math.max(VERSCHNITT_MIN, toNum(e.verschnittProzent)));
  const ek = Math.max(0, toNum(e.einkaufspreis));
  const vk = Math.max(0, toNum(e.verkaufspreis));

  const bahnenBreiteM = breiteCm / 100;
  const gueltig = flaeche > 0 && bahnenBreiteM > 0;

  const lfmRoh = gueltig ? flaeche / bahnenBreiteM : 0;
  const lfmMitVerschnitt = lfmRoh * (1 + verschnitt / 100);
  const ekKosten = lfmMitVerschnitt * ek;
  const vkVorschlag = lfmMitVerschnitt * vk;
  const marge = vkVorschlag - ekKosten;
  const margeProzent = vkVorschlag > 0 ? (marge / vkVorschlag) * 100 : 0;

  return {
    bahnenBreiteM: round2(bahnenBreiteM),
    lfmRoh: round2(lfmRoh),
    lfmMitVerschnitt: round2(lfmMitVerschnitt),
    ekKosten: round2(ekKosten),
    vkVorschlag: round2(vkVorschlag),
    marge: round2(marge),
    margeProzent: Math.round(margeProzent * 10) / 10,
    gueltig,
  };
}
