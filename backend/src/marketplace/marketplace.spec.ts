import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MarketplaceService } from './marketplace.service';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { PublicHaendlerBewerbungController } from './public-haendler-bewerbung.controller';
import { HaendlerBewerbungDto } from './dto/marketplace.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

function makeService(
  over: { produkte?: any[]; haendler?: any[]; product?: any; config?: Record<string, string> } = {},
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
  const svc = new MarketplaceService(
    dealerRepo,
    productRepo,
    clickRepo,
    orderRepo,
    orderItemRepo,
    dataSource,
    mail,
    config,
    kyb,
  );
  return { svc, dealerRepo, productRepo, clickRepo, orderRepo, orderItemRepo, mail, config, kyb };
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
