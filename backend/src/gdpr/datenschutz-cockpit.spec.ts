import { DatenschutzCockpitService } from './datenschutz-cockpit.service';
import { Customer } from '../customers/entities/customer.entity';
import { Order } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Rental } from '../shop/entities/rental.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

/**
 * Datenschutz-Cockpit: findFaelligeKunden liefert NUR wirklich faellige Kunden
 * (letzter Kontakt < Frist-Cutoff) und ist strikt tenant-scoped. Reiner Unit-Test
 * mit gemockter DataSource (kein TypeORM).
 */

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Grouped-QueryBuilder-Mock: liefert getRawMany aus einer festen Zeilenliste. */
function groupedQb(rows: unknown[], capture?: (params: Record<string, unknown>) => void) {
  const qb: any = {};
  qb.select = () => qb;
  qb.addSelect = () => qb;
  qb.where = (_sql: string, params: Record<string, unknown> = {}) => {
    capture?.(params);
    return qb;
  };
  qb.andWhere = () => qb;
  qb.groupBy = () => qb;
  qb.getRawMany = async () => rows;
  return qb;
}

function buildService(opts: {
  fristJahre: number;
  candidates: Array<Partial<Customer>>;
  latestOrder?: Array<{ cid: string; maxd: string }>;
  capturedWheres?: Record<string, unknown>[];
}) {
  const now = new Date('2026-07-01T00:00:00.000Z');

  const tenantRepo = {
    findOne: jest.fn(async () => ({
      id: 't1',
      settings: { datenschutz: { aufbewahrungInaktiveKundenJahre: opts.fristJahre } },
    })),
  };
  const customerRepo = {
    find: jest.fn(async (query: any) => {
      opts.capturedWheres?.push(query?.where);
      return opts.candidates.map((c) => ({ ...c }));
    }),
  };

  const getRepository = jest.fn((entity: unknown) => {
    if (entity === Tenant) return tenantRepo;
    if (entity === Customer) return customerRepo;
    if (entity === Order) {
      return { createQueryBuilder: () => groupedQb(opts.latestOrder ?? []) };
    }
    if (entity === Appointment || entity === Invoice || entity === Rental) {
      return { createQueryBuilder: () => groupedQb([]) };
    }
    if (entity === DamageInspection) {
      return { createQueryBuilder: () => groupedQb([]) };
    }
    // Rechnungs-/Angebots-/Abgerechnet-Counts (Invoice/Order via COUNT) -> leer.
    return { createQueryBuilder: () => groupedQb([]) };
  });

  const dataSource = { getRepository } as any;
  const audit = { log: jest.fn() } as any;
  const svc = new DatenschutzCockpitService(dataSource, audit);
  return { svc, now, customerRepo };
}

describe('DatenschutzCockpitService.findFaelligeKunden', () => {
  it('Frist 0 -> Automatik aus (leere Liste, aktiv=false)', async () => {
    const { svc, now } = buildService({ fristJahre: 0, candidates: [] });
    const res = await svc.findFaelligeKunden('t1', now);
    expect(res.aktiv).toBe(false);
    expect(res.kunden).toHaveLength(0);
  });

  it('liefert nur Kunden, deren letzter Kontakt vor dem Cutoff liegt', async () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    const fuenfJahre = new Date(now.getTime() - 5 * YEAR_MS).toISOString();
    const einJahr = new Date(now.getTime() - 1 * YEAR_MS);

    const { svc } = buildService({
      fristJahre: 3,
      candidates: [
        // c1: Stammzeile 5 Jahre alt, keine juengere Aktivitaet -> FAELLIG.
        { id: 'c1', tenantId: 't1', lastName: 'Alt', anonymisiertAm: null, updatedAt: new Date(fuenfJahre) },
        // c2: Stammzeile alt, ABER Auftrag vor 1 Jahr -> NICHT faellig.
        { id: 'c2', tenantId: 't1', lastName: 'Neu', anonymisiertAm: null, updatedAt: new Date(fuenfJahre) },
      ],
      latestOrder: [{ cid: 'c2', maxd: einJahr.toISOString() }],
    });

    const res = await svc.findFaelligeKunden('t1', now);
    expect(res.aktiv).toBe(true);
    expect(res.anzahl).toBe(1);
    expect(res.kunden.map((k) => k.id)).toEqual(['c1']);
    // Ohne Belege -> Modus "geloescht".
    expect(res.kunden[0].modus).toBe('geloescht');
  });

  it('ist tenant-scoped: die Kandidaten-Query filtert auf tenantId', async () => {
    const capturedWheres: Record<string, unknown>[] = [];
    const now = new Date('2026-07-01T00:00:00.000Z');
    const { svc } = buildService({ fristJahre: 3, candidates: [], capturedWheres });
    await svc.findFaelligeKunden('t1', now);
    expect(capturedWheres[0]).toMatchObject({ tenantId: 't1' });
  });
});
