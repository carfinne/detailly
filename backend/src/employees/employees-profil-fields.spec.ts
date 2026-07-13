import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Feature "Mitarbeiter: Geburtstag + Gewerk-Funktion".
 *
 * Deckt ab:
 *  - DTO-Validierung der neuen optionalen Felder (@IsDateString / @IsIn),
 *  - Round-Trip durch den Service (create/update/findAll) inkl. Sanitize,
 *  - Tenant-Scope bleibt unveraendert (findAll where { tenantId }, create setzt
 *    tenantId aus dem Actor).
 */

const actor: AuthUser = {
  id: 'actor',
  email: 'a@b.de',
  role: UserRole.OWNER,
  tenantId: 't1',
} as AuthUser;

// ---------------------------------------------------------------------------
// DTO-Validierung
// ---------------------------------------------------------------------------
describe('CreateEmployeeDto – geburtstag & funktion', () => {
  const validate_ = (partial: Record<string, unknown>) =>
    validate(
      // A3: policy-konformes Passwort (>= 10 Zeichen, nicht in der Blocklist),
      // damit dieser Test wirklich nur geburtstag/funktion prueft.
      plainToInstance(CreateEmployeeDto, {
        email: 'neu@b.de',
        password: 'Detailly2026!',
        firstName: 'Neu',
        lastName: 'User',
        role: UserRole.TECHNICIAN,
        ...partial,
      }),
    );
  const errorsFor = (errs: Awaited<ReturnType<typeof validate_>>, prop: string) =>
    errs.filter((e) => e.property === prop);

  it('akzeptiert gueltiges ISO-Datum und eine erlaubte Funktion', async () => {
    const errs = await validate_({ geburtstag: '1990-05-17', funktion: 'folierer' });
    expect(errs).toHaveLength(0);
  });

  it('akzeptiert alle fuenf erlaubten Funktions-Werte', async () => {
    for (const funktion of ['aufbereiter', 'folierer', 'ppf_spezialist', 'allrounder', 'buero']) {
      const errs = await validate_({ funktion });
      expect(errorsFor(errs, 'funktion')).toHaveLength(0);
    }
  });

  it('lehnt ein ungueltiges Geburtsdatum ab', async () => {
    const errs = await validate_({ geburtstag: 'kein-datum' });
    expect(errorsFor(errs, 'geburtstag').length).toBeGreaterThan(0);
  });

  it('lehnt eine unbekannte Funktion ab', async () => {
    const errs = await validate_({ funktion: 'chef' });
    expect(errorsFor(errs, 'funktion').length).toBeGreaterThan(0);
  });

  it('beide Felder sind optional (weglassen ist gueltig)', async () => {
    const errs = await validate_({});
    expect(errorsFor(errs, 'geburtstag')).toHaveLength(0);
    expect(errorsFor(errs, 'funktion')).toHaveLength(0);
  });

  it('UpdateEmployeeDto erbt beide Felder als optional', async () => {
    const errs = await validate(
      plainToInstance(UpdateEmployeeDto, { geburtstag: '1985-01-02', funktion: 'buero' }),
    );
    expect(errs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Service-Round-Trip
// ---------------------------------------------------------------------------
describe('EmployeesService – geburtstag & funktion Round-Trip', () => {
  const makeSvc = (repo: Record<string, unknown>) => {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const subscriptions = { assertLimit: jest.fn().mockResolvedValue(undefined) };
    return new EmployeesService(repo as any, audit as any, subscriptions as any);
  };

  it('create() reicht geburtstag & funktion an das Repo weiter und liefert sie zurueck (ohne passwordHash)', async () => {
    const repo = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((u: any) => u),
      save: jest.fn(async (u: any) => ({ ...u, id: 'u-neu', passwordHash: 'hash' })),
    };
    const svc = makeSvc(repo);

    const res: any = await svc.create(actor, {
      email: 'neu@b.de',
      password: '12345678',
      firstName: 'Neu',
      lastName: 'User',
      role: UserRole.TECHNICIAN,
      geburtstag: '1990-05-17',
      funktion: 'ppf_spezialist',
    } as any);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        geburtstag: '1990-05-17',
        funktion: 'ppf_spezialist',
        tenantId: 't1', // Tenant-Scope: aus dem Actor, nie aus dem Body
      }),
    );
    expect(res.geburtstag).toBe('1990-05-17');
    expect(res.funktion).toBe('ppf_spezialist');
    expect(res).not.toHaveProperty('passwordHash');
  });

  it('update() aendert die Funktion und kann beide Felder auf null zuruecksetzen', async () => {
    const target = {
      id: 'u2',
      role: UserRole.TECHNICIAN,
      tenantId: 't1',
      isActive: true,
      geburtstag: '1990-05-17',
      funktion: 'folierer',
      passwordHash: 'hash',
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(target),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(async (u: any) => u),
    };
    const svc = makeSvc(repo);

    const changed: any = await svc.update(actor, 'u2', { funktion: 'buero' } as any);
    expect(changed.funktion).toBe('buero');
    expect(changed).not.toHaveProperty('passwordHash');

    const cleared: any = await svc.update(actor, 'u2', {
      geburtstag: null,
      funktion: null,
    } as any);
    expect(cleared.geburtstag).toBeNull();
    expect(cleared.funktion).toBeNull();
  });

  it('findAll() bleibt tenant-scoped und liefert geburtstag & funktion (ohne passwordHash)', async () => {
    const repo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'u1',
          email: 'a@b.de',
          firstName: 'A',
          lastName: 'B',
          role: UserRole.TECHNICIAN,
          tenantId: 't1',
          passwordHash: 'hash',
          geburtstag: '1990-05-17',
          funktion: 'aufbereiter',
        },
      ]),
    };
    const svc = makeSvc(repo);

    const list: any[] = await svc.findAll('t1');

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    );
    expect(list[0]).not.toHaveProperty('passwordHash');
    expect(list[0].geburtstag).toBe('1990-05-17');
    expect(list[0].funktion).toBe('aufbereiter');
  });
});
