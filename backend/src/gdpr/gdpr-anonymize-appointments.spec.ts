import { GdprService } from './gdpr.service';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Order } from '../orders/entities/order.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die Residual-PII-Schliessung bei der Art.-17-Anonymisierung
 * (`GdprService.anonymizeCustomer`): der Freitext-`titel` eines Termins enthaelt
 * in der Praxis den Kundennamen (z.B. "Aufbereitung Max Mustermann") und blieb
 * bislang in Plantafel UND globaler Suche auch nach der "Loeschung" auffindbar.
 *
 * Bewusst DB-FREI gehalten (analog zu jest.config.js / den uebrigen Specs):
 * der EntityManager `m` und die DataSource werden gemockt, es wird NIE eine echte
 * Verbindung gebootet (kein better-sqlite3/pg noetig). Geprueft wird das Verhalten
 * der Anonymisierung, nicht die DB-Engine.
 */
describe('GdprService – Termin-PII bei Kunden-Anonymisierung (Art. 17 DSGVO)', () => {
  const tenantId = 't1';
  const customerId = 'c1';
  const user: AuthUser = {
    id: 'u1',
    email: 'chef@betrieb.de',
    role: 'franchise_owner',
    tenantId,
  };

  // Baut einen frischen Service samt Mocks (kein geteilter State zwischen Tests).
  function setup(appointments: any[], orders: any[] = []) {
    const savedAppointments: Appointment[] = [];

    // EntityManager-Mock: `find` dispatcht nach Entity-Klasse; `save` merkt sich
    // nur die Termin-Speicherungen; `delete`/`createQueryBuilder` sind No-ops.
    const m: any = {
      find: jest.fn(async (entity: unknown) => {
        if (entity === Order) return orders;
        if (entity === Appointment) return appointments;
        // Vehicle, Invoice, DamageInspection/-Item/-Photo, VehicleIntake, AuditLog
        return [];
      }),
      save: jest.fn(async (entity: unknown, obj: any) => {
        if (entity === Appointment) savedAppointments.push(obj);
        return obj;
      }),
      delete: jest.fn(async () => ({ affected: 0 })),
      createQueryBuilder: jest.fn(() => ({
        update: () => ({ set: () => ({ where: () => ({ execute: async () => ({}) }) }) }),
      })),
    };

    const kunde: any = { id: customerId, tenantId, firstName: 'Max', lastName: 'Mustermann' };
    const customerRepo: any = { findOne: jest.fn().mockResolvedValue(kunde) };
    const dataSource: any = { transaction: jest.fn(async (cb: any) => cb(m)) };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const dummy: any = {};

    // Konstruktor-Reihenfolge: 14 Repos, dann DataSource, dann AuditService.
    // Nur customerRepo (findOne), dataSource (transaction) und audit (log) werden
    // im anonymize-Pfad benutzt; der Rest laeuft ueber den gemockten `m`.
    const service = new GdprService(
      customerRepo, // customerRepo
      dummy, // vehicleRepo
      dummy, // orderRepo
      dummy, // orderItemRepo
      dummy, // invoiceRepo
      dummy, // invoiceItemRepo
      dummy, // appointmentRepo
      dummy, // intakeRepo
      dummy, // inspectionRepo
      dummy, // damageItemRepo
      dummy, // damagePhotoRepo
      dummy, // damageItemPhotoRepo
      dummy, // rentalRepo
      dummy, // auditRepo
      dataSource,
      audit,
    );

    return { service, m, savedAppointments, customerRepo, dataSource, audit, kunde };
  }

  it('scrubbt titel + notiz aller zugehoerigen Termine – direkt via customerId UND indirekt via orderId', async () => {
    // a1: direkt am Kunden (customerId). a2: nur ueber einen Auftrag (orderId),
    // customerId ist null – so entstehen Plantafel-Termine, die der frueheren
    // customerId-Loeschung entgingen und den Namen im titel zurueckliessen.
    const terminDirekt = {
      id: 'a1',
      tenantId,
      customerId,
      vehicleId: 'v1',
      titel: 'Aufbereitung Max Mustermann',
      notiz: 'Bitte bei Familie Mustermann klingeln',
    };
    const terminUeberOrder = {
      id: 'a2',
      tenantId,
      customerId: null,
      orderId: 'o1',
      vehicleId: 'v2',
      titel: 'Folierung Mustermann',
      notiz: 'Rueckruf an Herrn Mustermann',
    };
    const { service, m, savedAppointments } = setup(
      [terminDirekt, terminUeberOrder],
      [{ id: 'o1', tenantId, customerId }],
    );

    const res = await service.anonymizeCustomer(user, customerId);

    expect(res.success).toBe(true);
    // Beide Termine wurden neutralisiert (gespeichert, nicht geloescht).
    expect(savedAppointments).toHaveLength(2);
    for (const t of savedAppointments) {
      expect(t.titel).toBe('Termin (anonymisiert)');
      expect(t.notiz).toBeNull();
      expect(t.vehicleId).toBeNull();
    }
    // Kein Kundenname bleibt in einem Termin-Freitext zurueck.
    expect(JSON.stringify(savedAppointments)).not.toContain('Mustermann');

    // Regression: Termine werden NICHT mehr hart geloescht (sonst Verlust des
    // Plantafel-Slots) – es darf kein delete(Appointment, ...) abgesetzt werden.
    const apptDelete = m.delete.mock.calls.find((c: any[]) => c[0] === Appointment);
    expect(apptDelete).toBeUndefined();
  });

  it('Termin-Query ist strikt tenant-scoped und erfasst customerId UND orderId', async () => {
    const { service, m } = setup(
      [],
      [
        { id: 'o1', tenantId, customerId },
        { id: 'o2', tenantId, customerId },
      ],
    );

    await service.anonymizeCustomer(user, customerId);

    const apptFind = m.find.mock.calls.find((c: any[]) => c[0] === Appointment);
    expect(apptFind).toBeDefined();
    const where = apptFind[1].where;
    expect(Array.isArray(where)).toBe(true);
    expect(where).toHaveLength(2);
    // (1) direkter Kundenbezug, tenant-scoped
    expect(where[0]).toMatchObject({ customerId, tenantId });
    // (2) indirekt ueber die Auftraege des Kunden, ebenfalls tenant-scoped
    expect(where[1].tenantId).toBe(tenantId);
    expect(where[1].orderId).toBeDefined(); // In([...])-FindOperator ueber die orderIds
  });

  it('ohne Auftraege: Query enthaelt nur die customerId-Bedingung (keine leere IN-Klausel)', async () => {
    const { service, m } = setup([], []);

    await service.anonymizeCustomer(user, customerId);

    const apptFind = m.find.mock.calls.find((c: any[]) => c[0] === Appointment);
    const where = apptFind[1].where;
    expect(where).toHaveLength(1);
    expect(where[0]).toMatchObject({ customerId, tenantId });
  });

  it('bereits anonymisierter Kunde -> idempotent: keine Transaktion, kein erneutes Scrubben', async () => {
    const { service, dataSource, kunde } = setup([
      { id: 'a1', tenantId, customerId, titel: 'Aufbereitung Max Mustermann' },
    ]);
    // Zweiter Lauf: Flag ist gesetzt -> frueher Abbruch vor jeder DB-Aktion.
    kunde.anonymisiertAm = new Date('2026-01-01T00:00:00.000Z');

    const res = await service.anonymizeCustomer(user, customerId);

    expect(res).toEqual({ success: true, geloeschteFotos: 0, anonymisierteTabellen: 0 });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
