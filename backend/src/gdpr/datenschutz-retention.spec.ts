import { DatenschutzRetentionService } from './datenschutz-retention.service';
import { Tenant } from '../tenants/entities/tenant.entity';

/**
 * DSGVO-Retention-Job: prueft NUR Betriebe mit gesetzter Aufbewahrungsfrist (> 0),
 * strikt je tenantId, und loescht NICHTS (zaehlt nur die Pruefliste). Reiner
 * Unit-Test mit gemockter DataSource + gemocktem Cockpit-Service.
 */

function makeSvc(tenants: Array<{ id: string; settings: unknown }>, faelligProTenant: Record<string, number>) {
  const tenantRepo = { find: jest.fn(async () => tenants) };
  const getRepository = jest.fn((entity: unknown) => {
    if (entity === Tenant) return tenantRepo;
    return { find: jest.fn(async () => []) };
  });
  const dataSource = { getRepository } as any;

  const calls: string[] = [];
  const cockpit = {
    findFaelligeKunden: jest.fn(async (tenantId: string) => {
      calls.push(tenantId);
      return { anzahl: faelligProTenant[tenantId] ?? 0 };
    }),
  } as any;

  const svc = new DatenschutzRetentionService(dataSource, cockpit);
  return { svc, calls, cockpit };
}

describe('DatenschutzRetentionService.runDaily', () => {
  it('prueft nur Betriebe mit Frist > 0 und zaehlt die Faelligen', async () => {
    const { svc, calls } = makeSvc(
      [
        { id: 't1', settings: { datenschutz: { aufbewahrungInaktiveKundenJahre: 3 } } },
        { id: 't2', settings: { datenschutz: { aufbewahrungInaktiveKundenJahre: 0 } } }, // aus
        { id: 't3', settings: {} }, // Default 3 Jahre
      ],
      { t1: 2, t3: 0 },
    );

    const res = await svc.runDaily(new Date('2026-07-01T00:00:00.000Z'));

    // t2 (Frist 0) uebersprungen; t1 + t3 geprueft.
    expect(res.tenants).toBe(2);
    expect(res.faellig).toBe(2);
    expect(calls.sort()).toEqual(['t1', 't3']);
    expect(calls).not.toContain('t2');
  });

  it('isoliert Fehler je Betrieb (Lauf bricht nicht ab)', async () => {
    const tenantRepo = {
      find: jest.fn(async () => [
        { id: 't1', settings: { datenschutz: { aufbewahrungInaktiveKundenJahre: 3 } } },
        { id: 't2', settings: { datenschutz: { aufbewahrungInaktiveKundenJahre: 3 } } },
      ]),
    };
    const dataSource = { getRepository: jest.fn(() => tenantRepo) } as any;
    const cockpit = {
      findFaelligeKunden: jest.fn(async (tenantId: string) => {
        if (tenantId === 't1') throw new Error('db weg');
        return { anzahl: 5 };
      }),
    } as any;
    const svc = new DatenschutzRetentionService(dataSource, cockpit);

    const res = await svc.runDaily(new Date());
    expect(res.tenants).toBe(2);
    expect(res.fehler).toBe(1);
    expect(res.faellig).toBe(5);
  });
});
