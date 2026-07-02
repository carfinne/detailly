import { BadRequestException } from '@nestjs/common';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Order, OrderStatus, ServiceType } from '../orders/entities/order.entity';
import { ServiceItem, ServiceCategory } from '../services/entities/service-item.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die Auftrags-Erzeugung beim Annehmen einer Online-Anfrage (T-004).
 * Anders als die Mail-/Limit-Specs fuehrt der Transaktions-Mock hier den
 * Callback WIRKLICH aus (Manager-Fake): geprueft wird, WAS in der Transaktion
 * entsteht – Auftrag mit Leistung/Preis/Nummer/Token, Termin-Verknuepfung,
 * Tenant-Scope der Lookups und die Flag-Kombinationen.
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

/** Laesst fire-and-forget-Promises (void ...) auslaufen. */
const flush = () => new Promise((r) => setImmediate(r));

const START = new Date('2026-07-10T07:00:00.000Z');
const ENDE = new Date('2026-07-10T08:00:00.000Z');

function makeReq(over: Partial<BookingRequest> = {}): any {
  return {
    id: 'br1',
    tenantId: 't1',
    name: 'Max Muster',
    email: 'max@example.de',
    phone: null,
    serviceItemId: 'svc1',
    serviceName: 'Keramikversiegelung',
    fahrzeug: 'VW Golf, Bj. 2019',
    wunschtermin: null,
    nachricht: null,
    status: BookingRequestStatus.NEU,
    reference: 'AF-ABCDEF123456',
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
    ...over,
  };
}

const SVC_ITEM = {
  id: 'svc1',
  tenantId: 't1',
  name: 'Keramikversiegelung',
  kategorie: ServiceCategory.AUFBEREITUNG,
  basispreis: 120,
  aktiv: true,
};

/**
 * Manager-Fake: create() gibt die Daten durch, save() vergibt IDs und sammelt
 * alles nach Entity-Typ ein, findOne() dispatcht auf Anfrage/Leistung.
 */
function makeManager(opts: {
  req: any;
  serviceItem?: any | null;
  orderCount?: number;
  failOnOrderSave?: boolean;
}) {
  const saved: { entity: any; data: any }[] = [];
  let seq = 0;
  const manager = {
    findOne: jest.fn(async (entity: any, args: any) => {
      if (entity === BookingRequest) return opts.req;
      if (entity === ServiceItem) {
        const svc = opts.serviceItem === undefined ? SVC_ITEM : opts.serviceItem;
        // Tenant-Scope nachbilden: falscher Tenant -> kein Treffer.
        if (!svc || args?.where?.tenantId !== svc.tenantId) return null;
        return args?.where?.id === svc.id ? svc : null;
      }
      return null;
    }),
    create: jest.fn((entity: any, data: any) => ({ __entity: entity, ...data })),
    save: jest.fn(async (obj: any) => {
      if (opts.failOnOrderSave && obj.__entity === Order) throw new Error('DB kaputt');
      if (!obj.id) obj.id = `${(obj.__entity?.name ?? 'X').toLowerCase()}-${++seq}`;
      saved.push({ entity: obj.__entity, data: obj });
      return obj;
    }),
    // nextSequentialNumber zaehlt Auftraege des Tenants ueber das Order-Repo.
    getRepository: jest.fn(() => ({
      count: jest.fn().mockResolvedValue(opts.orderCount ?? 0),
    })),
  };
  return { manager, saved };
}

function makeSvc(opts: {
  req: any;
  serviceItem?: any | null;
  orderCount?: number;
  failOnOrderSave?: boolean;
}) {
  const { manager, saved } = makeManager(opts);
  const tenantRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 't1', name: 'Muster GmbH', email: 'info@muster.de', settings: {} }),
  };
  const customerRepo = { count: jest.fn().mockResolvedValue(0) };
  const dataSource = {
    getRepository: jest.fn().mockImplementation((entity: any) =>
      entity?.name === 'Tenant' ? tenantRepo : customerRepo,
    ),
    transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('https://app.detailly.de') };
  const svc = new BookingRequestsService(
    {} as any,
    dataSource as any,
    audit as any,
    { assertLimit: jest.fn().mockResolvedValue(undefined) } as any,
    mail as any,
    config as any,
  );
  return { svc, manager, saved, dataSource, audit, mail };
}

const savedOf = (saved: { entity: any; data: any }[], entity: any) =>
  saved.filter((s) => s.entity === entity).map((s) => s.data);

const DTO = { start: START.toISOString(), ende: ENDE.toISOString() };

describe('BookingRequestsService.accept - Auftrag zur Anfrage (T-004)', () => {
  it('Default: legt Auftrag mit Kunde, Nummer, Status bestaetigt und Termin-Verknuepfung an', async () => {
    const { svc, saved } = makeSvc({ req: makeReq() });

    const result = await svc.accept(USER, 'br1', DTO as any);
    await flush();

    const [order] = savedOf(saved, Order);
    const [customer] = savedOf(saved, Customer);
    const [appointment] = savedOf(saved, Appointment);

    expect(order).toBeDefined();
    expect(order.tenantId).toBe('t1');
    expect(order.customerId).toBe(customer.id);
    expect(order.auftragsnummer).toBe(`AU-${new Date().getFullYear()}-0001`);
    expect(order.status).toBe(OrderStatus.BESTAETIGT);
    expect(order.geplanterStart).toEqual(START);
    expect(order.geplantesEnde).toEqual(ENDE);
    expect(order.vehicleId).toBeUndefined(); // bewusst KEIN Fahrzeug-Parsing
    expect(order.internerHinweis).toContain('VW Golf, Bj. 2019');
    expect(order.freigabeToken).toMatch(/^[a-f0-9]{48}$/);

    // Termin zeigt auf den Auftrag; Antwort enthaelt die Verknuepfung.
    expect(appointment.orderId).toBe(order.id);
    expect(result.order).toEqual({ id: order.id, auftragsnummer: order.auftragsnummer });
  });

  it('Leistungs-Treffer: Position mit Basispreis, serviceType aus Kategorie, Summen mit 19 % MwSt', async () => {
    const { svc, saved } = makeSvc({ req: makeReq() });

    await svc.accept(USER, 'br1', DTO as any);
    await flush();

    const [order] = savedOf(saved, Order);
    expect(order.serviceType).toBe(ServiceType.AUFBEREITUNG);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      beschreibung: 'Keramikversiegelung',
      menge: 1,
      einzelpreis: 120,
      gesamtpreis: 120,
    });
    expect(order.nettoSumme).toBe(120);
    expect(order.mwstBetrag).toBe(22.8);
    expect(order.gesamtpreis).toBe(142.8);
  });

  it('Leistung geloescht: 0-€-Position aus dem Snapshot-Namen + "Preis pruefen"-Hinweis', async () => {
    const { svc, saved } = makeSvc({ req: makeReq(), serviceItem: null });

    await svc.accept(USER, 'br1', DTO as any);
    await flush();

    const [order] = savedOf(saved, Order);
    expect(order.serviceType).toBe(ServiceType.SONSTIGES);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ beschreibung: 'Keramikversiegelung', einzelpreis: 0 });
    expect(order.gesamtpreis).toBe(0);
    expect(order.internerHinweis).toContain('Preis prüfen');
  });

  it('Anfrage ganz ohne Leistung: Auftrag ohne Positionen + Ergaenzungs-Hinweis', async () => {
    const { svc, saved } = makeSvc({ req: makeReq({ serviceItemId: null, serviceName: null }) });

    await svc.accept(USER, 'br1', DTO as any);
    await flush();

    const [order] = savedOf(saved, Order);
    expect(order.items).toHaveLength(0);
    expect(order.serviceType).toBe(ServiceType.SONSTIGES);
    expect(order.internerHinweis).toContain('Positionen bitte ergänzen');
  });

  it('kundeAnlegen=false ohne auftragAnlegen: KEIN Auftrag (stiller Skip), Termin ohne orderId', async () => {
    const { svc, saved } = makeSvc({ req: makeReq() });

    const result = await svc.accept(USER, 'br1', { ...DTO, kundeAnlegen: false } as any);
    await flush();

    expect(savedOf(saved, Order)).toHaveLength(0);
    const [appointment] = savedOf(saved, Appointment);
    expect(appointment.orderId).toBeUndefined();
    expect(result.order).toBeNull();
  });

  it('auftragAnlegen=false: KEIN Auftrag, Kunde entsteht trotzdem', async () => {
    const { svc, saved } = makeSvc({ req: makeReq() });

    const result = await svc.accept(USER, 'br1', { ...DTO, auftragAnlegen: false } as any);
    await flush();

    expect(savedOf(saved, Order)).toHaveLength(0);
    expect(savedOf(saved, Customer)).toHaveLength(1);
    expect(result.order).toBeNull();
  });

  it('kundeAnlegen=false + auftragAnlegen=true explizit: 400, Transaktion startet NICHT', async () => {
    const { svc, dataSource } = makeSvc({ req: makeReq() });

    await expect(
      svc.accept(USER, 'br1', { ...DTO, kundeAnlegen: false, auftragAnlegen: true } as any),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('Tenant-Isolation: Leistungs-Lookup laeuft tenant-scoped (fremder Tenant -> kein Treffer)', async () => {
    const { svc, manager, saved } = makeSvc({
      req: makeReq(),
      serviceItem: { ...SVC_ITEM, tenantId: 't2' }, // gehoert einem ANDEREN Betrieb
    });

    await svc.accept(USER, 'br1', DTO as any);
    await flush();

    expect(manager.findOne).toHaveBeenCalledWith(ServiceItem, {
      where: { id: 'svc1', tenantId: 't1' },
    });
    // Fremde Leistung wird NICHT uebernommen -> Fallback auf den Snapshot (0 €).
    const [order] = savedOf(saved, Order);
    expect(order.items[0]).toMatchObject({ einzelpreis: 0 });
  });

  it('Fehler beim Auftrag-Speichern: accept wirft (Transaktion rollt zurueck)', async () => {
    const { svc } = makeSvc({ req: makeReq(), failOnOrderSave: true });

    await expect(svc.accept(USER, 'br1', DTO as any)).rejects.toThrow('DB kaputt');
  });

  it('Terminbestaetigung enthaelt den Track-Link mit dem Token des neuen Auftrags', async () => {
    const { svc, saved, mail } = makeSvc({ req: makeReq() });

    await svc.accept(USER, 'br1', DTO as any);
    await flush();

    const [order] = savedOf(saved, Order);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const opts = mail.send.mock.calls[0][0];
    expect(opts.text).toContain(`https://app.detailly.de/track/?t=${order.freigabeToken}`);
  });

  it('Audit-Payload enthaelt orderId und auftragsnummer', async () => {
    const { svc, saved, audit } = makeSvc({ req: makeReq() });

    await svc.accept(USER, 'br1', DTO as any);
    await flush();

    const [order] = savedOf(saved, Order);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'booking_request_accepted',
        payload: expect.objectContaining({
          orderId: order.id,
          auftragsnummer: order.auftragsnummer,
        }),
      }),
    );
  });
});
