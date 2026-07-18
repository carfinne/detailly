import { DataSource } from 'typeorm';
import { MarketplaceCategory } from '../entities/marketplace-category.entity';

/**
 * Plattform-weite Kategorie-Taxonomie des B2B-Marktplatzes (zwei Ebenen:
 * Haupt -> Unter). Eine einzige Quelle der Wahrheit fuer Seed UND Tests.
 *
 * `slug` ist plattform-weit eindeutig; Unterkategorien sind daher bereichs-
 * praefigiert (z. B. "folierung-primer-kleber" vs. "ppf-primer"). `sdbPflicht`
 * markiert Chemie-Kategorien (Sicherheitsdatenblatt am Produkt spaeter Pflicht).
 * Hauptkategorien sind reine Container -> sdbPflicht=false, `bereich` == `slug`.
 */
export interface TaxonomyUnterkategorie {
  slug: string;
  name: string;
  /** true = Chemie-Kategorie (SDB-Pflicht am Produkt). */
  sdbPflicht: boolean;
}

export interface TaxonomyHauptkategorie {
  /** Top-Level-Slug == bereich (folierung | aufbereitung | ppf | sonstiges). */
  slug: string;
  name: string;
  unter: TaxonomyUnterkategorie[];
}

export const MARKETPLACE_TAXONOMY: TaxonomyHauptkategorie[] = [
  {
    slug: 'aufbereitung',
    name: 'Aufbereitung',
    unter: [
      { slug: 'aufbereitung-polituren', name: 'Polituren', sdbPflicht: true },
      { slug: 'aufbereitung-wachse-versiegelungen', name: 'Wachse & Versiegelungen', sdbPflicht: true },
      { slug: 'aufbereitung-keramik-nano', name: 'Keramik- & Nanoversiegelung', sdbPflicht: true },
      { slug: 'aufbereitung-innenreiniger', name: 'Innenreiniger', sdbPflicht: true },
      { slug: 'aufbereitung-aussenreiniger-shampoos', name: 'Außenreiniger & Shampoos', sdbPflicht: true },
      { slug: 'aufbereitung-felgenreiniger', name: 'Felgenreiniger', sdbPflicht: true },
      { slug: 'aufbereitung-insekten-teerentferner', name: 'Insekten- & Teerentferner', sdbPflicht: true },
      { slug: 'aufbereitung-lederpflege', name: 'Lederpflege', sdbPflicht: true },
      { slug: 'aufbereitung-kunststoff-gummipflege', name: 'Kunststoff- & Gummipflege', sdbPflicht: true },
      { slug: 'aufbereitung-glasreiniger-versiegelung', name: 'Glasreiniger & -versiegelung', sdbPflicht: true },
      { slug: 'aufbereitung-geruchsentfernung', name: 'Geruchsentfernung', sdbPflicht: true },
      { slug: 'aufbereitung-mikrofasertuecher', name: 'Mikrofasertücher', sdbPflicht: false },
      { slug: 'aufbereitung-pads-polierteller', name: 'Pads & Polierteller', sdbPflicht: false },
      { slug: 'aufbereitung-poliermaschinen-zubehoer', name: 'Poliermaschinen & Zubehör', sdbPflicht: false },
      { slug: 'aufbereitung-applikatoren-spruehflaschen', name: 'Applikatoren & Sprühflaschen', sdbPflicht: false },
      { slug: 'aufbereitung-schutzausruestung', name: 'Schutzausrüstung', sdbPflicht: false },
    ],
  },
  {
    slug: 'folierung',
    name: 'Folierung',
    unter: [
      { slug: 'folierung-wrapping-glanz', name: 'Wrapping Glanz', sdbPflicht: false },
      { slug: 'folierung-wrapping-matt', name: 'Wrapping Matt', sdbPflicht: false },
      { slug: 'folierung-wrapping-satin', name: 'Wrapping Satin', sdbPflicht: false },
      { slug: 'folierung-wrapping-farbwechsel', name: 'Wrapping Farbwechsel', sdbPflicht: false },
      { slug: 'folierung-wrapping-chrom', name: 'Wrapping Chrom', sdbPflicht: false },
      { slug: 'folierung-carbon', name: 'Carbon', sdbPflicht: false },
      { slug: 'folierung-scheibentoenung-sonnenschutz', name: 'Scheibentönung & Sonnenschutz', sdbPflicht: false },
      { slug: 'folierung-rakel-werkzeuge', name: 'Rakel & Werkzeuge', sdbPflicht: false },
      { slug: 'folierung-primer-kleber', name: 'Primer & Kleber', sdbPflicht: true },
      { slug: 'folierung-cutter-messer-klingen', name: 'Cutter, Messer & Klingen', sdbPflicht: false },
      { slug: 'folierung-heissluftfoehne', name: 'Heißluftföhne', sdbPflicht: false },
      { slug: 'folierung-reiniger-entfetter', name: 'Reiniger & Entfetter', sdbPflicht: true },
      { slug: 'folierung-magnete-halter', name: 'Magnete & Halter', sdbPflicht: false },
    ],
  },
  {
    slug: 'ppf',
    name: 'PPF (Lackschutzfolie)',
    unter: [
      { slug: 'ppf-klar', name: 'PPF klar', sdbPflicht: false },
      { slug: 'ppf-matt', name: 'PPF matt', sdbPflicht: false },
      { slug: 'ppf-farbig', name: 'PPF farbig', sdbPflicht: false },
      { slug: 'ppf-vorgeschnitten-software', name: 'Vorgeschnittene Sätze & Software-Zuschnitt', sdbPflicht: false },
      { slug: 'ppf-slip-tack-loesung', name: 'Slip- & Tack-Lösung', sdbPflicht: true },
      { slug: 'ppf-rakel', name: 'Rakel', sdbPflicht: false },
      { slug: 'ppf-primer', name: 'Primer', sdbPflicht: true },
      { slug: 'ppf-cutter', name: 'Cutter', sdbPflicht: false },
      { slug: 'ppf-zubehoer', name: 'Zubehör', sdbPflicht: false },
    ],
  },
];

/**
 * Legt die Kategorie-Taxonomie an – IDEMPOTENT: nur wenn die Tabelle leer ist
 * (spec: "nur anlegen wenn leer"). So darf der Auto-Seed beim Start beliebig
 * oft laufen, ohne den Baum zu verdoppeln. Reihenfolge: erst Hauptkategorie,
 * dann ihre Unterkategorien (parentId gesetzt, bereich denormalisiert).
 */
export async function seedMarketplaceCategories(
  dataSource: DataSource,
): Promise<{ angelegt: number; uebersprungen: boolean }> {
  const repo = dataSource.getRepository(MarketplaceCategory);
  const vorhanden = await repo.count();
  if (vorhanden > 0) return { angelegt: 0, uebersprungen: true };

  let angelegt = 0;
  for (const [hIndex, haupt] of MARKETPLACE_TAXONOMY.entries()) {
    const hauptRow = await repo.save(
      repo.create({
        parentId: null,
        slug: haupt.slug,
        name: haupt.name,
        bereich: haupt.slug,
        sortIndex: hIndex,
        aktiv: true,
        sdbPflicht: false,
      }),
    );
    angelegt += 1;

    for (const [uIndex, u] of haupt.unter.entries()) {
      await repo.save(
        repo.create({
          parentId: hauptRow.id,
          slug: u.slug,
          name: u.name,
          bereich: haupt.slug,
          sortIndex: uIndex,
          aktiv: true,
          sdbPflicht: u.sdbPflicht,
        }),
      );
      angelegt += 1;
    }
  }
  return { angelegt, uebersprungen: false };
}
