import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

/**
 * GoBD/EUeR (Fix 2): markPaid setzt das Zahldatum nur beim ERSTEN Mal. Ein
 * idempotenter Re-Call auf BEZAHLT (statuswechselErlaubt(...,BEZAHLT,BEZAHLT)
 * liefert wegen von===nach true) darf den gebuchten Zahlungszufluss und damit
 * die Steuerperiode nie verschieben. Unit-Test mit gemocktem Repository.
 */
function makeService(stored: any) {
  // repo emuliert einen Store: findOne liefert die (mutierbare) Rechnung,
  // save schreibt zurueck und gibt sie zurueck.
  const repo: any = {
    findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
    save: jest.fn().mockImplementation((inv: any) => {
      Object.assign(stored, inv);
      return Promise.resolve(stored);
    }),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, {} as any, {} as any, {} as any, {} as any, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, repo };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('InvoicesService · markPaid (Zahldatum unveraenderlich)', () => {
  it('zweifacher markPaid -> Zahldatum bleibt beim ersten Wert', async () => {
    const stored: any = {
      id: 'inv1',
      tenantId: 't1',
      art: InvoiceKind.RECHNUNG,
      status: InvoiceStatus.OFFEN,
      zahldatum: null,
      items: [],
    };
    const { svc } = makeService(stored);

    await svc.markPaid(USER, 'inv1');
    const ersterWert = stored.zahldatum;
    expect(ersterWert).toBeInstanceOf(Date);
    expect(stored.status).toBe(InvoiceStatus.BEZAHLT);

    // Re-Call (jetzt bereits BEZAHLT, Zahldatum gesetzt) darf nichts verschieben.
    await svc.markPaid(USER, 'inv1');
    expect(stored.zahldatum).toBe(ersterWert); // identische Referenz -> nie neu gesetzt
  });

  it('vorbestehendes Zahldatum wird durch markPaid nicht ueberschrieben', async () => {
    const original = new Date('2026-01-15T10:00:00.000Z');
    const stored: any = {
      id: 'inv2',
      tenantId: 't1',
      art: InvoiceKind.RECHNUNG,
      status: InvoiceStatus.OFFEN,
      zahldatum: original,
      items: [],
    };
    const { svc } = makeService(stored);

    await svc.markPaid(USER, 'inv2');
    expect(stored.zahldatum).toBe(original);
  });
});
