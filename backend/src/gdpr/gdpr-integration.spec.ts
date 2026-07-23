import 'reflect-metadata';
import { promises as fsp } from 'fs';
import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { GdprService } from './gdpr.service';
import { TenantExportService } from './tenant-export.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { BookingRequest } from '../public-booking/entities/booking-request.entity';
import { LayerMeasurement } from '../schichtdicke/entities/layer-measurement.entity';
import { LayerMeasurementPoint } from '../schichtdicke/entities/layer-measurement-point.entity';
import { DellenKalkulation } from '../dellenkalkulation/entities/dellen-kalkulation.entity';
import { DellenMarker } from '../dellenkalkulation/entities/dellen-marker.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { entities as ALL_ENTITIES } from '../database/data-source-options';

/**
 * REAL-DB-Integration (In-Memory-SQLite) fuer die DSGVO-Loeschung/-Anonymisierung
 * + den Betriebs-Export. Bewusst KEIN Voll-Mock: nur so schlagen echte Schema-
 * Fallen zu (z. B. Kind-Tabellen OHNE tenantId-Spalte wie OrderItem/InvoiceItem).
 * Registriert das VOLLE App-Entity-Set (data-source-options), damit Relationen
 * (z. B. PurchaseOrder->PurchaseOrderItem) konsistent aufgeloest werden.
 */

const ENTITIES = ALL_ENTITIES;

const USER: AuthUser = { id: 'op1', email: 'chef@a.de', role: 'owner', tenantId: 'T1' } as AuthUser;

describe('GdprService · Real-DB-Integration', () => {
  let ds: DataSource;
  let svc: GdprService;
  let tenantExport: TenantExportService;
  let auditStub: { log: jest.Mock };

  const repo = <T extends import('typeorm').ObjectLiteral>(e: { new (): T }): Repository<T> =>
    ds.getRepository(e);

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: ENTITIES,
    });
    await ds.initialize();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    // Frisches Schema je Test (einfachste Isolation).
    await ds.synchronize(true);
    auditStub = { log: jest.fn().mockResolvedValue(undefined) };
    svc = new GdprService(
      repo(Customer), repo(Vehicle), repo(Order), repo(OrderItem), repo(Invoice),
      repo(InvoiceItem), repo(Appointment), repo(DamageInspection), repo(DamageItem),
      repo(DamagePhoto), repo(DamageItemPhoto), repo(Rental), repo(AuditLog),
      ds, auditStub as never,
    );
    tenantExport = new TenantExportService(ds, auditStub as never);
  });

  // --- Fixtures ---------------------------------------------------------------

  async function customer(over: Partial<Customer> = {}): Promise<Customer> {
    return repo(Customer).save(
      repo(Customer).create({ tenantId: 'T1', firstName: 'Max', lastName: 'Muster', email: 'max@a.de', ...over }),
    );
  }
  async function order(customerId: string, over: Partial<Order> = {}): Promise<Order> {
    const o = await repo(Order).save(
      repo(Order).create({ tenantId: 'T1', auftragsnummer: `AU-${Math.random()}`, customerId, ...over }),
    );
    await repo(OrderItem).save(
      repo(OrderItem).create({ orderId: o.id, beschreibung: 'Politur' }),
    );
    return o;
  }
  async function invoice(customerId: string, over: Partial<Invoice> = {}): Promise<Invoice> {
    const inv = await repo(Invoice).save(
      repo(Invoice).create({ tenantId: 'T1', customerId, art: InvoiceKind.RECHNUNG, ...over }),
    );
    await repo(InvoiceItem).save(repo(InvoiceItem).create({ invoiceId: inv.id, beschreibung: 'Leistung' }));
    return inv;
  }

  async function tokenOf(entity: 'order' | 'invoice', id: string, col: string): Promise<string | null> {
    const table = entity === 'order' ? Order : Invoice;
    const row = await ds
      .getRepository(table)
      .createQueryBuilder('e')
      .addSelect(`e.${col}`, `e_${col}`)
      .where('e.id = :id', { id })
      .getOne();
    return (row as unknown as Record<string, string | null>)?.[col] ?? null;
  }

  // --- Harte Loeschung --------------------------------------------------------

  it('Kunde OHNE Belege -> HART geloescht inkl. OrderItem/InvoiceItem/Layer/Dellen', async () => {
    const c = await customer();
    const o = await order(c.id);
    const inv = await invoice(c.id, { nummer: null as never, status: InvoiceStatus.ENTWURF }); // Entwurf
    await repo(Vehicle).save(repo(Vehicle).create({ tenantId: 'T1', customerId: c.id, make: 'VW', model: 'Golf' }));
    await repo(Appointment).save(
      repo(Appointment).create({ tenantId: 'T1', customerId: c.id, titel: 'Termin', start: new Date(), ende: new Date() }),
    );
    await repo(OrderTime).save(repo(OrderTime).create({ tenantId: 'T1', orderId: o.id, userId: 'u', datum: new Date(), minuten: 30, erfasstVon: 'u' }));
    await repo(Rental).save(repo(Rental).create({ tenantId: 'T1', productId: 'p', customerId: c.id, von: new Date(), bis: new Date() }));
    await repo(BookingRequest).save(repo(BookingRequest).create({ tenantId: 'T1', name: 'Max', email: 'max@a.de', reference: 'R1' }));
    const mess = await repo(LayerMeasurement).save(repo(LayerMeasurement).create({ tenantId: 'T1', customerId: c.id, notiz: 'geheim' }));
    await repo(LayerMeasurementPoint).save(repo(LayerMeasurementPoint).create({ tenantId: 'T1', measurementId: mess.id, partId: 'tür-vl' }));
    const kalk = await repo(DellenKalkulation).save(repo(DellenKalkulation).create({ tenantId: 'T1', customerId: c.id, notiz: 'PDR' }));
    await repo(DellenMarker).save(repo(DellenMarker).create({ tenantId: 'T1', kalkulationId: kalk.id, bauteil: 'tuer' }));

    const res = await svc.deleteCustomer(USER, c.id);
    expect(res.modus).toBe('geloescht');

    // ALLES weg – insbesondere die Kind-Tabellen ohne tenantId (Fund 4/5).
    expect(await repo(Customer).count()).toBe(0);
    expect(await repo(Order).count()).toBe(0);
    expect(await repo(OrderItem).count()).toBe(0);
    expect(await repo(Invoice).count()).toBe(0);
    expect(await repo(InvoiceItem).count()).toBe(0);
    expect(await repo(Vehicle).count()).toBe(0);
    expect(await repo(Appointment).count()).toBe(0);
    expect(await repo(OrderTime).count()).toBe(0);
    expect(await repo(Rental).count()).toBe(0);
    expect(await repo(BookingRequest).count()).toBe(0);
    expect(await repo(LayerMeasurement).count()).toBe(0);
    expect(await repo(LayerMeasurementPoint).count()).toBe(0);
    expect(await repo(DellenKalkulation).count()).toBe(0);
    expect(await repo(DellenMarker).count()).toBe(0);

    // 2. Aufruf -> idempotent 404.
    await expect(svc.deleteCustomer(USER, c.id)).rejects.toThrow();
    void inv;
  });

  // --- Anonymisierung ---------------------------------------------------------

  it('Kunde MIT festgeschriebener Rechnung -> anonymisiert; Rechnung + hinweis UNVERAENDERT (GoBD)', async () => {
    const c = await customer();
    const inv = await invoice(c.id, {
      nummer: 'RE-2026-0001',
      status: InvoiceStatus.BEZAHLT,
      hinweis: 'Interner Kundenwunsch',
    });
    const o = await order(c.id, { freigabeToken: 'FREI-TOKEN' as never });
    await ds.getRepository(Invoice).update({ id: inv.id }, { downloadToken: 'DL-TOKEN' as never });

    const res = await svc.deleteCustomer(USER, c.id);
    expect(res.modus).toBe('anonymisiert');

    const inv2 = await repo(Invoice).findOne({ where: { id: inv.id } });
    expect(inv2).toBeTruthy();
    expect(inv2!.nummer).toBe('RE-2026-0001');
    // Fund 10: hinweis eines FESTGESCHRIEBENEN Belegs bleibt (GoBD-Unveraenderbarkeit).
    expect(inv2!.hinweis).toBe('Interner Kundenwunsch');
    // Empfaenger-Snapshot gefuellt.
    expect(inv2!.empfaengerName).toContain('Max');

    // Kunde anonymisiert (PII weg, Flag gesetzt).
    const c2 = await repo(Customer).findOne({ where: { id: c.id } });
    expect(c2!.anonymisiertAm).toBeTruthy();
    expect(c2!.email).toBeNull();

    // Token invalidiert (track/freigabe/PDF).
    expect(await tokenOf('order', o.id, 'freigabeToken')).toBeNull();
    expect(await tokenOf('invoice', inv.id, 'downloadToken')).toBeNull();
  });

  it('Entwurfs-Rechnung: hinweis wird geleert, festgeschriebene bleibt', async () => {
    const c = await customer();
    await invoice(c.id, { nummer: 'RE-2026-0002', status: InvoiceStatus.OFFEN, hinweis: 'BELEG-HINWEIS' });
    const entwurf = await invoice(c.id, { nummer: null as never, status: InvoiceStatus.ENTWURF, hinweis: 'ENTWURF-PII' });

    await svc.deleteCustomer(USER, c.id);

    const draft = await repo(Invoice).findOne({ where: { id: entwurf.id } });
    expect(draft).toBeTruthy();
    expect(draft!.hinweis).toBeNull(); // Entwurf: PII-Freitext geleert
    const beleg = await repo(Invoice).findOne({ where: { nummer: 'RE-2026-0002' } });
    expect(beleg!.hinweis).toBe('BELEG-HINWEIS'); // Beleg: unveraendert
  });

  it('nur SIGNIERTE Schichtdicken-Messung (keine Rechnung) -> anonymisiert, Messung bleibt ohne PII', async () => {
    const c = await customer();
    const mess = await repo(LayerMeasurement).save(
      repo(LayerMeasurement).create({
        tenantId: 'T1',
        customerId: c.id,
        unterschriftPng: 'data:image/png;base64,AAA',
        unterschriebenVonName: 'Max Muster',
        notiz: 'privat',
        freigabeToken: 'L-TOKEN' as never,
      }),
    );

    const res = await svc.deleteCustomer(USER, c.id);
    expect(res.modus).toBe('anonymisiert');
    expect(res.belege.signierteProtokolle).toBe(1);

    const m2 = await repo(LayerMeasurement).findOne({ where: { id: mess.id } });
    expect(m2).toBeTruthy();
    expect(m2!.unterschriftPng).toBeNull();
    expect(m2!.notiz).toBeNull();
    expect(m2!.unterschriebenVonName).toBe('Anonymisiert');
    // freigabeToken invalidiert.
    const tok = await ds
      .getRepository(LayerMeasurement)
      .createQueryBuilder('l')
      .addSelect('l.freigabeToken', 'l_freigabeToken')
      .where('l.id = :id', { id: mess.id })
      .getOne();
    expect((tok as unknown as { freigabeToken: string | null }).freigabeToken).toBeNull();
  });

  // --- TOCTOU-Recheck ---------------------------------------------------------

  it('hardDeleteCustomer verweigert (409), wenn inzwischen ein nummerierter Beleg existiert', async () => {
    const c = await customer();
    // Nummerierter Beleg vorhanden -> harte Loeschung wuerde ihn vernichten.
    await invoice(c.id, { nummer: 'RE-2026-0009', status: InvoiceStatus.OFFEN });

    // Direkter Aufruf der privaten harten Loeschung (simuliert den Race: aeussere
    // Entscheidung war "loeschen", inzwischen wurde festgeschrieben).
    await expect((svc as unknown as { hardDeleteCustomer: (u: AuthUser, k: Customer) => Promise<unknown> }).hardDeleteCustomer(USER, c)).rejects.toBeInstanceOf(ConflictException);

    // Beleg + Kunde unangetastet.
    expect(await repo(Invoice).count()).toBe(1);
    expect(await repo(Customer).count()).toBe(1);
  });

  // --- Foto-Disk-Loeschung: transienter Fehler wird gemeldet (Fund 7) ---------

  it('meldet fehlgeschlagene Foto-Loeschungen zur Nacharbeit (DB weg, Datei bleibt)', async () => {
    const c = await customer();
    const insp = await repo(DamageInspection).save(
      repo(DamageInspection).create({ tenantId: 'T1', customerId: c.id, status: 'entwurf' as never }),
    );
    await repo(DamagePhoto).save(
      repo(DamagePhoto).create({ tenantId: 'T1', inspectionId: insp.id, pfad: 'IMG_1234.webp' }),
    );

    // fs.unlink schlaegt transient fehl (EBUSY, Windows-realistisch).
    const spy = jest.spyOn(fsp, 'unlink').mockRejectedValue(
      Object.assign(new Error('resource busy'), { code: 'EBUSY' }),
    );
    try {
      const res = await svc.deleteCustomer(USER, c.id);
      expect(res.modus).toBe('geloescht');
      // Datei-Loeschung schlug fehl -> als PII-freier Nacharbeits-Pfad ausgewiesen.
      expect(res.fehlgeschlageneDateien).toEqual(
        expect.arrayContaining([expect.stringContaining('IMG_1234.webp')]),
      );
      // Auch im Audit-Protokoll (ohne PII).
      const log = auditStub.log.mock.calls.map((a) => a[0]).find((e: any) => e.action === 'gdpr_delete');
      expect(log.payload.dateiLoeschungUnvollstaendig).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  // --- Betriebs-Export --------------------------------------------------------

  it('Betriebs-Export: OrderItem/InvoiceItem-Arrays gefuellt, tenant-scoped, ohne Secrets', async () => {
    const c = await customer();
    await order(c.id); // + OrderItem
    await invoice(c.id, { nummer: 'RE-1' }); // + InvoiceItem
    await repo(User).save(
      repo(User).create({ email: 'chef@a.de', passwordHash: 'HASH-SECRET', firstName: 'C', lastName: 'A', tenantId: 'T1' }),
    );
    // Fremd-Tenant-Daten (T2), die NICHT exportiert werden duerfen.
    const cX = await repo(Customer).save(repo(Customer).create({ tenantId: 'T2', lastName: 'Fremd' }));
    await order(cX.id, { tenantId: 'T2' });

    let out = '';
    const sink = { write: (s: string) => (out += s), end: jest.fn() };
    await tenantExport.streamExport(USER, sink);

    const parsed = JSON.parse(out);
    expect(parsed._abgebrochen).toBe(false);
    expect(parsed.auftragsPositionen).toHaveLength(1); // Fund 4: KEIN Crash, korrekt gefuellt
    expect(parsed.rechnungsPositionen).toHaveLength(1);
    expect(parsed.kunden).toHaveLength(1); // nur T1
    expect(out).not.toContain('HASH-SECRET');
    expect(out).not.toContain('passwordHash');
    expect(out).not.toContain('Fremd'); // Cross-Tenant-Isolation
    expect(sink.end).toHaveBeenCalled();
  });
});
