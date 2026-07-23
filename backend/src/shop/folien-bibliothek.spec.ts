import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { CreateProductDto } from './dto/shop.dto';
import { FOLIEN_VORLAGEN } from './folien-vorlagen';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Folierer-Welle 2, Baustein 1 (Folien-Bibliothek):
 *  - DTO-Round-Trip + Validierung der neuen Folien-Felder,
 *  - Vorlagen-Import (legt an / idempotent / tenant-scoped),
 *  - Rollen-Gate des Import-Endpoints (Techniker -> gesperrt).
 */

const T1: AuthUser = { id: 'u1', email: 'chef@t1.de', role: 'owner', tenantId: 't1' } as AuthUser;
const T2: AuthUser = { id: 'u2', email: 'chef@t2.de', role: 'owner', tenantId: 't2' } as AuthUser;

// Erwartete Produktanzahl = Summe der Finishes ueber alle Katalog-Eintraege.
const KATALOG_PRODUKTE = FOLIEN_VORLAGEN.reduce((n, v) => n + v.finishes.length, 0);

async function invalidProps(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

// In-Memory-Fake des Product-Repos: findet tenant-/kategorie-gescopt, speichert Arrays.
function makeProductRepo() {
  const rows: any[] = [];
  return {
    rows,
    find: jest.fn(async (opts: any) => {
      const where = opts?.where ?? {};
      return rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
    }),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (arg: any) => {
      const list = Array.isArray(arg) ? arg : [arg];
      for (const o of list) {
        if (!o.id) o.id = `p${rows.length + 1}`;
        rows.push(o);
      }
      return arg;
    }),
  };
}

function makeSvc() {
  const productRepo = makeProductRepo();
  const svc = new ShopService(
    productRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { log: jest.fn() } as any,
    {} as any,
  );
  return { svc, productRepo };
}

describe('Folien-Bibliothek · CreateProductDto (Round-Trip + Validierung)', () => {
  it('akzeptiert die neuen Folien-Felder und uebernimmt die Werte (Round-Trip)', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '3M 2080 Gloss (152 cm)',
      kategorie: 'folie',
      hersteller: '3M',
      serie: 'Wrap Film 2080',
      farbcode: 'GP281',
      finish: 'Gloss',
      breiteCm: 152,
      einheit: 'lfm',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.hersteller).toBe('3M');
    expect(dto.serie).toBe('Wrap Film 2080');
    expect(dto.farbcode).toBe('GP281');
    expect(dto.finish).toBe('Gloss');
    expect(dto.breiteCm).toBe(152);
  });

  it('breiteCm: 0 (unter Min 1) und 501 (ueber Max 500) werden abgelehnt', async () => {
    expect(await invalidProps(plainToInstance(CreateProductDto, { name: 'x', breiteCm: 0 }))).toContain(
      'breiteCm',
    );
    expect(
      await invalidProps(plainToInstance(CreateProductDto, { name: 'x', breiteCm: 501 })),
    ).toContain('breiteCm');
  });

  it('breiteCm: Grenzwerte 1 und 500 sind erlaubt', async () => {
    expect(await validate(plainToInstance(CreateProductDto, { name: 'x', breiteCm: 1 }))).toHaveLength(0);
    expect(await validate(plainToInstance(CreateProductDto, { name: 'x', breiteCm: 500 }))).toHaveLength(
      0,
    );
  });

  it('hersteller ueber MaxLength wird abgelehnt', async () => {
    const props = await invalidProps(
      plainToInstance(CreateProductDto, { name: 'x', hersteller: 'A'.repeat(121) }),
    );
    expect(props).toContain('hersteller');
  });
});

describe('Folien-Bibliothek · importFolienVorlagen (Service)', () => {
  it('legt fuer jeden Katalog-Finish ein Folien-Produkt an (bestand 0, tenant-scoped)', async () => {
    const { svc, productRepo } = makeSvc();

    const res = await svc.importFolienVorlagen(T1);

    expect(res).toEqual({ angelegt: KATALOG_PRODUKTE, uebersprungen: 0 });
    expect(productRepo.rows).toHaveLength(KATALOG_PRODUKTE);
    for (const p of productRepo.rows) {
      expect(p.tenantId).toBe('t1');
      expect(p.kategorie).toBe('folie');
      expect(Number(p.bestand)).toBe(0);
      expect(p.einheit).toBe('lfm');
      expect(p.finish).toBeTruthy();
      // EK/VK werden NICHT vorbelegt (Betrieb pflegt die Preise; DB-Default 0).
      expect(p.einkaufspreis).toBeUndefined();
      expect(p.verkaufspreis).toBeUndefined();
    }
  });

  it('ist idempotent: zweiter Import legt nichts an und ueberspringt alles', async () => {
    const { svc, productRepo } = makeSvc();

    await svc.importFolienVorlagen(T1);
    const zweiter = await svc.importFolienVorlagen(T1);

    expect(zweiter).toEqual({ angelegt: 0, uebersprungen: KATALOG_PRODUKTE });
    expect(productRepo.rows).toHaveLength(KATALOG_PRODUKTE); // keine Duplikate
  });

  it('ueberspringt nur vorhandene Schluessel (hersteller,serie,finish,breiteCm)', async () => {
    const { svc, productRepo } = makeSvc();
    const vorlage = FOLIEN_VORLAGEN[0];
    // Ein bereits gepflegtes Produkt exakt auf einem Katalog-Schluessel.
    productRepo.rows.push({
      id: 'seed',
      tenantId: 't1',
      kategorie: 'folie',
      hersteller: vorlage.hersteller,
      serie: vorlage.serie,
      finish: vorlage.finishes[0],
      breiteCm: '152.00', // DB liefert decimals als String -> Key muss trotzdem matchen
    });

    const res = await svc.importFolienVorlagen(T1);

    expect(res.uebersprungen).toBe(1);
    expect(res.angelegt).toBe(KATALOG_PRODUKTE - 1);
  });

  it('ist tenant-scoped: fremde Folien blockieren den Import nicht', async () => {
    const { svc, productRepo } = makeSvc();

    await svc.importFolienVorlagen(T1);
    const beimZweitenTenant = await svc.importFolienVorlagen(T2);

    // t2 sieht t1s Produkte nicht -> legt den vollen Katalog erneut an.
    expect(beimZweitenTenant).toEqual({ angelegt: KATALOG_PRODUKTE, uebersprungen: 0 });
    expect(productRepo.rows.filter((r) => r.tenantId === 't1')).toHaveLength(KATALOG_PRODUKTE);
    expect(productRepo.rows.filter((r) => r.tenantId === 't2')).toHaveLength(KATALOG_PRODUKTE);
  });
});

describe('Folien-Bibliothek · Rollen-Gate des Import-Endpoints', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = ShopController.prototype as any;

  function ctxFor(handler: any, role: string): any {
    return {
      getHandler: () => handler,
      getClass: () => ShopController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    };
  }

  it.each([UserRole.TECHNICIAN, UserRole.RECEPTIONIST])(
    'importFolienVorlagen ist fuer %s gesperrt (403)',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.importFolienVorlagen, role))).toBe(false);
    },
  );

  it.each([UserRole.MANAGER, UserRole.OWNER, UserRole.PLATFORM_ADMIN])(
    'importFolienVorlagen ist fuer %s erlaubt',
    (role) => {
      expect(guard.canActivate(ctxFor(proto.importFolienVorlagen, role))).toBe(true);
    },
  );

  it('importFolienVorlagen haengt hinter dem Add-on "folierung_ppf" (Methoden-Gate ueberschreibt "shop")', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, proto.importFolienVorlagen)).toBe('folierung_ppf');
    // Klassen-Gate bleibt 'shop' (KERN) – nur der Import zieht das Add-on-Gate.
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, ShopController)).toBe('shop');
  });
});
