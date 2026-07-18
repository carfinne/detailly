import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import { resolve, sep } from 'path';
import {
  GeraeteInseratUploadService,
  MAX_BILD_BYTES,
  MAX_BILDER_PRO_INSERAT,
} from './geraete-inserat-upload.service';

/**
 * PR2 – Geraetemarkt-Bild-Upload. Deckt die Sicherheits-Kernpunkte ab: Magic-Byte
 * (echte JPEG/PNG/WebP akzeptiert, SVG/HTML/gefaelschter Typ abgewiesen),
 * Groessenlimit, Pro-Inserat-Quota, Traversal-Neutralisierung, Tenant-Scope
 * (fremdes Inserat -> 404) sowie die Stream-Sichtbarkeit (eigenes immer, fremdes
 * nur sichtbar). Bilder liegen bewusst UNVERSCHLUESSELT (Klartext) auf der Platte.
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

/** Ein sichtbares Fremd-Inserat (aktiv, moderiert ok, nicht abgelaufen). */
const SICHTBAR_FREMD = { id: 'i1', tenantId: 'fremd', status: 'aktiv', moderationStatus: 'ok', ablaufAm: null };

/**
 * Baut den Service mit Mock-Repos.
 * `inserat: null` simuliert ein fremdes/fehlendes Inserat (Scope-404).
 */
function build(
  over: { inserat?: any; count?: number; find?: any[]; bildFindOne?: any } = {},
) {
  const inseratRepo: any = {
    findOne: jest
      .fn()
      .mockResolvedValue('inserat' in over ? over.inserat : { id: 'i1', tenantId: 't1' }),
  };
  const bildRepo: any = {
    count: jest.fn().mockResolvedValue(over.count ?? 0),
    find: jest.fn().mockResolvedValue(over.find ?? []),
    findOne: jest.fn().mockResolvedValue(over.bildFindOne ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => ({ id: 'b1', ...x })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const svc = new GeraeteInseratUploadService(inseratRepo, bildRepo);
  return { svc, inseratRepo, bildRepo };
}

beforeEach(() => {
  jest.spyOn(fsp, 'mkdir').mockResolvedValue(undefined as any);
  jest.spyOn(fsp, 'writeFile').mockResolvedValue(undefined as any);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------------------
// bilderHochladen
// ---------------------------------------------------------------------------
describe('bilderHochladen · Magic-Byte / Groesse / Quota / Ablage', () => {
  it.each([
    ['JPG', JPG, 'jpg'],
    ['PNG', PNG, 'png'],
    ['WebP', WEBP, 'webp'],
  ])('%s akzeptiert und UNVERSCHLUESSELT (Klartext) unter geraetemarkt-images abgelegt', async (_n, buf, ext) => {
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    const res = await svc.bilderHochladen('t1', 'i1', [{ buffer: buf }] as any);
    expect(res).toHaveLength(1);
    expect(res[0].datei).toMatch(
      new RegExp(`^/private-uploads/geraetemarkt-images/[0-9a-f-]+\\.${ext}$`),
    );
    // Auf die Platte gehen exakt die Ausgangsbytes (Klartext, keine Verschluesselung).
    const geschrieben = write.mock.calls[0][1] as Buffer;
    expect(geschrieben.equals(buf)).toBe(true);
  });

  it.each([
    ['SVG', SVG],
    ['HTML', HTML],
    ['PDF-als-Bild', PDF],
  ])('%s -> 400, nichts geschrieben', async (_n, buf) => {
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('t1', 'i1', [{ buffer: buf }] as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('gefaelschter Content-Type (SVG-Bytes) rutscht NICHT durch – Magic-Byte entscheidet', async () => {
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    await expect(
      svc.bilderHochladen('t1', 'i1', [{ mimetype: 'image/png', buffer: SVG }] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(write).not.toHaveBeenCalled();
  });

  it('Bild > 5 MB -> 400 (Limit greift vor dem Schreiben)', async () => {
    const gross = Buffer.concat([JPG, Buffer.alloc(MAX_BILD_BYTES)]);
    const { svc } = build();
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('t1', 'i1', [{ buffer: gross }] as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('keine/leere Datei -> 400', async () => {
    const { svc } = build();
    await expect(svc.bilderHochladen('t1', 'i1', [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.bilderHochladen('t1', 'i1', [{ buffer: Buffer.alloc(0) }] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Quota: bereits MAX vorhanden -> 400, kein Write', async () => {
    const { svc } = build({ count: MAX_BILDER_PRO_INSERAT });
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('t1', 'i1', [{ buffer: JPG }] as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('Quota: vorhandene + neue > MAX -> 400', async () => {
    const { svc } = build({ count: MAX_BILDER_PRO_INSERAT - 1 });
    await expect(
      svc.bilderHochladen('t1', 'i1', [{ buffer: JPG }, { buffer: PNG }] as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vergibt fortlaufende sortIndex ab (max + 1)', async () => {
    const { svc, bildRepo } = build({ count: 1, find: [{ sortIndex: 4 }] });
    await svc.bilderHochladen('t1', 'i1', [{ buffer: JPG }, { buffer: PNG }] as any);
    const indices = (bildRepo.save as jest.Mock).mock.calls.map((c) => c[0].sortIndex);
    expect(indices).toEqual([5, 6]);
  });

  it('fremdes/nicht-eigenes Inserat -> 404 (kein Write)', async () => {
    const { svc } = build({ inserat: null });
    const write = fsp.writeFile as jest.Mock;
    await expect(svc.bilderHochladen('t1', 'i1', [{ buffer: JPG }] as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('Upload laedt das Inserat STRIKT tenant-scoped ({ id, tenantId })', async () => {
    const { svc, inseratRepo } = build();
    await svc.bilderHochladen('t1', 'i1', [{ buffer: JPG }] as any);
    expect(inseratRepo.findOne).toHaveBeenCalledWith({ where: { id: 'i1', tenantId: 't1' } });
  });
});

// ---------------------------------------------------------------------------
// bildLoeschen
// ---------------------------------------------------------------------------
describe('bildLoeschen · Scope + Datei/DB', () => {
  it('fremdes Inserat -> 404', async () => {
    const { svc } = build({ inserat: null });
    await expect(svc.bildLoeschen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fremdes/nicht vorhandenes Bild -> 404', async () => {
    const { svc } = build({ bildFindOne: null });
    await expect(svc.bildLoeschen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('loescht Datei (best effort) + DB-Zeile', async () => {
    const bild = { id: 'b1', inseratId: 'i1', datei: '/private-uploads/geraetemarkt-images/x.jpg' };
    const { svc, bildRepo } = build({ bildFindOne: bild });
    const unlink = jest.spyOn(fsp, 'unlink').mockResolvedValue(undefined as any);
    const res = await svc.bildLoeschen('t1', 'i1', 'b1');
    expect(res).toEqual({ ok: true });
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(bildRepo.delete as jest.Mock).toHaveBeenCalledWith({ id: 'b1' });
  });
});

// ---------------------------------------------------------------------------
// bildStreamen (Sichtbarkeit + Membership + Traversal + Mime)
// ---------------------------------------------------------------------------
describe('bildStreamen · Sichtbarkeit / Membership / Traversal', () => {
  it('fehlendes Inserat -> 404', async () => {
    const { svc } = build({ inserat: null });
    await expect(svc.bildStreamen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fremdes, NICHT sichtbares Inserat -> 404 (kein Existenz-Orakel)', async () => {
    const verborgen = { id: 'i1', tenantId: 'fremd', status: 'aktiv', moderationStatus: 'verborgen', ablaufAm: null };
    const { svc, bildRepo } = build({ inserat: verborgen });
    await expect(svc.bildStreamen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
    // Sichtbarkeit blockt VOR dem Bild-Lookup.
    expect(bildRepo.findOne).not.toHaveBeenCalled();
  });

  it('fremdes, abgelaufenes Inserat -> 404', async () => {
    const abgelaufen = {
      id: 'i1', tenantId: 'fremd', status: 'aktiv', moderationStatus: 'ok',
      ablaufAm: new Date(Date.now() - 1000),
    };
    const { svc } = build({ inserat: abgelaufen });
    await expect(svc.bildStreamen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fremdes, verkauftes Inserat (nicht in SICHTBARE_STATUS) -> 404', async () => {
    const verkauft = { id: 'i1', tenantId: 'fremd', status: 'verkauft', moderationStatus: 'ok', ablaufAm: null };
    const { svc } = build({ inserat: verkauft });
    await expect(svc.bildStreamen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('eigenes Inserat: Besitzer sieht Bild auch wenn NICHT sichtbar (entfernt)', async () => {
    const eigenEntfernt = { id: 'i1', tenantId: 't1', status: 'entfernt', moderationStatus: 'verborgen', ablaufAm: null };
    const bild = { id: 'b1', inseratId: 'i1', datei: '/private-uploads/geraetemarkt-images/x.webp' };
    const { svc } = build({ inserat: eigenEntfernt, bildFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue({} as any);
    const res = await svc.bildStreamen('t1', 'i1', 'b1');
    expect(res.mime).toBe('image/webp');
  });

  it('fremdes SICHTBARES Inserat: eingeloggter Tenant darf streamen', async () => {
    const bild = { id: 'b1', inseratId: 'i1', datei: '/private-uploads/geraetemarkt-images/x.jpg' };
    const { svc } = build({ inserat: SICHTBAR_FREMD, bildFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'createReadStream').mockReturnValue({} as any);
    const res = await svc.bildStreamen('t1', 'i1', 'b1');
    expect(res.mime).toBe('image/jpeg');
  });

  it('Bild gehoert nicht zum Inserat -> 404', async () => {
    const { svc } = build({ inserat: SICHTBAR_FREMD, bildFindOne: null });
    await expect(svc.bildStreamen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Traversal im gespeicherten Pfad wird per basename neutralisiert (bleibt im Bilder-Ordner)', async () => {
    const bild = {
      id: 'b1',
      inseratId: 'i1',
      datei: '/private-uploads/geraetemarkt-images/../../../../etc/passwd',
    };
    const { svc } = build({ inserat: SICHTBAR_FREMD, bildFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = jest.spyOn(fs, 'createReadStream').mockReturnValue({} as any);
    await svc.bildStreamen('t1', 'i1', 'b1');
    const pfad = readSpy.mock.calls[0][0] as string;
    const dir = resolve(process.cwd(), 'private-uploads', 'geraetemarkt-images');
    expect(pfad.startsWith(dir + sep)).toBe(true);
    expect(pfad.endsWith('passwd')).toBe(true); // nur der basename, NIE /etc/passwd
    expect(pfad.includes(`etc${sep}passwd`)).toBe(false);
  });

  it('Datei fehlt auf der Platte -> 404', async () => {
    const bild = { id: 'b1', inseratId: 'i1', datei: '/private-uploads/geraetemarkt-images/x.jpg' };
    const { svc } = build({ inserat: SICHTBAR_FREMD, bildFindOne: bild });
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(svc.bildStreamen('t1', 'i1', 'b1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
