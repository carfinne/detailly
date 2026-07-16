import { SchichtdickeService } from './schichtdicke.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Sicherheits-Regression fuer das Schichtdicken-Messprotokoll:
 * - eine client-vorgegebene `id` wird NIE als Primaerschluessel uebernommen
 *   (sonst UPDATE per WHERE id=... ohne tenantId -> Fremd-Mandant ueberschreibbar);
 * - Offline-Idempotenz laeuft ausschliesslich ueber die tenant-scoped `clientUuid`;
 * - `tenantId` wird immer aus dem Nutzer gesetzt, nie aus dem Body;
 * - die Auswertung (Ampel) ist rein ableitbar.
 *
 * Reine Mock-Tests (kein Nest-Bootstrap, keine DB).
 */
describe('SchichtdickeService – Mandanten-Sicherheit beim Anlegen', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: UserRole.MANAGER, tenantId: 't1' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  const refRepo = () => ({ findOne: jest.fn().mockResolvedValue({ id: 'ref', tenantId: 't1' }) });

  function makeService(
    overrides: { measurementFindOne?: any; pointFindOne?: any } = {},
  ) {
    const measurementRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.measurementFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'server-uuid', ...x })),
      find: jest.fn().mockResolvedValue([]),
    };
    const pointRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.pointFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'server-point-uuid', ...x })),
      find: jest.fn().mockResolvedValue([]),
    };
    const customerRepo: any = refRepo();
    const vehicleRepo: any = refRepo();
    const orderRepo: any = refRepo();
    const tenantRepo: any = refRepo();
    const svc = new SchichtdickeService(
      measurementRepo,
      pointRepo,
      customerRepo,
      vehicleRepo,
      orderRepo,
      tenantRepo,
      audit,
    );
    return { svc, measurementRepo, pointRepo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('create uebernimmt dto.id NICHT als Primaerschluessel; tenantId aus dem Nutzer', async () => {
    const { svc, measurementRepo } = makeService();
    await svc.create(user, {
      id: 'FREMDE-PK',
      customerId: 'c1',
      vehicleId: 'v1',
    } as any);
    expect(measurementRepo.create).toHaveBeenCalledTimes(1);
    const arg = measurementRepo.create.mock.calls[0][0];
    expect(arg).not.toHaveProperty('id');
    expect(arg.tenantId).toBe('t1');
  });

  it('create defaultet ein unbekanntes Normprofil auf serienlack_stahl', async () => {
    const { svc, measurementRepo } = makeService();
    await svc.create(user, { customerId: 'c1', normProfileKey: 'phantasie' } as any);
    const arg = measurementRepo.create.mock.calls[0][0];
    expect(arg.normProfileKey).toBe('serienlack_stahl');
  });

  it('create ist idempotent ueber tenant-scoped clientUuid (kein Ueberschreiben)', async () => {
    const bestehend = { id: 'bestehend', tenantId: 't1', clientUuid: 'cu-1' };
    const { svc, measurementRepo } = makeService({ measurementFindOne: bestehend });
    const result = await svc.create(user, { customerId: 'c1', clientUuid: 'cu-1' } as any);
    expect(result).toBe(bestehend);
    expect(measurementRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 't1', clientUuid: 'cu-1' },
    });
    expect(measurementRepo.create).not.toHaveBeenCalled();
    expect(measurementRepo.save).not.toHaveBeenCalled();
  });

  it('createPoint uebernimmt dto.id NICHT als PK; verankert tenantId + measurementId', async () => {
    const { svc, pointRepo } = makeService({
      measurementFindOne: { id: 'm1', tenantId: 't1', unterschriftPng: null, status: 'entwurf' },
    });
    await svc.createPoint(user, 'm1', {
      id: 'FREMDE-POINT-PK',
      partId: 'tuer_vl',
      positionMode: '3d',
      readings: [{ wertUm: 120 }],
    } as any);
    expect(pointRepo.create).toHaveBeenCalledTimes(1);
    const arg = pointRepo.create.mock.calls[0][0];
    expect(arg).not.toHaveProperty('id');
    expect(arg.tenantId).toBe('t1');
    expect(arg.measurementId).toBe('m1');
  });

  it('createPoint filtert ungueltige/negative Messwerte heraus', async () => {
    const { svc, pointRepo } = makeService({
      measurementFindOne: { id: 'm1', tenantId: 't1', unterschriftPng: null, status: 'entwurf' },
    });
    await svc.createPoint(user, 'm1', {
      partId: 'tuer_vl',
      positionMode: '3d',
      readings: [{ wertUm: 100 }, { wertUm: -3 }],
    } as any);
    const arg = pointRepo.create.mock.calls[0][0];
    expect(arg.readings).toEqual([{ wertUm: 100, erfasstAm: undefined }]);
  });

  it('findOne liefert Punkte + abgeleitete Bauteil-Auswertung (Ampel)', async () => {
    const { svc, measurementRepo, pointRepo } = makeService({
      measurementFindOne: { id: 'm1', tenantId: 't1', normProfileKey: 'serienlack_stahl' },
    });
    pointRepo.find.mockResolvedValue([
      { id: 'p1', partId: 'tuer_vl', partLabel: 'Tür vorne links', readings: [{ wertUm: 300 }] },
      { id: 'p2', partId: 'motorhaube', partLabel: 'Motorhaube', readings: [{ wertUm: 120 }] },
    ]);
    const detail = await svc.findOne(user, 'm1');
    expect(measurementRepo.findOne).toHaveBeenCalledWith({ where: { id: 'm1', tenantId: 't1' } });
    const tuer = detail.auswertung.find((a) => a.partId === 'tuer_vl')!;
    expect(tuer.status).toBe('verdacht');
    expect(tuer.auffaellig).toBe(true);
    const haube = detail.auswertung.find((a) => a.partId === 'motorhaube')!;
    expect(haube.status).toBe('normal');
    expect(detail.auffaelligeBauteile).toBe(1);
  });
});
