import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MarketplaceService } from './marketplace.service';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { PublicHaendlerBewerbungController } from './public-haendler-bewerbung.controller';
import { HaendlerBewerbungDto, PortalProductDto } from './dto/marketplace.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

function makeService(
  over: {
    produkte?: any[];
    haendler?: any[];
    product?: any;
    config?: Record<string, string>;
    verkauft?: Record<string, number>;
    kategorien?: any[];
    reviews?: any[];
  } = {},
) {
  const dealerRepo: any = {
    find: jest.fn().mockResolvedValue(over.haendler ?? []),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'd1', ...x })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
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
  // Verkaufs-Aggregat (Ranking): createQueryBuilder(...).getRawMany() -> Zeilen.
  // Default leer; einzelne Tests koennen over.verkauft (productId->menge) setzen.
  const orderItemQb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(
      Object.entries(over.verkauft ?? {}).map(([productId, verkauft]) => ({
        productId,
        verkauft: String(verkauft),
      })),
    ),
  };
  const orderItemRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
    createQueryBuilder: jest.fn(() => orderItemQb),
  };
  // Kategorie-/Review-Repos (PR4: Katalog-API). Default leer; Tests setzen sie gezielt.
  const categoryRepo: any = {
    find: jest.fn().mockResolvedValue(over.kategorien ?? []),
  };
  const reviewRepo: any = {
    find: jest.fn().mockResolvedValue(over.reviews ?? []),
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
  const config: any = { get: jest.fn((key: string) => over.config?.[key]) };
  // KYB-Service (Welle 5): Datei-Ablage + Vorpruefung sind eigenstaendig getestet
  // (kyb.spec.ts); hier nur als Mock, damit createBewerbung/freigeben laufen.
  const kyb: any = {
    speichereDokument: jest
      .fn()
      .mockResolvedValue({ pfad: '/private-uploads/kyb/x.pdf.enc', hash: 'sha-abc' }),
    pruefeBewerbung: jest.fn().mockResolvedValue(undefined),
    ladeDokument: jest.fn(),
  };
  // User-Repo + AuthService (PR2): Haendler-Login-Onboarding bei der Freigabe.
  const userRepo: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'hu1', ...x })),
  };
  const auth: any = {
    hashPassword: jest.fn().mockResolvedValue('hashed'),
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
  };
  // Upload-Service (PR3): Datei-Handling ist eigenstaendig getestet
  // (marketplace-upload.spec.ts); hier nur als Mock. bilderFuerProdukte reichert
  // Katalog/Portal-Uebersicht an -> leere Galerie genuegt fuer diese Tests.
  const upload: any = {
    bilderFuerProdukte: jest.fn().mockResolvedValue(new Map()),
    bilderHochladen: jest.fn(),
    bildLoeschen: jest.fn(),
    bildAnzeigenFuerDealer: jest.fn(),
    bildStream: jest.fn(),
    sdbHochladen: jest.fn(),
    sdbAnzeigenFuerDealer: jest.fn(),
    sdbLaden: jest.fn(),
  };
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
  return {
    svc,
    dealerRepo,
    productRepo,
    clickRepo,
    orderRepo,
    orderItemRepo,
    orderItemQb,
    categoryRepo,
    reviewRepo,
    userRepo,
    mail,
    config,
    kyb,
    auth,
    upload,
  };
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

describe('MarketplaceService · Katalog-API (PR4)', () => {
  const heute = new Date();

  it('reichert je Produkt die Shop-Felder an (Kategorie/Herkunft/Bewertung/Versand/Bestand/hatSdb/Verkaeufe)', async () => {
    const { svc } = makeService({
      produkte: [
        {
          id: 'p1',
          dealerId: 'd1',
          name: 'Keramikversiegelung',
          bereich: 'aufbereitung',
          categoryId: 'cat-keramik',
          herkunftsland: 'DE',
          preis: 49.9,
          versandKosten: 5.9,
          lieferzeitTage: 2,
          bestand: 2, // -> "wenig"
          istHighlight: true,
          sdbDatei: '/private-uploads/marketplace-sdb/x.pdf.enc',
          bewertungSchnitt: 4.5,
          bewertungAnzahl: 8,
          klicks: 12,
          createdAt: heute,
        },
      ],
      haendler: [{ id: 'd1', name: 'ChemieProfi' }],
      verkauft: { p1: 15 },
    });
    const res = await svc.catalog();
    const p = res.produkte[0];
    expect(p).toMatchObject({
      id: 'p1',
      haendlerName: 'ChemieProfi',
      bereich: 'aufbereitung',
      categoryId: 'cat-keramik',
      herkunftsland: 'DE',
      versandKosten: 5.9,
      lieferzeitTage: 2,
      bestandStatus: 'wenig',
      istHighlight: true,
      hatSdb: true,
      bewertungSchnitt: 4.5,
      bewertungAnzahl: 8,
      verkaufsAnzahl: 15,
    });
    // Der Roh-SDB-Pfad wird NICHT ausgeliefert (nur das hatSdb-Flag).
    expect((p as any).sdbDatei).toBeUndefined();
    expect(typeof p.rankingScore).toBe('number');
    // Highlight taucht in der Highlights-Teilmenge auf.
    expect(res.highlights).toContain('p1');
  });

  it('bestandStatus leitet verfuegbar/wenig/ausverkauft korrekt ab (null = verfuegbar)', async () => {
    const { svc } = makeService({
      produkte: [
        { id: 'a', dealerId: 'd1', name: 'A', bestand: null },
        { id: 'b', dealerId: 'd1', name: 'B', bestand: 0 },
        { id: 'c', dealerId: 'd1', name: 'C', bestand: 3 },
        { id: 'd', dealerId: 'd1', name: 'D', bestand: 50 },
      ],
      haendler: [{ id: 'd1', name: 'H' }],
    });
    const res = await svc.catalog();
    const byId = Object.fromEntries(res.produkte.map((p) => [p.id, p.bestandStatus]));
    expect(byId).toEqual({ a: 'verfuegbar', b: 'ausverkauft', c: 'wenig', d: 'verfuegbar' });
  });

  it('Ranking (empfohlen, Default): Highlight + viele Verkaeufe + gute Bewertung rankt oben; Karteileiche unten', async () => {
    const alt = new Date(Date.now() - 400 * 24 * 3600 * 1000);
    const { svc } = makeService({
      produkte: [
        // Karteileiche: nichts, alt.
        { id: 'flop', dealerId: 'd1', name: 'Ladenhueter', createdAt: alt },
        // Mittelfeld: solide Bewertung, ein paar Verkaeufe.
        { id: 'mid', dealerId: 'd1', name: 'Solide', bewertungSchnitt: 4, bewertungAnzahl: 5, klicks: 20, createdAt: heute },
        // Star: Highlight + viele Verkaeufe + Top-Bewertung + frisch.
        { id: 'star', dealerId: 'd1', name: 'Bestseller', istHighlight: true, bewertungSchnitt: 5, bewertungAnzahl: 20, klicks: 100, createdAt: heute },
      ],
      haendler: [{ id: 'd1', name: 'H' }],
      verkauft: { star: 50, mid: 5 },
    });
    const res = await svc.catalog(); // Default = 'empfohlen'
    expect(res.produkte.map((p) => p.id)).toEqual(['star', 'mid', 'flop']);
  });

  it('Highlight rankt ueber ein sonst identisches Nicht-Highlight-Produkt', async () => {
    const { svc } = makeService({
      produkte: [
        { id: 'normal', dealerId: 'd1', name: 'Normal', createdAt: heute },
        { id: 'pin', dealerId: 'd1', name: 'Gepinnt', istHighlight: true, createdAt: heute },
      ],
      haendler: [{ id: 'd1', name: 'H' }],
    });
    const res = await svc.catalog();
    expect(res.produkte[0].id).toBe('pin');
  });

  it('sort=preis sortiert aufsteigend, Produkte ohne Preis ans Ende', async () => {
    const { svc } = makeService({
      produkte: [
        { id: 'teuer', dealerId: 'd1', name: 'Teuer', preis: 199 },
        { id: 'ohne', dealerId: 'd1', name: 'AufAnfrage', preis: null },
        { id: 'guenstig', dealerId: 'd1', name: 'Guenstig', preis: 9.9 },
      ],
      haendler: [{ id: 'd1', name: 'H' }],
    });
    const res = await svc.catalog('preis');
    expect(res.produkte.map((p) => p.id)).toEqual(['guenstig', 'teuer', 'ohne']);
  });

  it('laedt Verkaufs-Aggregat + Galerie-Bilder in JE EINER Sammelabfrage (kein N+1)', async () => {
    const { svc, orderItemRepo, upload } = makeService({
      produkte: [
        { id: 'p1', dealerId: 'd1', name: 'A' },
        { id: 'p2', dealerId: 'd1', name: 'B' },
        { id: 'p3', dealerId: 'd1', name: 'C' },
      ],
      haendler: [{ id: 'd1', name: 'H' }],
    });
    await svc.catalog();
    // Unabhaengig von der Produktzahl: genau EIN Aggregat + EIN Bilder-Batch.
    expect(orderItemRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(upload.bilderFuerProdukte).toHaveBeenCalledTimes(1);
    expect(upload.bilderFuerProdukte).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
  });
});

describe('MarketplaceService · Kategorie-Baum (PR4)', () => {
  it('liefert die aktive Taxonomie hierarchisch (Haupt mit Unterkategorien), nur aktiv', async () => {
    const { svc, categoryRepo } = makeService({
      kategorien: [
        { id: 'h-auf', parentId: null, slug: 'aufbereitung', name: 'Aufbereitung', bereich: 'aufbereitung', sdbPflicht: false, sortIndex: 0 },
        { id: 'u-pol', parentId: 'h-auf', slug: 'aufbereitung-polituren', name: 'Polituren', bereich: 'aufbereitung', sdbPflicht: true, sortIndex: 0 },
        { id: 'u-mft', parentId: 'h-auf', slug: 'aufbereitung-mikrofaser', name: 'Mikrofaser', bereich: 'aufbereitung', sdbPflicht: false, sortIndex: 1 },
        { id: 'h-fol', parentId: null, slug: 'folierung', name: 'Folierung', bereich: 'folierung', sdbPflicht: false, sortIndex: 1 },
      ],
    });
    const baum = await svc.categoryTree();
    // Nur aktive Kategorien werden abgefragt.
    expect(categoryRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { aktiv: true } }),
    );
    // Zwei Hauptkategorien, die erste mit zwei Unterkategorien (nach sortIndex).
    expect(baum).toHaveLength(2);
    expect(baum[0]).toMatchObject({ slug: 'aufbereitung', parentId: null });
    expect(baum[0].unterkategorien.map((u) => u.slug)).toEqual([
      'aufbereitung-polituren',
      'aufbereitung-mikrofaser',
    ]);
    expect(baum[0].unterkategorien[0]).toMatchObject({ sdbPflicht: true, bereich: 'aufbereitung' });
    // Folierung hat (in diesem Datensatz) keine Unterkategorien.
    expect(baum[1].unterkategorien).toEqual([]);
  });
});

describe('MarketplaceService · Produkt-Detail (PR4)', () => {
  it('liefert die vollen Felder + Bewertungs-Vorschau OHNE bewertenden Betrieb/Nutzer', async () => {
    const { svc, dealerRepo, reviewRepo } = makeService({
      product: {
        id: 'p1',
        dealerId: 'd1',
        name: 'Politur X',
        bereich: 'aufbereitung',
        anwendungshinweise: 'Duenn auftragen.',
        technischeDaten: { ph: 7 },
        bestand: 0,
        sdbDatei: '/private-uploads/marketplace-sdb/x.pdf.enc',
        bewertungSchnitt: 4.2,
        bewertungAnzahl: 3,
      },
    });
    // aktivesProdukt() prueft danach den Haendler; findOne wird mehrfach genutzt.
    dealerRepo.findOne.mockResolvedValue({ id: 'd1', name: 'H', aktiv: true, status: 'freigegeben' });
    reviewRepo.find.mockResolvedValue([
      { sterne: 5, text: 'Top', verifiziert: true, createdAt: new Date(), tenantId: 't-geheim', userId: 'u-geheim' },
    ]);

    const det = await svc.productDetail('p1');
    expect(det).toMatchObject({
      id: 'p1',
      haendlerName: 'H',
      anwendungshinweise: 'Duenn auftragen.',
      technischeDaten: { ph: 7 },
      bestandStatus: 'ausverkauft',
      hatSdb: true,
    });
    // Nur Reviews mit aktiv=true werden geladen.
    expect(reviewRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'p1', aktiv: true } }),
    );
    // Vorschau enthaelt KEINE Cross-Tenant-PII (weder tenantId noch userId).
    expect(det.bewertungen[0]).toEqual({
      sterne: 5,
      text: 'Top',
      verifiziert: true,
      createdAt: expect.any(Date),
    });
    expect((det.bewertungen[0] as any).tenantId).toBeUndefined();
    expect((det.bewertungen[0] as any).userId).toBeUndefined();
  });

  it('inaktives Produkt -> 404', async () => {
    const { svc } = makeService({ product: null });
    await expect(svc.productDetail('weg')).rejects.toBeInstanceOf(NotFoundException);
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

  it('Bewerbungs-Review (freigeben/ablehnen/portal-mail): Admin+Support ja, Analyst/Kunden nein', () => {
    for (const handler of [proto.freigeben, proto.ablehnen, proto.portalMail]) {
      expect(guard.canActivate(ctxFor(handler, UserRole.PLATFORM_ADMIN))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, UserRole.PLATFORM_SUPPORT))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, UserRole.PLATFORM_ANALYST))).toBe(false);
      expect(guard.canActivate(ctxFor(handler, UserRole.OWNER))).toBe(false);
    }
  });

  it('KYB-Dokument-Download: NUR Admin+Support (Analyst read-only + Kunden -> 403)', () => {
    expect(guard.canActivate(ctxFor(proto.dokument, UserRole.PLATFORM_ADMIN))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.dokument, UserRole.PLATFORM_SUPPORT))).toBe(true);
    expect(guard.canActivate(ctxFor(proto.dokument, UserRole.PLATFORM_ANALYST))).toBe(false);
    for (const role of [UserRole.OWNER, UserRole.MANAGER, UserRole.TECHNICIAN]) {
      expect(guard.canActivate(ctxFor(proto.dokument, role))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Welle 3: Grosshaendler-Bewerbung + Betreiber-Review
// ---------------------------------------------------------------------------

/** Gueltige Minimal-Bewerbung (alle Pflichtfelder laut Betreiber-Entscheidung). */
const BEWERBUNG = {
  name: 'FolienGroßhandel Nord GmbH',
  ansprechpartner: 'Kim Weber',
  kontaktEmail: 'Einkauf@Folien-Nord.de',
  ustIdNr: 'DE123456789',
};

describe('HaendlerBewerbungDto · Validierung', () => {
  it('Pflichtfelder fehlen -> Validierungsfehler fuer name/ansprechpartner/kontaktEmail/ustIdNr', async () => {
    const errors = await validate(plainToInstance(HaendlerBewerbungDto, {}));
    const felder = errors.map((e) => e.property);
    expect(felder).toEqual(
      expect.arrayContaining(['name', 'ansprechpartner', 'kontaktEmail', 'ustIdNr']),
    );
  });

  it('gueltige Bewerbung (Pflicht + optionale Felder) passiert die Validierung', async () => {
    const errors = await validate(
      plainToInstance(HaendlerBewerbungDto, {
        ...BEWERBUNG,
        telefon: '040 123456',
        webseite: 'https://folien-nord.de',
        adresse: 'Hafenstraße 1, 20457 Hamburg',
        sortiment: 'folierung,ppf',
        nachricht: 'Wir liefern seit 12 Jahren an Folierer.',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('kaputte E-Mail / javascript:-Webseite -> abgelehnt', async () => {
    const errors = await validate(
      plainToInstance(HaendlerBewerbungDto, {
        ...BEWERBUNG,
        kontaktEmail: 'keine-mail',
        webseite: 'javascript:alert(1)',
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['kontaktEmail', 'webseite']),
    );
  });
});

describe('PortalProductDto · PR9-Felder (Haendler-Pflege)', () => {
  // Pflicht-Minimum, damit nur die neuen Felder Fehler erzeugen koennen.
  const BASIS = { name: 'Keramik-Versiegelung', bereich: 'aufbereitung' };
  const UUID = '11111111-1111-4111-8111-111111111111';

  it('gueltige neue Felder passieren die Validierung', async () => {
    const errors = await validate(
      plainToInstance(PortalProductDto, {
        ...BASIS,
        categoryId: UUID,
        herkunftsland: 'de',
        versandKosten: 4.99,
        versandHinweis: 'Versand per DHL',
        lieferzeitTage: 3,
        bestand: 20,
        anwendungshinweise: 'Vor Gebrauch gut schuetteln.',
        technischeDaten: { Schichtdicke: '150 µm', pH: 7, loesemittelfrei: true },
        inhaltMenge: '500 ml',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('categoryId=null und weggelassene Felder sind erlaubt (Zuruecksetzen/optional)', async () => {
    const errors = await validate(plainToInstance(PortalProductDto, { ...BASIS, categoryId: null }));
    expect(errors).toHaveLength(0);
  });

  it('herkunftsland "XYZ" (3-stellig) -> Fehler', async () => {
    const errors = await validate(plainToInstance(PortalProductDto, { ...BASIS, herkunftsland: 'XYZ' }));
    expect(errors.map((e) => e.property)).toContain('herkunftsland');
  });

  it('herkunftsland mit Ziffer -> Fehler', async () => {
    const errors = await validate(plainToInstance(PortalProductDto, { ...BASIS, herkunftsland: 'D1' }));
    expect(errors.map((e) => e.property)).toContain('herkunftsland');
  });

  it('categoryId ohne UUID-Format -> Fehler', async () => {
    const errors = await validate(plainToInstance(PortalProductDto, { ...BASIS, categoryId: 'nicht-uuid' }));
    expect(errors.map((e) => e.property)).toContain('categoryId');
  });

  it('negative Versandkosten/Lieferzeit/Bestand -> Fehler', async () => {
    const errors = await validate(
      plainToInstance(PortalProductDto, { ...BASIS, versandKosten: -1, lieferzeitTage: -5, bestand: -2 }),
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['versandKosten', 'lieferzeitTage', 'bestand']),
    );
  });

  it('technischeDaten mit Verschachtelung -> Fehler', async () => {
    const errors = await validate(
      plainToInstance(PortalProductDto, { ...BASIS, technischeDaten: { block: { a: 1 } } }),
    );
    expect(errors.map((e) => e.property)).toContain('technischeDaten');
  });

  it('technischeDaten mit Array-Wert -> Fehler', async () => {
    const errors = await validate(
      plainToInstance(PortalProductDto, { ...BASIS, technischeDaten: { werte: [1, 2, 3] } }),
    );
    expect(errors.map((e) => e.property)).toContain('technischeDaten');
  });
});

describe('PublicHaendlerBewerbungController · Throttle', () => {
  it('POST ist auf 5 Anfragen pro Stunde je IP begrenzt', () => {
    const handler = PublicHaendlerBewerbungController.prototype.create;
    // @nestjs/throttler v5 legt die Werte als Metadata "<KEY><name>" auf die Methode.
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(3_600_000);
  });
});

describe('MarketplaceService · Bewerbung (oeffentlich)', () => {
  it('Honeypot gefuellt -> Erfolg vorgetaeuscht, NICHTS gespeichert', async () => {
    const { svc, dealerRepo } = makeService();
    const res = await svc.createBewerbung({ ...BEWERBUNG, website: 'http://spam.example' } as any);
    expect(res).toEqual({ ok: true });
    expect(dealerRepo.findOne).not.toHaveBeenCalled();
    expect(dealerRepo.save).not.toHaveBeenCalled();
  });

  /** Minimales Pflicht-Dokument (Multer-Shape) fuer die multipart-Bewerbung. */
  const DOKUMENT = { buffer: Buffer.from('%PDF-1.4'), mimetype: 'application/pdf', size: 8 };

  it('legt den Haendler als beantragt+inaktiv OHNE Token an - speichert das Dokument, startet die Vorpruefung, KEINE Mail', async () => {
    const { svc, dealerRepo, mail, kyb } = makeService();
    await svc.createBewerbung(
      { ...BEWERBUNG, sortiment: 'folierung, PPF, quatsch', nachricht: ' Hallo! ' } as any,
      DOKUMENT as any,
    );
    const saved = dealerRepo.create.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: 'FolienGroßhandel Nord GmbH',
      ansprechpartner: 'Kim Weber',
      kontaktEmail: 'einkauf@folien-nord.de', // normalisiert (Doppel-Guard-Vergleich)
      ustIdNr: 'DE123456789',
      status: 'beantragt',
      aktiv: false,
      sortiment: 'folierung,ppf', // nur bekannte Bereiche, "quatsch" fliegt raus
      nachricht: 'Hallo!',
      gewerbeanmeldungDatei: '/private-uploads/kyb/x.pdf.enc',
      dokumentHash: 'sha-abc',
    });
    expect(saved.beantragtAm).toBeInstanceOf(Date);
    expect(saved.uploadToken).toBeUndefined(); // Token gibt es erst bei Freigabe
    expect(kyb.speichereDokument).toHaveBeenCalledWith(DOKUMENT); // Magic-Byte/Groesse im KybService
    expect(kyb.pruefeBewerbung).toHaveBeenCalledWith('d1'); // fire-and-forget Vorpruefung
    expect(mail.send).not.toHaveBeenCalled(); // Review-before-send
  });

  it('ohne Dokument -> 400 (KybService lehnt ab), kein Dealer gespeichert', async () => {
    const { svc, dealerRepo, kyb } = makeService();
    kyb.speichereDokument.mockRejectedValue(new BadRequestException('Bitte die Gewerbeanmeldung hochladen.'));
    await expect(svc.createBewerbung(BEWERBUNG as any, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dealerRepo.save).not.toHaveBeenCalled();
  });

  it('Doppel-Bewerbung (gleiche E-Mail, offener Antrag) -> 409 VOR dem Datei-Write, nichts gespeichert', async () => {
    const { svc, dealerRepo, kyb } = makeService();
    dealerRepo.findOne.mockResolvedValue({ id: 'd9', status: 'beantragt' });
    await expect(svc.createBewerbung(BEWERBUNG as any, DOKUMENT as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(dealerRepo.findOne).toHaveBeenCalledWith({
      where: { kontaktEmail: 'einkauf@folien-nord.de', status: 'beantragt' },
    });
    // Guard laeuft VOR speichereDokument -> keine verwaiste Datei auf der Platte.
    expect(kyb.speichereDokument).not.toHaveBeenCalled();
    expect(dealerRepo.save).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Freigabe-Flow', () => {
  const bewerber = () => ({
    id: 'd1',
    name: 'FolienGroßhandel Nord GmbH',
    kontaktEmail: 'einkauf@folien-nord.de',
    provisionSatz: 10,
    status: 'beantragt',
    aktiv: false,
    // KYB-Gate (Welle 5): eine beworbene Freigabe setzt eine gesichtete Datei voraus.
    gewerbeanmeldungDatei: '/private-uploads/kyb/x.pdf.enc',
  });

  it('setzt freigegeben+aktiv, uebernimmt die Review-Provision, haelt den Pruefer fest und stellt einen Token aus', async () => {
    const { svc, dealerRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(bewerber());
    const res = await svc.freigeben('d1', 12.5, 'admin-1');

    expect(dealerRepo.save.mock.calls[0][0]).toMatchObject({
      status: 'freigegeben',
      aktiv: true,
      provisionSatz: 12.5,
      kybGeprueftVonUserId: 'admin-1',
    });
    // Token separat per update (Spalte ist select:false).
    const [id, patch] = dealerRepo.update.mock.calls[0];
    expect(id).toBe('d1');
    expect(patch.uploadToken).toMatch(/^[a-f0-9]{48}$/);
    expect(res.uploadToken).toBe(patch.uploadToken);
    expect(res.portalPfad).toBe(`/haendler?t=${patch.uploadToken}`);
    expect(res.haendler).toMatchObject({ id: 'd1', provisionSatz: 12.5 });
    expect(res.mailKonfiguriert).toBe(false); // kein SMTP_HOST im Test-Config
  });

  it('ohne Review-Provision bleibt der gespeicherte Satz; mit SMTP_HOST ist mailKonfiguriert=true', async () => {
    const { svc, dealerRepo } = makeService({ config: { SMTP_HOST: 'smtp.example' } });
    dealerRepo.findOne.mockResolvedValue(bewerber());
    const res = await svc.freigeben('d1');
    expect(dealerRepo.save.mock.calls[0][0].provisionSatz).toBe(10);
    expect(res.mailKonfiguriert).toBe(true);
  });

  it('unbekannter Haendler -> 404', async () => {
    const { svc } = makeService();
    await expect(svc.freigeben('weg')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('beantragt OHNE Gewerbeanmeldung -> 400 (KYB-Gate), kein Token', async () => {
    const { svc, dealerRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue({ ...bewerber(), gewerbeanmeldungDatei: null });
    await expect(svc.freigeben('d1', 10, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(dealerRepo.save).not.toHaveBeenCalled();
    expect(dealerRepo.update).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Ablehnung (PII-Sparsamkeit)', () => {
  it('nullt nachricht+adresse, setzt Ablehn-Uhr + Pruefer, deaktiviert und entzieht den Token', async () => {
    const { svc, dealerRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue({
      id: 'd1',
      name: 'X',
      status: 'beantragt',
      aktiv: false,
      nachricht: 'Wir wollen unbedingt rein',
      adresse: 'Privatweg 3, 12345 Ort',
    });
    await svc.ablehnen('d1', 'support-2');
    const saved = dealerRepo.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      status: 'abgelehnt',
      aktiv: false,
      nachricht: null,
      adresse: null,
      kybGeprueftVonUserId: 'support-2',
    });
    // Retention-Uhr fuer die 90-Tage-Dokument-Loeschung.
    expect(saved.abgelehntAm).toBeInstanceOf(Date);
    // Das Dokument bleibt bis zur Retention erhalten (nicht sofort geloescht).
    expect(dealerRepo.update).toHaveBeenCalledWith('d1', { uploadToken: null });
  });
});

describe('MarketplaceService · Portal-Link-Mail (bestaetigte Betreiber-Aktion)', () => {
  const FREIGEGEBEN = {
    id: 'd1',
    name: 'FolienGroßhandel Nord GmbH',
    ansprechpartner: 'Kim Weber',
    kontaktEmail: 'einkauf@folien-nord.de',
    status: 'freigegeben',
    aktiv: true,
    uploadToken: 'a'.repeat(48),
  };
  const qbFuer = (dealer: any) => ({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(dealer),
  });

  it('ohne SMTP -> 400 mit Kopier-Hinweis, keine Mail', async () => {
    const { svc, mail } = makeService();
    await expect(svc.sendPortalLinkMail('d1')).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('sendet den serverseitig gebauten Link an die Kontakt-Adresse', async () => {
    const { svc, dealerRepo, mail } = makeService({
      config: { SMTP_HOST: 'smtp.example', APP_URL: 'https://app.detailly.de/' },
    });
    dealerRepo.createQueryBuilder.mockReturnValue(qbFuer(FREIGEGEBEN));
    const res = await svc.sendPortalLinkMail('d1');
    expect(res).toEqual({ ok: true, to: 'einkauf@folien-nord.de' });
    expect(mail.send.mock.calls[0][0].to).toBe('einkauf@folien-nord.de');
    expect(mail.send.mock.calls[0][0].text).toContain(
      `https://app.detailly.de/haendler?t=${'a'.repeat(48)}`,
    );
  });

  it('nicht freigegeben / ohne Token -> 400, keine Mail', async () => {
    const { svc, dealerRepo, mail } = makeService({ config: { SMTP_HOST: 'smtp.example' } });
    dealerRepo.createQueryBuilder.mockReturnValue(
      qbFuer({ ...FREIGEGEBEN, status: 'beantragt', uploadToken: null }),
    );
    await expect(svc.sendPortalLinkMail('d1')).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Katalog-Status-Filter (Welle 3)', () => {
  it('Katalog laedt NUR aktiv+freigegebene Haendler (Bestand mit Default bleibt sichtbar)', async () => {
    const { svc, dealerRepo } = makeService({
      produkte: [{ id: 'p1', dealerId: 'd1', name: 'Seed-Folie', kategorie: 'Folien' }],
      haendler: [{ id: 'd1', name: 'Seed-Händler', status: 'freigegeben', aktiv: true }],
    });
    const res = await svc.catalog();
    // Seed-/Bestands-Haendler (status-Default 'freigegeben') bleibt im Katalog.
    expect(res.produkte).toHaveLength(1);
    expect(res.haendler).toHaveLength(1);
    // Und die Query verlangt beides: aktiv UND freigegeben.
    expect(dealerRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { aktiv: true, status: 'freigegeben' } }),
    );
  });

  it('Bestellung prueft Haendler auf aktiv+freigegeben', async () => {
    const { svc, dealerRepo } = makeService({
      produkte: [{ id: 'p1', dealerId: 'd1', name: 'X', preis: 50, aktiv: true, bestellbar: true }],
      haendler: [{ id: 'd1', name: 'D', provisionSatz: 10, aktiv: true }],
    });
    await svc.createOrders(KUNDE as any, {
      kontaktName: 'Max',
      kontaktEmail: 'max@betrieb.de',
      positionen: [{ productId: 'p1', menge: 1 }],
    } as any);
    expect(dealerRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aktiv: true, status: 'freigegeben' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// PR2: Authentifiziertes Haendler-Portal (dealerId-Scope) + Token-Portal bleibt
// ---------------------------------------------------------------------------
describe('MarketplaceService · Authentifiziertes Portal (dealerId aus JWT)', () => {
  const dealerA = { id: 'dealerA', name: 'Haendler A', aktiv: true, status: 'freigegeben' };

  it('scopet die Uebersicht HART auf die dealerId (nie Fremd-Daten von Dealer B)', async () => {
    const { svc, dealerRepo, productRepo, orderRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    productRepo.find.mockResolvedValue([{ id: 'pA', dealerId: 'dealerA', name: 'A-Folie' }]);
    orderRepo.find.mockResolvedValue([]);

    const res = await svc.portalOverviewById('dealerA');

    // Dealer wird per Id UND aktiv+freigegeben aufgeloest – der Wert kommt aus dem JWT.
    expect(dealerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'dealerA', aktiv: true, status: 'freigegeben' },
    });
    // Produkte + Bestellungen sind auf dealerA gescoped – nie auf einen Client-Wert.
    expect(productRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dealerId: 'dealerA' } }),
    );
    expect(orderRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dealerId: 'dealerA' } }),
    );
    expect(res.haendler.id).toBe('dealerA');
    expect(res.produkte).toHaveLength(1);
  });

  it('fehlende dealerId -> 404 OHNE DB-Zugriff; gesperrter/unbekannter Dealer -> 404', async () => {
    const { svc, dealerRepo } = makeService();
    await expect(svc.portalOverviewById(undefined)).rejects.toBeInstanceOf(NotFoundException);
    expect(dealerRepo.findOne).not.toHaveBeenCalled();
    dealerRepo.findOne.mockResolvedValue(null); // nicht aktiv/nicht freigegeben
    await expect(svc.portalOverviewById('gesperrt')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Bearbeiten eines FREMDEN Produkts -> 404 (dealerId-gescopter findOne)', async () => {
    const { svc, dealerRepo, productRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    productRepo.findOne.mockResolvedValue(null); // gehoert Dealer B -> nicht gefunden
    await expect(
      svc.portalUpdateProductById('dealerA', 'pB', { name: 'Hack' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(productRepo.findOne).toHaveBeenCalledWith({ where: { id: 'pB', dealerId: 'dealerA' } });
  });

  it('Produkt anlegen setzt die dealerId serverseitig (nie aus dem Body)', async () => {
    const { svc, dealerRepo, productRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    await svc.portalCreateProductById('dealerA', {
      name: 'A-Folie',
      bestellbar: false,
      affiliateUrl: 'https://a.de/x',
      // Angriff: fremde dealerId im Body – wird ignoriert.
      dealerId: 'dealerB',
    } as any);
    expect(productRepo.create.mock.calls[0][0]).toMatchObject({ dealerId: 'dealerA' });
  });

  it('Token-Portal bleibt voll funktionsfaehig (Bestandshaendler-Links)', async () => {
    const { svc, dealerRepo, productRepo, orderRepo } = makeService();
    const token = 'a'.repeat(48);
    dealerRepo.findOne.mockResolvedValue({ ...dealerA, uploadToken: token });
    productRepo.find.mockResolvedValue([{ id: 'pA', dealerId: 'dealerA', name: 'A-Folie' }]);
    orderRepo.find.mockResolvedValue([]);
    const res = await svc.portalOverview(token);
    // Beide Wege nutzen dieselbe dealer-gescopte Kernlogik.
    expect(productRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dealerId: 'dealerA' } }),
    );
    expect(res.produkte).toHaveLength(1);
  });

  // --- PR9: neue Katalog-Felder (categoryId/herkunftsland/…) am eigenen Produkt ---

  it('PR9: legt Produkt mit aktiver categoryId + herkunftsland an – Land gross, dealer-gescoped', async () => {
    const { svc, dealerRepo, productRepo, categoryRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    categoryRepo.findOne = jest.fn().mockResolvedValue({ id: 'cat-1', aktiv: true });

    await svc.portalCreateProductById('dealerA', {
      name: 'Keramik XL',
      bereich: 'aufbereitung',
      bestellbar: false,
      affiliateUrl: 'https://a.de/x',
      categoryId: 'cat-1',
      herkunftsland: 'de',
      versandKosten: 4.99,
      lieferzeitTage: 3,
      bestand: 20,
      technischeDaten: { pH: 7 },
      inhaltMenge: '500 ml',
    } as any);

    // Kategorie wird strikt als aktiv geprueft ...
    expect(categoryRepo.findOne).toHaveBeenCalledWith({ where: { id: 'cat-1', aktiv: true } });
    // ... und die neuen Felder landen am eigenen Produkt (dealerId serverseitig, Land gross).
    expect(productRepo.create.mock.calls[0][0]).toMatchObject({
      dealerId: 'dealerA',
      categoryId: 'cat-1',
      herkunftsland: 'DE',
      versandKosten: 4.99,
      lieferzeitTage: 3,
      bestand: 20,
      technischeDaten: { pH: 7 },
      inhaltMenge: '500 ml',
    });
  });

  it('PR9: unbekannte/inaktive categoryId -> 400 (kein Save)', async () => {
    const { svc, dealerRepo, productRepo, categoryRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    categoryRepo.findOne = jest.fn().mockResolvedValue(null); // nicht gefunden ODER inaktiv

    await expect(
      svc.portalCreateProductById('dealerA', {
        name: 'X',
        bereich: 'folierung',
        bestellbar: false,
        affiliateUrl: 'https://a.de/x',
        categoryId: 'cat-weg',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(productRepo.save).not.toHaveBeenCalled();
  });

  it('PR9: Bearbeiten schreibt Land gross + prueft aktive Kategorie', async () => {
    const { svc, dealerRepo, productRepo, categoryRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    productRepo.findOne.mockResolvedValue({
      id: 'pA',
      dealerId: 'dealerA',
      name: 'Alt',
      bestellbar: false,
      affiliateUrl: 'https://a.de/x',
    });
    categoryRepo.findOne = jest.fn().mockResolvedValue({ id: 'cat-1', aktiv: true });

    const res = await svc.portalUpdateProductById('dealerA', 'pA', {
      herkunftsland: 'us',
      categoryId: 'cat-1',
    } as any);

    expect(res).toMatchObject({ herkunftsland: 'US', categoryId: 'cat-1' });
    expect(productRepo.findOne).toHaveBeenCalledWith({ where: { id: 'pA', dealerId: 'dealerA' } });
  });

  it('PR9: Bearbeiten eines FREMDEN Produkts -> 404 zuerst (KEIN Kategorie-Orakel)', async () => {
    const { svc, dealerRepo, productRepo, categoryRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(dealerA);
    productRepo.findOne.mockResolvedValue(null); // gehoert Dealer B
    categoryRepo.findOne = jest.fn();

    await expect(
      svc.portalUpdateProductById('dealerA', 'pFremd', { categoryId: 'cat-1' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    // Die Kategorie wird fuer fremde Produkte gar nicht erst nachgeschlagen.
    expect(categoryRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('MarketplaceService · Haendler-Login-Onboarding (bei Freigabe)', () => {
  const bewerber = () => ({
    id: 'd1',
    name: 'FolienGroßhandel Nord GmbH',
    ansprechpartner: 'Kim Weber',
    kontaktEmail: 'einkauf@folien-nord.de',
    provisionSatz: 10,
    status: 'beantragt',
    aktiv: false,
    gewerbeanmeldungDatei: '/private-uploads/kyb/x.pdf.enc',
  });

  it('legt ein HAENDLER-Konto an (tenantId null, dealerId gesetzt) + verschickt die Einladung', async () => {
    const { svc, dealerRepo, userRepo, auth } = makeService();
    dealerRepo.findOne.mockResolvedValue(bewerber());
    userRepo.findOne.mockResolvedValue(null);

    await svc.freigeben('d1', undefined, 'admin-1');

    const created = userRepo.create.mock.calls[0][0];
    expect(created).toMatchObject({
      email: 'einkauf@folien-nord.de',
      role: UserRole.HAENDLER,
      dealerId: 'd1',
      tenantId: null,
      isActive: true,
    });
    expect(userRepo.save).toHaveBeenCalled();
    expect(auth.hashPassword).toHaveBeenCalled(); // Zufalls-Passwort, nie kommuniziert
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('einkauf@folien-nord.de');
  });

  it('E-Mail bereits als Betriebs-User vergeben -> 409 VOR jeder Mutation (kein Konto, keine Freigabe)', async () => {
    const { svc, dealerRepo, userRepo, auth } = makeService();
    dealerRepo.findOne.mockResolvedValue(bewerber());
    userRepo.findOne.mockResolvedValue({
      id: 'u-betrieb',
      email: 'einkauf@folien-nord.de',
      role: UserRole.OWNER,
      tenantId: 't1',
      dealerId: null,
    });

    await expect(svc.freigeben('d1', undefined, 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    // Sauberer Abbruch: nichts freigegeben, kein Token, kein Konto, keine Mail.
    expect(dealerRepo.save).not.toHaveBeenCalled();
    expect(dealerRepo.update).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('idempotent: Konto DIESES Haendlers existiert schon -> Freigabe ok, KEIN zweites Konto', async () => {
    const { svc, dealerRepo, userRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue(bewerber());
    userRepo.findOne.mockResolvedValue({
      id: 'hu1',
      email: 'einkauf@folien-nord.de',
      role: UserRole.HAENDLER,
      tenantId: null,
      dealerId: 'd1',
    });

    const res = await svc.freigeben('d1', undefined, 'admin-1');
    expect(res.uploadToken).toMatch(/^[a-f0-9]{48}$/);
    expect(dealerRepo.save).toHaveBeenCalled(); // Freigabe laeuft durch
    expect(userRepo.save).not.toHaveBeenCalled(); // aber kein Doppel-Konto
  });

  it('ohne Kontakt-E-Mail -> Freigabe ok, aber KEIN Login-Konto (Token-Portal genuegt)', async () => {
    const { svc, dealerRepo, userRepo } = makeService();
    dealerRepo.findOne.mockResolvedValue({ ...bewerber(), kontaktEmail: null });

    await svc.freigeben('d1', undefined, 'admin-1');
    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
