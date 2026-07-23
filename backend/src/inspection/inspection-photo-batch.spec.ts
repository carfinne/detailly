import { BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { InspectionService } from './inspection.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Regression zur N+1-Beseitigung beim Foto-Anhaengen (Cleanup-C, Fund 1).
 *
 * Frueher lief pro Foto je eine Einzelabfrage (Tenant-Validierung + bestehende
 * Zuordnung). Jetzt werden beide Lookups gebuendelt (In(ids) / je EINE Query).
 * Diese Tests belegen: gleiche Ergebnisse/Reihenfolge/Idempotenz wie zuvor,
 * aber KONSTANT viele Queries – unabhaengig von der Anzahl der Fotos.
 */
describe('InspectionService – Foto-Anhaengen ohne N+1', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: UserRole.MANAGER, tenantId: 't1' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  function makeService(over: {
    item?: any;
    inspection?: any;
    gefundeneFotos?: string[]; // welche photoIds "gehoeren" dem Betrieb
    bestehendeLinks?: any[]; // vorhandene damage_item_photos
  } = {}) {
    const inspectionRepo: any = {
      findOne: jest.fn().mockResolvedValue(
        over.inspection ?? { id: 'insp1', tenantId: 't1', unterschriftPng: null },
      ),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'server-insp', ...x })),
    };
    const itemRepo: any = {
      findOne: jest.fn().mockResolvedValue(
        'item' in over ? over.item : { id: 'item1', tenantId: 't1', inspectionId: 'insp1' },
      ),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'server-item', ...x })),
    };
    const photoRepo: any = {
      // Batch-Validierung: liefert nur die tenant-eigenen Fotos als {id}.
      find: jest.fn(async () => (over.gefundeneFotos ?? []).map((id) => ({ id }))),
      findOne: jest.fn(), // darf NIE aufgerufen werden (kein per-Foto-Query mehr)
    };
    let savedSeq = 0;
    const itemPhotoRepo: any = {
      find: jest.fn().mockResolvedValue(over.bestehendeLinks ?? []),
      findOne: jest.fn(), // darf NIE aufgerufen werden
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: `link${++savedSeq}`, ...x })),
    };
    const refRepo = () => ({ findOne: jest.fn().mockResolvedValue({ id: 'ref', tenantId: 't1' }) });
    const svc = new InspectionService(
      inspectionRepo,
      itemRepo,
      photoRepo,
      itemPhotoRepo,
      refRepo() as any,
      refRepo() as any,
      refRepo() as any,
      audit,
    );
    return { svc, inspectionRepo, itemRepo, photoRepo, itemPhotoRepo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('linkPhotos: validiert + laedt bestehende Zuordnungen in JE EINER Query (kein N+1)', async () => {
    const { svc, photoRepo, itemPhotoRepo } = makeService({
      gefundeneFotos: ['p1', 'p2', 'p3'],
      bestehendeLinks: [],
    });
    const links = await svc.linkPhotos(user, 'item1', {
      photoIds: ['p1', 'p2', 'p3'],
      hauptfotoId: 'p2',
    } as any);

    // Unabhaengig von der Fotozahl: genau EINE Foto-Query + EINE Link-Query.
    expect(photoRepo.find).toHaveBeenCalledTimes(1);
    expect(itemPhotoRepo.find).toHaveBeenCalledTimes(1);
    // Und NIE eine Einzelabfrage je Foto.
    expect(photoRepo.findOne).not.toHaveBeenCalled();
    expect(itemPhotoRepo.findOne).not.toHaveBeenCalled();
    // Tenant-gescopte Batch-Abfragen (In(ids) + tenantId).
    expect(photoRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: In(['p1', 'p2', 'p3']), tenantId: 't1' } }),
    );
    expect(itemPhotoRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', damageItemId: 'item1', photoId: In(['p1', 'p2', 'p3']) },
      }),
    );
    // Drei neue Links in Eingabereihenfolge; Hauptfoto korrekt markiert.
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.photoId)).toEqual(['p1', 'p2', 'p3']);
    expect(links.map((l) => l.istHauptfoto)).toEqual([false, true, false]);
    expect(itemPhotoRepo.save).toHaveBeenCalledTimes(3);
  });

  it('linkPhotos: bestehende Zuordnung wird idempotent uebersprungen (nur Neue gespeichert)', async () => {
    const { svc, itemPhotoRepo } = makeService({
      gefundeneFotos: ['p1', 'p2'],
      bestehendeLinks: [
        { id: 'alt', tenantId: 't1', damageItemId: 'item1', photoId: 'p1', istHauptfoto: false },
      ],
    });
    const links = await svc.linkPhotos(user, 'item1', { photoIds: ['p1', 'p2'] } as any);

    // p1 kommt aus dem Bestand (kein neuer Insert), nur p2 wird angelegt.
    expect(itemPhotoRepo.save).toHaveBeenCalledTimes(1);
    expect(itemPhotoRepo.save.mock.calls[0][0]).toMatchObject({ photoId: 'p2' });
    // Reihenfolge bleibt: [bestehendes p1, neues p2].
    expect(links.map((l) => l.photoId)).toEqual(['p1', 'p2']);
    expect(links[0].id).toBe('alt');
  });

  it('linkPhotos: fremdes/unbekanntes Foto -> BadRequest (an derselben Stelle wie zuvor)', async () => {
    const { svc, itemPhotoRepo } = makeService({
      gefundeneFotos: ['p1'], // p2 gehoert nicht zum Betrieb
      bestehendeLinks: [],
    });
    await expect(
      svc.linkPhotos(user, 'item1', { photoIds: ['p1', 'p2'] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    // p1 (gueltig, vor der fremden ID) wurde wie im alten Verhalten bereits angelegt.
    expect(itemPhotoRepo.save).toHaveBeenCalledTimes(1);
    expect(itemPhotoRepo.save.mock.calls[0][0]).toMatchObject({ photoId: 'p1' });
  });

  it('createItem: photoIds werden gebuendelt validiert (kein per-Foto-Query)', async () => {
    const { svc, photoRepo, itemRepo } = makeService({
      item: null, // clientUuid-Lookup liefert nichts -> Neuanlage
      gefundeneFotos: ['p1', 'p2'],
      bestehendeLinks: [],
    });
    await svc.createItem(user, 'insp1', {
      partId: 'p',
      positionMode: '2d',
      origin: 'neu',
      art: 'kratzer',
      schweregrad: 'mittel',
      photoIds: ['p1', 'p2'],
    } as any);

    // Validierung per Batch (find mit In(ids)), nie findOne je Foto.
    expect(photoRepo.findOne).not.toHaveBeenCalled();
    expect(photoRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: In(['p1', 'p2']), tenantId: 't1' } }),
    );
    // Item wurde angelegt (alle Fotos gueltig).
    expect(itemRepo.save).toHaveBeenCalledTimes(1);
  });

  it('createItem: fremdes Foto -> BadRequest, KEIN Item angelegt (kein Waisenrecord)', async () => {
    const { svc, itemRepo } = makeService({
      item: null,
      gefundeneFotos: ['p1'], // p2 fehlt
    });
    await expect(
      svc.createItem(user, 'insp1', {
        partId: 'p',
        positionMode: '2d',
        origin: 'neu',
        art: 'kratzer',
        schweregrad: 'mittel',
        photoIds: ['p1', 'p2'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(itemRepo.create).not.toHaveBeenCalled();
    expect(itemRepo.save).not.toHaveBeenCalled();
  });
});
