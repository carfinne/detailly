import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ShopService } from './shop.service';
import { Product } from './entities/product.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { PurchaseOrderStatus } from './entities/purchase-order.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer den konditionalen Statuswechsel der Bestellung (H2). Der Manager-
 * Fake bildet den konditionalen Flip nach (`flipWins` = affected). Nur der
 * Gewinner bucht bei GELIEFERT den Lagerzugang; der Verlierer eines parallelen
 * "Als geliefert markieren"-Klicks bucht NICHT doppelt und loggt nicht.
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

function makeSvc(opts: {
  poStatus?: PurchaseOrderStatus;
  flipWins?: boolean;
  items?: Array<{ productId: string | null; menge: number }>;
  productBestand?: number;
  erstelltVon?: string;
}) {
  const po = {
    id: 'po1',
    tenantId: 't1',
    nummer: 'BE-2026-0001',
    status: opts.poStatus ?? PurchaseOrderStatus.BESTELLT,
    // Standard-Ersteller != USER ('u1'), damit die Vier-Augen-Wache (H6) die
    // uebrigen Faelle nicht blockiert.
    erstelltVon: opts.erstelltVon ?? 'u0',
    items: (opts.items ?? [{ productId: 'p1', menge: 5 }]).map((i, idx) => ({ id: `it${idx}`, ...i })),
  };
  const product = { id: 'p1', tenantId: 't1', bestand: opts.productBestand ?? 10 };
  const flipWins = opts.flipWins ?? true;
  const savedMovements: any[] = [];
  const auditLog = jest.fn().mockResolvedValue(undefined);

  const poRepo = {
    findOne: jest.fn(async (args: any) => {
      if (args?.where?.id === 'po1' && args?.where?.tenantId === 't1') return { ...po, items: po.items };
      return null;
    }),
  };

  const manager: any = {
    update: jest.fn(async (_entity: any, criteria: any, patch: any) => {
      if (
        flipWins &&
        criteria.id === 'po1' &&
        criteria.tenantId === 't1' &&
        criteria.status === po.status
      ) {
        po.status = patch.status;
        return { affected: 1 };
      }
      return { affected: 0 };
    }),
    findOne: jest.fn(async (entity: any, args: any) => {
      if (entity === Product && args?.where?.id === 'p1' && args?.where?.tenantId === 't1') {
        return { ...product };
      }
      return null;
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = { _menge: 0 };
      qb.update = jest.fn(() => qb);
      qb.set = jest.fn(() => qb);
      qb.where = jest.fn(() => qb);
      qb.setParameter = jest.fn((k: string, v: number) => {
        if (k === 'menge') qb._menge = v;
        return qb;
      });
      qb.execute = jest.fn(async () => {
        product.bestand += qb._menge; // atomarer Zugang
        return { affected: 1 };
      });
      return qb;
    }),
    create: jest.fn((entity: any, data: any) => ({ __entity: entity, ...data })),
    save: jest.fn(async (obj: any) => {
      if (obj.__entity === StockMovement) savedMovements.push(obj);
      return obj;
    }),
  };

  const dataSource = { transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)) };
  const svc = new ShopService(
    {} as any,
    {} as any,
    poRepo as any,
    {} as any,
    {} as any,
    {} as any,
    { log: auditLog } as any,
    dataSource as any,
  );
  return { svc, po, product, savedMovements, auditLog, manager, poRepo, dataSource };
}

describe('ShopService.changePurchaseOrderStatus - konditionaler Flip (H2)', () => {
  it('BESTELLT->GELIEFERT (Gewinner) bucht den Lagerzugang genau einmal', async () => {
    const { svc, product, savedMovements, auditLog, manager } = makeSvc({
      poStatus: PurchaseOrderStatus.BESTELLT,
    });

    await svc.changePurchaseOrderStatus(USER, 'po1', PurchaseOrderStatus.GELIEFERT);

    expect(product.bestand).toBe(15);
    expect(savedMovements).toHaveLength(1);
    expect(auditLog).toHaveBeenCalledTimes(1);
    // Flip war konditional auf den Vorstatus.
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'po1', tenantId: 't1', status: PurchaseOrderStatus.BESTELLT }),
      expect.objectContaining({ status: PurchaseOrderStatus.GELIEFERT }),
    );
    // Produkt-Lookup tenant-scoped.
    expect(manager.findOne).toHaveBeenCalledWith(
      Product,
      expect.objectContaining({ where: { id: 'p1', tenantId: 't1' } }),
    );
  });

  it('Doppel-Lieferung (Race, Verlierer): keine Buchung, kein Beleg, kein Audit', async () => {
    const { svc, product, savedMovements, auditLog, dataSource } = makeSvc({
      poStatus: PurchaseOrderStatus.BESTELLT,
      flipWins: false, // paralleler Flip war schneller -> affected=0
    });

    await svc.changePurchaseOrderStatus(USER, 'po1', PurchaseOrderStatus.GELIEFERT);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(product.bestand).toBe(10); // NICHT doppelt gebucht
    expect(savedMovements).toHaveLength(0);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('unerlaubter Uebergang -> BadRequest, Transaktion startet NICHT', async () => {
    const { svc, dataSource } = makeSvc({ poStatus: PurchaseOrderStatus.ENTWURF });

    await expect(
      svc.changePurchaseOrderStatus(USER, 'po1', PurchaseOrderStatus.GELIEFERT),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('FREIGEGEBEN setzt freigegebenVon und bucht keinen Bestand', async () => {
    const { svc, savedMovements, manager } = makeSvc({ poStatus: PurchaseOrderStatus.EINGEREICHT });

    await svc.changePurchaseOrderStatus(USER, 'po1', PurchaseOrderStatus.FREIGEGEBEN);

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: PurchaseOrderStatus.EINGEREICHT }),
      expect.objectContaining({ status: PurchaseOrderStatus.FREIGEGEBEN, freigegebenVon: 'u1' }),
    );
    expect(savedMovements).toHaveLength(0);
  });

  it('H6 Vier-Augen: Ersteller darf die eigene Bestellung NICHT freigeben (403)', async () => {
    const { svc, dataSource } = makeSvc({
      poStatus: PurchaseOrderStatus.EINGEREICHT,
      erstelltVon: 'u1', // == USER.id -> Selbstfreigabe verboten
    });

    await expect(
      svc.changePurchaseOrderStatus(USER, 'po1', PurchaseOrderStatus.FREIGEGEBEN),
    ).rejects.toThrow(ForbiddenException);
    // Keine Statusaenderung: Transaktion startet gar nicht.
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
