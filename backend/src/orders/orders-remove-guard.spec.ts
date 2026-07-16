import { ConflictException, NotFoundException } from '@nestjs/common';
import { Not } from 'typeorm';
import { OrdersService } from './orders.service';
import { InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';

/**
 * GoBD-Loeschsperre (Fix 1): ein Auftrag, auf den eine FESTGESETZTE Rechnung
 * (art=RECHNUNG, Status != Entwurf) verweist, darf nicht hart geloescht werden –
 * sonst zeigt invoice.orderId ins Leere und order_items/Fotos verschwinden per
 * FK-Cascade. Reine Entwuerfe/Auftraege ohne festgesetzte Rechnung bleiben loeschbar.
 * Unit-Test mit gemockten Repositories (kein DB-Zugriff).
 */
function makeService(over: { order?: any; invoiceCount?: number } = {}) {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(
      over.order ?? { id: 'o1', tenantId: 't1', items: [] },
    ),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const invoiceRepo: any = {
    count: jest.fn().mockResolvedValue(over.invoiceCount ?? 0),
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new OrdersService(
    repo, // Order
    {} as any, // OrderItem
    {} as any, // Customer
    {} as any, // Vehicle
    {} as any, // User
    {} as any, // Location
    {} as any, // Tenant
    invoiceRepo, // Invoice
    audit, // audit
    { send: jest.fn() } as any, // mail
    { get: jest.fn() } as any, // config
  );
  return { svc, repo, invoiceRepo, audit };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('OrdersService · remove (GoBD-Loeschsperre)', () => {
  it('Auftrag mit festgesetzter Rechnung -> ConflictException, kein Loeschen', async () => {
    const { svc, repo, audit } = makeService({ invoiceCount: 1 });
    await expect(svc.remove(USER, 'o1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.remove).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('Auftrag ohne festgesetzte Rechnung -> loeschbar + Audit', async () => {
    const { svc, repo, audit } = makeService({ invoiceCount: 0 });
    const res = await svc.remove(USER, 'o1');
    expect(res).toEqual({ success: true });
    expect(repo.remove).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('Sperr-Query ist tenant-scoped und filtert auf festgesetzte Rechnungen', async () => {
    const { svc, invoiceRepo } = makeService({ invoiceCount: 0 });
    await svc.remove(USER, 'o1');
    expect(invoiceRepo.count).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        orderId: 'o1',
        art: InvoiceKind.RECHNUNG,
        status: Not(InvoiceStatus.ENTWURF),
      },
    });
  });

  it('unbekannter Auftrag -> 404 (findOne wirft vor der Sperr-Pruefung)', async () => {
    const { svc, invoiceRepo } = makeService({ order: null });
    // findOne liefert bei null einen NotFound – ganz ohne Rechnungs-Count.
    (invoiceRepo.count as jest.Mock).mockClear();
    const repoNull: any = (svc as any).repo;
    repoNull.findOne.mockResolvedValueOnce(null);
    await expect(svc.remove(USER, 'x')).rejects.toBeInstanceOf(NotFoundException);
    expect(invoiceRepo.count).not.toHaveBeenCalled();
  });
});
