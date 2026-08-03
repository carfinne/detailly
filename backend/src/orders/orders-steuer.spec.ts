import { OrdersService } from './orders.service';
import { ServiceType } from './entities/order.entity';

/**
 * Finding #1: Der Auftrag muss mit dem ECHTEN Steuersatz des Betriebs rechnen –
 * insbesondere 0 % fuer Kleinunternehmer (§ 19 UStG), sonst zeigt der Auftrag eine
 * Phantom-MwSt (1.000 € netto -> 1.190 €), waehrend die daraus erzeugte Rechnung
 * korrekt mit 0 % (1.000 €) rechnet. Quelle des Satzes ist resolveSteuer(
 * tenant.settings.steuer) – identisch zum InvoicesService. Unit-Test mit gemockten
 * Repositories (kein DB-Zugriff).
 */
function makeService(over: { steuer?: Record<string, unknown> } = {}) {
  const repo: any = {
    create: jest.fn().mockImplementation((x: any) => ({ ...x })),
    count: jest.fn().mockResolvedValue(0), // nextSequentialNumber -> lfd 0001
    save: jest.fn().mockImplementation(async (o: any) => ({ ...o, id: 'ord-neu' })),
    findOne: jest.fn().mockImplementation(async () => ({ id: 'ord-neu' })),
  };
  const itemRepo: any = { create: jest.fn().mockImplementation((x: any) => ({ ...x })) };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) };
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue({ id: 't1', settings: { steuer: over.steuer ?? {} } }),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new OrdersService(
    repo, // Order
    itemRepo, // OrderItem
    customerRepo, // Customer
    {} as any, // Vehicle
    {} as any, // User
    {} as any, // Location
    tenantRepo, // Tenant
    {} as any, // Invoice
    audit, // audit
    { send: jest.fn() } as any, // mail
    { get: jest.fn() } as any, // config
    {} as any, // subscriptions
  );
  return { svc, repo, tenantRepo };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('OrdersService · Auftrags-MwSt nach Steuer-Einstellung (Finding #1)', () => {
  it('Kleinunternehmer (§ 19): 1.000 € netto -> 0 € MwSt, Brutto = 1.000 €', async () => {
    const { svc, repo, tenantRepo } = makeService({ steuer: { kleinunternehmer: true } });
    await svc.create(USER, {
      customerId: 'c1',
      serviceType: ServiceType.FOLIERUNG,
      items: [{ beschreibung: 'Vollfolierung', menge: 1, einzelpreis: 1000 }],
    } as any);

    const entity = repo.create.mock.calls[0][0];
    expect(entity.nettoSumme).toBe(1000);
    expect(entity.mwstBetrag).toBe(0);
    expect(entity.gesamtpreis).toBe(1000);
    // Satz kam tenant-scoped aus den Steuer-Einstellungen.
    expect(tenantRepo.findOne).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: ['id', 'settings'],
    });
  });

  it('Regelbesteuerung (Default): 1.000 € netto -> 190 € MwSt, Brutto = 1.190 € (unveraendert)', async () => {
    const { svc, repo } = makeService({ steuer: {} });
    await svc.create(USER, {
      customerId: 'c1',
      serviceType: ServiceType.FOLIERUNG,
      items: [{ beschreibung: 'Vollfolierung', menge: 1, einzelpreis: 1000 }],
    } as any);

    const entity = repo.create.mock.calls[0][0];
    expect(entity.nettoSumme).toBe(1000);
    expect(entity.mwstBetrag).toBe(190);
    expect(entity.gesamtpreis).toBe(1190);
  });
});
