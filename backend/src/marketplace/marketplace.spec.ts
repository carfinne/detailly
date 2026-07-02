import { NotFoundException } from '@nestjs/common';
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
  const svc = new MarketplaceService(dealerRepo, productRepo, clickRepo);
  return { svc, dealerRepo, productRepo, clickRepo };
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
