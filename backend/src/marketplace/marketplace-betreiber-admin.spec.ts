import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MarketplaceService } from './marketplace.service';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

// ---------------------------------------------------------------------------
// Marktplatz-Ausbau PR7: Betreiber-Admin (Kategorie-CRUD, Highlight-Kuration,
// Bewertungs-Moderation, Haendler-Login-Verwaltung). Fokussierter Service-Mock:
// nur die von diesen Pfaden genutzten Repos/Deps sind belegt.
// ---------------------------------------------------------------------------

function makeAdminService(
  opts: {
    category?: any;
    parent?: any;
    slugTaken?: boolean;
    kinder?: number;
    product?: any;
    review?: any;
    aktiveReviews?: any[];
    haendlerUser?: any;
    haendlerUsers?: any[];
    dealer?: any;
  } = {},
) {
  const dealer = opts.dealer === undefined ? { id: 'd1', name: 'Haendler' } : opts.dealer;

  const dealerRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(dealer),
  };
  const productRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(opts.product ?? null),
    save: jest.fn(async (x: any) => ({ id: 'p1', ...x })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const clickRepo: any = {};
  const orderRepo: any = {};
  const orderItemRepo: any = {};
  // Kategorie-Repo: findOne liefert je nach Aufruf Slug-Kollision bzw. Parent/Kategorie.
  const categoryRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(opts.kinder ?? 0),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: x.id ?? 'cat-neu', ...x })),
  };
  const reviewRepo: any = {
    find: jest.fn().mockResolvedValue(opts.aktiveReviews ?? []),
    findOne: jest.fn().mockResolvedValue(opts.review ?? null),
    save: jest.fn(async (x: any) => x),
  };
  const userRepo: any = {
    find: jest.fn().mockResolvedValue(opts.haendlerUsers ?? []),
    findOne: jest.fn().mockResolvedValue(opts.haendlerUser ?? null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    increment: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource: any = {};
  const mail: any = { send: jest.fn() };
  const config: any = { get: jest.fn() };
  const kyb: any = {};
  const auth: any = { requestPasswordReset: jest.fn().mockResolvedValue(undefined) };
  const upload: any = {};

  const svc = new MarketplaceService(
    dealerRepo,
    productRepo,
    clickRepo,
    orderRepo,
    orderItemRepo,
    categoryRepo,
    reviewRepo,
    userRepo,
    dataSource,
    mail,
    config,
    kyb,
    auth,
    upload,
  );
  return { svc, dealerRepo, productRepo, categoryRepo, reviewRepo, userRepo, auth };
}

// ---------------------------------------------------------------------------
// Rollen-Gate: nur PLATFORM_* – Tenant-Rollen kommen nicht an die Pflege
// ---------------------------------------------------------------------------
describe('PlatformMarketplaceController · RolesGuard (PR7-Endpunkte)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = PlatformMarketplaceController.prototype as any;
  const ctxFor = (handler: any, role: string): any => ({
    getHandler: () => handler,
    getClass: () => PlatformMarketplaceController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });

  const schreibHandler = [
    'createCategory',
    'updateCategory',
    'deactivateCategory',
    'setHighlight',
    'moderateReview',
    'reinviteHaendler',
    'deactivateHaendler',
  ];

  it.each([UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.RECEPTIONIST, UserRole.HAENDLER])(
    'Nicht-Plattform-Rolle %s -> 403 auf allen PR7-Schreib-Endpunkten',
    (role) => {
      for (const name of schreibHandler) {
        expect(guard.canActivate(ctxFor(proto[name], role))).toBe(false);
      }
    },
  );

  it('Platform-Admin + -Support duerfen alle PR7-Schreib-Endpunkte; Analyst nicht', () => {
    for (const name of schreibHandler) {
      expect(guard.canActivate(ctxFor(proto[name], UserRole.PLATFORM_ADMIN))).toBe(true);
      expect(guard.canActivate(ctxFor(proto[name], UserRole.PLATFORM_SUPPORT))).toBe(true);
      expect(guard.canActivate(ctxFor(proto[name], UserRole.PLATFORM_ANALYST))).toBe(false);
    }
  });

  it('Lese-Endpunkte (Kategorien/Bewertungen) sind fuer alle Plattform-Rollen offen', () => {
    for (const name of ['listCategories', 'listReviews']) {
      for (const role of [UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST]) {
        expect(guard.canActivate(ctxFor(proto[name], role))).toBe(true);
      }
      // Tenant-Rolle bleibt aussen vor (Klassen-Guard).
      expect(guard.canActivate(ctxFor(proto[name], UserRole.OWNER))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Kategorie-CRUD + Slug-Eindeutigkeit
// ---------------------------------------------------------------------------
describe('MarketplaceService · Kategorie-CRUD', () => {
  it('legt eine Hauptkategorie an (Bereich aus DTO, parentId=null), Slug normalisiert', async () => {
    const { svc, categoryRepo } = makeAdminService();
    categoryRepo.findOne.mockResolvedValue(null); // Slug frei
    await svc.createCategory(
      { name: 'Zubehör', slug: 'Aufbereitung-Extra', bereich: 'aufbereitung' } as any,
      'admin-1',
    );
    const angelegt = categoryRepo.create.mock.calls[0][0];
    expect(angelegt).toMatchObject({
      slug: 'aufbereitung-extra', // trim + lowercase
      name: 'Zubehör',
      bereich: 'aufbereitung',
      parentId: null,
      aktiv: true,
      sdbPflicht: false,
    });
  });

  it('legt eine Unterkategorie an: Bereich wird vom Parent abgeleitet (nie aus dem Body)', async () => {
    const { svc, categoryRepo } = makeAdminService();
    // 1. Aufruf: Slug-Check (frei). 2. Aufruf: Parent laden.
    categoryRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'h-fol', parentId: null, bereich: 'folierung' });
    await svc.createCategory(
      { name: 'Neu-Sub', slug: 'folierung-neu', bereich: 'ppf', parentId: 'h-fol' } as any,
      'admin-1',
    );
    const angelegt = categoryRepo.create.mock.calls[0][0];
    expect(angelegt.parentId).toBe('h-fol');
    expect(angelegt.bereich).toBe('folierung'); // vom Parent, NICHT das 'ppf' aus dem Body
  });

  it('doppelter Slug -> 409, nichts gespeichert', async () => {
    const { svc, categoryRepo } = makeAdminService();
    categoryRepo.findOne.mockResolvedValue({ id: 'cat-alt', slug: 'folierung-neu' });
    await expect(
      svc.createCategory({ name: 'X', slug: 'folierung-neu', bereich: 'folierung' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });

  it('Unterkategorie unter nicht existierendem Parent -> 400', async () => {
    const { svc, categoryRepo } = makeAdminService();
    categoryRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(
      svc.createCategory({ name: 'X', slug: 'x-neu', parentId: 'weg' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Unterkategorie unter einer Unterkategorie -> 400 (nur zwei Ebenen)', async () => {
    const { svc, categoryRepo } = makeAdminService();
    categoryRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub', parentId: 'h1', bereich: 'ppf' }); // Parent ist selbst Sub
    await expect(
      svc.createCategory({ name: 'X', slug: 'x-neu', parentId: 'sub' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deaktivieren setzt aktiv=false (kein Hard-Delete; Produkte behalten categoryId)', async () => {
    const { svc, categoryRepo } = makeAdminService();
    categoryRepo.findOne.mockResolvedValue({ id: 'cat1', aktiv: true });
    await svc.deactivateCategory('cat1', 'admin-1');
    expect(categoryRepo.save.mock.calls[0][0]).toMatchObject({ id: 'cat1', aktiv: false });
  });

  it('deaktivieren unbekannte Kategorie -> 404', async () => {
    const { svc, categoryRepo } = makeAdminService();
    categoryRepo.findOne.mockResolvedValue(null);
    await expect(svc.deactivateCategory('weg')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Re-Parenting einer Kategorie mit Unterkategorien -> 400 (keine dritte Ebene)', async () => {
    const { svc, categoryRepo } = makeAdminService({ kinder: 2 });
    categoryRepo.findOne
      .mockResolvedValueOnce({ id: 'cat1', parentId: null, bereich: 'folierung' }) // die Kategorie
      .mockResolvedValueOnce({ id: 'h2', parentId: null, bereich: 'ppf' }); // neuer Parent
    await expect(
      svc.updateCategory('cat1', { parentId: 'h2' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Bewertungs-Moderation: setzt aktiv + Aggregat neu (inaktive zaehlen nicht)
// ---------------------------------------------------------------------------
describe('MarketplaceService · Bewertungs-Moderation', () => {
  it('ausblenden setzt aktiv=false und berechnet den Schnitt/Anzahl neu (nur AKTIVE)', async () => {
    const { svc, reviewRepo, productRepo } = makeAdminService({
      review: { id: 'r1', productId: 'p1', aktiv: true },
      // Nach dem Ausblenden verbleiben diese AKTIVEN Bewertungen -> Schnitt 4.0 / 2.
      aktiveReviews: [{ sterne: 5 }, { sterne: 3 }],
    });
    const res = await svc.moderateReview('r1', false, 'admin-1');
    expect(reviewRepo.save.mock.calls[0][0]).toMatchObject({ id: 'r1', aktiv: false });
    // aggregatFortschreiben laedt NUR aktiv=true und schreibt das denormalisierte Aggregat.
    expect(reviewRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'p1', aktiv: true } }),
    );
    expect(productRepo.update).toHaveBeenCalledWith('p1', {
      bewertungSchnitt: 4,
      bewertungAnzahl: 2,
    });
    expect(res).toMatchObject({ id: 'r1', aktiv: false, bewertungSchnitt: 4, bewertungAnzahl: 2 });
  });

  it('letzte aktive Bewertung ausgeblendet -> Aggregat 0/0', async () => {
    const { svc, productRepo } = makeAdminService({
      review: { id: 'r1', productId: 'p1', aktiv: true },
      aktiveReviews: [], // keine aktiven mehr
    });
    await svc.moderateReview('r1', false);
    expect(productRepo.update).toHaveBeenCalledWith('p1', {
      bewertungSchnitt: 0,
      bewertungAnzahl: 0,
    });
  });

  it('unbekannte Bewertung -> 404, kein Aggregat-Schreiben', async () => {
    const { svc, reviewRepo, productRepo } = makeAdminService({ review: null });
    await expect(svc.moderateReview('weg', false)).rejects.toBeInstanceOf(NotFoundException);
    expect(reviewRepo.save).not.toHaveBeenCalled();
    expect(productRepo.update).not.toHaveBeenCalled();
  });

  it('betreiberweite Liste liefert Produktbezug OHNE bewertenden Betrieb/Nutzer', async () => {
    const { svc, reviewRepo, productRepo, dealerRepo } = makeAdminService();
    reviewRepo.find.mockResolvedValue([
      { id: 'r1', productId: 'p1', sterne: 2, text: 'mau', verifiziert: true, aktiv: false, createdAt: new Date(), tenantId: 't-geheim', userId: 'u-geheim' },
    ]);
    productRepo.find.mockResolvedValue([{ id: 'p1', name: 'Politur X', dealerId: 'd1' }]);
    dealerRepo.find.mockResolvedValue([{ id: 'd1', name: 'ChemieProfi' }]);
    const liste = await svc.listAllReviews();
    expect(liste[0]).toEqual({
      id: 'r1',
      productId: 'p1',
      produktName: 'Politur X',
      haendlerName: 'ChemieProfi',
      sterne: 2,
      text: 'mau',
      verifiziert: true,
      aktiv: false, // inaktive sind fuer die Moderation sichtbar
      createdAt: expect.any(Date),
    });
    expect((liste[0] as any).tenantId).toBeUndefined();
    expect((liste[0] as any).userId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Highlight-Kuration
// ---------------------------------------------------------------------------
describe('MarketplaceService · Highlight-Toggle', () => {
  it('setzt istHighlight=true am Produkt', async () => {
    const { svc, productRepo } = makeAdminService({ product: { id: 'p1', istHighlight: false } });
    await svc.setHighlight('p1', true, 'admin-1');
    expect(productRepo.save.mock.calls[0][0]).toMatchObject({ id: 'p1', istHighlight: true });
  });

  it('entfernt das Highlight (istHighlight=false)', async () => {
    const { svc, productRepo } = makeAdminService({ product: { id: 'p1', istHighlight: true } });
    await svc.setHighlight('p1', false);
    expect(productRepo.save.mock.calls[0][0]).toMatchObject({ id: 'p1', istHighlight: false });
  });

  it('unbekanntes Produkt -> 404', async () => {
    const { svc } = makeAdminService({ product: null });
    await expect(svc.setHighlight('weg', true)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Haendler-Login-Verwaltung: Einladung erneut senden + Konto deaktivieren
// ---------------------------------------------------------------------------
describe('MarketplaceService · Haendler-Login-Verwaltung', () => {
  it('Einladung erneut senden loest den bestehenden Reset-Flow fuer die Haendler-Mail aus', async () => {
    const { svc, auth } = makeAdminService({
      haendlerUser: { id: 'hu1', email: 'einkauf@nord.de', role: UserRole.HAENDLER, dealerId: 'd1', isActive: true },
    });
    const res = await svc.reinviteHaendler('d1', 'admin-1');
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('einkauf@nord.de');
    expect(res.ok).toBe(true);
  });

  it('kein Login-Konto -> 400, keine Einladung', async () => {
    const { svc, auth } = makeAdminService({ haendlerUser: null });
    await expect(svc.reinviteHaendler('d1')).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('deaktivieren setzt isActive=false UND erhoeht tokenVersion (Sessions ungueltig)', async () => {
    const { svc, userRepo } = makeAdminService({
      haendlerUsers: [{ id: 'hu1', role: UserRole.HAENDLER, dealerId: 'd1', isActive: true }],
    });
    const res = await svc.deactivateHaendler('d1', 'admin-1');
    expect(userRepo.update).toHaveBeenCalledWith('hu1', { isActive: false });
    expect(userRepo.increment).toHaveBeenCalledWith({ id: 'hu1' }, 'tokenVersion', 1);
    expect(res).toEqual({ ok: true, deaktiviert: 1 });
  });

  it('kein aktives Konto vorhanden -> 400, keine Mutation', async () => {
    const { svc, userRepo } = makeAdminService({
      haendlerUsers: [{ id: 'hu1', role: UserRole.HAENDLER, dealerId: 'd1', isActive: false }],
    });
    await expect(svc.deactivateHaendler('d1')).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(userRepo.increment).not.toHaveBeenCalled();
  });

  it('unbekannter Haendler -> 404 (deaktivieren)', async () => {
    const { svc } = makeAdminService({ dealer: null });
    await expect(svc.deactivateHaendler('weg')).rejects.toBeInstanceOf(NotFoundException);
  });
});
