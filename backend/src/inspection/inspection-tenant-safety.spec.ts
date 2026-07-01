import { InspectionService } from './inspection.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Sicherheits-Regression: Eine Inspektion (bzw. ein Schaden) darf NIEMALS eine
 * client-vorgegebene `id` als Primaerschluessel uebernehmen. Sonst wuerde ein
 * `save()` mit gesetzter, fremder PK ein UPDATE per WHERE id=... OHNE tenantId
 * ausloesen und koennte den Datensatz eines anderen Mandanten ueberschreiben.
 * Offline-Idempotenz laeuft ausschliesslich ueber die tenant-scoped `clientUuid`.
 *
 * Reine Mock-Tests (kein Nest-Bootstrap, keine DB): die Repos sind jest-Mocks,
 * `create` echoed sein Argument zurueck, damit wir pruefen koennen, welche Felder
 * gesetzt werden.
 */
describe('InspectionService – Ebenen-/Mandanten-Sicherheit beim Anlegen', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: UserRole.MANAGER, tenantId: 't1' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  // Repo-Mock: findOne konfigurierbar, create echoed Arg, save echoed (mit id).
  const refRepo = () => ({ findOne: jest.fn().mockResolvedValue({ id: 'ref', tenantId: 't1' }) });

  function makeService(overrides: {
    inspectionFindOne?: any;
    itemFindOne?: any;
  } = {}) {
    const inspectionRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.inspectionFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'server-generierte-uuid', ...x })),
    };
    const itemRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.itemFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({ id: 'server-item-uuid', ...x })),
    };
    const photoRepo: any = refRepo();
    const itemPhotoRepo: any = refRepo();
    const customerRepo: any = refRepo();
    const vehicleRepo: any = refRepo();
    const orderRepo: any = refRepo();
    const svc = new InspectionService(
      inspectionRepo,
      itemRepo,
      photoRepo,
      itemPhotoRepo,
      customerRepo,
      vehicleRepo,
      orderRepo,
      audit,
    );
    return { svc, inspectionRepo, itemRepo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('createInspection uebernimmt dto.id NICHT als Primaerschluessel', async () => {
    const { svc, inspectionRepo } = makeService();
    await svc.createInspection(user, {
      id: 'FREMDE-PK-EINES-ANDEREN-MANDANTEN',
      customerId: 'c1',
      vehicleId: 'v1',
      typ: 'eingang',
    } as any);

    expect(inspectionRepo.create).toHaveBeenCalledTimes(1);
    const arg = inspectionRepo.create.mock.calls[0][0];
    expect(arg).not.toHaveProperty('id'); // PK bleibt serverseitig
    expect(arg.tenantId).toBe('t1');
  });

  it('createInspection ist idempotent ueber tenant-scoped clientUuid (kein Ueberschreiben)', async () => {
    const bestehend = { id: 'bestehende-inspektion', tenantId: 't1', clientUuid: 'cu-1' };
    const { svc, inspectionRepo } = makeService({ inspectionFindOne: bestehend });
    const result = await svc.createInspection(user, {
      customerId: 'c1',
      vehicleId: 'v1',
      typ: 'eingang',
      clientUuid: 'cu-1',
    } as any);

    // Re-Sync liefert den bestehenden Beleg zurueck, es wird NICHTS neu gespeichert.
    expect(result).toBe(bestehend);
    expect(inspectionRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 't1', clientUuid: 'cu-1' },
    });
    expect(inspectionRepo.create).not.toHaveBeenCalled();
    expect(inspectionRepo.save).not.toHaveBeenCalled();
  });

  it('createItem uebernimmt dto.id NICHT als Primaerschluessel', async () => {
    // inspectionRepo.findOne liefert die (nicht signierte) Inspektion fuer assertRefInTenant.
    const { svc, itemRepo } = makeService({
      inspectionFindOne: { id: 'insp1', tenantId: 't1', unterschriftPng: null },
    });
    await svc.createItem(user, 'insp1', {
      id: 'FREMDE-ITEM-PK',
      partId: 'p1',
      origin: 'neu',
      art: 'kratzer',
      schweregrad: 'mittel',
    } as any);

    expect(itemRepo.create).toHaveBeenCalledTimes(1);
    const arg = itemRepo.create.mock.calls[0][0];
    expect(arg).not.toHaveProperty('id');
    expect(arg.tenantId).toBe('t1');
  });

  it('createItem ist idempotent ueber tenant-scoped clientUuid', async () => {
    const bestehend = { id: 'bestehender-schaden', tenantId: 't1', clientUuid: 'ci-1' };
    const { svc, itemRepo } = makeService({
      inspectionFindOne: { id: 'insp1', tenantId: 't1', unterschriftPng: null },
      itemFindOne: bestehend,
    });
    const result = await svc.createItem(user, 'insp1', {
      partId: 'p1',
      origin: 'neu',
      art: 'kratzer',
      schweregrad: 'mittel',
      clientUuid: 'ci-1',
    } as any);

    expect(result).toBe(bestehend);
    expect(itemRepo.create).not.toHaveBeenCalled();
    expect(itemRepo.save).not.toHaveBeenCalled();
  });
});
