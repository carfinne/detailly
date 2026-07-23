import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, PLATTFORM_ROLLEN } from '../users/entities/user.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { AuditService } from '../audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { KeyedMutex } from '../common/keyed-mutex';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * Per-Betrieb-Serialisierung des maxUsers-Abschnitts (zaehlen -> pruefen ->
   * speichern) beim Anlegen UND Reaktivieren. Ohne diese Klammer koennten zwei
   * gleichzeitige Anlagen am Limit beide unter dem Limit zaehlen und es zusammen
   * ueberschreiten (TOCTOU). Instanz-Feld, weil der Service ein DI-Singleton ist
   * (alle Requests teilen denselben Lock).
   */
  private readonly limitLock = new KeyedMutex();

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

  /**
   * SICHERHEIT (Rang-Wache): Ein Nutzer darf einen anderen nur bearbeiten, wenn
   * dessen bestehende Rolle NICHT hoeher (kleinerer Rang) ist als die eigene.
   * Ohne diese Wache koennte z. B. ein MANAGER via PATCH :id/password das Passwort
   * des OWNER setzen (= Account-Uebernahme), ihn deaktivieren oder seine Login-
   * E-Mail aendern. Frueher stand dieser Check NUR im Rollenwechsel-Zweig von
   * update() und fehlte bei setPassword()/deactivate() sowie bei reinen Feld-
   * aenderungen. Platform-Admin ist ausgenommen (darf alles).
   */
  private assertZielRangErlaubt(actor: AuthUser, ziel: User) {
    if (actor.role === UserRole.PLATFORM_ADMIN) return;
    if (this.rank(ziel.role) < this.rank(actor.role)) {
      throw new ForbiddenException('Dieser Mitarbeiter darf nicht bearbeitet werden');
    }
  }

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  /**
   * Zaehlregel des Mitarbeiter-Limits (maxUsers), tenant-scoped: es zaehlen nur
   * AKTIVE Betriebs-Nutzer. Deaktivierte geben ihren Platz frei; Plattform-Rollen
   * (Detailly-Personal) zaehlen NICHT gegen das Kunden-Limit. Der Inhaber-Account
   * (OWNER) ist ein regulaerer Betriebs-Nutzer und zaehlt bewusst mit. EINE Quelle
   * dieser Regel fuer create(), update()-Reaktivierung und getUsage().
   */
  private countActiveBetriebsUsers(tenantId: string): Promise<number> {
    return this.repo.count({
      where: { tenantId, isActive: true, role: Not(In(PLATTFORM_ROLLEN)) },
    });
  }

  /**
   * Mitarbeiter-Kontingent des Betriebs fuer die UX: `used` = aktuell zaehlende
   * (aktive) Betriebs-Nutzer, `limit` = maxUsers des Tarifs (`null` = unbegrenzt
   * bzw. kein Tarif). Dieselbe Zaehlregel wie die Durchsetzung, damit Anzeige und
   * Server-Block nie auseinanderlaufen.
   */
  async getUsage(tenantId: string): Promise<{ used: number; limit: number | null }> {
    const used = await this.countActiveBetriebsUsers(tenantId);
    const limit = await this.subscriptions.getLimit(tenantId, 'maxUsers');
    return { used, limit };
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
    // Tarif-Limit (maxUsers) + Anlage im per-Betrieb serialisierten Abschnitt
    // (Race-Schutz, TOCTOU): zaehlen -> pruefen -> speichern laufen fuer denselben
    // Betrieb atomar, damit zwei gleichzeitige Anlagen das Limit nicht gemeinsam
    // ueberschreiten. Nur AKTIVE Betriebs-User zaehlen (siehe countActiveBetriebsUsers).
    const saved = await this.limitLock.runExclusive(actor.tenantId, async () => {
      const aktiveBetriebsUser = await this.countActiveBetriebsUsers(actor.tenantId);
      await this.subscriptions.assertLimit(actor.tenantId, 'maxUsers', aktiveBetriebsUser);
      const existing = await this.repo.findOne({
        where: { email: dto.email, tenantId: actor.tenantId },
      });
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
        geburtstag: dto.geburtstag,
        funktion: dto.funktion,
        tenantId: actor.tenantId,
      });
      return this.repo.save(user);
    });
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
    // SICHERHEIT: Rang-Wache fuer JEDE Aenderung (auch reine Feldaenderungen wie
    // isActive/email), nicht nur beim Rollenwechsel. Sonst koennte ein MANAGER
    // die Stammdaten/den Login des OWNER umschreiben.
    this.assertZielRangErlaubt(actor, user);
    // Reaktivierung = Anlage-Aequivalent fuers Tarif-Limit (maxUsers): sonst
    // liesse sich das Limit per Deaktivieren/Reaktivieren umgehen. Der Limit-Check
    // laeuft unten IM selben serialisierten Abschnitt wie das Speichern (Race-
    // Schutz, TOCTOU) – gleiche Zaehlregel wie create() (countActiveBetriebsUsers).
    const reactivating = dto.isActive === true && user.isActive === false;
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
      // (d) "bestehende Rolle des Ziel-Users nicht hoeher" wird jetzt zentral
      // durch assertZielRangErlaubt() oben abgedeckt.
      roleChanged = { from: user.role, to: role };
      user.role = role as UserRole;
    }

    // Persistieren. Bei Reaktivierung im per-Betrieb serialisierten Abschnitt mit
    // frischem Zaehlen+Limit-Check (Race-Schutz analog create()); sonst direkt.
    const saved = reactivating
      ? await this.limitLock.runExclusive(actor.tenantId, async () => {
          const aktiveBetriebsUser = await this.countActiveBetriebsUsers(actor.tenantId);
          await this.subscriptions.assertLimit(actor.tenantId, 'maxUsers', aktiveBetriebsUser);
          return this.repo.save(user);
        })
      : await this.repo.save(user);
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
    this.assertZielRangErlaubt(actor, user); // kein Passwort-Reset fuer hoeher gestellte (z. B. MANAGER -> OWNER)
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
    this.assertZielRangErlaubt(actor, user); // kein Deaktivieren hoeher gestellter (z. B. MANAGER -> OWNER)
    if (actor.id === id) {
      throw new ForbiddenException('Der eigene Zugang kann nicht deaktiviert werden');
    }
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
