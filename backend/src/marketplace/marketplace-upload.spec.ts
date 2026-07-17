import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import { resolve, sep } from 'path';
import {
  MarketplaceUploadService,
  MAX_BILD_BYTES,
  MAX_SDB_BYTES,
  MAX_BILDER_PRO_PRODUKT,
} from './marketplace-upload.service';
import {
  encryptBuffer,
  decryptBuffer,
  resetEncryptionKeyCache,
} from '../common/crypto/encryption';

/**
 * PR3 – Marktplatz-Uploads. Deckt die Sicherheits-Kernpunkte ab: Magic-Byte
 * (echte JPEG/PNG/WebP + PDF akzeptiert, SVG/HTML/gefaelschter Typ abgewiesen),
 * Groessenlimit, Traversal, Pro-Produkt-Quota, Dealer-Scope (fremdes Produkt ->
 * 404) sowie die Speicher-Strategie (Bilder KLARTEXT, SDB AES-256-GCM at rest).
 */

// --- Magic-Byte-Fixtures (nur der Header entscheidet) -----------------------
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('x'.repeat(40))]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('x'.repeat(40)),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.from('x'.repeat(40)),
]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('x'.repeat(100))]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = Buffer.from('<html><body><script>alert(1)</script></body></html>');

/** Baut den Service mit Mock-Repos; `product: null` simuliert ein fremdes Produkt. */
function build(
  over: { product?: any; count?: number; find?: any[]; imageFindOne?: any } = {},
) {
  const productRepo: any = {
    findOne: jest
      .fn()
      .mockResolvedValue('product' in over ? over.product : { id: 'p1', dealerId: 'd1' }),
    save: jest.fn(async (x: any) => x),
  };
  const imageRepo: any = {
    count: jest.fn().mockResolvedValue(over.count ?? 0),
    find: jest.fn().mockResolvedValue(over.find ?? []),
    findOne: jest.fn().mockResolvedValue(over.imageFindOne ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'img1', ...x })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const svc = new MarketplaceUploadService(productRepo, imageRepo);
  return { svc, productRepo, imageRepo };
}

beforeAll(() => {
  process.env.DATA_ENC_KEY = 'c'.repeat(64);
  resetEncryptionKeyCache();
});
afterAll(() => {
  delete process.env.DATA_ENC_KEY;
  resetEncryptionKeyCache();
});

beforeEach(() => {
  jest.spyOn(fsp, 'mkdir').mockResolvedValue(undefined as any);
  jest.spyOn(fsp, 'writeFile').mockResolvedValue(undefined as any);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// Galerie-Bilder
// ---------------------------------------------------------------------------
describe('bilderHochladen · Magic-Byte / Groesse / Quota / Ablage', () => {
  it.each([
    ['JPG', JPG],
    ['PNG', PNG],
    ['WebP', WEBP],
  ])('%s akzeptiert und UNVERSCHLUESSELT (Klartext) abgelegt', async (_n, buf) => {
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    const res = await svc.bilderHochladen('d1', 'p1', [{ buffer: buf }] as any);
    expect(res).toHaveLength(1);
    expect(res[0].datei).toMatch(
      /^\/private-uploads\/marketplace-images\/[0-9a-f-]+\.(jpg|png|webp)$/,
    );
    // Auf die Platte gehen exakt die Ausgangsbytes – KEIN GCM-Marker (unverschluesselt).
    const geschrieben = write.mock.calls[0][1] as Buffer;
    expect(geschrieben.equals(buf)).toBe(true);
    expect(geschrieben.subarray(0, 8).toString('utf8')).not.toBe('DLYENC1\0');
  });

  it.each([
    ['SVG', SVG],
    ['HTML', HTML],
    ['PDF-als-Bild', PDF],
  ])('%s -> 400, nichts geschrieben', async (_n, buf) => {
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('d1', 'p1', [{ buffer: buf }] as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('Bild > 5 MB -> 400 (Limit greift vor dem Schreiben)', async () => {
    const gross = Buffer.concat([JPG, Buffer.alloc(MAX_BILD_BYTES)]);
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('d1', 'p1', [{ buffer: gross }] as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('keine/leere Datei -> 400', async () => {
    const { svc } = build();
    await expect(svc.bilderHochladen('d1', 'p1', [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.bilderHochladen('d1', 'p1', [{ buffer: Buffer.alloc(0) }] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Quota: bereits MAX vorhanden -> 400, kein Write', async () => {
    const { svc } = build({ count: MAX_BILDER_PRO_PRODUKT });
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('d1', 'p1', [{ buffer: JPG }] as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('Quota: vorhandene + neue > MAX -> 400', async () => {
    const { svc } = build({ count: MAX_BILDER_PRO_PRODUKT - 1 });
    await expect(
      svc.bilderHochladen('d1', 'p1', [{ buffer: JPG }, { buffer: PNG }] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vergibt fortlaufende sortIndex ab (max + 1)', async () => {
    const { svc, imageRepo } = build({ count: 1, find: [{ sortIndex: 4 }] });
    await svc.bilderHochladen('d1', 'p1', [{ buffer: JPG }, { buffer: PNG }] as any);
    const indices = (imageRepo.save as jest.Mock).mock.calls.map((c) => c[0].sortIndex);
    expect(indices).toEqual([5, 6]);
  });

  it('fremdes/nicht-eigenes Produkt -> 404 (kein Write)', async () => {
    const { svc } = build({ product: null });
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('d1', 'p1', [{ buffer: JPG }] as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(write).not.toHaveBeenCalled();
  });
});

describe('bildStream · Membership / Traversal / Mime', () => {
  it('Bild gehoert nicht zum Produkt -> 404', async () => {
    const { svc } = build({ imageFindOne: null });
    await expect(svc.bildStream({ id: 'p1' } as any, 'img1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('Traversal im gespeicherten Pfad wird per basename neutralisiert (bleibt im Bilder-Ordner)', async () => {
    const bild = {
      id: 'img1',
      productId: 'p1',
      datei: '/private-uploads/marketplace-images/../../../../etc/passwd',
    };
    const { svc } = build({ imageFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = jest.spyOn(fs, 'createReadStream').mockReturnValue({} as any);
    await svc.bildStream({ id: 'p1' } as any, 'img1');
    const pfad = readSpy.mock.calls[0][0] as string;
    const dir = resolve(process.cwd(), 'private-uploads', 'marketplace-images');
    expect(pfad.startsWith(dir + sep)).toBe(true);
    expect(pfad.endsWith('passwd')).toBe(true); // nur der basename, NIE /etc/passwd
    expect(pfad.includes(`etc${sep}passwd`)).toBe(false);
  });

  it('Datei fehlt auf der Platte -> 404', async () => {
    const bild = { id: 'img1', productId: 'p1', datei: '/private-uploads/marketplace-images/x.jpg' };
    const { svc } = build({ imageFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(svc.bildStream({ id: 'p1' } as any, 'img1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('erfolgreich: mime aus der (serverseitigen) Endung', async () => {
    const bild = { id: 'img1', productId: 'p1', datei: '/private-uploads/marketplace-images/x.webp' };
    const { svc } = build({ imageFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue({} as any);
    const res = await svc.bildStream({ id: 'p1' } as any, 'img1');
    expect(res.mime).toBe('image/webp');
  });

  it('bildAnzeigenFuerDealer: fremdes Produkt -> 404', async () => {
    const { svc } = build({ product: null });
    await expect(svc.bildAnzeigenFuerDealer('d1', 'p1', 'img1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('bildLoeschen · Scope + Datei/DB', () => {
  it('fremdes Produkt -> 404', async () => {
    const { svc } = build({ product: null });
    await expect(svc.bildLoeschen('d1', 'p1', 'img1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fremdes/nicht vorhandenes Bild -> 404', async () => {
    const { svc } = build({ imageFindOne: null });
    await expect(svc.bildLoeschen('d1', 'p1', 'img1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('loescht Datei (best effort) + DB-Zeile', async () => {
    const bild = { id: 'img1', productId: 'p1', datei: '/private-uploads/marketplace-images/x.jpg' };
    const { svc, imageRepo } = build({ imageFindOne: bild });
    const unlink = jest.spyOn(fsp, 'unlink').mockResolvedValue(undefined as any);
    const res = await svc.bildLoeschen('d1', 'p1', 'img1');
    expect(res).toEqual({ ok: true });
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(imageRepo.delete as jest.Mock).toHaveBeenCalledWith({ id: 'img1' });
  });
});

describe('bilderFuerProdukte · Gruppierung', () => {
  it('gruppiert nach productId (sortIndex aufsteigend)', async () => {
    const { svc, imageRepo } = build();
    (imageRepo.find as jest.Mock).mockResolvedValue([
      { id: 'a', productId: 'p1', sortIndex: 0 },
      { id: 'b', productId: 'p1', sortIndex: 1 },
      { id: 'c', productId: 'p2', sortIndex: 0 },
    ]);
    const map = await svc.bilderFuerProdukte(['p1', 'p2']);
    expect(map.get('p1')).toEqual([
      { id: 'a', sortIndex: 0 },
      { id: 'b', sortIndex: 1 },
    ]);
    expect(map.get('p2')).toEqual([{ id: 'c', sortIndex: 0 }]);
  });

  it('leere Eingabe -> leere Map, kein Query', async () => {
    const { svc, imageRepo } = build();
    const map = await svc.bilderFuerProdukte([]);
    expect(map.size).toBe(0);
    expect(imageRepo.find as jest.Mock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sicherheitsdatenblatt (SDB)
// ---------------------------------------------------------------------------
describe('sdbHochladen · nur PDF, VERSCHLUESSELT at rest', () => {
  it('PDF: GCM-Container geschrieben + Felder am Produkt gesetzt', async () => {
    const product = { id: 'p1', dealerId: 'd1', sdbDatei: null, sdbHochgeladenAm: null };
    const { svc } = build({ product });
    const write = fsp.writeFile as jest.Mock;
    const res = await svc.sdbHochladen('d1', 'p1', { buffer: PDF } as any);
    const geschrieben = write.mock.calls[0][1] as Buffer;
    // NIE Klartext auf der Platte: Datei-Marker vorn + entschluesselbar == Original.
    expect(geschrieben.subarray(0, 8).toString('utf8')).toBe('DLYENC1\0');
    expect(geschrieben.includes(Buffer.from('%PDF-1.7'))).toBe(false);
    expect(decryptBuffer(geschrieben).equals(PDF)).toBe(true);
    expect(res.sdbDatei).toMatch(/^\/private-uploads\/marketplace-sdb\/[0-9a-f-]+\.pdf\.enc$/);
    expect(res.sdbHochgeladenAm).toBeInstanceOf(Date);
  });

  it.each([
    ['JPG', JPG],
    ['SVG', SVG],
    ['HTML', HTML],
  ])('%s als SDB -> 400, nichts geschrieben', async (_n, buf) => {
    const { svc } = build({ product: { id: 'p1', dealerId: 'd1' } });
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.sdbHochladen('d1', 'p1', { buffer: buf } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('SDB > 10 MB -> 400', async () => {
    const gross = Buffer.concat([PDF, Buffer.alloc(MAX_SDB_BYTES)]);
    const { svc } = build({ product: { id: 'p1', dealerId: 'd1' } });
    await expect(svc.sdbHochladen('d1', 'p1', { buffer: gross } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('kein SDB -> 400', async () => {
    const { svc } = build({ product: { id: 'p1', dealerId: 'd1' } });
    await expect(svc.sdbHochladen('d1', 'p1', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('fremdes Produkt -> 404 (kein Write)', async () => {
    const { svc } = build({ product: null });
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.sdbHochladen('d1', 'p1', { buffer: PDF } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(write).not.toHaveBeenCalled();
  });
});

describe('sdbLaden · entschluesseln + 404', () => {
  it('entschluesselt exakt + Dateiname sicherheitsdatenblatt.pdf', async () => {
    const enc = encryptBuffer(PDF);
    jest.spyOn(fsp, 'readFile').mockResolvedValue(enc as any);
    const { svc } = build();
    const res = await svc.sdbLaden({
      id: 'p1',
      sdbDatei: '/private-uploads/marketplace-sdb/x.pdf.enc',
    } as any);
    expect(res.buffer.equals(PDF)).toBe(true);
    expect(res.filename).toBe('sicherheitsdatenblatt.pdf');
  });

  it('kein SDB hinterlegt -> 404', async () => {
    const { svc } = build();
    await expect(svc.sdbLaden({ id: 'p1', sdbDatei: null } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('Datei fehlt auf der Platte -> 404', async () => {
    jest.spyOn(fsp, 'readFile').mockRejectedValue(new Error('ENOENT'));
    const { svc } = build();
    await expect(
      svc.sdbLaden({ id: 'p1', sdbDatei: '/private-uploads/marketplace-sdb/x.pdf.enc' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sdbAnzeigenFuerDealer: fremdes Produkt -> 404', async () => {
    const { svc } = build({ product: null });
    await expect(svc.sdbAnzeigenFuerDealer('d1', 'p1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
