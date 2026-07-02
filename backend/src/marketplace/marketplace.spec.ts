import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MarketplaceService } from './marketplace.service';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

function makeService(over: { produkte?: any[]; haendler?: any[]; product?: any } = {}) {
  const dealerRepo: any = {
    find: jest.fn().mockResolvedValue(over.haendler ?? []),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'd1', ...x })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const productRepo: any = {
    find: jest.fn().mockResolvedValue(over.produkte ?? []),
    findOne: jest.fn().mockResolvedValue('product' in over ? over.product : null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'p1', ...x })),
    increment: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const clickRepo: any = {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'k1', ...x })),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
  };
  let orderSeq = 0;
  const orderRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: x.id ?? `o${++orderSeq}`, ...x })),
    createQueryBuilder: jest.fn(),
  };
  const orderItemRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
  };
  // Transaktion: reicht dieselben Mock-Repos ueber den EntityManager durch.
  const dataSource: any = {
    transaction: jest.fn(async (cb: any) =>
      cb({
        getRepository: (entity: any) =>
          entity?.name === 'MarketplaceOrderItem' ? orderItemRepo : orderRepo,
      }),
    ),
  };
  const mail: any = { send: jest.fn().mockResolvedValue(undefined) };
  const svc = new MarketplaceService(
    dealerRepo,
    productRepo,
    clickRepo,
    orderRepo,
    orderItemRepo,
    dataSource,
    mail,
  );
  return { svc, dealerRepo, productRepo, clickRepo, orderRepo, orderItemRepo, mail };
}

const KUNDE: any = { id: 'u1', email: 'a@b.de', role: 'technician', tenantId: 't1' };

describe('MarketplaceService · Katalog', () => {
  it('liefert nur Produkte AKTIVER Haendler, mit Haendlernamen + Kategorien', async () => {
    const { svc } = makeService({
      produkte: [
        { id: 'p1', dealerId: 'd1', name: 'PPF-Folie', kategorie: 'Folien' },
        { id: 'p2', dealerId: 'weg', name: 'Verwaist', kategorie: 'Chemie' }, // Haendler inaktiv/geloescht
      ],
      haendler: [{ id: 'd1', name: 'FolienProfi GmbH' }],
    });
    const res = await svc.catalog();
    expect(res.produkte).toHaveLength(1);
    expect(res.produkte[0]).toMatchObject({ name: 'PPF-Folie', haendlerName: 'FolienProfi GmbH' });
    expect(res.kategorien).toEqual(['Chemie', 'Folien']); // sortiert; Kategorien vor dem Haendler-Filter
  });
});

describe('MarketplaceService · Klick (Affiliate)', () => {
  it('zaehlt Einzelklick (mit tenantId aus JWT) + inkrementiert atomar + liefert die URL', async () => {
    const { svc, clickRepo, productRepo } = makeService({
      product: { id: 'p1', dealerId: 'd1', affiliateUrl: 'https://haendler.de/x?aff=detailly', aktiv: true },
    });
    const res = await svc.klick(KUNDE, 'p1');
    expect(res).toEqual({ affiliateUrl: 'https://haendler.de/x?aff=detailly' });
    expect(clickRepo.create.mock.calls[0][0]).toMatchObject({ productId: 'p1', dealerId: 'd1', tenantId: 't1' });
    expect(productRepo.increment).toHaveBeenCalledWith({ id: 'p1' }, 'klicks', 1);
  });

  it('inaktives/unbekanntes Produkt -> 404, kein Klick gezaehlt', async () => {
    const { svc, clickRepo } = makeService({ product: null });
    await expect(svc.klick(KUNDE, 'x')).rejects.toBeInstanceOf(NotFoundException);
    expect(clickRepo.save).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · In-App-Bestellung', () => {
  const BESTELLDATEN = { kontaktName: 'Max Muster', kontaktEmail: 'max@betrieb.de' };

  it('teilt den Warenkorb je Haendler auf und friert Preis + Provisionssatz als Snapshot ein', async () => {
    const { svc, orderRepo, orderItemRepo, mail } = makeService({
      produkte: [
        { id: 'p1', dealerId: 'd1', name: 'PPF-Folie', preis: 100, aktiv: true, bestellbar: true },
        { id: 'p2', dealerId: 'd2', name: 'Politur', preis: 19.9, aktiv: true, bestellbar: true },
      ],
      haendler: [
        { id: 'd1', name: 'FolienProfi', provisionSatz: 10, aktiv: true, kontaktEmail: 'fp@x.de' },
        { id: 'd2', name: 'ChemieMax', provisionSatz: 7.5, aktiv: true },
      ],
    });
    await svc.createOrders(KUNDE as any, {
      ...BESTELLDATEN,
      positionen: [
        { productId: 'p1', menge: 2 },
        { productId: 'p2', menge: 1 },
      ],
    } as any);

    // Zwei Teil-Bestellungen (eine je Haendler).
    expect(orderRepo.save).toHaveBeenCalledTimes(2);
    const [o1, o2] = orderRepo.save.mock.calls.map((c: any) => c[0]);
    expect(o1).toMatchObject({ dealerId: 'd1', tenantId: 't1', summeBrutto: 200, summeProvision: 20 });
    expect(o2).toMatchObject({ dealerId: 'd2', summeBrutto: 19.9, summeProvision: 1.49 });
    expect(o1.nummer).toMatch(/^MP-\d{4}-\d{4}$/);

    // Positionen mit Snapshot-Werten.
    const items = orderItemRepo.save.mock.calls.flatMap((c: any) => c[0]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ produktName: 'PPF-Folie', einzelpreis: 100, menge: 2, provisionSatz: 10, provisionBetrag: 20 });

    // Haendler mit kontaktEmail wird benachrichtigt (fire-and-forget).
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('fp@x.de');
  });

  it('nicht bestellbare/inaktive Produkte -> 400, keine Bestellung', async () => {
    const { svc, orderRepo } = makeService({ produkte: [] }); // find() liefert nichts Bestellbares
    await expect(
      svc.createOrders(KUNDE as any, { ...BESTELLDATEN, positionen: [{ productId: 'p1', menge: 1 }] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('Preise/Provision kommen NIE vom Client (kein Feld aus dto uebernommen)', async () => {
    const { svc, orderRepo } = makeService({
      produkte: [{ id: 'p1', dealerId: 'd1', name: 'X', preis: 50, aktiv: true, bestellbar: true }],
      haendler: [{ id: 'd1', name: 'D', provisionSatz: 20, aktiv: true }],
    });
    await svc.createOrders(KUNDE as any, {
      ...BESTELLDATEN,
      // Angriff: Client versucht Preis/Provision mitzugeben - DTO kennt die Felder
      // nicht (whitelist), und der Service liest sie nirgends.
      positionen: [{ productId: 'p1', menge: 1, einzelpreis: 0.01, provisionSatz: 0 } as any],
    } as any);
    expect(orderRepo.save.mock.calls[0][0]).toMatchObject({ summeBrutto: 50, summeProvision: 10 });
  });
});

describe('MarketplaceService · Haendler-Portal', () => {
  it('Token mit falschem Format -> 404 OHNE DB-Zugriff', async () => {
    const { svc, dealerRepo } = makeService();
    await expect(svc.portalOverview('../../etc/passwd')).rejects.toBeInstanceOf(NotFoundException);
    expect(dealerRepo.findOne).not.toHaveBeenCalled();
  });

  it('Statusuebergang versendet -> bestaetigt ist verboten (kein Zuruecksetzen)', async () => {
    const token = 'a'.repeat(48);
    const { svc, dealerRepo, orderRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue({ id: 'd1', name: 'D', aktiv: true });
    orderRepo.findOne.mockResolvedValue({ id: 'o1', dealerId: 'd1', status: 'versendet' });
    await expect(svc.portalSetOrderStatus(token, 'o1', 'bestaetigt' as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bestellbares Produkt ohne Preis -> 400 (Vertriebsweg-Validierung)', async () => {
    const token = 'b'.repeat(48);
    const { svc, dealerRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue({ id: 'd1', name: 'D', aktiv: true });
    await expect(
      svc.portalCreateProduct(token, { name: 'Folie XL', kategorie: 'Folien', bestellbar: true } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PlatformMarketplaceController · RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = PlatformMarketplaceController.prototype as any;
  const ctxFor = (handler: any, role: string): any => ({
    getHandler: () => handler,
    getClass: () => PlatformMarketplaceController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });

  it.each([UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN])(
    'Kunden-Rolle %s kommt NICHT an die Pflege',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.createProduct, role))).toBe(false);
      expect(guard.canActivate(ctxFor(proto.stats, role))).toBe(false);
    },
  );

  it('Analyst: Statistik lesen ja, pflegen nein', () => {
    expect(guard.canActivate(ctxFor(proto.stats, UserRole.PLATFORM_ANALYST))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.createProduct, UserRole.PLATFORM_ANALYST))).toBe(false);
  });

  it('Platform-Support darf pflegen', () => {
    expect(guard.canActivate(ctxFor(proto.createDealer, UserRole.PLATFORM_SUPPORT))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.updateProduct, UserRole.PLATFORM_SUPPORT))).toBe(true);
  });
});
