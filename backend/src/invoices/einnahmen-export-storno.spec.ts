import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InvoicesService } from './invoices.service';
import { AccountingExportService } from './accounting-export.service';
import { resetEncryptionKeyCache } from '../common/crypto/encryption';

/**
 * REAL-DB-Integration (In-Memory-SQLite) fuer den ZUFLUSS-basierten Einnahmen-
 * Export (EUeR). Kern: Ein Storno-Beleg (selbst BEZAHLT + Zahldatum=heute, damit
 * er nicht ins Mahnwesen laeuft) darf nur dann als Rueckfluss zaehlen, wenn die
 * stornierte Ursprungsrechnung TATSAECHLICH EINMAL BEZAHLT war (orig.zahldatum
 * gesetzt). Storno einer NIE bezahlten Rechnung -> KEINE Minus-Einnahme.
 * Nur ein echter Repository-Round-Trip beweist die (SQL-seitige) Join-Bedingung.
 */
describe('InvoicesService · Zufluss-Export: Storno nur bei zuvor bezahltem Original (Real-DB)', () => {
  let ds: DataSource;
  let svc: InvoicesService;
  let invoiceRepo: Repository<Invoice>;

  const TENANT = 't1';
  const von = new Date('2026-01-01T00:00:00.000');
  const bis = new Date('2026-12-31T23:59:59.999');

  const mkInvoice = (over: Partial<Invoice>): Invoice =>
    invoiceRepo.create({
      tenantId: TENANT,
      art: InvoiceKind.RECHNUNG,
      customerId: 'c1',
      mwstSatz: 19,
      ...over,
    } as Invoice);

  beforeAll(async () => {
    process.env.DATA_ENC_KEY = 'a'.repeat(64); // deterministischer Test-Key (encrypted columns)
    resetEncryptionKeyCache();
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Invoice, InvoiceItem, Customer],
    });
    await ds.initialize();
    invoiceRepo = ds.getRepository(Invoice);
    const customerRepo = ds.getRepository(Customer);
    const tenantRepo: any = { findOne: jest.fn().mockResolvedValue({ id: TENANT, settings: {} }) };
    svc = new InvoicesService(
      invoiceRepo,
      ds.getRepository(InvoiceItem),
      {} as any, // orderRepo (ungenutzt)
      customerRepo,
      tenantRepo,
      {} as any, // audit
      {} as any, // sevdesk
      {} as any, // pdf
      {} as any, // mail
      new AccountingExportService(),
    );

    await customerRepo.save(customerRepo.create({ tenantId: TENANT, lastName: 'Muster' } as Customer));
    const kunde = await customerRepo.findOneOrFail({ where: { tenantId: TENANT } });

    // --- Szenario A: NIE bezahlte Ursprungsrechnung (OFFEN, zahldatum NULL) + Storno ---
    const origUnpaid = await invoiceRepo.save(
      mkInvoice({
        nummer: 'RE-2026-0001',
        status: InvoiceStatus.OFFEN,
        customerId: kunde.id,
        datum: new Date('2026-03-01T09:00:00.000'),
        zahldatum: null as unknown as Date,
        netto: 100,
        mwst: 19,
        brutto: 119,
      }),
    );
    await invoiceRepo.save(
      mkInvoice({
        nummer: 'RE-2026-0002',
        status: InvoiceStatus.BEZAHLT, // Storno-Beleg ist selbst BEZAHLT (Zahldatum=heute)
        customerId: kunde.id,
        datum: new Date('2026-03-05T09:00:00.000'),
        zahldatum: new Date('2026-03-05T09:00:00.000'),
        netto: -100,
        mwst: -19,
        brutto: -119,
        stornoVonInvoiceId: origUnpaid.id,
      }),
    );

    // --- Szenario B: BEZAHLTE Ursprungsrechnung (zahldatum gesetzt) + Storno ---
    const origPaid = await invoiceRepo.save(
      mkInvoice({
        nummer: 'RE-2026-0003',
        status: InvoiceStatus.BEZAHLT,
        customerId: kunde.id,
        datum: new Date('2026-04-01T09:00:00.000'),
        zahldatum: new Date('2026-04-02T09:00:00.000'),
        netto: 200,
        mwst: 38,
        brutto: 238,
      }),
    );
    await invoiceRepo.save(
      mkInvoice({
        nummer: 'RE-2026-0004',
        status: InvoiceStatus.BEZAHLT,
        customerId: kunde.id,
        datum: new Date('2026-04-10T09:00:00.000'),
        zahldatum: new Date('2026-04-10T09:00:00.000'),
        netto: -200,
        mwst: -38,
        brutto: -238,
        stornoVonInvoiceId: origPaid.id,
      }),
    );
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    delete process.env.DATA_ENC_KEY;
    resetEncryptionKeyCache();
  });

  it('Storno einer NIE bezahlten Rechnung erscheint NICHT im Zufluss-Export', async () => {
    const { invoices } = await (svc as any).collectPaidForExport(TENANT, von, bis);
    const nummern: string[] = invoices.map((i: Invoice) => i.nummer);
    // Weder die offene Ursprungsrechnung (nicht BEZAHLT) noch ihr Storno gehoeren hinein.
    expect(nummern).not.toContain('RE-2026-0001');
    expect(nummern).not.toContain('RE-2026-0002');
  });

  it('Storno einer BEZAHLTEN Rechnung erscheint weiterhin als Rueckfluss (-238)', async () => {
    const { invoices } = await (svc as any).collectPaidForExport(TENANT, von, bis);
    const byNummer = new Map<string, Invoice>(invoices.map((i: Invoice) => [i.nummer, i]));
    // Bezahltes Original (+238) UND sein Storno (-238) sind beide enthalten.
    expect(byNummer.has('RE-2026-0003')).toBe(true);
    expect(byNummer.has('RE-2026-0004')).toBe(true);
    expect(Number(byNummer.get('RE-2026-0004')!.brutto)).toBe(-238);
  });

  it('Gesamtsumme des Zufluss-Exports: +238 -238 = 0 (kein phantom -119)', async () => {
    const { invoices } = await (svc as any).collectPaidForExport(TENANT, von, bis);
    const summe = invoices.reduce((a: number, i: Invoice) => a + Number(i.brutto), 0);
    // Ohne den Fix stuende hier -119 (der Storno der nie bezahlten Rechnung).
    expect(summe).toBe(0);
  });
});
