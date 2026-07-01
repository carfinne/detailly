import { ForbiddenException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die Privilege-Escalation-Wachen in EmployeesService.update().
 *
 * Die Rang-Logik (`rank`) ist privat, wird aber ueber den oeffentlichen Pfad
 * `update()` mitgetestet. Repository und Audit sind einfache Mocks -> keine DB,
 * kein Nest-Bootstrap. `update` ruft kein bcrypt -> kein nativer Code.
 *
 * Rang (kleiner = mehr Rechte): platform_admin 0, owner 1, manager 2,
 * technician 3, receptionist 4, unbekannt = +Infinity (kein Bypass).
 */
describe('EmployeesService.update - Rollen-Eskalations-Wachen', () => {
  // Repo gibt bei findOne den Ziel-User zurueck; save echoed das uebergebene Objekt.
  const makeRepo = (targetUser: any) => ({
    findOne: jest.fn().mockResolvedValue(targetUser),
    save: jest.fn().mockImplementation(async (u: any) => u),
  });
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  const actor = (over: Partial<AuthUser>): AuthUser =>
    ({ id: 'actor', email: 'a@b.de', role: UserRole.OWNER, tenantId: 't1', ...over });

  // Hilfsfunktion: baut Service mit gegebenem Ziel-User im Repo.
  const makeSvc = (targetUser: any) => {
    const repo = makeRepo(targetUser);
    const svc = new EmployeesService(repo as any, audit);
    return { svc, repo };
  };

  beforeEach(() => jest.clearAllMocks());

  it('(a) MANAGER darf keine Rolle aendern -> Forbidden', async () => {
    const { svc } = makeSvc({ id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1' });
    await expect(
      svc.update(actor({ role: UserRole.MANAGER }), 'u2', { role: UserRole.RECEPTIONIST } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('(b) Self-Rollenwechsel verboten -> Forbidden', async () => {
    // actor.id === id: Ziel-User ist der Akteur selbst. Wechsel auf eine
    // TENANT-Rolle, damit gezielt die Self-Guard greift (nicht die Plattform-Guard).
    const { svc } = makeSvc({ id: 'actor', role: UserRole.OWNER, tenantId: 't1' });
    await expect(
      svc.update(actor({ id: 'actor' }), 'actor', { role: UserRole.MANAGER } as any),
    ).rejects.toThrow('Eigene Rolle kann nicht geaendert werden');
  });

  it('(c) Owner kann niemanden auf eine Plattform-Rolle hochstufen -> Forbidden', async () => {
    const { svc } = makeSvc({ id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1' });
    await expect(
      svc.update(actor({ role: UserRole.OWNER }), 'u2', { role: UserRole.PLATFORM_ADMIN } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('(d) Owner kann einen Plattform-User nicht bearbeiten -> Forbidden', async () => {
    const { svc } = makeSvc({ id: 'u2', role: UserRole.PLATFORM_ADMIN, tenantId: 't1' });
    await expect(
      svc.update(actor({ role: UserRole.OWNER }), 'u2', { role: UserRole.MANAGER } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Positiv: Owner stuft technician -> manager hoch, save wird aufgerufen, role gesetzt', async () => {
    const target = { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1', passwordHash: 'geheim' };
    const { svc, repo } = makeSvc(target);

    const result = await svc.update(actor({ role: UserRole.OWNER }), 'u2', {
      role: UserRole.MANAGER,
    } as any);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(target.role).toBe(UserRole.MANAGER);
    // sanitize() entfernt den passwordHash aus der Rueckgabe.
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('unbekannte Ziel-Rolle = Rang +Infinity -> kein Bypass (Owner darf zuweisen, da nicht hoeher)', async () => {
    // rank('hausmeister') = +Infinity, also NICHT kleiner als rank(owner)=1 -> Guard (c) greift nicht.
    // Damit ist eine unbekannte Rolle definitiv keine Hochstufung; der Wechsel ist erlaubt.
    const target = { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1' };
    const { svc, repo } = makeSvc(target);

    await expect(
      svc.update(actor({ role: UserRole.OWNER }), 'u2', { role: 'hausmeister' } as any),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('Nicht-Rollen-Felder aendern (kein role im DTO) loest keine Guard aus', async () => {
    const target = { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1', firstName: 'Alt' };
    const { svc, repo } = makeSvc(target);

    await svc.update(actor({ role: UserRole.MANAGER }), 'u2', { firstName: 'Neu' } as any);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(target.firstName).toBe('Neu');
  });
});

/**
 * Ebenen-Trennung Plattform (Detailly) vs. Kunde: ein Kunde darf sich NIEMALS
 * Plattform-Zugriff verschaffen. Nagelt genau diese Angriffe fest.
 */
describe('EmployeesService - Ebenen-Trennung (Plattform vs. Kunde)', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const actor = (over: Partial<AuthUser>): AuthUser =>
    ({ id: 'actor', email: 'a@b.de', role: UserRole.OWNER, tenantId: 't1', ...over });
  const fullRepo = (targetUser: any) => ({
    findOne: jest.fn().mockResolvedValue(targetUser),
    save: jest.fn(async (u: any) => u),
    create: jest.fn((u: any) => u),
  });
  const svcWith = (targetUser: any) => new EmployeesService(fullRepo(targetUser) as any, audit);

  it('Inhaber kann KEINE Plattform-Rolle anlegen -> Forbidden', async () => {
    const svc = svcWith(null);
    await expect(
      svc.create(actor({}), {
        email: 'x@y.de', password: '12345678', firstName: 'X', lastName: 'Y',
        role: UserRole.PLATFORM_ANALYST,
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Inhaber kann einen User NICHT auf eine Plattform-Rolle hochstufen -> Forbidden', async () => {
    const svc = svcWith({ id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1' });
    await expect(
      svc.update(actor({}), 'u2', { role: UserRole.PLATFORM_SUPPORT } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Inhaber kann einen bestehenden Plattform-User NICHT bearbeiten -> Forbidden', async () => {
    const svc = svcWith({ id: 'u2', role: UserRole.PLATFORM_ANALYST, tenantId: 't1', firstName: 'Alt' });
    await expect(
      svc.update(actor({}), 'u2', { firstName: 'Neu' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Inhaber kann Passwort/Deaktivierung eines Plattform-Users NICHT ausloesen', async () => {
    const svc = svcWith({ id: 'u2', role: UserRole.PLATFORM_ADMIN, tenantId: 't1' });
    await expect(svc.setPassword(actor({}), 'u2', 'neuespasswort')).rejects.toThrow(ForbiddenException);
    await expect(svc.deactivate(actor({}), 'u2')).rejects.toThrow(ForbiddenException);
  });

  it('Manager kann KEINEN Inhaber anlegen (Rang-Wache in create) -> Forbidden', async () => {
    const svc = svcWith(null);
    await expect(
      svc.create(actor({ role: UserRole.MANAGER }), {
        email: 'x@y.de', password: '12345678', firstName: 'X', lastName: 'Y',
        role: UserRole.OWNER,
      } as any),
    ).rejects.toThrow('Ziel-Rolle darf nicht hoeher als die eigene sein');
  });

  it('Manager DARF einen Techniker anlegen (niedrigere Rolle bleibt erlaubt)', async () => {
    const svc = svcWith(null);
    await expect(
      svc.create(actor({ role: UserRole.MANAGER }), {
        email: 't@y.de', password: '12345678', firstName: 'T', lastName: 'Y',
        role: UserRole.TECHNICIAN,
      } as any),
    ).resolves.toBeDefined();
  });

  it('Platform-Admin DARF eine Plattform-Rolle anlegen', async () => {
    const svc = svcWith(null);
    await expect(
      svc.create(actor({ role: UserRole.PLATFORM_ADMIN }), {
        email: 'p@d.de', password: '12345678', firstName: 'P', lastName: 'A',
        role: UserRole.PLATFORM_ANALYST,
      } as any),
    ).resolves.toBeDefined();
  });
});
