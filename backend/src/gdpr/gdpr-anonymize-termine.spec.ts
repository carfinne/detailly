import { GdprService } from './gdpr.service';
import { Order } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Test fuer den GDPR-Fix (PR #39-Rest): Bei der Anonymisierung eines Kunden
 * muessen auch Termine geloescht werden, die NICHT ueber customerId, sondern nur
 * ueber orderId mit einem Auftrag des Kunden verknuepft sind. Sonst ueberlebt ein
 * rein auftragsbezogener Termin die Anonymisierung samt PII.
 *
 * Die uebrige Anonymisierungslogik wird gruen gemockt (leere Ergebnismengen), der
 * Fokus liegt auf dem an Appointment.delete uebergebenen Kriterium.
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

function makeSvc(opts: { orders: Array<{ id: string }> }) {
  const deleteCalls: Array<{ entity: unknown; criteria: any }> = [];

  const manager: any = {
    find: jest.fn(async (entity: unknown) => {
      if (entity === Order) return opts.orders.map((o) => ({ ...o, tenantId: 't1', customerId: 'c1', bilderVorher: [], bilderNachher: [] }));
      if (entity === Appointment) return [{ id: 'a-order-only', tenantId: 't1' }];
      return [];
    }),
    save: jest.fn(async (_entity: unknown, obj: any) => obj),
    delete: jest.fn(async (entity: unknown, criteria: any) => {
      deleteCalls.push({ entity, criteria });
      return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {};
      qb.update = jest.fn(() => qb);
      qb.set = jest.fn(() => qb);
      qb.where = jest.fn(() => qb);
      qb.execute = jest.fn(async () => ({ affected: 0 }));
      return qb;
    }),
  };

  const customerRepo = {
    findOne: jest.fn(async () => ({ id: 'c1', tenantId: 't1', anonymisiertAm: null })),
  };
  const dataSource = { transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  // 13 Repos + dataSource + audit (Konstruktor-Reihenfolge). Nur customerRepo,
  // dataSource und audit werden im Anonymisierungspfad tatsaechlich benutzt.
  const empty = {} as any;
  const svc = new GdprService(
    customerRepo as any, // customerRepo
    empty, // vehicleRepo
    empty, // orderRepo
    empty, // orderItemRepo
    empty, // invoiceRepo
    empty, // invoiceItemRepo
    empty, // appointmentRepo
    empty, // inspectionRepo
    empty, // damageItemRepo
    empty, // damagePhotoRepo
    empty, // damageItemPhotoRepo
    empty, // rentalRepo
    empty, // auditRepo
    dataSource as any,
    audit as any,
  );
  return { svc, deleteCalls };
}

describe('GdprService.anonymizeCustomer - Termine ueber orderId (PR #39-Rest)', () => {
  it('loescht Termine sowohl per customerId ALS AUCH per orderId der Kunden-Auftraege', async () => {
    const { svc, deleteCalls } = makeSvc({ orders: [{ id: 'o1' }, { id: 'o2' }] });

    await svc.anonymizeCustomer(USER, 'c1');

    const apptDelete = deleteCalls.find((c) => c.entity === Appointment);
    expect(apptDelete).toBeDefined();
    // Kriterium ist eine ODER-Liste (Array), da Auftrags-IDs vorhanden sind.
    expect(Array.isArray(apptDelete!.criteria)).toBe(true);
    expect(apptDelete!.criteria).toHaveLength(2);
    // (1) direkte Verknuepfung ueber customerId, tenant-scoped.
    expect(apptDelete!.criteria[0]).toMatchObject({ customerId: 'c1', tenantId: 't1' });
    // (2) Verknuepfung ueber die Auftrags-IDs des Kunden, tenant-scoped.
    expect(apptDelete!.criteria[1]).toMatchObject({ tenantId: 't1' });
    expect(apptDelete!.criteria[1].orderId.value).toEqual(['o1', 'o2']);
  });

  it('faellt ohne Auftrags-IDs auf das einfache customerId-Kriterium zurueck', async () => {
    const { svc, deleteCalls } = makeSvc({ orders: [] });

    await svc.anonymizeCustomer(USER, 'c1');

    const apptDelete = deleteCalls.find((c) => c.entity === Appointment);
    expect(apptDelete).toBeDefined();
    // Kein orderId-Zweig, wenn der Kunde keine Auftraege hat.
    expect(Array.isArray(apptDelete!.criteria)).toBe(false);
    expect(apptDelete!.criteria).toMatchObject({ customerId: 'c1', tenantId: 't1' });
  });
});
