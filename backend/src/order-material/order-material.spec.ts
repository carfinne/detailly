import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderMaterialService } from './order-material.service';
import { Product } from '../shop/entities/product.entity';
import { FolienRolle, FolienRolleStatus } from '../folien-rollen/entities/folien-rolle.entity';

function makeService(
  over: {
    found?: any;
    order?: any;
    product?: any;
    txProduct?: any;
    rolle?: any;
    txRolle?: any;
  } = {},
) {
  const repo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue('found' in over ? over.found : null),
  };
  const orderRepo: any = {
    findOne: jest.fn().mockResolvedValue('order' in over ? over.order : { id: 'o1', tenantId: 't1' }),
  };
  const defaultProduct = { id: 'p1', tenantId: 't1', name: 'Folie 3M', einheit: 'Rolle', bestand: '10' };
  const productRepo: any = {
    findOne: jest.fn().mockResolvedValue('product' in over ? over.product : defaultProduct),
  };
  // Restrollen-Repo: assertRefInTenant laesst nur durch, wenn eine Rolle geliefert wird.
  const rolleRepo: any = {
    findOne: jest.fn().mockResolvedValue('rolle' in over ? over.rolle : null),
  };
  // Transaktions-Manager: save/decrement/increment/update/remove/findOne/create.
  // findOne ist entity-bewusst (Product vs. FolienRolle).
  const manager: any = {
    create: (_E: any, x: any) => x,
    save: jest.fn(async (x: any) => ({ id: 'om1', ...x })),
    decrement: jest.fn().mockResolvedValue({ affected: 1 }),
    increment: jest.fn().mockResolvedValue({ affected: 1 }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(async (E: any) =>
      E === FolienRolle
        ? 'txRolle' in over
          ? over.txRolle
          : { id: 'r1', tenantId: 't1', status: FolienRolleStatus.AUFGEBRAUCHT }
        : 'txProduct' in over
          ? over.txProduct
          : defaultProduct,
    ),
  };
  const dataSource: any = { transaction: jest.fn(async (cb: any) => cb(manager)) };
  const audit: any = { log: jest.fn() };
  const svc = new OrderMaterialService(repo, orderRepo, productRepo, rolleRepo, dataSource, audit);
  return { svc, repo, orderRepo, productRepo, rolleRepo, manager, dataSource };
}

const USER: any = { id: 'u1', tenantId: 't1', role: 'technician' };
const MGR: any = { id: 'm1', tenantId: 't1', role: 'manager' };

describe('OrderMaterialService · erfassen', () => {
  it('bucht Material mit Snapshot und senkt den Bestand atomar (relativer decrement)', async () => {
    const { svc, manager } = makeService();
    await svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 3 });
    expect(manager.save.mock.calls[0][0]).toMatchObject({
      tenantId: 't1', orderId: 'o1', productId: 'p1',
      produktName: 'Folie 3M', einheit: 'Rolle', menge: 3, erfasstVon: 'u1',
    });
    expect(manager.decrement).toHaveBeenCalledWith(Product, { id: 'p1', tenantId: 't1' }, 'bestand', 3);
  });

  it('ohne Rolle: nur der bestand wird gesenkt, keine Rollen-Buchung', async () => {
    const { svc, manager } = makeService();
    await svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 3 });
    expect(manager.decrement).toHaveBeenCalledTimes(1);
    expect(manager.decrement).not.toHaveBeenCalledWith(
      FolienRolle, expect.anything(), 'restLfm', expect.anything(),
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('geplantLfm (Planzahl der Verschnitt-KPI) wird auf der Zeile gespeichert', async () => {
    const { svc, manager } = makeService();
    await svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 2, geplantLfm: 1.8 });
    expect(manager.save.mock.calls[0][0]).toMatchObject({ geplantLfm: 1.8 });
  });

  it('fremdes/unbekanntes Produkt -> BadRequest, KEINE Transaktion', async () => {
    const { svc, dataSource } = makeService({ product: null });
    await expect(
      svc.add(USER, { orderId: 'o1', productId: 'fremd', menge: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('OrderMaterialService · erfassen mit Restrolle', () => {
  it('senkt bestand UND restLfm im selben Tx (kein Doppelabzug-Fehler, s. Klassen-Doc)', async () => {
    const { svc, manager } = makeService({
      rolle: { id: 'r1', tenantId: 't1', status: FolienRolleStatus.VERFUEGBAR, restLfm: '5' },
    });
    await svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 2, folienRolleId: 'r1' });
    expect(manager.decrement).toHaveBeenCalledWith(Product, { id: 'p1', tenantId: 't1' }, 'bestand', 2);
    expect(manager.decrement).toHaveBeenCalledWith(FolienRolle, { id: 'r1', tenantId: 't1' }, 'restLfm', 2);
    expect(manager.save.mock.calls[0][0]).toMatchObject({ folienRolleId: 'r1' });
  });

  it('leergelaufene Rolle -> bedingtes UPDATE auf AUFGEBRAUCHT (nur solange VERFUEGBAR)', async () => {
    const { svc, manager } = makeService({
      rolle: { id: 'r1', tenantId: 't1', status: FolienRolleStatus.VERFUEGBAR, restLfm: '2' },
    });
    await svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 5, folienRolleId: 'r1' });
    expect(manager.update).toHaveBeenCalledWith(
      FolienRolle,
      expect.objectContaining({ id: 'r1', tenantId: 't1', status: FolienRolleStatus.VERFUEGBAR }),
      { status: FolienRolleStatus.AUFGEBRAUCHT },
    );
  });

  it('fremde/unbekannte Rolle -> BadRequest, KEINE Transaktion', async () => {
    const { svc, dataSource } = makeService({ rolle: null });
    await expect(
      svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 1, folienRolleId: 'fremd' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('OrderMaterialService · loeschen (Rueckbuchung)', () => {
  it('bucht die exakte Menge atomar zurueck und loescht den Eintrag', async () => {
    const { svc, manager } = makeService({
      found: { id: 'om1', tenantId: 't1', productId: 'p1', menge: '3' },
      txProduct: { id: 'p1', tenantId: 't1' },
    });
    await svc.remove(MGR, 'om1');
    expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1', tenantId: 't1' }, 'bestand', 3);
    expect(manager.remove).toHaveBeenCalled();
  });

  it('Rolle-Buchung: restLfm wird symmetrisch zurueckgebucht + AUFGEBRAUCHT aufgehoben', async () => {
    const { svc, manager } = makeService({
      found: { id: 'om1', tenantId: 't1', productId: 'p1', menge: '3', folienRolleId: 'r1' },
      txProduct: { id: 'p1', tenantId: 't1' },
      txRolle: { id: 'r1', tenantId: 't1', status: FolienRolleStatus.AUFGEBRAUCHT },
    });
    await svc.remove(MGR, 'om1');
    expect(manager.increment).toHaveBeenCalledWith(FolienRolle, { id: 'r1', tenantId: 't1' }, 'restLfm', 3);
    expect(manager.update).toHaveBeenCalledWith(
      FolienRolle,
      expect.objectContaining({ id: 'r1', tenantId: 't1', status: FolienRolleStatus.AUFGEBRAUCHT }),
      { status: FolienRolleStatus.VERFUEGBAR },
    );
  });

  it('Symmetrie: erfassen(menge) senkt um menge, loeschen bucht dieselbe menge zurueck', async () => {
    // add: decrement 3
    const a = makeService();
    await a.svc.add(USER, { orderId: 'o1', productId: 'p1', menge: 3 });
    const abzug = a.manager.decrement.mock.calls[0][3];
    // remove desselben Eintrags: increment 3
    const r = makeService({
      found: { id: 'om1', tenantId: 't1', productId: 'p1', menge: '3' },
      txProduct: { id: 'p1', tenantId: 't1' },
    });
    await r.svc.remove(MGR, 'om1');
    const rueck = r.manager.increment.mock.calls[0][3];
    expect(rueck).toBe(abzug); // netto 0 -> exakt zum Ausgangswert zurueck
  });

  it('Produkt bereits geloescht: keine Rueckbuchung, aber Zeile wird entfernt', async () => {
    const { svc, manager } = makeService({
      found: { id: 'om1', tenantId: 't1', productId: 'weg', menge: '3' },
      txProduct: null,
    });
    await svc.remove(MGR, 'om1');
    expect(manager.increment).not.toHaveBeenCalled();
    expect(manager.remove).toHaveBeenCalled();
  });

  it('unbekannter Eintrag -> 404', async () => {
    const { svc } = makeService({ found: null });
    await expect(svc.remove(MGR, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
