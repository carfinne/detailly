import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * Welle 1 (§19 UStG): Ist der Betrieb Kleinunternehmer (tenant.settings.steuer.
 * kleinunternehmer === true), erzwingt der Service auf NEUEN/geaenderten Belegen
 * SERVERSEITIG 0 % MwSt – der vom Client uebergebene Satz wird ignoriert. Ohne
 * §19 gilt der Default = standardMwstSatz (statt hart 19). Unit-Test mit
 * gemockten Repositories.
 */
function makeService(steuer?: Record<string, unknown>) {
  let gespeichert: any = null;
  const repo: any = {
    create: (x: any) => x,
    save: jest.fn().mockImplementation((inv: any) => {
      gespeichert = { ...inv, id: inv.id ?? 'inv1' };
      return Promise.resolve(gespeichert);
    }),
    // finales findOne (this.findOne) liefert den gespeicherten Beleg zurueck.
    findOne: jest.fn().mockImplementation(() => Promise.resolve(gespeichert)),
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const itemRepo: any = { create: (x: any) => x, delete: jest.fn().mockResolvedValue({}) };
  const orderRepo: any = { findOne: jest.fn() };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) };
  // tenantRepo.findOne wird von steuerConfig UND defaultZahlungsziel genutzt.
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue({ id: 't1', settings: steuer ? { steuer } : {} }),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, itemRepo, orderRepo, customerRepo, tenantRepo, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, repo, orderRepo, get: () => gespeichert };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('InvoicesService · §19 Kleinunternehmer erzwingt 0 %', () => {
  it('create: Client sendet 19 %, §19 -> serverseitig 0 % (mwst = 0)', async () => {
    const { svc, get } = makeService({ kleinunternehmer: true });
    await svc.create(USER, {
      customerId: 'c1',
      art: InvoiceKind.RECHNUNG,
      mwstSatz: 19,
      items: [{ beschreibung: 'Politur', menge: 1, einzelpreis: 100 }],
    } as any);
    const saved = get();
    expect(Number(saved.mwstSatz)).toBe(0);
    expect(Number(saved.mwst)).toBe(0);
    expect(Number(saved.brutto)).toBe(100);
  });

  it('create ohne §19: Default = standardMwstSatz (0) statt hart 19', async () => {
    const { svc, get } = makeService({ kleinunternehmer: false, standardMwstSatz: 0 });
    await svc.create(USER, {
      customerId: 'c1',
      art: InvoiceKind.RECHNUNG,
      items: [{ beschreibung: 'Politur', menge: 1, einzelpreis: 100 }],
    } as any);
    expect(Number(get().mwstSatz)).toBe(0);
  });

  it('create ohne §19: expliziter Client-Satz 7 % bleibt erhalten (keine Regression)', async () => {
    const { svc, get } = makeService(); // kein steuer-Block -> Defaults (19)
    await svc.create(USER, {
      customerId: 'c1',
      art: InvoiceKind.RECHNUNG,
      mwstSatz: 7,
      items: [{ beschreibung: 'Politur', menge: 1, einzelpreis: 100 }],
    } as any);
    expect(Number(get().mwstSatz)).toBe(7);
    expect(Number(get().mwst)).toBe(7);
  });

  it('update: §19 erzwingt 0 % auch beim Bearbeiten eines Entwurfs (Client 19 ignoriert)', async () => {
    const { svc, repo } = makeService({ kleinunternehmer: true });
    // Entwurf, den update() zuerst laedt (findOne).
    repo.findOne.mockResolvedValueOnce({
      id: 'inv1',
      tenantId: 't1',
      art: InvoiceKind.RECHNUNG,
      status: InvoiceStatus.ENTWURF,
      mwstSatz: 19,
      items: [{ beschreibung: 'A', menge: 1, einzelpreis: 100, gesamtpreis: 100 }],
    });
    await svc.update(USER, 'inv1', { mwstSatz: 19 } as any);
    // save() bekommt die auf 0 % korrigierte Rechnung.
    const savedArg = repo.save.mock.calls[0][0];
    expect(Number(savedArg.mwstSatz)).toBe(0);
    expect(Number(savedArg.mwst)).toBe(0);
  });

  it('createFromOrder: §19 erzwingt 0 % (via create) trotz mwstSatz-Parameter 19', async () => {
    const { svc, orderRepo, get } = makeService({ kleinunternehmer: true });
    orderRepo.findOne.mockResolvedValue({
      id: 'o1',
      tenantId: 't1',
      customerId: 'c1',
      materialkosten: 0,
      items: [{ beschreibung: 'Vollaufbereitung', menge: 1, einzelpreis: 200 }],
    });
    await svc.createFromOrder(USER, 'o1', InvoiceKind.RECHNUNG, 19);
    const saved = get();
    expect(Number(saved.mwstSatz)).toBe(0);
    expect(Number(saved.mwst)).toBe(0);
    expect(Number(saved.brutto)).toBe(200);
  });
});
