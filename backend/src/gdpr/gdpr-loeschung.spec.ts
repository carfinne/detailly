import { NotFoundException } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Kern-Entscheidung Art. 17: deleteCustomer waehlt zwischen ANONYMISIEREN (bei
 * Aufbewahrungspflicht) und HARTER Loeschung – und schreibt ein PII-freies
 * Protokoll. Reiner Unit-Test mit gemockten Repos/Transaktion (kein TypeORM).
 */

const USER: AuthUser = {
  id: 'u1',
  email: 'chef@betrieb.de',
  role: 'owner',
  tenantId: 't1',
} as AuthUser;

/** Chainable Query-Builder-Mock fuer .where(...).getCount(). */
function countQb(resolver: (params: Record<string, unknown>) => number) {
  const qb: Record<string, unknown> = {};
  let captured: Record<string, unknown> = {};
  qb.where = (_sql: string, params: Record<string, unknown> = {}) => {
    captured = params;
    return qb;
  };
  qb.andWhere = () => qb;
  qb.getCount = async () => resolver(captured);
  return qb;
}

/** Manager-Mock (Transaktion) mit Aufzeichnung von save/delete/update. */
function makeManager(finds: (entity: unknown) => unknown[]) {
  const deletes: Array<{ entity: unknown; criteria: unknown }> = [];
  const saves: Array<{ entity: unknown; obj: any }> = [];
  const updates: Array<{ entity: unknown; set: Record<string, unknown> }> = [];
  const m: any = {
    find: jest.fn(async (entity: unknown) => finds(entity)),
    save: jest.fn(async (entity: unknown, obj: any) => {
      saves.push({ entity, obj });
      return obj;
    }),
    delete: jest.fn(async (entity: unknown, criteria: unknown) => {
      deletes.push({ entity, criteria });
      return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {};
      let ent: unknown = null;
      qb.update = (e: unknown) => {
        ent = e;
        return qb;
      };
      qb.set = (s: Record<string, unknown>) => {
        updates.push({ entity: ent, set: s });
        return qb;
      };
      qb.where = () => qb;
      qb.execute = async () => ({ affected: 1 });
      return qb;
    }),
  };
  return { m, deletes, saves, updates };
}

function buildService(opts: {
  customer: Partial<Customer> | null;
  rechnungenNummeriert?: number;
  angeboteNummeriert?: number;
  abgerechnet?: number;
  signierteProtokolle?: number;
  finds?: (entity: unknown) => unknown[];
}) {
  const auditLogs: any[] = [];
  const customerRepo = {
    findOne: jest.fn(async () => (opts.customer ? { ...opts.customer } : null)),
  };
  const invoiceRepo = {
    createQueryBuilder: jest.fn(() =>
      countQb((p) =>
        p.art === 'rechnung'
          ? (opts.rechnungenNummeriert ?? 0)
          : (opts.angeboteNummeriert ?? 0),
      ),
    ),
  };
  const orderRepo = { count: jest.fn(async () => opts.abgerechnet ?? 0) };
  const inspectionRepo = {
    createQueryBuilder: jest.fn(() => countQb(() => opts.signierteProtokolle ?? 0)),
  };

  const finds =
    opts.finds ??
    (() => []);
  const mgr = makeManager(finds);
  const dataSource = {
    transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(mgr.m)),
  };
  const audit = { log: jest.fn(async (e: any) => void auditLogs.push(e)) };

  const empty = {} as any;
  const svc = new GdprService(
    customerRepo as any, // customerRepo
    empty, // vehicleRepo
    orderRepo as any, // orderRepo
    empty, // orderItemRepo
    invoiceRepo as any, // invoiceRepo
    empty, // invoiceItemRepo
    empty, // appointmentRepo
    inspectionRepo as any, // inspectionRepo
    empty, // damageItemRepo
    empty, // damagePhotoRepo
    empty, // damageItemPhotoRepo
    empty, // rentalRepo
    empty, // auditRepo
    dataSource as any,
    audit as any,
  );
  return { svc, mgr, auditLogs, customerRepo };
}

describe('GdprService.deleteCustomer – Entscheidung anonymisieren vs. loeschen', () => {
  it('Kunde MIT nummerierter Rechnung -> ANONYMISIEREN, Rechnung bleibt unveraendert', async () => {
    const rechnung: any = {
      id: 'inv1',
      tenantId: 't1',
      customerId: 'c1',
      nummer: 'RE-2026-0001',
      netto: 100,
      brutto: 119,
      status: 'bezahlt',
    };
    const { svc, mgr } = buildService({
      customer: { id: 'c1', tenantId: 't1', firstName: 'Max', lastName: 'Mustermann', anonymisiertAm: null },
      rechnungenNummeriert: 1,
      finds: (entity) => (entity === Invoice ? [rechnung] : []),
    });

    const res = await svc.deleteCustomer(USER, 'c1');

    expect(res.modus).toBe('anonymisiert');
    // Rechnung wurde gespeichert (Empfaenger-Snapshot), aber NIE geloescht.
    const invoiceDeleted = mgr.deletes.find((d) => d.entity === Invoice);
    expect(invoiceDeleted).toBeUndefined();
    // Betrag + Nummer der Rechnung unangetastet (GoBD).
    expect(rechnung.nummer).toBe('RE-2026-0001');
    expect(rechnung.netto).toBe(100);
    expect(rechnung.brutto).toBe(119);
    // Empfaenger-Snapshot gefuellt.
    expect(rechnung.empfaengerName).toContain('Max');
    // Der Kunde selbst darf NICHT hart geloescht werden.
    const customerDeleted = mgr.deletes.find((d) => d.entity === Customer);
    expect(customerDeleted).toBeUndefined();
  });

  it('Kunde OHNE Belege -> HART LOESCHEN inkl. abhaengiger Zeilen', async () => {
    const vehicle = { id: 'v1', tenantId: 't1', customerId: 'c1' };
    const order = { id: 'o1', tenantId: 't1', customerId: 'c1', bilderVorher: [], bilderNachher: [] };
    const { svc, mgr, auditLogs } = buildService({
      customer: { id: 'c1', tenantId: 't1', email: 'max@example.com', anonymisiertAm: null },
      rechnungenNummeriert: 0,
      finds: (entity) => {
        if (entity === Vehicle) return [vehicle];
        if (entity === Order) return [order];
        return [];
      },
    });

    const res = await svc.deleteCustomer(USER, 'c1');

    expect(res.modus).toBe('geloescht');
    // Kunde + abhaengige Kern-Tabellen hart geloescht.
    expect(mgr.deletes.some((d) => d.entity === Customer)).toBe(true);
    expect(mgr.deletes.some((d) => d.entity === Vehicle)).toBe(true);
    expect(mgr.deletes.some((d) => d.entity === Order)).toBe(true);
    expect(mgr.deletes.some((d) => d.entity === OrderItem)).toBe(true);
    // Protokoll OHNE PII: nur Zaehler/Modus, kein Name/Email.
    const log = auditLogs.find((l) => l.action === 'gdpr_delete');
    expect(log).toBeDefined();
    const payloadStr = JSON.stringify(log.payload);
    expect(payloadStr).not.toContain('max@example.com');
    expect(payloadStr).not.toContain('Max');
    expect(log.payload.modus).toBe('geloescht');
  });

  it('ist idempotent: zweiter Aufruf nach harter Loeschung -> 404', async () => {
    const { svc } = buildService({ customer: null });
    await expect(svc.deleteCustomer(USER, 'c1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bereits anonymisierter Kunde -> No-op (Snapshot nicht erneut ueberschrieben)', async () => {
    const { svc, mgr } = buildService({
      customer: { id: 'c1', tenantId: 't1', anonymisiertAm: new Date() },
      rechnungenNummeriert: 1,
    });
    const res = await svc.deleteCustomer(USER, 'c1');
    expect(res.modus).toBe('anonymisiert');
    expect(res.bereitsErledigt).toBe(true);
    // Keine Transaktion / keine Saves.
    expect(mgr.saves.length).toBe(0);
  });

  it('Anonymisierung invalidiert oeffentliche Tokens (Tracking/Freigabe/PDF)', async () => {
    const { svc, mgr } = buildService({
      customer: { id: 'c1', tenantId: 't1', anonymisiertAm: null },
      rechnungenNummeriert: 1,
    });

    await svc.deleteCustomer(USER, 'c1');

    const orderUpdate = mgr.updates.find((u) => u.entity === Order);
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate!.set).toHaveProperty('freigabeToken', null);

    const invoiceUpdate = mgr.updates.find((u) => u.entity === Invoice);
    expect(invoiceUpdate).toBeDefined();
    expect(invoiceUpdate!.set).toHaveProperty('downloadToken', null);
    expect(invoiceUpdate!.set).toHaveProperty('angebotToken', null);
  });

  it('signiertes Protokoll ohne Rechnung erzwingt ebenfalls Anonymisierung', async () => {
    const { svc } = buildService({
      customer: { id: 'c1', tenantId: 't1', anonymisiertAm: null },
      rechnungenNummeriert: 0,
      signierteProtokolle: 1,
    });
    const res = await svc.deleteCustomer(USER, 'c1');
    expect(res.modus).toBe('anonymisiert');
    expect(res.belege.signierteProtokolle).toBe(1);
  });
});
