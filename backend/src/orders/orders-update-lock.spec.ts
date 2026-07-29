import { ConflictException } from '@nestjs/common';
import { Not } from 'typeorm';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';
import { InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';

/**
 * GoBD-Unveraenderbarkeit (Welle 1-A, F2): sind die Positionen eines Auftrags
 * FESTGESCHRIEBEN (Status abgerechnet/storniert ODER eine festgesetzte Rechnung
 * haengt daran), duerfen die finanzwirksamen Felder (items/materialkosten) NICHT
 * mehr per PATCH geaendert werden -> 409. Rein beschreibende Felder bleiben
 * editierbar. Serverseitige Durchsetzung (nicht nur UI-Ausblenden). Unit-Test
 * mit gemockten Repositories (kein DB-Zugriff).
 */
function makeService(over: { order?: any; invoiceCount?: number } = {}) {
  const order = over.order ?? {
    id: 'o1',
    tenantId: 't1',
    status: OrderStatus.FERTIG,
    materialkosten: 0,
    items: [],
  };
  const itemRepo: any = { create: jest.fn().mockImplementation((x: any) => ({ ...x })) };
  const managerMock: any = {
    delete: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockImplementation(async (o: any) => o),
  };
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(order),
    save: jest.fn().mockImplementation(async (o: any) => o),
    manager: { transaction: jest.fn().mockImplementation((cb: any) => cb(managerMock)) },
  };
  const invoiceRepo: any = { count: jest.fn().mockResolvedValue(over.invoiceCount ?? 0) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new OrdersService(
    repo, // Order
    itemRepo, // OrderItem
    {} as any, // Customer
    {} as any, // Vehicle
    {} as any, // User
    {} as any, // Location
    {} as any, // Tenant
    invoiceRepo, // Invoice
    audit, // audit
    { send: jest.fn() } as any, // mail
    { get: jest.fn() } as any, // config
    {} as any, // subscriptions
  );
  return { svc, repo, invoiceRepo, audit, managerMock };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('OrdersService · update (GoBD-Positionssperre)', () => {
  it('abgerechneter Auftrag + Positionsaenderung -> 409, kein Speichern/Audit', async () => {
    const { svc, repo, audit } = makeService({
      order: { id: 'o1', tenantId: 't1', status: OrderStatus.ABGERECHNET, materialkosten: 0, items: [] },
    });
    await expect(
      svc.update(USER, 'o1', { items: [{ beschreibung: 'Extra', menge: 1, einzelpreis: 50 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.manager.transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('stornierter Auftrag + Positionsaenderung -> 409', async () => {
    const { svc } = makeService({
      order: { id: 'o1', tenantId: 't1', status: OrderStatus.STORNIERT, materialkosten: 0, items: [] },
    });
    await expect(
      svc.update(USER, 'o1', { items: [{ beschreibung: 'Extra', menge: 1, einzelpreis: 50 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('festgeschriebene Rechnung am (noch) fertigen Auftrag + Positionsaenderung -> 409', async () => {
    const { svc, invoiceRepo } = makeService({ invoiceCount: 1 }); // Status FERTIG, aber RE festgesetzt
    await expect(
      svc.update(USER, 'o1', { items: [{ beschreibung: 'Extra', menge: 1, einzelpreis: 50 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    // Sperr-Query exakt wie die Loeschsperre: tenant-scoped, art=RECHNUNG, != Entwurf.
    expect(invoiceRepo.count).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        orderId: 'o1',
        art: InvoiceKind.RECHNUNG,
        status: Not(InvoiceStatus.ENTWURF),
      },
    });
  });

  it('geaenderte Materialkosten bei abgerechnetem Auftrag -> 409 (auch ohne items)', async () => {
    const { svc } = makeService({
      order: { id: 'o1', tenantId: 't1', status: OrderStatus.ABGERECHNET, materialkosten: 0, items: [] },
    });
    await expect(svc.update(USER, 'o1', { materialkosten: 99 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('offener Auftrag (keine festgesetzte Rechnung) -> Positionen editierbar (kein 409)', async () => {
    const { svc, managerMock, audit } = makeService({ invoiceCount: 0 }); // Status FERTIG, nur Entwurf
    const res = await svc.update(USER, 'o1', {
      items: [{ beschreibung: 'Nachbuchung', menge: 2, einzelpreis: 30 }],
    });
    expect(res).toBeDefined();
    // Positionsaenderung laeuft atomar: alte Positionen loeschen + neu speichern.
    expect(managerMock.delete).toHaveBeenCalledTimes(1);
    expect(managerMock.save).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('abgerechneter Auftrag: rein beschreibende Aenderung (interner Hinweis) bleibt erlaubt', async () => {
    const { svc, repo, invoiceRepo } = makeService({
      order: { id: 'o1', tenantId: 't1', status: OrderStatus.ABGERECHNET, materialkosten: 0, items: [] },
    });
    await expect(svc.update(USER, 'o1', { internerHinweis: 'Kunde zufrieden' })).resolves.toBeDefined();
    // Kein finanzwirksames Feld -> gar keine Sperr-Pruefung noetig (Status-Kurzschluss);
    // einfacher save-Pfad (keine Transaktion).
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(invoiceRepo.count).not.toHaveBeenCalled();
  });
});
