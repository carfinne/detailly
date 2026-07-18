import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DellenkalkulationService } from './dellenkalkulation.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Sicherheits-/Fach-Regression der Dellenkalkulation (reine Mocks, keine DB):
 * - fremde Kalkulation -> NotFound (Mandantentrennung);
 * - ein vom Client gesendeter Preis wird IGNORIERT/ueberschrieben (Preis nur
 *   serverseitig aus der Matrix);
 * - der Batch-Endpunkt setzt ALLE Marker in EINEM Request (ein delete + ein save);
 * - die Preismatrix ist tenant-scoped (findOne/Upsert immer mit tenantId).
 */
describe('DellenkalkulationService', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: UserRole.MANAGER, tenantId: 't1' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  function makeService(
    overrides: {
      kalkFindOne?: any;
      markerFind?: any[];
      matrixFindOne?: any;
    } = {},
  ) {
    const kalkRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.kalkFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'k-server', ...x })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const markerRepo: any = {
      find: jest.fn().mockResolvedValue(overrides.markerFind ?? []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const matrixRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.matrixFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'm-server', ...x })),
    };
    const customerRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) };
    const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'v1', tenantId: 't1' }) };
    const svc = new DellenkalkulationService(
      kalkRepo,
      markerRepo,
      matrixRepo,
      customerRepo,
      vehicleRepo,
      audit,
    );
    return { svc, kalkRepo, markerRepo, matrixRepo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('findOne einer fremden/nicht existierenden Kalkulation -> NotFound', async () => {
    const { svc, kalkRepo } = makeService({ kalkFindOne: null });
    await expect(svc.findOne(user, 'fremd')).rejects.toBeInstanceOf(NotFoundException);
    expect(kalkRepo.findOne).toHaveBeenCalledWith({ where: { id: 'fremd', tenantId: 't1' } });
  });

  it('create uebernimmt dto.id NICHT als PK; tenantId aus dem Nutzer', async () => {
    const { svc, kalkRepo } = makeService();
    await svc.create(user, { id: 'FREMDE-PK', modus: 'einzel' } as any);
    const arg = kalkRepo.create.mock.calls[0][0];
    expect(arg).not.toHaveProperty('id');
    expect(arg.tenantId).toBe('t1');
    expect(arg.status).toBe('entwurf');
    expect(arg.gesamtpreis).toBe('0');
  });

  it('setMarker: client-gesendeter Preis wird ignoriert; Preis serverseitig aus der Matrix', async () => {
    const { svc, markerRepo, kalkRepo } = makeService({
      kalkFindOne: { id: 'k1', tenantId: 't1', status: 'entwurf', modus: 'einzel' },
      // ladeMarker nach dem Speichern (Rueckgabe irrelevant fuer die Assertions).
      markerFind: [],
    });
    await svc.setMarker(user, 'k1', {
      markers: [
        // Bogus einzelpreis/gesamtpreis im Body: MUSS ignoriert werden.
        { bauteil: 'tuer_vl', positionMode: '3d', groessenklasse: '2euro', einzelpreis: 99999 } as any,
      ],
    });
    // Default-Matrix: basis '2euro' = 55, keine Faktoren -> 55.00 (nicht 99999).
    const createdMarker = markerRepo.create.mock.calls[0][0];
    expect(createdMarker.einzelpreis).toBe('55.00');
    expect(createdMarker.tenantId).toBe('t1');
    expect(createdMarker.kalkulationId).toBe('k1');
    // Kopf-Gesamtpreis serverseitig gesetzt.
    const savedKalk = kalkRepo.save.mock.calls.at(-1)![0];
    expect(savedKalk.gesamtpreis).toBe('55.00');
  });

  it('setMarker setzt ALLE Marker in EINEM Request (ein delete + ein save mit Array)', async () => {
    const { svc, markerRepo } = makeService({
      kalkFindOne: { id: 'k1', tenantId: 't1', status: 'entwurf', modus: 'einzel' },
    });
    await svc.setMarker(user, 'k1', {
      markers: [
        { bauteil: 'tuer_vl', positionMode: '3d', groessenklasse: '1euro' },
        { bauteil: 'dach', positionMode: '3d', groessenklasse: '5euro' },
        { bauteil: 'motorhaube', positionMode: '3d', groessenklasse: 'golfball' },
      ],
    } as any);
    // Replace-all: genau ein tenant-scoped delete ...
    expect(markerRepo.delete).toHaveBeenCalledTimes(1);
    expect(markerRepo.delete).toHaveBeenCalledWith({ tenantId: 't1', kalkulationId: 'k1' });
    // ... und genau ein save mit allen drei Markern.
    expect(markerRepo.save).toHaveBeenCalledTimes(1);
    expect(markerRepo.save.mock.calls[0][0]).toHaveLength(3);
  });

  it('setMarker im Hagel-Modus bepreist per Panel-Staffel', async () => {
    const { svc, kalkRepo } = makeService({
      kalkFindOne: { id: 'k1', tenantId: 't1', status: 'entwurf', modus: 'hagel' },
    });
    await svc.setMarker(user, 'k1', {
      markers: [
        { bauteil: 'dach', positionMode: '3d', dellenAnzahl: 3 }, // Default-Staffel: 250
        { bauteil: 'motorhaube', positionMode: '3d', dellenAnzahl: 20 }, // 700
      ],
    } as any);
    const savedKalk = kalkRepo.save.mock.calls.at(-1)![0];
    expect(savedKalk.gesamtpreis).toBe('950.00');
  });

  it('setMarker auf finalisierter Kalkulation ist gesperrt', async () => {
    const { svc } = makeService({
      kalkFindOne: { id: 'k1', tenantId: 't1', status: 'final', modus: 'einzel' },
    });
    await expect(svc.setMarker(user, 'k1', { markers: [] })).rejects.toThrow(/finalisiert/i);
  });

  it('getMatrix ist tenant-scoped und liefert Default, wenn ungepflegt', async () => {
    const { svc, matrixRepo } = makeService({ matrixFindOne: null });
    const res = await svc.getMatrix(user);
    expect(matrixRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
    expect(res.istDefault).toBe(true);
    expect(res.basispreise.groesser).toBeGreaterThan(0);
  });

  it('setMatrix upsertet tenant-scoped (tenantId aus dem Nutzer)', async () => {
    const { svc, matrixRepo } = makeService({ matrixFindOne: null });
    await svc.setMatrix(user, {
      basis1Euro: 40,
      basis2Euro: 60,
      basis5Euro: 90,
      basisGolfball: 130,
      basisGroesser: 180,
      kantenFaktor: 1.6,
      aluFaktor: 1.3,
      lackschadenAufschlag: 70,
      mindestpauschale: 0,
      anfahrtspauschale: 0,
      hagelStaffel: [{ maxDellen: 10, pauschale: 300 }, { maxDellen: null, pauschale: 900 }],
    });
    const createdRow = matrixRepo.create.mock.calls[0][0];
    expect(createdRow.tenantId).toBe('t1');
    const savedRow = matrixRepo.save.mock.calls[0][0];
    expect(savedRow.basis1Euro).toBe('40.00');
    expect(savedRow.kantenFaktor).toBe('1.600');
  });

  it('setMarker im Hagel-Modus mit LEERER Staffel -> BadRequest (kein stummer 0-EUR-Preis)', async () => {
    const { svc } = makeService({
      kalkFindOne: { id: 'k1', tenantId: 't1', status: 'entwurf', modus: 'hagel' },
      // Persistierte Matrix ohne Hagel-Staffel (leeres Array).
      matrixFindOne: { hagelStaffel: [] },
    });
    await expect(
      svc.setMarker(user, 'k1', {
        markers: [{ bauteil: 'dach', positionMode: '3d', dellenAnzahl: 5 }] as any,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setMarker -> BadRequest, wenn der berechnete Preis die numeric(10,2)-Grenze sprengt', async () => {
    const { svc } = makeService({
      kalkFindOne: { id: 'k1', tenantId: 't1', status: 'entwurf', modus: 'einzel' },
      // Absurd hohe (persistierte) Matrix: 5euro-Basis * Kante * Alu = 99999.99*10*10 je Marker.
      matrixFindOne: {
        basis5Euro: '99999.99',
        kantenFaktor: '10.000',
        aluFaktor: '10.000',
        hagelStaffel: [{ maxDellen: null, pauschale: 0 }],
      },
    });
    // 500 Marker (erlaubt) -> Gesamt ~5 Mrd EUR -> ueber der Spaltengrenze.
    const markers = Array.from({ length: 500 }, () => ({
      bauteil: 'dach',
      positionMode: '3d',
      groessenklasse: '5euro',
      kante: true,
      alu: true,
    }));
    await expect(svc.setMarker(user, 'k1', { markers } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
