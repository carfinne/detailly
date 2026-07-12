import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * Welle 1 (F3): Anzahlung als BRUTTO + Schlussrechnungs-Abzug. Unit-Test mit
 * gemockten Repositories; create()/createFromOrder werden teils gespyt.
 */
function makeService(over: { invoiceFindOne?: any; orderFindOne?: any; anzahlungen?: any[] } = {}) {
  const repo: any = {
    findOne: jest.fn().mockImplementation((opts: any) => {
      // Basis-Rechnung (createAnzahlung invoiceId) ODER finales findOne.
      if (over.invoiceFindOne) return over.invoiceFindOne(opts);
      return Promise.resolve({ id: opts?.where?.id, items: [] });
    }),
    find: jest.fn().mockResolvedValue(over.anzahlungen ?? []),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const orderRepo: any = {
    findOne: jest.fn().mockImplementation((opts: any) =>
      over.orderFindOne ? over.orderFindOne(opts) : Promise.resolve(null),
    ),
  };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 't1', name: 'X' }) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, {} as any, orderRepo, customerRepo, tenantRepo, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, repo, orderRepo };
}

const USER: any = { id: 'u1', tenantId: 't1' };
const round2 = (n: number) => Math.round(n * 100) / 100;

describe('InvoicesService · Anzahlung als Brutto (F3)', () => {
  it('500 € brutto bei 19% -> netto 420,17; Beleg-Brutto wieder exakt 500,00', async () => {
    const { svc, repo } = makeService({
      orderFindOne: () =>
        Promise.resolve({ id: 'o1', tenantId: 't1', gesamtpreis: '1000', customerId: 'c1', auftragsnummer: 'AU-2026-0001' }),
    });
    const spy = jest.spyOn(svc, 'create').mockResolvedValue({ id: 'inv1' } as any);

    await svc.createAnzahlung(USER, { orderId: 'o1', betragBrutto: 500 } as any);

    const dto = spy.mock.calls[0][1] as any;
    expect(dto.art).toBe(InvoiceKind.RECHNUNG);
    expect(dto.mwstSatz).toBe(19);
    const netto = dto.items[0].einzelpreis;
    expect(netto).toBe(420.17);
    // Nachrechnen wie totals(): Kunde zahlt exakt 500,00.
    const mwst = round2(netto * 0.19);
    expect(round2(netto + mwst)).toBe(500);
    // Anzahlungs-Flag gesetzt, tenant-scoped; ohne Basis-Rechnung -> Verweis null.
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'inv1', tenantId: 't1' },
      { istAnzahlung: true, anzahlungFuerInvoiceId: null },
    );
  });

  it('Prozent vom Basis-Brutto einer Rechnung -> netto herausgerechnet + Verweis auf Basis', async () => {
    const basis = {
      id: 'RE-BASE', tenantId: 't1', brutto: '1000', mwstSatz: '19',
      customerId: 'c1', orderId: 'o1', nummer: 'RE-2026-0001',
    };
    const { svc, repo } = makeService({
      invoiceFindOne: (opts: any) =>
        Promise.resolve(opts?.where?.id === 'RE-BASE' ? basis : { id: 'inv1', items: [] }),
    });
    const spy = jest.spyOn(svc, 'create').mockResolvedValue({ id: 'inv1' } as any);

    await svc.createAnzahlung(USER, { invoiceId: 'RE-BASE', prozent: 30 } as any);

    const dto = spy.mock.calls[0][1] as any;
    // 30% von 1000 = 300 brutto -> netto round2(300/1.19) = 252.10.
    expect(dto.items[0].einzelpreis).toBe(252.1);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'inv1', tenantId: 't1' },
      { istAnzahlung: true, anzahlungFuerInvoiceId: 'RE-BASE' },
    );
  });
});

describe('InvoicesService · Schlussrechnung zieht bezahlte Anzahlungen ab (F3)', () => {
  it('createFromOrder haengt negative Position mit gespeichertem Netto (kein Re-Rounding) an', async () => {
    const { svc } = makeService({
      orderFindOne: () =>
        Promise.resolve({
          id: 'o1', tenantId: 't1', customerId: 'c1', materialkosten: 0,
          items: [{ beschreibung: 'Vollfolierung', menge: 1, einzelpreis: 1000 }],
        }),
      anzahlungen: [
        { nummer: 'RE-2026-0005', netto: '420.17', status: InvoiceStatus.BEZAHLT, istAnzahlung: true },
      ],
    });
    const spy = jest.spyOn(svc, 'create').mockResolvedValue({ id: 'final1' } as any);

    await svc.createFromOrder(USER, 'o1', InvoiceKind.RECHNUNG);

    const dto = spy.mock.calls[0][1] as any;
    const abzug = dto.items.find((i: any) => i.einzelpreis < 0);
    expect(abzug).toBeDefined();
    expect(abzug.einzelpreis).toBe(-420.17);
    expect(abzug.beschreibung).toContain('RE-2026-0005');
  });

  it('Angebot (art=angebot) zieht KEINE Anzahlungen ab', async () => {
    const { svc, repo } = makeService({
      orderFindOne: () =>
        Promise.resolve({ id: 'o1', tenantId: 't1', customerId: 'c1', materialkosten: 0, items: [] }),
    });
    const spy = jest.spyOn(svc, 'create').mockResolvedValue({ id: 'ang1' } as any);

    await svc.createFromOrder(USER, 'o1', InvoiceKind.ANGEBOT);

    // repo.find (Anzahlungen) wird bei Angeboten gar nicht erst aufgerufen.
    expect(repo.find).not.toHaveBeenCalled();
    const dto = spy.mock.calls[0][1] as any;
    expect(dto.items.some((i: any) => i.einzelpreis < 0)).toBe(false);
  });
});
