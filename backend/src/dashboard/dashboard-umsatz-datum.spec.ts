import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { ReportsService } from '../reports/reports.service';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { resetEncryptionKeyCache } from '../common/crypto/encryption';

/**
 * REAL-DB-Integration (In-Memory-SQLite): Dashboard und Auswertungen (Reports)
 * muessen Umsatz nach DEMSELBEN Datum fenstern. Frueher fensterte das Dashboard
 * ueber das Anlage-Datum (createdAt), die Auswertungen ueber das Belegdatum
 * (datum) -> eine am 28.12. angelegte, am 03.01. festgesetzte Rechnung landete im
 * Dashboard im Dezember, in den Auswertungen im Januar. Der Fix stellt das
 * Dashboard auf `datum` um. Hier: eine Rechnung mit createdAt=Dez, datum=Jan muss
 * in BEIDEN in DENSELBEN Monat (Januar) zaehlen.
 */
describe('Dashboard vs. Auswertungen · Umsatz nach Belegdatum (Real-DB)', () => {
  let ds: DataSource;
  let dash: DashboardService;
  let reports: ReportsService;

  const TENANT = 't1';
  const BRUTTO = 500;

  const janStart = new Date('2026-01-01T00:00:00.000');
  const janEnd = new Date('2026-01-31T23:59:59.999');
  const dezStart = new Date('2025-12-01T00:00:00.000');
  const dezEnd = new Date('2025-12-31T23:59:59.999');

  beforeAll(async () => {
    process.env.DATA_ENC_KEY = 'a'.repeat(64);
    resetEncryptionKeyCache();
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Invoice, InvoiceItem, Order, OrderItem, Customer],
    });
    await ds.initialize();
    const invoiceRepo: Repository<Invoice> = ds.getRepository(Invoice);
    const orderRepo = ds.getRepository(Order);
    const customerRepo = ds.getRepository(Customer);

    // Dashboard nutzt fuer bruttoSumme nur den invoiceRepo -> uebrige Repos Dummy.
    dash = new DashboardService(
      {} as any, // orderRepo
      {} as any, // apptRepo
      {} as any, // customerRepo
      {} as any, // vehicleRepo
      invoiceRepo,
      {} as any, // productRepo
      {} as any, // tenantRepo
    );
    reports = new ReportsService(orderRepo, invoiceRepo, customerRepo);

    // Rechnung: am 28.12.2025 ANGELEGT (createdAt), am 03.01.2026 FESTGESETZT (datum),
    // bezahlt. createdAt ist eine @CreateDateColumn -> nach dem Insert per RAW-SQL
    // deterministisch auf Dezember setzen (der Kern des Bugs).
    const inv = await invoiceRepo.save(
      invoiceRepo.create({
        tenantId: TENANT,
        nummer: 'RE-2026-0001',
        art: InvoiceKind.RECHNUNG,
        status: InvoiceStatus.BEZAHLT,
        customerId: 'c1',
        datum: new Date('2026-01-03T10:00:00.000'),
        zahldatum: new Date('2026-01-03T10:00:00.000'),
        netto: 420.17,
        mwst: 79.83,
        brutto: BRUTTO,
        mwstSatz: 19,
      } as Invoice),
    );
    await ds.query('UPDATE invoices SET "createdAt" = ? WHERE id = ?', [
      '2025-12-28 12:00:00.000',
      inv.id,
    ]);
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    delete process.env.DATA_ENC_KEY;
    resetEncryptionKeyCache();
  });

  it('Dashboard zaehlt die Rechnung in den JANUAR (Belegdatum), nicht in den Dezember (Anlage-Datum)', async () => {
    const jan = await (dash as any).bruttoSumme(TENANT, InvoiceStatus.BEZAHLT, janStart, janEnd);
    const dez = await (dash as any).bruttoSumme(TENANT, InvoiceStatus.BEZAHLT, dezStart, dezEnd);
    expect(jan).toBe(BRUTTO); // frueher (createdAt-Fenster) waere Januar = 0 gewesen
    expect(dez).toBe(0); // frueher (createdAt-Fenster) waere Dezember = 500 gewesen
  });

  it('Auswertungen (Reports) zaehlen dieselbe Rechnung ebenfalls in den JANUAR', async () => {
    const rJan = await reports.overview(TENANT, '2026-01-01', '2026-01-31');
    const rDez = await reports.overview(TENANT, '2025-12-01', '2025-12-31');
    expect(rJan.umsatzBezahlt).toBe(BRUTTO);
    expect(rDez.umsatzBezahlt).toBe(0);
  });

  it('Dashboard und Auswertungen sind konsistent (gleicher Monat, gleicher Betrag)', async () => {
    const dashJan = await (dash as any).bruttoSumme(TENANT, InvoiceStatus.BEZAHLT, janStart, janEnd);
    const dashDez = await (dash as any).bruttoSumme(TENANT, InvoiceStatus.BEZAHLT, dezStart, dezEnd);
    const rJan = await reports.overview(TENANT, '2026-01-01', '2026-01-31');
    const rDez = await reports.overview(TENANT, '2025-12-01', '2025-12-31');
    expect(dashJan).toBe(rJan.umsatzBezahlt);
    expect(dashDez).toBe(rDez.umsatzBezahlt);
  });
});
