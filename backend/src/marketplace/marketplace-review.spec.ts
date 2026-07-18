import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { CreateReviewDto } from './dto/marketplace.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

// ---------------------------------------------------------------------------
// Marktplatz-Ausbau PR6: Bewertungen schreiben (nur verifizierte Kaeufer) +
// Aggregat-Fortschreibung. Fokussierter Service-Mock (nur die von den Review-
// Pfaden benutzten Repos/Deps sind belegt).
// ---------------------------------------------------------------------------

const KUNDE: any = { id: 'u1', email: 'a@b.de', role: 'technician', tenantId: 't1' };

function makeReviewService(
  opts: {
    product?: any;
    dealer?: any;
    gekauft?: boolean;
    eigene?: any;
    aktive?: any[];
    liste?: any[];
    listeTotal?: number;
  } = {},
) {
  const product =
    opts.product === undefined ? { id: 'p1', dealerId: 'd1', aktiv: true } : opts.product;
  const dealer =
    opts.dealer === undefined ? { id: 'd1', aktiv: true, status: 'freigegeben' } : opts.dealer;

  const dealerRepo: any = { findOne: jest.fn().mockResolvedValue(dealer) };
  const productRepo: any = {
    findOne: jest.fn().mockResolvedValue(product),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const clickRepo: any = {};
  const orderRepo: any = {};
  // Kauf-Nachweis: createQueryBuilder(...).getCount() -> 0/1 je nach opts.gekauft.
  const orderItemQb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(opts.gekauft ? 1 : 0),
  };
  const orderItemRepo: any = { createQueryBuilder: jest.fn(() => orderItemQb) };
  const categoryRepo: any = {};
  let reviewSeq = 0;
  const reviewRepo: any = {
    findOne: jest.fn().mockResolvedValue(opts.eigene ?? null),
    find: jest.fn().mockResolvedValue(opts.aktive ?? []),
    findAndCount: jest
      .fn()
      .mockResolvedValue([opts.liste ?? [], opts.listeTotal ?? (opts.liste?.length ?? 0)]),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({
      id: x.id ?? `r${++reviewSeq}`,
      createdAt: x.createdAt ?? new Date(),
      ...x,
    })),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const userRepo: any = {};
  const dataSource: any = {};
  const mail: any = {};
  const config: any = { get: jest.fn() };
  const kyb: any = {};
  const auth: any = {};
  const upload: any = { bilderFuerProdukte: jest.fn().mockResolvedValue(new Map()) };

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
  return { svc, dealerRepo, productRepo, orderItemRepo, orderItemQb, reviewRepo };
}

describe('MarketplaceService · Bewertung anlegen (Kaeufer-Pflicht)', () => {
  it('Nicht-Kaeufer -> 403, nichts gespeichert, kein Aggregat', async () => {
    const { svc, reviewRepo, productRepo } = makeReviewService({ gekauft: false });
    await expect(svc.createReview(KUNDE, 'p1', { sterne: 5 } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(reviewRepo.save).not.toHaveBeenCalled();
    expect(productRepo.update).not.toHaveBeenCalled();
  });

  it('Kaeufer legt an -> verifiziert=true, tenantId/userId aus JWT, aktiv=true', async () => {
    const { svc, reviewRepo } = makeReviewService({ gekauft: true, aktive: [{ sterne: 5 }] });
    const res = await svc.createReview(KUNDE, 'p1', { sterne: 5, text: '  Top Produkt  ' } as any);
    const angelegt = reviewRepo.create.mock.calls[0][0];
    expect(angelegt).toMatchObject({
      productId: 'p1',
      tenantId: 't1',
      userId: 'u1',
      sterne: 5,
      text: 'Top Produkt', // getrimmt
      verifiziert: true,
      aktiv: true,
    });
    expect(res).toMatchObject({ sterne: 5, verifiziert: true, aktiv: true });
    // Preis/Aggregat: kein bewertender Betrieb/Nutzer in der Rueckgabe (nur eigene Sicht).
    expect((res as any).tenantId).toBeUndefined();
    expect((res as any).userId).toBeUndefined();
  });

  it('Doppel-Bewertung (Betrieb hat schon bewertet) -> 409, kein zweiter Datensatz', async () => {
    const { svc, reviewRepo, productRepo } = makeReviewService({
      gekauft: true,
      eigene: { id: 'r1', productId: 'p1', tenantId: 't1', sterne: 4 },
    });
    await expect(svc.createReview(KUNDE, 'p1', { sterne: 5 } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(reviewRepo.save).not.toHaveBeenCalled();
    expect(productRepo.update).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Bewertung aendern (Upsert)', () => {
  it('vorhandene eigene Bewertung wird aktualisiert (kein erneuter Kauf-Check, Autor/verifiziert bleiben)', async () => {
    const { svc, reviewRepo, orderItemRepo } = makeReviewService({
      eigene: {
        id: 'r1',
        productId: 'p1',
        tenantId: 't1',
        userId: 'u-orig',
        sterne: 3,
        text: 'alt',
        verifiziert: true,
        aktiv: true,
      },
      aktive: [{ sterne: 5 }],
    });
    const res = await svc.updateReview(KUNDE, 'p1', { sterne: 5, text: 'neu' } as any);
    const gespeichert = reviewRepo.save.mock.calls[0][0];
    expect(gespeichert).toMatchObject({
      id: 'r1',
      sterne: 5,
      text: 'neu',
      userId: 'u-orig', // urspruenglicher Autor bleibt
      verifiziert: true, // Kauf-Nachweis bleibt
    });
    expect(res).toMatchObject({ sterne: 5, text: 'neu' });
    // Bestehende eigene Bewertung -> KEINE erneute Kauf-Pruefung.
    expect(orderItemRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('ohne eigene Bewertung legt PUT eine an -> Kaeufer-Pflicht greift (Nicht-Kaeufer -> 403)', async () => {
    const { svc, reviewRepo } = makeReviewService({ eigene: null, gekauft: false });
    await expect(svc.updateReview(KUNDE, 'p1', { sterne: 4 } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(reviewRepo.save).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Aggregat-Fortschreibung (denormalisiert)', () => {
  it('Create schreibt Schnitt (gerundet) + Anzahl aus den AKTIVEN Bewertungen', async () => {
    const { svc, productRepo, reviewRepo } = makeReviewService({
      gekauft: true,
      aktive: [{ sterne: 5 }, { sterne: 4 }, { sterne: 4 }], // Schnitt 4.33 -> 4.33
    });
    await svc.createReview(KUNDE, 'p1', { sterne: 4 } as any);
    // NUR aktive Bewertungen zaehlen (where aktiv:true).
    expect(reviewRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'p1', aktiv: true } }),
    );
    expect(productRepo.update).toHaveBeenCalledWith('p1', {
      bewertungSchnitt: 4.33,
      bewertungAnzahl: 3,
    });
  });

  it('Update schreibt das Aggregat neu', async () => {
    const { svc, productRepo } = makeReviewService({
      eigene: { id: 'r1', productId: 'p1', tenantId: 't1', userId: 'u1', sterne: 2, verifiziert: true, aktiv: true },
      aktive: [{ sterne: 5 }, { sterne: 3 }], // -> 4.0 / 2
    });
    await svc.updateReview(KUNDE, 'p1', { sterne: 5 } as any);
    expect(productRepo.update).toHaveBeenCalledWith('p1', {
      bewertungSchnitt: 4,
      bewertungAnzahl: 2,
    });
  });

  it('Delete entfernt die eigene Bewertung und setzt das Aggregat auf 0/0 (letzte weg)', async () => {
    const { svc, reviewRepo, productRepo } = makeReviewService({
      eigene: { id: 'r1', productId: 'p1', tenantId: 't1', sterne: 5, aktiv: true },
      aktive: [], // nach dem Loeschen keine aktiven mehr
    });
    const res = await svc.deleteReview(KUNDE, 'p1');
    expect(reviewRepo.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    expect(productRepo.update).toHaveBeenCalledWith('p1', {
      bewertungSchnitt: 0,
      bewertungAnzahl: 0,
    });
    expect(res).toEqual({ ok: true, bewertungSchnitt: 0, bewertungAnzahl: 0 });
  });

  it('Delete ohne eigene Bewertung -> 404, kein Aggregat-Schreiben', async () => {
    const { svc, reviewRepo, productRepo } = makeReviewService({ eigene: null });
    await expect(svc.deleteReview(KUNDE, 'p1')).rejects.toBeInstanceOf(NotFoundException);
    expect(reviewRepo.remove).not.toHaveBeenCalled();
    expect(productRepo.update).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Bewertungsliste (GET, ohne PII)', () => {
  it('liefert nur aktive Bewertungen, paginiert, OHNE bewertenden Betrieb/Nutzer', async () => {
    const { svc, reviewRepo } = makeReviewService({
      liste: [
        {
          id: 'r1',
          sterne: 5,
          text: 'Top',
          verifiziert: true,
          createdAt: new Date(),
          tenantId: 't-geheim',
          userId: 'u-geheim',
          aktiv: true,
        },
      ],
      listeTotal: 1,
    });
    const res = await svc.listReviews('p1', '10', '0');
    // Query verlangt aktiv:true + Paginierung.
    expect(reviewRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'p1', aktiv: true }, take: 10, skip: 0 }),
    );
    expect(res.total).toBe(1);
    // Keine Cross-Tenant-PII in der Ausgabe.
    expect(res.bewertungen[0]).toEqual({
      sterne: 5,
      text: 'Top',
      verifiziert: true,
      createdAt: expect.any(Date),
    });
    expect((res.bewertungen[0] as any).tenantId).toBeUndefined();
    expect((res.bewertungen[0] as any).userId).toBeUndefined();
  });

  it('klemmt limit (Default 20, Max 50) und offset (>=0)', async () => {
    const { svc, reviewRepo } = makeReviewService();
    await svc.listReviews('p1', '999', '-5');
    expect(reviewRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
    await svc.listReviews('p1', undefined, undefined);
    expect(reviewRepo.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 20, skip: 0 }),
    );
  });
});

describe('MarketplaceService · Detail-Schreibsicht (kannBewerten/eigeneBewertung)', () => {
  it('Kaeufer ohne eigene Bewertung -> kannBewerten=true', async () => {
    const { svc } = makeReviewService({ gekauft: true, eigene: null });
    const det = await svc.productDetail('p1', KUNDE);
    expect(det.kannBewerten).toBe(true);
    expect(det.eigeneBewertung).toBeNull();
  });

  it('Betrieb mit eigener Bewertung -> eigeneBewertung gesetzt, kannBewerten=false, kein Kauf-Check', async () => {
    const { svc, orderItemRepo } = makeReviewService({
      eigene: { sterne: 4, text: 'meins', verifiziert: true, aktiv: true, createdAt: new Date() },
    });
    const det = await svc.productDetail('p1', KUNDE);
    expect(det.kannBewerten).toBe(false);
    expect(det.eigeneBewertung).toMatchObject({ sterne: 4, text: 'meins', verifiziert: true });
    expect(orderItemRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('ohne user (unauth. Aufruf-Pfad) -> kannBewerten=false, eigeneBewertung=null', async () => {
    const { svc, reviewRepo } = makeReviewService();
    const det = await svc.productDetail('p1');
    expect(det.kannBewerten).toBe(false);
    expect(det.eigeneBewertung).toBeNull();
    // findOne (eigene Bewertung) wird ohne user nicht aufgerufen.
    expect(reviewRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('CreateReviewDto · Validierung', () => {
  it('sterne < 1 / > 5 und zu langer Text -> Fehler', async () => {
    const zuLang = 'x'.repeat(2001);
    const e1 = await validate(plainToInstance(CreateReviewDto, { sterne: 0 }));
    const e6 = await validate(plainToInstance(CreateReviewDto, { sterne: 6 }));
    const eText = await validate(plainToInstance(CreateReviewDto, { sterne: 3, text: zuLang }));
    expect(e1.map((e) => e.property)).toContain('sterne');
    expect(e6.map((e) => e.property)).toContain('sterne');
    expect(eText.map((e) => e.property)).toContain('text');
  });

  it('gueltig: sterne 1–5, text optional', async () => {
    const ok = await validate(plainToInstance(CreateReviewDto, { sterne: 4, text: 'Solide.' }));
    const okOhneText = await validate(plainToInstance(CreateReviewDto, { sterne: 5 }));
    expect(ok).toHaveLength(0);
    expect(okOhneText).toHaveLength(0);
  });
});

describe('MarketplaceController · RolesGuard (Bewertungen = Buy-Side)', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = MarketplaceController.prototype as any;
  const ctxFor = (handler: any, role: string): any => ({
    getHandler: () => handler,
    getClass: () => MarketplaceController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });

  it('HAENDLER kommt NICHT an die Bewertungs-Endpoints (403)', () => {
    for (const handler of [proto.reviews, proto.createReview, proto.updateReview, proto.deleteReview]) {
      expect(guard.canActivate(ctxFor(handler, UserRole.HAENDLER))).toBe(false);
    }
  });

  it('Betriebs-Rollen (Buy-Side) duerfen bewerten', () => {
    for (const role of [UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.RECEPTIONIST]) {
      expect(guard.canActivate(ctxFor(proto.createReview, role))).toBe(true);
      expect(guard.canActivate(ctxFor(proto.deleteReview, role))).toBe(true);
    }
  });
});
