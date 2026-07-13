import 'reflect-metadata';
import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * Welle 2 (§19-Umsatzgrenzen-Waechter): summiert den laufenden Kalenderjahr-
 * Umsatz eines Kleinunternehmers gegen die 100.000-EUR-Grenze und liefert eine
 * Warnstufe. Unit-Test mit gemocktem QueryBuilder (keine DB) – prueft Schwellen,
 * §19-Bindung, Tenant-Scope und das Rollen-Gate am Endpoint.
 */
type Captured = { params: Record<string, unknown>; where: string[] };

function makeQb(summe: number) {
  const captured: Captured = { params: {}, where: [] };
  const qb: any = {
    select: () => qb,
    where: (c: string, p?: Record<string, unknown>) => {
      captured.where.push(c);
      if (p) Object.assign(captured.params, p);
      return qb;
    },
    andWhere: (c: string, p?: Record<string, unknown>) => {
      captured.where.push(c);
      if (p) Object.assign(captured.params, p);
      return qb;
    },
    getRawOne: () => Promise.resolve({ summe: String(summe) }),
  };
  return { qb, captured };
}

function makeService(steuer: Record<string, unknown> | undefined, summe = 0) {
  const { qb, captured } = makeQb(summe);
  const repo: any = { createQueryBuilder: jest.fn(() => qb) };
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue({ id: 't1', settings: steuer ? { steuer } : {} }),
  };
  const svc = new InvoicesService(
    repo,
    {} as any,
    {} as any,
    {} as any,
    tenantRepo,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { svc, repo, captured };
}

describe('InvoicesService · §19-Umsatzgrenzen-Waechter', () => {
  it('ohne §19: { istKleinunternehmer: false } OHNE DB-Aggregation', async () => {
    const { svc, repo } = makeService({ kleinunternehmer: false });
    const res = await svc.kleinunternehmerStatus('t1');
    expect(res).toEqual({ istKleinunternehmer: false });
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('ohne steuer-Block: nicht Kleinunternehmer', async () => {
    const { svc } = makeService(undefined);
    expect(await svc.kleinunternehmerStatus('t1')).toEqual({ istKleinunternehmer: false });
  });

  const scenarios: Array<[number, string]> = [
    [0, 'ok'],
    [50000, 'ok'],
    [79999.99, 'ok'],
    [80000, 'nah'],
    [94999.99, 'nah'],
    [95000, 'kritisch'],
    [99999.99, 'kritisch'],
    [100000, 'ueberschritten'],
    [150000, 'ueberschritten'],
  ];
  it.each(scenarios)('Umsatz %d EUR -> Warnstufe %s (Schwellen 80/95/100 %%)', async (summe, warn) => {
    const { svc } = makeService({ kleinunternehmer: true }, summe);
    const res = await svc.kleinunternehmerStatus('t1');
    expect(res.istKleinunternehmer).toBe(true);
    expect(res.grenze).toBe(100000);
    expect(res.jahr).toBe(new Date().getFullYear());
    expect(res.umsatzLaufend).toBeCloseTo(summe, 2);
    expect(res.warnstufe).toBe(warn);
  });

  it('Aggregation ist tenant-scoped und zaehlt nur festgesetzte Rechnungen (offen/bezahlt)', async () => {
    const { svc, captured } = makeService({ kleinunternehmer: true }, 1234.5);
    await svc.kleinunternehmerStatus('t1');
    expect(captured.params.tenantId).toBe('t1');
    expect(captured.params.art).toBe(InvoiceKind.RECHNUNG);
    expect(captured.params.status).toEqual([InvoiceStatus.OFFEN, InvoiceStatus.BEZAHLT]);
    // Erste Klausel bindet den Tenant -> keine Cross-Tenant-Summierung.
    expect(captured.where.some((w) => w.includes('i.tenantId'))).toBe(true);
  });

  it('Endpoint kleinunternehmer-status ist Leitung-only (OWNER/MANAGER), KEIN Feature-Gate', () => {
    const method = InvoicesController.prototype.kleinunternehmerStatus;
    expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual([UserRole.MANAGER, UserRole.OWNER]);
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, method)).toBeUndefined();
  });
});
