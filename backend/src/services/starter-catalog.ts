import { ServiceCategory, ServiceUnit } from './entities/service-item.entity';

/**
 * Branchen-Starter-Katalog (Pilot-Onboarding).
 *
 * Ein frisch registrierter Betrieb startet sonst mit 0 Leistungen und kann nicht
 * sofort kalkulieren/abrechnen. Diese kuratierte, GENERISCHE Liste (keine
 * Markennamen) typischer Leistungen je Gewerk laesst sich beim Onboarding per
 * Klick uebernehmen. Die uebernommenen Leistungen sind danach normale, tenant-
 * scoped ServiceItems – frei editier-/loeschbar.
 *
 * Richtpreise sind bewusst als grobe Orientierung fuer den deutschen Markt
 * gesetzt; jeder Betrieb passt sie an seine Kalkulation an. Einheiten folgen der
 * bestehenden ServiceUnit (pauschal/qm/stunde).
 *
 * REINE Datenquelle (keine DB, kein Tenant): das Anlegen erledigt der
 * ServicesService tenant-scoped.
 */

/** Gewerke, fuer die es einen Starter-Katalog gibt (Teilmenge der ServiceCategory). */
export const STARTER_GEWERKE = [
  ServiceCategory.AUFBEREITUNG,
  ServiceCategory.FOLIERUNG,
  ServiceCategory.PPF,
] as const;

export type StarterGewerk = (typeof STARTER_GEWERKE)[number];

/** Eine Katalog-Leistung (ohne tenantId – die setzt der Service beim Anlegen). */
export interface StarterLeistung {
  name: string;
  beschreibung: string;
  einheit: ServiceUnit;
  /** Richtpreis in EUR (Orientierung, vom Betrieb anpassbar). */
  basispreis: number;
}

/**
 * Normalisiert einen Leistungsnamen fuer den Idempotenz-Vergleich beim Import
 * (getrimmt + kleingeschrieben + Mehrfach-Leerzeichen zusammengezogen). So wird
 * ein zweiter Import nicht stumpf dupliziert, wenn ein namensgleicher Eintrag
 * bereits existiert – unabhaengig von Gross-/Kleinschreibung.
 */
export function normStarterName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const STARTER_KATALOG: Record<StarterGewerk, StarterLeistung[]> = {
  [ServiceCategory.AUFBEREITUNG]: [
    {
      name: 'Außenwäsche & Felgenreinigung',
      beschreibung: 'Handwäsche außen inkl. Felgen- und Reifenpflege.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 39,
    },
    {
      name: 'Innenraumreinigung Basis',
      beschreibung: 'Saugen, Staub wischen, Scheiben innen, Fußmatten.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 49,
    },
    {
      name: 'Innenraum-Komplettaufbereitung',
      beschreibung: 'Intensivreinigung aller Oberflächen, Polster und Verkleidungen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 149,
    },
    {
      name: 'Lederreinigung & -pflege',
      beschreibung: 'Reinigung und Rückfettung von Ledersitzen und -flächen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 79,
    },
    {
      name: 'Polsterreinigung (Nassreinigung)',
      beschreibung: 'Sprühextraktion von Stoffsitzen und Teppichen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 99,
    },
    {
      name: 'Politur Stufe 1 – Glanzpolitur',
      beschreibung: 'Auffrischungspolitur für mehr Glanz und Farbtiefe.',
      einheit: ServiceUnit.STUNDE,
      basispreis: 65,
    },
    {
      name: 'Politur Stufe 2 – Kratzerentfernung',
      beschreibung: 'Mehrstufige Politur gegen feine Kratzer und Hologramme.',
      einheit: ServiceUnit.STUNDE,
      basispreis: 75,
    },
    {
      name: 'Lackreinigung mit Reinigungsknete',
      beschreibung: 'Entfernung von Flugrost und festsitzenden Verunreinigungen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 45,
    },
    {
      name: 'Keramikversiegelung Lack',
      beschreibung: 'Langzeit-Lackschutz durch keramische Beschichtung.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 499,
    },
    {
      name: 'Scheibenversiegelung',
      beschreibung: 'Abperleffekt für bessere Sicht bei Regen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 39,
    },
    {
      name: 'Motorwäsche',
      beschreibung: 'Reinigung und Pflege des Motorraums.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 45,
    },
    {
      name: 'Geruchsneutralisation (Ozon)',
      beschreibung: 'Beseitigung von Gerüchen mit Ozonbehandlung.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 59,
    },
    {
      name: 'Neuwagenaufbereitung',
      beschreibung: 'Erstaufbereitung inkl. Konservierung für Neu- und Jahreswagen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 129,
    },
    {
      name: 'Komplettaufbereitung innen & außen',
      beschreibung: 'Rundum-Aufbereitung von Innenraum und Außenlack.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 249,
    },
  ],
  [ServiceCategory.FOLIERUNG]: [
    {
      name: 'Vollfolierung Karosserie',
      beschreibung: 'Komplette Umfolierung der Karosserie (Farb-/Designwechsel).',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 2490,
    },
    {
      name: 'Teilfolierung Dach',
      beschreibung: 'Folierung des Dachs, z. B. in Schwarz glänzend.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 249,
    },
    {
      name: 'Teilfolierung Motorhaube',
      beschreibung: 'Folierung der Motorhaube (Akzent oder Steinschlag-Optik).',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 199,
    },
    {
      name: 'Folierung Spiegelkappen',
      beschreibung: 'Folierung beider Außenspiegelkappen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 89,
    },
    {
      name: 'Chrom-Delete (Zierleisten)',
      beschreibung: 'Umfolierung der Chromzierleisten in Schwarz.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 149,
    },
    {
      name: 'Design-/Digitaldruckfolie',
      beschreibung: 'Individuell bedruckte Folie, Abrechnung nach Fläche.',
      einheit: ServiceUnit.QM,
      basispreis: 89,
    },
    {
      name: 'Werbebeschriftung',
      beschreibung: 'Firmenbeschriftung und Logos als Folienplot.',
      einheit: ServiceUnit.QM,
      basispreis: 65,
    },
    {
      name: 'Folierung Einzelteil nach Fläche',
      beschreibung: 'Farbfolierung einzelner Bauteile, Abrechnung pro Quadratmeter.',
      einheit: ServiceUnit.QM,
      basispreis: 55,
    },
    {
      name: 'Scheibentönung hinten',
      beschreibung: 'Tönung der hinteren Seiten- und Heckscheiben.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 149,
    },
    {
      name: 'Scheibentönung Rundum',
      beschreibung: 'Tönung aller zulässigen Scheiben.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 249,
    },
    {
      name: 'Lackschutzfolie Ladekante',
      beschreibung: 'Transparente Schutzfolie für die Ladekante.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 49,
    },
    {
      name: 'Entfolierung (Altfolie entfernen)',
      beschreibung: 'Rückstandsfreies Entfernen alter Folie.',
      einheit: ServiceUnit.STUNDE,
      basispreis: 65,
    },
    {
      name: 'Innenraum-Dekorfolierung',
      beschreibung: 'Folierung von Zierteilen im Innenraum.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 129,
    },
  ],
  [ServiceCategory.PPF]: [
    {
      name: 'PPF Front Teilschutz',
      beschreibung: 'Steinschlagschutz für Frontstoßstange und Haubenvorderkante.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 349,
    },
    {
      name: 'PPF Front komplett',
      beschreibung: 'Lackschutzfolie für Stoßstange, Haube, Kotflügel und Spiegel.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 1290,
    },
    {
      name: 'PPF Vollfahrzeug',
      beschreibung: 'Rundum-Lackschutz der gesamten Fahrzeugoberfläche.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 3990,
    },
    {
      name: 'PPF Motorhaube komplett',
      beschreibung: 'Vollflächige Lackschutzfolie auf der Motorhaube.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 490,
    },
    {
      name: 'PPF Ladekante',
      beschreibung: 'Unsichtbarer Schutz der Stoßstangen-Ladekante.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 59,
    },
    {
      name: 'PPF Türgriffmulden (Satz)',
      beschreibung: 'Schutz vor Kratzern an den Türgriffmulden.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 79,
    },
    {
      name: 'PPF Einstiegsleisten (Satz)',
      beschreibung: 'Schutzfolie für die Türeinstiege.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 99,
    },
    {
      name: 'PPF Scheinwerfer (Satz)',
      beschreibung: 'Steinschlagschutz für die Scheinwerfer.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 89,
    },
    {
      name: 'PPF A-Säule & Spiegel',
      beschreibung: 'Lackschutz an A-Säulen und Spiegelkappen.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 199,
    },
    {
      name: 'PPF nach Fläche (Sonderteil)',
      beschreibung: 'Individueller Lackschutz einzelner Flächen, Abrechnung pro Quadratmeter.',
      einheit: ServiceUnit.QM,
      basispreis: 120,
    },
    {
      name: 'PPF-Entfernung & Neuverklebung',
      beschreibung: 'Entfernen alter Folie und Neuapplikation.',
      einheit: ServiceUnit.STUNDE,
      basispreis: 75,
    },
    {
      name: 'Keramikbeschichtung auf PPF',
      beschreibung: 'Zusätzliche keramische Versiegelung der Schutzfolie.',
      einheit: ServiceUnit.PAUSCHAL,
      basispreis: 249,
    },
  ],
};

/** Gruppe im Vorschau-/Import-Kontrakt (ein Gewerk + seine Leistungen). */
export interface StarterKatalogGruppe {
  gewerk: StarterGewerk;
  anzahl: number;
  leistungen: StarterLeistung[];
}

/** Voller Katalog als geordnete Gruppenliste (fuer die Frontend-Vorschau). */
export function getStarterKatalog(): { gewerke: StarterKatalogGruppe[] } {
  return {
    gewerke: STARTER_GEWERKE.map((gewerk) => ({
      gewerk,
      anzahl: STARTER_KATALOG[gewerk].length,
      leistungen: STARTER_KATALOG[gewerk],
    })),
  };
}
