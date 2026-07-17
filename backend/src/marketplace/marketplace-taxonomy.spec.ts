import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import {
  MARKETPLACE_TAXONOMY,
  seedMarketplaceCategories,
} from './data/marketplace-taxonomy';
import { MarketplaceCategory } from './entities/marketplace-category.entity';

/**
 * Datenmodell-Fundament PR1: die plattform-weite Kategorie-Taxonomie ist die
 * einzige Quelle der Wahrheit. Zwei Ebenen: reine Datenpruefung (Struktur/Slugs/
 * SDB-Flags) + ein Round-Trip gegen eine In-Memory-SQLite-DB (Seed + Idempotenz).
 */

const HAUPT_ANZAHL = 3;
const UNTER_ANZAHL = MARKETPLACE_TAXONOMY.reduce((n, h) => n + h.unter.length, 0);
const GESAMT = HAUPT_ANZAHL + UNTER_ANZAHL;

describe('Marktplatz-Taxonomie · Datenintegritaet', () => {
  it('hat genau drei Hauptbereiche (aufbereitung/folierung/ppf)', () => {
    expect(MARKETPLACE_TAXONOMY).toHaveLength(HAUPT_ANZAHL);
    expect(MARKETPLACE_TAXONOMY.map((h) => h.slug)).toEqual([
      'aufbereitung',
      'folierung',
      'ppf',
    ]);
  });

  it('deckt den vollen Umfang aus der Spec ab (16 + 13 + 9 Unterkategorien)', () => {
    const byBereich = Object.fromEntries(
      MARKETPLACE_TAXONOMY.map((h) => [h.slug, h.unter.length]),
    );
    expect(byBereich).toEqual({ aufbereitung: 16, folierung: 13, ppf: 9 });
  });

  it('alle Slugs (Haupt + Unter) sind plattform-weit eindeutig', () => {
    const slugs = MARKETPLACE_TAXONOMY.flatMap((h) => [
      h.slug,
      ...h.unter.map((u) => u.slug),
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('jeder Unter-Slug ist bereichs-praefigiert (garantiert Eindeutigkeit ueber Bereiche)', () => {
    for (const haupt of MARKETPLACE_TAXONOMY) {
      for (const u of haupt.unter) {
        expect(u.slug.startsWith(`${haupt.slug}-`)).toBe(true);
      }
    }
  });

  it('markiert die Chemie-Unterkategorien als SDB-pflichtig, Werkzeug/Textil nicht', () => {
    const sdb = new Map(
      MARKETPLACE_TAXONOMY.flatMap((h) => h.unter).map((u) => [u.slug, u.sdbPflicht]),
    );
    // Chemie -> SDB-Pflicht.
    for (const slug of [
      'aufbereitung-polituren',
      'aufbereitung-wachse-versiegelungen',
      'aufbereitung-innenreiniger',
      'folierung-primer-kleber',
      'folierung-reiniger-entfetter',
      'ppf-slip-tack-loesung',
      'ppf-primer',
    ]) {
      expect(sdb.get(slug)).toBe(true);
    }
    // Werkzeug/Textil/Folie -> keine SDB-Pflicht.
    for (const slug of [
      'aufbereitung-mikrofasertuecher',
      'aufbereitung-poliermaschinen-zubehoer',
      'folierung-wrapping-glanz',
      'folierung-rakel-werkzeuge',
      'ppf-klar',
      'ppf-rakel',
    ]) {
      expect(sdb.get(slug)).toBe(false);
    }
  });

  it('genau 15 SDB-pflichtige Unterkategorien (11 Aufbereitung + 2 Folierung + 2 PPF)', () => {
    const anzahl = MARKETPLACE_TAXONOMY.flatMap((h) => h.unter).filter(
      (u) => u.sdbPflicht,
    ).length;
    expect(anzahl).toBe(15);
  });
});

describe('seedMarketplaceCategories · Round-Trip (In-Memory-SQLite)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [MarketplaceCategory],
    });
    await ds.initialize();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('legt den vollen Baum an (Haupt mit parentId=null, Unter mit gesetztem Parent + denormalisiertem bereich)', async () => {
    const res = await seedMarketplaceCategories(ds);
    expect(res).toEqual({ angelegt: GESAMT, uebersprungen: false });

    const repo = ds.getRepository(MarketplaceCategory);
    expect(await repo.count()).toBe(GESAMT);

    // Hauptkategorien: parentId null, bereich == slug, sdbPflicht false.
    const haupt = await repo.find({ where: { parentId: IsNull() } });
    expect(haupt).toHaveLength(HAUPT_ANZAHL);
    for (const h of haupt) {
      expect(h.bereich).toBe(h.slug);
      expect(h.sdbPflicht).toBe(false);
    }

    // Beispiel-Unterkategorie: verweist auf ihren Parent + traegt den Bereich denormalisiert.
    const polituren = await repo.findOneOrFail({ where: { slug: 'aufbereitung-polituren' } });
    const aufbereitung = haupt.find((h) => h.slug === 'aufbereitung')!;
    expect(polituren.parentId).toBe(aufbereitung.id);
    expect(polituren.bereich).toBe('aufbereitung');
    expect(polituren.sdbPflicht).toBe(true);
  });

  it('ist idempotent: zweiter Lauf legt NICHTS an (nur wenn leer)', async () => {
    const res = await seedMarketplaceCategories(ds);
    expect(res).toEqual({ angelegt: 0, uebersprungen: true });
    expect(await ds.getRepository(MarketplaceCategory).count()).toBe(GESAMT);
  });
});
