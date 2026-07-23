import { VehiclesService, normalizeKennzeichen } from './vehicles.service';

/**
 * Tests fuer die Kennzeichen-Schnellsuche (Welle 4, Paket F). Fokus:
 *  - Tenant-Isolation: ein fremdes Kennzeichen (anderer Betrieb) liefert NICHTS.
 *  - tolerante Normalisierung (Gross/Klein, Leerzeichen, Bindestrich).
 *  - schlanke Projektion: Fahrzeug + minimaler Kunde + letzte Auftraege.
 * Gemockte Repositories; der Fahrzeug-QueryBuilder wird faithful nachgebildet
 * (filtert nach dem uebergebenen tenantId- UND Kennzeichen-Parameter), damit der
 * Isolations-Test die WHERE-Semantik echt prueft und nicht nur Aufruf-Argumente.
 */

interface Row {
  id: string;
  tenantId: string;
  customerId: string;
  make?: string;
  model?: string;
  variant?: string | null;
  year?: number | null;
  color?: string | null;
  licensePlate?: string | null;
  fuelType?: string | null;
  createdAt: Date;
}
interface Cust {
  id: string;
  tenantId: string;
  type?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}
interface Ord {
  id: string;
  tenantId: string;
  vehicleId: string;
  auftragsnummer: string;
  serviceType: string;
  status: string;
  createdAt: Date;
}

function makeVehicleRepo(rows: Row[]) {
  const createQueryBuilder = jest.fn(() => {
    const params: Record<string, unknown> = {};
    const qb: any = {
      select: () => qb,
      where: (_c: string, p: Record<string, unknown>) => {
        Object.assign(params, p);
        return qb;
      },
      andWhere: (_c: string, p: Record<string, unknown>) => {
        Object.assign(params, p);
        return qb;
      },
      orderBy: () => qb,
      getOne: async () =>
        rows
          // Tenant-Filter zuerst – exakt wie der WHERE-Zweig der Query.
          .filter((r) => r.tenantId === params.tenantId)
          // Die echte Query vergleicht gegen die Spalte kennzeichenNormalisiert;
          // deren Inhalt (Entity-Hooks) ist genau normalizeKennzeichen(licensePlate).
          .filter((r) => normalizeKennzeichen(r.licensePlate) === params.kennzeichen)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
    };
    return qb;
  });
  return { createQueryBuilder } as any;
}

function makeCustomerRepo(rows: Cust[]) {
  return {
    findOne: jest.fn(async ({ where }: any) =>
      rows.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null,
    ),
  } as any;
}

function makeOrderRepo(rows: Ord[]) {
  return {
    find: jest.fn(async ({ where, take }: any) => {
      const list = rows
        .filter((r) => r.tenantId === where.tenantId && r.vehicleId === where.vehicleId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return typeof take === 'number' ? list.slice(0, take) : list;
    }),
  } as any;
}

function makeService(opts: { vehicles?: Row[]; customers?: Cust[]; orders?: Ord[] } = {}) {
  const vehicleRepo = makeVehicleRepo(opts.vehicles ?? []);
  const orderRepo = makeOrderRepo(opts.orders ?? []);
  const customerRepo = makeCustomerRepo(opts.customers ?? []);
  const audit: any = { log: jest.fn() };
  const svc = new VehiclesService(vehicleRepo, orderRepo, customerRepo, audit);
  return { svc, vehicleRepo, orderRepo, customerRepo };
}

const T1 = 't1';
const T2 = 't2';

describe('VehiclesService.lookupByKennzeichen', () => {
  it('findet das eigene Fahrzeug + minimalen Kunden + letzte Auftraege (schlanke Projektion)', async () => {
    const { svc } = makeService({
      vehicles: [
        {
          id: 'v1',
          tenantId: T1,
          customerId: 'c1',
          make: 'BMW',
          model: 'M3',
          variant: 'Competition',
          year: 2021,
          color: 'schwarz',
          licensePlate: 'K-AB 123',
          fuelType: 'petrol',
          createdAt: new Date('2026-01-01'),
        },
      ],
      customers: [
        { id: 'c1', tenantId: T1, type: 'private', firstName: 'Max', lastName: 'Mustermann', companyName: null },
      ],
      orders: [
        { id: 'o1', tenantId: T1, vehicleId: 'v1', auftragsnummer: 'AU-2026-0001', serviceType: 'ppf', status: 'fertig', createdAt: new Date('2026-02-01') },
        { id: 'o2', tenantId: T1, vehicleId: 'v1', auftragsnummer: 'AU-2026-0002', serviceType: 'folierung', status: 'in_arbeit', createdAt: new Date('2026-03-01') },
      ],
    });

    const res = await svc.lookupByKennzeichen(T1, 'K-AB 123');
    expect(res.found).toBe(true);
    expect(res.vehicle).toMatchObject({ id: 'v1', make: 'BMW', model: 'M3', licensePlate: 'K-AB 123' });
    expect(res.customer).toMatchObject({ id: 'c1', firstName: 'Max', lastName: 'Mustermann' });
    // Neueste zuerst, auf N begrenzt.
    expect(res.recentOrders.map((o) => o.id)).toEqual(['o2', 'o1']);
    // Datensparsamkeit: keine sensiblen/ueberfluessigen Felder in der Projektion.
    expect(res.customer).not.toHaveProperty('email');
    expect(res.customer).not.toHaveProperty('phone');
    expect(res.vehicle).not.toHaveProperty('vin');
    expect(res.vehicle).not.toHaveProperty('notes');
  });

  it('normalisiert tolerant (Gross/Klein, Leerzeichen, Bindestrich)', async () => {
    const { svc } = makeService({
      vehicles: [
        { id: 'v1', tenantId: T1, customerId: 'c1', make: 'VW', model: 'Golf', licensePlate: 'K-AB 123', createdAt: new Date('2026-01-01') },
      ],
      customers: [{ id: 'c1', tenantId: T1, type: 'private', firstName: 'A', lastName: 'B' }],
    });
    for (const eingabe of ['k ab-123', 'KAB123', '  k-ab-123 ', 'k-AB 123']) {
      const res = await svc.lookupByKennzeichen(T1, eingabe);
      expect(res.found).toBe(true);
      expect(res.vehicle?.id).toBe('v1');
    }
  });

  it('findet Umlaut- und E-Kennzeichen ueber tolerante Eingabe (Ende-zu-Ende)', async () => {
    const { svc } = makeService({
      vehicles: [
        { id: 'vu', tenantId: T1, customerId: 'c1', make: 'VW', model: 'ID.3', licensePlate: 'LÖ-AB 12', createdAt: new Date('2026-01-01') },
        { id: 've', tenantId: T1, customerId: 'c1', make: 'Tesla', model: 'Model 3', licensePlate: 'M-AB 123E', createdAt: new Date('2026-01-02') },
      ],
      customers: [{ id: 'c1', tenantId: T1, type: 'private', firstName: 'A', lastName: 'B' }],
    });
    expect((await svc.lookupByKennzeichen(T1, 'lö ab 12')).vehicle?.id).toBe('vu');
    expect((await svc.lookupByKennzeichen(T1, 'm-ab 123e')).vehicle?.id).toBe('ve');
    // Gegenprobe: ohne E-Suffix darf das E-Kennzeichen NICHT matchen.
    expect((await svc.lookupByKennzeichen(T1, 'm-ab 123')).found).toBe(false);
  });

  it('TENANT-ISOLATION: fremdes Kennzeichen (anderer Betrieb) liefert NICHTS', async () => {
    const { svc, customerRepo, orderRepo } = makeService({
      // Das Kennzeichen existiert ausschliesslich unter T2.
      vehicles: [
        { id: 'v2', tenantId: T2, customerId: 'c2', make: 'Audi', model: 'A4', licensePlate: 'M-XY 999', createdAt: new Date('2026-01-01') },
      ],
      customers: [{ id: 'c2', tenantId: T2, type: 'private', firstName: 'Fremd', lastName: 'Kunde' }],
      orders: [
        { id: 'ox', tenantId: T2, vehicleId: 'v2', auftragsnummer: 'AU-2026-9999', serviceType: 'ppf', status: 'fertig', createdAt: new Date('2026-02-01') },
      ],
    });

    // T1 sucht das Kennzeichen von T2 -> kein Treffer, kein Leak.
    const res = await svc.lookupByKennzeichen(T1, 'M-XY 999');
    expect(res.found).toBe(false);
    expect(res.vehicle).toBeNull();
    expect(res.customer).toBeNull();
    expect(res.recentOrders).toEqual([]);
    // Ohne Fahrzeug-Treffer werden Kunde/Auftraege gar nicht erst geladen.
    expect(customerRepo.findOne).not.toHaveBeenCalled();
    expect(orderRepo.find).not.toHaveBeenCalled();

    // Gegenprobe: T2 findet sein eigenes Fahrzeug sehr wohl.
    const eigen = await svc.lookupByKennzeichen(T2, 'M-XY 999');
    expect(eigen.found).toBe(true);
    expect(eigen.vehicle?.id).toBe('v2');
  });

  it('gibt nur die letzten Auftraege DIESES Fahrzeugs (kein Fremd-Fahrzeug/-Tenant)', async () => {
    const { svc } = makeService({
      vehicles: [
        { id: 'v1', tenantId: T1, customerId: 'c1', make: 'VW', model: 'Golf', licensePlate: 'K-AB 123', createdAt: new Date('2026-01-01') },
      ],
      customers: [{ id: 'c1', tenantId: T1, type: 'private', firstName: 'A', lastName: 'B' }],
      orders: [
        { id: 'o1', tenantId: T1, vehicleId: 'v1', auftragsnummer: 'AU-1', serviceType: 'ppf', status: 'fertig', createdAt: new Date('2026-02-01') },
        // anderes Fahrzeug, gleicher Tenant -> darf NICHT erscheinen
        { id: 'o2', tenantId: T1, vehicleId: 'vX', auftragsnummer: 'AU-2', serviceType: 'ppf', status: 'fertig', createdAt: new Date('2026-03-01') },
        // gleicher vehicleId, anderer Tenant -> darf NICHT erscheinen
        { id: 'o3', tenantId: T2, vehicleId: 'v1', auftragsnummer: 'AU-3', serviceType: 'ppf', status: 'fertig', createdAt: new Date('2026-04-01') },
      ],
    });
    const res = await svc.lookupByKennzeichen(T1, 'K-AB 123');
    expect(res.recentOrders.map((o) => o.id)).toEqual(['o1']);
  });

  it('leeres oder zu kurzes Kennzeichen -> found=false ohne DB-Zugriff', async () => {
    const { svc, vehicleRepo } = makeService({
      vehicles: [
        { id: 'v1', tenantId: T1, customerId: 'c1', make: 'VW', model: 'Golf', licensePlate: 'K-AB 123', createdAt: new Date('2026-01-01') },
      ],
    });
    for (const eingabe of ['', '   ', '-', 'A']) {
      const res = await svc.lookupByKennzeichen(T1, eingabe);
      expect(res.found).toBe(false);
      expect(res.vehicle).toBeNull();
    }
    expect(vehicleRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('unbekanntes Kennzeichen (eigener Tenant, kein Match) -> found=false', async () => {
    const { svc } = makeService({
      vehicles: [
        { id: 'v1', tenantId: T1, customerId: 'c1', make: 'VW', model: 'Golf', licensePlate: 'K-AB 123', createdAt: new Date('2026-01-01') },
      ],
    });
    const res = await svc.lookupByKennzeichen(T1, 'HH-ZZ 1');
    expect(res.found).toBe(false);
    expect(res.kennzeichen).toBe('HHZZ1');
  });
});

describe('normalizeKennzeichen', () => {
  it('vereinheitlicht Gross/Klein, Leerzeichen, Bindestriche und deckelt die Laenge', () => {
    expect(normalizeKennzeichen('k-ab 123')).toBe('KAB123');
    expect(normalizeKennzeichen('  m xy-9  ')).toBe('MXY9');
    expect(normalizeKennzeichen(null)).toBe('');
    expect(normalizeKennzeichen('A'.repeat(50)).length).toBe(32);
  });

  it('erhaelt Umlaut-Staedtekuerzel (Ö/Ü/Ä) und schreibt sie gross', () => {
    // Deutsche Unterscheidungszeichen mit Umlaut: LÖ (Loerrach), MÜ (Muenchen-Land
    // historisch), SÜW (Suedliche Weinstrasse). Die Normalisierung darf den Umlaut
    // NICHT strippen oder transliterieren – sonst faende "lö ab 12" das Fahrzeug
    // "LÖ-AB 12" nicht.
    expect(normalizeKennzeichen('lö-ab 12')).toBe('LÖAB12');
    expect(normalizeKennzeichen('mü cd 34')).toBe('MÜCD34');
    expect(normalizeKennzeichen('süw-x 5')).toBe('SÜWX5');
    expect(normalizeKennzeichen('LÖ AB 12')).toBe('LÖAB12');
  });

  it('behaelt das E-Kennzeichen-Suffix (Elektrofahrzeuge)', () => {
    // E-Kennzeichen tragen ein angehaengtes "E"; es ist Teil des Kennzeichens und
    // muss erhalten bleiben (sonst kollidiert "M-AB 123E" mit "M-AB 123").
    expect(normalizeKennzeichen('m-ab 123e')).toBe('MAB123E');
    expect(normalizeKennzeichen('M AB 123 E')).toBe('MAB123E');
    expect(normalizeKennzeichen('b-ev 100e')).toBe('BEV100E');
  });

  it('uppercased Umlaut-Staedtekuerzel (LOE/MUE/SUEW) korrekt – anders als SQLites UPPER()', () => {
    expect(normalizeKennzeichen('lö-ab 123')).toBe('LÖAB123');
    expect(normalizeKennzeichen('mü-c 45')).toBe('MÜC45');
    expect(normalizeKennzeichen('süw-de 6')).toBe('SÜWDE6');
    // Bereits grosse Umlaute bleiben stabil (idempotent).
    expect(normalizeKennzeichen('LÖ-AB 123')).toBe('LÖAB123');
  });
});
