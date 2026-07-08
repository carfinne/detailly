// Flaechen- und Preis-Richtwerte fuer die 3D-Sofortkalkulation (Paket B3).
//
// Zweck: Aus einem Klick auf ein Karosserie-Bauteil im 3D-Modul direkt einen
// Preis ableiten. Der Preis je Bauteil ergibt sich aus
//   Flaeche (qm) x Fahrzeuggroesse-Faktor x EUR/qm-Satz der Leistung.
// Alle Werte sind bewusst konservative RICHTWERTE und in der Kalkulation frei
// ueberschreibbar (Default-Flaeche je Bauteil + globaler EUR/qm-Satz). Ein
// Flat-Preis greift als Fallback, falls fuer eine partId keine Flaeche existiert.
//
// Namensraum: Diese Tabelle ist ueber die KANONISCHE partId (lib/vehicle-parts)
// verschluesselt - dieselbe Wahrheit, die das 3D-Modul fuer mesh.name nutzt.
// Der bestehende Kalkulations-Katalog (lib/kalkulation-katalog) hat einen
// EIGENEN, aelteren Bauteil-ID-Namensraum (z. B. `stossstange_v`,
// `kotfluegel_hl`) und KEINE Flaechendaten. Statt diesen Katalog invasiv
// umzubauen (Risiko fuer die bestehende Kalkulations-Seite), fuehrt B3 die
// Flaechen-/qm-Logik hier sauber getrennt auf der kanonischen partId ein.
// CANONICAL_TO_KATALOG unten dokumentiert die Zuordnung fuer eine spaetere
// Zusammenfuehrung/Persistenz (B4); die Sofortkalkulation nutzt sie NICHT.

import type { Betriebstyp } from '@/lib/branche';
import { canonicalPartId } from '@/lib/vehicle-parts';

/** Leistungsart der Sofortkalkulation (deckt sich mit den Katalog-Typen). */
export type KalkLeistung = Exclude<Betriebstyp, 'komplett'>; // 'aufbereitung' | 'folierung' | 'ppf'

export interface LeistungMeta {
  id: KalkLeistung;
  label: string;
  /** EUR/qm netto - ueberschreibbarer Richtwert. */
  proQm: number;
  hinweis: string;
}

// Reihenfolge: Folierung ist laut B3 die primaere Leistung -> zuerst.
export const KALK_LEISTUNGEN: LeistungMeta[] = [
  { id: 'folierung', label: 'Folierung', proQm: 60, hinweis: 'Farb-/Designfolierung, Standardfolie' },
  { id: 'ppf', label: 'PPF / Lackschutz', proQm: 130, hinweis: 'Lackschutzfolie (Paint Protection Film)' },
  { id: 'aufbereitung', label: 'Aufbereitung', proQm: 25, hinweis: 'Politur/Pflege je Flaeche (grober Richtwert)' },
];

export const DEFAULT_LEISTUNG: KalkLeistung = 'folierung';

// Default-Flaeche (qm) je kanonischer partId - Richtwert fuer eine Mittelklasse.
// Ueberschreibbar in der UI. Deckt alle kanonischen Bauteile ab (auch solche
// ohne 3D-Geometrie), damit auch die 2D-/Listenauswahl einen Preis erhaelt.
export const PART_FLAECHE_QM: Record<string, number> = {
  stossfaenger_vorne: 1.5,
  motorhaube: 1.6,
  kotfluegel_vl: 0.8,
  kotfluegel_vr: 0.8,
  windschutzscheibe: 0.9,
  dach: 1.8,
  tuer_vl: 1.0,
  tuer_vr: 1.0,
  tuer_hl: 1.0,
  tuer_hr: 1.0,
  seitenscheibe_l: 0.5,
  seitenscheibe_r: 0.5,
  aussenspiegel_l: 0.15,
  aussenspiegel_r: 0.15,
  schweller_l: 0.6,
  schweller_r: 0.6,
  seitenwand_hl: 1.1,
  seitenwand_hr: 1.1,
  heckscheibe: 0.7,
  heckklappe: 1.4,
  stossfaenger_hinten: 1.5,
};

/** Flat-Fallback (netto), falls fuer eine partId keine Flaeche hinterlegt ist. */
export const FLAT_FALLBACK_PREIS = 120;

/** Default-Flaeche (qm) einer kanonischen partId (alias-tolerant); 0 = unbekannt. */
export function defaultFlaeche(partId: string): number {
  return PART_FLAECHE_QM[canonicalPartId(partId)] ?? 0;
}

/**
 * Zeilenpreis (netto) aus Flaeche x Fahrzeuggroesse x EUR/qm.
 * Ohne gueltige Flaeche greift der Flat-Fallback.
 */
export function flaechenPreis(flaecheQm: number, groesseFaktor: number, proQm: number): number {
  if (!flaecheQm || flaecheQm <= 0) return FLAT_FALLBACK_PREIS;
  return Math.round(flaecheQm * groesseFaktor * proQm * 100) / 100;
}

/**
 * Betriebs-Einstellung fuer die EUR/qm-Saetze (Tenant-Settings, Block
 * `kalkulation` aus GET /tenants/me). Alle Felder optional - fehlt/unplausibel
 * ein Wert, greift der Konstanten-Default aus KALK_LEISTUNGEN.
 */
export interface KalkulationSettings {
  folierungProQm?: number | null;
  ppfProQm?: number | null;
  aufbereitungProQm?: number | null;
}

/** Leistung -> Feldname im kalkulation-Settings-Block (Backend-Kontrakt). */
const SETTINGS_FELD: Record<KalkLeistung, keyof KalkulationSettings> = {
  folierung: 'folierungProQm',
  ppf: 'ppfProQm',
  aufbereitung: 'aufbereitungProQm',
};

/**
 * Effektiver EUR/qm-Basissatz einer Leistung: der gepflegte Tenant-Wert, wenn
 * gesetzt und plausibel (> 0), sonst der bisherige Konstanten-Default. KEINE
 * harte Kopplung - die Konstanten in KALK_LEISTUNGEN bleiben der Fallback.
 */
export function proQmFuer(leistung: KalkLeistung, settings?: KalkulationSettings | null): number {
  const konstante = KALK_LEISTUNGEN.find((l) => l.id === leistung)?.proQm ?? KALK_LEISTUNGEN[0].proQm;
  const wert = settings?.[SETTINGS_FELD[leistung]];
  return typeof wert === 'number' && Number.isFinite(wert) && wert > 0 ? wert : konstante;
}

/**
 * Dokumentierte Zuordnung kanonische partId -> Positions-Id im bestehenden
 * Kalkulations-Katalog (lib/kalkulation-katalog). NUR zur spaeteren Verknuepfung/
 * Persistenz (B4); die 3D-Sofortkalkulation nutzt sie NICHT. Bauteile ohne
 * Katalog-Pendant (z. B. Seitenscheiben) bleiben absichtlich unzugeordnet.
 */
export const CANONICAL_TO_KATALOG: Record<string, string> = {
  stossfaenger_vorne: 'stossstange_v',
  stossfaenger_hinten: 'stossstange_h',
  motorhaube: 'motorhaube',
  dach: 'dach',
  kotfluegel_vl: 'kotfluegel_vl',
  kotfluegel_vr: 'kotfluegel_vr',
  tuer_vl: 'tuer_vl',
  tuer_vr: 'tuer_vr',
  tuer_hl: 'tuer_hl',
  tuer_hr: 'tuer_hr',
  seitenwand_hl: 'kotfluegel_hl',
  seitenwand_hr: 'kotfluegel_hr',
  heckklappe: 'heckklappe',
};
