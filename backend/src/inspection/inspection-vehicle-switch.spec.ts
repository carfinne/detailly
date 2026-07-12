import { InspectionService } from './inspection.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Fahrzeug-Wechsel an einer bestehenden Inspektion (updateInspection mit
 * vehicleId). Zwei Garantien:
 *  1. Das Ziel-Fahrzeug wird tenant-scoped validiert (assertRefInTenant) –
 *     ein fremdes Fahrzeug fuehrt zu BadRequest, es wird NICHTS gespeichert.
 *  2. Ein signierter/gesperrter Beleg laesst sich nicht umhaengen.
 *
 * Reine Mock-Tests (kein Nest-Bootstrap, keine DB): die Repos sind jest-Mocks.
 */
describe('InspectionService – Fahrzeug-Wechsel (updateInspection.vehicleId)', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: UserRole.MANAGER, tenantId: 't1' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  function makeService(overrides: {
    inspectionFindOne?: any;
    vehicleFindOne?: any;
  } = {}) {
    const inspectionRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.inspectionFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const refRepo = () => ({ findOne: jest.fn().mockResolvedValue({ id: 'ref', tenantId: 't1' }) });
    const itemRepo: any = refRepo();
    const photoRepo: any = refRepo();
    const itemPhotoRepo: any = refRepo();
    const customerRepo: any = refRepo();
    const vehicleRepo: any = {
      findOne: jest.fn().mockResolvedValue(
        overrides.vehicleFindOne === undefined ? { id: 'v2', tenantId: 't1' } : overrides.vehicleFindOne,
      ),
    };
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
    return { svc, inspectionRepo, vehicleRepo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('haengt die Inspektion tenant-validiert auf ein anderes Fahrzeug um', async () => {
    const bestehend = { id: 'insp1', tenantId: 't1', vehicleId: 'v1', unterschriftPng: null };
    const { svc, inspectionRepo, vehicleRepo } = makeService({ inspectionFindOne: bestehend });

    const saved = await svc.updateInspection(user, 'insp1', { vehicleId: 'v2' } as any);

    // Ziel-Fahrzeug wurde tenant-scoped geladen (assertRefInTenant).
    expect(vehicleRepo.findOne).toHaveBeenCalledWith({ where: { id: 'v2', tenantId: 't1' } });
    // Zuordnung geaendert und gespeichert.
    expect(inspectionRepo.save).toHaveBeenCalledTimes(1);
    expect(saved.vehicleId).toBe('v2');
  });

  it('lehnt ein fremdes Fahrzeug ab (BadRequest, kein Save)', async () => {
    const bestehend = { id: 'insp1', tenantId: 't1', vehicleId: 'v1', unterschriftPng: null };
    const { svc, inspectionRepo } = makeService({
      inspectionFindOne: bestehend,
      vehicleFindOne: null, // Fahrzeug gehoert nicht zum Betrieb / existiert nicht
    });

    await expect(svc.updateInspection(user, 'insp1', { vehicleId: 'fremd' } as any)).rejects.toThrow();
    expect(inspectionRepo.save).not.toHaveBeenCalled();
  });

  it('verweigert den Wechsel an einem signierten (gesperrten) Beleg', async () => {
    const signiert = { id: 'insp1', tenantId: 't1', vehicleId: 'v1', unterschriftPng: 'data:image/png;base64,AAA' };
    const { svc, inspectionRepo } = makeService({ inspectionFindOne: signiert });

    await expect(svc.updateInspection(user, 'insp1', { vehicleId: 'v2' } as any)).rejects.toThrow();
    expect(inspectionRepo.save).not.toHaveBeenCalled();
  });
});
