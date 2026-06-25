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
 * Rang (kleiner = mehr Rechte): super_admin 0, franchise_owner 1, manager 2,
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
    ({ id: 'actor', email: 'a@b.de', role: UserRole.FRANCHISE_OWNER, tenantId: 't1', ...over });

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
    // actor.id === id: Ziel-User ist der Akteur selbst.
    const { svc } = makeSvc({ id: 'actor', role: UserRole.FRANCHISE_OWNER, tenantId: 't1' });
    await expect(
      svc.update(actor({ id: 'actor' }), 'actor', { role: UserRole.SUPER_ADMIN } as any),
    ).rejects.toThrow('Eigene Rolle kann nicht geaendert werden');
  });

  it('(c) Ziel-Rolle hoeher als eigene -> Forbidden (Owner kann niemanden zum super_admin machen)', async () => {
    const { svc } = makeSvc({ id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1' });
    await expect(
      svc.update(actor({ role: UserRole.FRANCHISE_OWNER }), 'u2', {
        role: UserRole.SUPER_ADMIN,
      } as any),
    ).rejects.toThrow('Ziel-Rolle darf nicht hoeher als die eigene sein');
  });

  it('(d) bestehende Rolle des Ziel-Users hoeher als eigene -> Forbidden', async () => {
    // Owner (Rang 1) will einen super_admin (Rang 0) bearbeiten.
    const { svc } = makeSvc({ id: 'u2', role: UserRole.SUPER_ADMIN, tenantId: 't1' });
    await expect(
      svc.update(actor({ role: UserRole.FRANCHISE_OWNER }), 'u2', {
        role: UserRole.MANAGER,
      } as any),
    ).rejects.toThrow('Dieser Mitarbeiter darf nicht bearbeitet werden');
  });

  it('Positiv: Owner stuft technician -> manager hoch, save wird aufgerufen, role gesetzt', async () => {
    const target = { id: 'u2', role: UserRole.TECHNICIAN, tenantId: 't1', passwordHash: 'geheim' };
    const { svc, repo } = makeSvc(target);

    const result = await svc.update(actor({ role: UserRole.FRANCHISE_OWNER }), 'u2', {
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
      svc.update(actor({ role: UserRole.FRANCHISE_OWNER }), 'u2', { role: 'hausmeister' } as any),
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
