import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, PLATTFORM_ROLLEN } from '../users/entities/user.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  // Rollen-Hierarchie: kleinerer Rang = mehr Rechte. Unabhaengig von der Enum-Reihenfolge.
  // Plattform-Rollen (Detailly) stehen ganz oben (Rang 0) – sie werden ohnehin
  // von den Plattform-Guards unten geschuetzt, aber so liefert rank() nie +Infinity.
  private static readonly ROLE_RANK: Record<string, number> = {
    [UserRole.PLATFORM_ADMIN]: 0,
    [UserRole.PLATFORM_ANALYST]: 0,
    [UserRole.PLATFORM_SUPPORT]: 0,
    [UserRole.OWNER]: 1,
    [UserRole.MANAGER]: 2,
    [UserRole.TECHNICIAN]: 3,
    [UserRole.RECEPTIONIST]: 4,
  };

  private rank(role?: string): number {
    return role != null && role in EmployeesService.ROLE_RANK
      ? EmployeesService.ROLE_RANK[role]
      : Number.POSITIVE_INFINITY; // unbekannte Rolle = niedrigste Macht, kein Bypass
  }

  private static istPlattformRolle(role?: string): boolean {
    return !!role && (PLATTFORM_ROLLEN as string[]).includes(role);
  }

  /**
   * Harte Trennung der Ebenen: Ueber die (Kunden-)Mitarbeiterverwaltung darf
   * NIEMAND ausser einem Platform-Admin eine Plattform-Rolle vergeben oder einen
   * Plattform-User anfassen. Verhindert, dass ein Kunde sich Plattform-Zugriff
   * verschafft (Privilege Escalation ueber die Rollenzuweisung).
   */
  private assertKeinPlattformZugriff(actor: AuthUser, zielRolle?: string) {
    if (actor.role === UserRole.PLATFORM_ADMIN) return; // Detailly darf alles
    if (EmployeesService.istPlattformRolle(zielRolle)) {
      throw new ForbiddenException('Plattform-Rollen können hier nicht vergeben/bearbeitet werden.');
    }
  }

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findAll(tenantId: string) {
    const users = await this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return users.map((u) => this.sanitize(u));
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.repo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    return this.sanitize(user);
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto) {
    // Ebenen-Trennung: keine Plattform-Rolle ueber die Kunden-Verwaltung anlegen.
    this.assertKeinPlattformZugriff(actor, dto.role);
    // Rang-Wache wie in update() (Wache c): niemand legt einen Nutzer mit MEHR
    // Rechten an, als er selbst hat (z. B. Manager -> Inhaber).
    if (this.rank(dto.role) < this.rank(actor.role)) {
      throw new ForbiddenException('Ziel-Rolle darf nicht hoeher als die eigene sein');
    }
    const existing = await this.repo.findOne({ where: { email: dto.email, tenantId: actor.tenantId } });
    if (existing) throw new ConflictException('E-Mail-Adresse bereits vergeben');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.repo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: dto.role,
      stundenlohn: dto.stundenlohn,
      tenantId: actor.tenantId,
    });
    const saved = await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'create',
      entityType: 'User',
      entityId: saved.id,
      payload: { email: saved.email, role: saved.role },
    });
    return this.sanitize(saved);
  }

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto) {
    const user = await this.repo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    // Ebenen-Trennung: einen Plattform-User (Detailly) darf nur ein Platform-Admin
    // anfassen – kein Kunde, auch nicht fuer harmlose Felder.
    this.assertKeinPlattformZugriff(actor, user.role);
    // role aus dem DTO herausloesen - normale Felder duerfen frei geaendert werden.
    const { role, ...rest } = dto;
    Object.assign(user, rest);

    let roleChanged: { from: string; to: string } | null = null;
    if (role != null && role !== user.role) {
      // Keine Hochstufung auf eine Plattform-Rolle ueber die Kunden-Verwaltung.
      this.assertKeinPlattformZugriff(actor, role);
      const CAN_CHANGE = [UserRole.OWNER, UserRole.PLATFORM_ADMIN] as string[];
      // a) Nur Owner/Super-Admin duerfen Rollen aendern (MANAGER faellt hier raus).
      if (!CAN_CHANGE.includes(actor.role)) {
        throw new ForbiddenException('Keine Berechtigung, Rollen zu aendern');
      }
      // b) Kein Self-Rollenwechsel (verhindert Self-Upgrade).
      if (actor.id === id) {
        throw new ForbiddenException('Eigene Rolle kann nicht geaendert werden');
      }
      // c) Ziel-Rolle darf nicht hoeher (kleinerer Rang) sein als die eigene.
      if (this.rank(role) < this.rank(actor.role)) {
        throw new ForbiddenException('Ziel-Rolle darf nicht hoeher als die eigene sein');
      }
      // d) Auch die bestehende Rolle des Ziel-Users nicht hoeher als die eigene.
      if (this.rank(user.role) < this.rank(actor.role)) {
        throw new ForbiddenException('Dieser Mitarbeiter darf nicht bearbeitet werden');
      }
      roleChanged = { from: user.role, to: role };
      user.role = role as UserRole;
    }

    const saved = await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: roleChanged ? 'role_change' : 'update',
      entityType: 'User',
      entityId: id,
      payload: roleChanged ? { from: roleChanged.from, to: roleChanged.to } : undefined,
    });
    return this.sanitize(saved);
  }

  async setPassword(actor: AuthUser, id: string, password: string) {
    const user = await this.repo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    this.assertKeinPlattformZugriff(actor, user.role); // kein Passwort-Reset fuer Plattform-User durch Kunden
    user.passwordHash = await bcrypt.hash(password, 12);
    await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'set_password',
      entityType: 'User',
      entityId: id,
    });
    return { success: true };
  }

  async deactivate(actor: AuthUser, id: string) {
    const user = await this.repo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    this.assertKeinPlattformZugriff(actor, user.role); // kein Deaktivieren von Plattform-Usern durch Kunden
    user.isActive = false;
    await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'deactivate',
      entityType: 'User',
      entityId: id,
    });
    return { success: true };
  }
}
