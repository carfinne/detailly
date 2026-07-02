// Kalkulations-Katalog je Betriebstyp: Bauteile/Leistungen mit Basispreisen
// (NETTO, EUR) als Startwerte - jede Position ist in der Kalkulation frei
// anpassbar. Die Preise sind bewusst konservative Marktdurchschnitte und
// ersetzen keine betriebliche Preisliste.
//
// PRODUKTENTSCHEIDUNG (Nacht-Brief): Keramik-Versiegelung ist KEIN eigenes
// Modul, sondern eine zuschaltbare, anpassbare Option INNERHALB der
// Kalkulation (fuer alle Betriebstypen verfuegbar, s. KERAMIK_OPTION).

import type { Betriebstyp } from '@/lib/branche';

export interface KalkPosition {
  id: string;
  label: string;
  /** Basispreis netto in EUR (bei Fahrzeuggroesse "Mittelklasse", Standard-Material). */
  basispreis: number;
  /** Zone-Id im Fahrzeug-Diagramm (Draufsicht); ohne Zone nur in der Liste. */
  zone?: string;
  /** Kurzer Zusatz (z. B. "Paar", "Set"). */
  hinweis?: string;
}

export interface MaterialStufe {
  id: string;
  label: string;
  faktor: number;
}

export interface KalkKatalog {
  titel: string;
  /** Bezeichnung der Positionsgruppe (Bauteile vs. Leistungen). */
  gruppenLabel: string;
  positionen: KalkPosition[];
  /** Material-/Qualitaetsstufen (Faktor auf den Basispreis); leer = keine. */
  materialStufen: MaterialStufe[];
  materialLabel?: string;
  /** Schnellauswahl-Pakete: Label -> Positions-Ids. */
  pakete: { label: string; ids: string[] }[];
}

export const FAHRZEUG_GROESSEN: { id: string; label: string; faktor: number }[] = [
  { id: 'klein', label: 'Kleinwagen', faktor: 0.85 },
  { id: 'mittel', label: 'Mittelklasse', faktor: 1 },
  { id: 'suv', label: 'Oberklasse / SUV', faktor: 1.2 },
  { id: 'transporter', label: 'Van / Transporter', faktor: 1.35 },
];

/** Keramik-Versiegelung: Option innerhalb der Kalkulation (alle Typen). */
export const KERAMIK_OPTION = {
  label: 'Keramik-Versiegelung',
  beschreibung:
    'Als Zusatzoption in der Kalkulation - Basispreis inkl. 1 Schicht, weitere Schichten frei anpassbar.',
  basispreis: 349, // inkl. Vorreinigung + 1 Schicht
  preisProWeitereSchicht: 89,
  maxWeitereSchichten: 3,
};

const FOLIERUNG: KalkKatalog = {
  titel: 'Folierung',
  gruppenLabel: 'Bauteile',
  materialLabel: 'Folienqualität',
  materialStufen: [
    { id: 'standard', label: 'Standard (glanz/matt)', faktor: 1 },
    { id: 'premium', label: 'Premium (Metallic/Satin)', faktor: 1.25 },
    { id: 'spezial', label: 'Spezial (Chrom/Flip/Struktur)', faktor: 1.6 },
  ],
  positionen: [
    { id: 'motorhaube', label: 'Motorhaube', basispreis: 180, zone: 'motorhaube' },
    { id: 'dach', label: 'Dach', basispreis: 160, zone: 'dach' },
    { id: 'stossstange_v', label: 'Stoßstange vorne', basispreis: 150, zone: 'stossstange_v' },
    { id: 'stossstange_h', label: 'Stoßstange hinten', basispreis: 150, zone: 'stossstange_h' },
    { id: 'kotfluegel_vl', label: 'Kotflügel vorne links', basispreis: 90, zone: 'kotfluegel_vl' },
    { id: 'kotfluegel_vr', label: 'Kotflügel vorne rechts', basispreis: 90, zone: 'kotfluegel_vr' },
    { id: 'tuer_vl', label: 'Tür vorne links', basispreis: 120, zone: 'tuer_vl' },
    { id: 'tuer_vr', label: 'Tür vorne rechts', basispreis: 120, zone: 'tuer_vr' },
    { id: 'tuer_hl', label: 'Tür hinten links', basispreis: 120, zone: 'tuer_hl' },
    { id: 'tuer_hr', label: 'Tür hinten rechts', basispreis: 120, zone: 'tuer_hr' },
    { id: 'kotfluegel_hl', label: 'Kotflügel hinten links', basispreis: 90, zone: 'kotfluegel_hl' },
    { id: 'kotfluegel_hr', label: 'Kotflügel hinten rechts', basispreis: 90, zone: 'kotfluegel_hr' },
    { id: 'heckklappe', label: 'Heckklappe', basispreis: 140, zone: 'heckklappe' },
    { id: 'spiegel', label: 'Außenspiegel', basispreis: 60, hinweis: 'Paar' },
    { id: 'schweller', label: 'Schweller', basispreis: 120, hinweis: 'Paar' },
    { id: 'a_saeulen', label: 'A-Säulen', basispreis: 80, hinweis: 'Paar' },
    { id: 'entfolierung', label: 'Entfolierung (Altfolie)', basispreis: 350 },
  ],
  pakete: [
    {
      label: 'Vollfolierung',
      ids: [
        'motorhaube', 'dach', 'stossstange_v', 'stossstange_h',
        'kotfluegel_vl', 'kotfluegel_vr', 'kotfluegel_hl', 'kotfluegel_hr',
        'tuer_vl', 'tuer_vr', 'tuer_hl', 'tuer_hr',
        'heckklappe', 'spiegel', 'schweller', 'a_saeulen',
      ],
    },
    { label: 'Dach + Spiegel (Kontrast)', ids: ['dach', 'spiegel'] },
  ],
};

const PPF: KalkKatalog = {
  titel: 'PPF / Lackschutz',
  gruppenLabel: 'Schutzzonen',
  materialLabel: 'Folientyp',
  materialStufen: [
    { id: 'standard', label: 'Standard PPF', faktor: 1 },
    { id: 'premium', label: 'Premium (selbstheilend)', faktor: 1.35 },
  ],
  positionen: [
    { id: 'stossstange_v', label: 'Stoßstange vorne', basispreis: 320, zone: 'stossstange_v' },
    { id: 'motorhaube', label: 'Motorhaube komplett', basispreis: 400, zone: 'motorhaube' },
    { id: 'kotfluegel_vl', label: 'Kotflügel vorne links', basispreis: 110, zone: 'kotfluegel_vl' },
    { id: 'kotfluegel_vr', label: 'Kotflügel vorne rechts', basispreis: 110, zone: 'kotfluegel_vr' },
    { id: 'spiegel', label: 'Spiegelkappen', basispreis: 90, hinweis: 'Paar' },
    { id: 'scheinwerfer', label: 'Scheinwerfer', basispreis: 120, hinweis: 'Paar' },
    { id: 'a_saeulen_dach', label: 'A-Säulen + Dachkante', basispreis: 150 },
    { id: 'schweller', label: 'Schweller', basispreis: 260, hinweis: 'Paar' },
    { id: 'tuer_vl', label: 'Tür vorne links', basispreis: 180, zone: 'tuer_vl' },
    { id: 'tuer_vr', label: 'Tür vorne rechts', basispreis: 180, zone: 'tuer_vr' },
    { id: 'tuer_hl', label: 'Tür hinten links', basispreis: 180, zone: 'tuer_hl' },
    { id: 'tuer_hr', label: 'Tür hinten rechts', basispreis: 180, zone: 'tuer_hr' },
    { id: 'tuerkanten', label: 'Türkanten', basispreis: 80, hinweis: 'Set' },
    { id: 'ladekante', label: 'Ladekante', basispreis: 90 },
    { id: 'dach', label: 'Dach', basispreis: 320, zone: 'dach' },
    { id: 'heckklappe', label: 'Heckklappe', basispreis: 220, zone: 'heckklappe' },
    { id: 'stossstange_h', label: 'Stoßstange hinten', basispreis: 300, zone: 'stossstange_h' },
  ],
  pakete: [
    {
      label: 'Frontpaket',
      ids: ['stossstange_v', 'motorhaube', 'kotfluegel_vl', 'kotfluegel_vr', 'spiegel', 'scheinwerfer'],
    },
    {
      label: 'Komplettschutz',
      ids: [
        'stossstange_v', 'motorhaube', 'kotfluegel_vl', 'kotfluegel_vr', 'spiegel', 'scheinwerfer',
        'a_saeulen_dach', 'schweller', 'tuer_vl', 'tuer_vr', 'tuer_hl', 'tuer_hr',
        'tuerkanten', 'ladekante', 'dach', 'heckklappe', 'stossstange_h',
      ],
    },
    { label: 'Anfahrschutz (Kanten + Ladekante)', ids: ['tuerkanten', 'ladekante'] },
  ],
};

const AUFBEREITUNG: KalkKatalog = {
  titel: 'Aufbereitung',
  gruppenLabel: 'Leistungen',
  materialStufen: [],
  positionen: [
    { id: 'handwaesche', label: 'Handwäsche + Trocknung', basispreis: 49 },
    { id: 'felgen', label: 'Felgen intensiv + Flugrost', basispreis: 39 },
    { id: 'kneten', label: 'Lackreinigung (Kneten)', basispreis: 69 },
    { id: 'politur_1', label: 'Politur einstufig (Auffrischung)', basispreis: 249 },
    { id: 'politur_2', label: 'Politur zweistufig (Schleif + Finish)', basispreis: 449 },
    { id: 'politur_3', label: 'Politur dreistufig (Korrektur)', basispreis: 699 },
    { id: 'innenraum', label: 'Innenraum intensiv', basispreis: 129 },
    { id: 'polster', label: 'Polster-/Teppichreinigung', basispreis: 89 },
    { id: 'leder', label: 'Lederreinigung + Pflege', basispreis: 99 },
    { id: 'scheiben', label: 'Scheibenversiegelung', basispreis: 49 },
    { id: 'motorraum', label: 'Motorraumreinigung', basispreis: 59 },
    { id: 'ozon', label: 'Ozonbehandlung (Geruch)', basispreis: 79 },
  ],
  pakete: [
    { label: 'Außen komplett', ids: ['handwaesche', 'felgen', 'kneten', 'politur_1'] },
    { label: 'Innen komplett', ids: ['innenraum', 'polster', 'leder', 'ozon'] },
    { label: 'Showroom (Korrektur)', ids: ['handwaesche', 'felgen', 'kneten', 'politur_3', 'innenraum', 'leder', 'scheiben'] },
  ],
};

export const KATALOGE: Record<Exclude<Betriebstyp, 'komplett'>, KalkKatalog> = {
  aufbereitung: AUFBEREITUNG,
  folierung: FOLIERUNG,
  ppf: PPF,
};

/** Reihenfolge der Katalog-Tabs fuer Komplett-Anbieter. */
export const KATALOG_REIHENFOLGE: Exclude<Betriebstyp, 'komplett'>[] = [
  'aufbereitung',
  'folierung',
  'ppf',
];
