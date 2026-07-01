import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  FindOptionsWhere,
} from 'typeorm';
import { TimeEntry, TimeEntryType } from './entities/time-entry.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  StempelDto,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  TimeEntryQueryDto,
} from './dto/time-entry.dto';
import { assertRefInTenant } from '../common/tenant/tenant-scope';

/** Eintrag angereichert um Mitarbeiter- und Standortnamen (fuer die Anzeige). */
export interface TimeEntryView extends TimeEntry {
  mitarbeiterName: string;
  standortName: string | null;
}

/**
 * Verwaltet Stempel-Eintraege (Kommen/Gehen) der Mitarbeiter.
 * Alle Abfragen sind tenant-gebunden (Mandantentrennung).
 */
@Injectable()
export class ZeiterfassungService {
  constructor(
    @InjectRepository(TimeEntry) private readonly repo: Repository<TimeEntry>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Self-Service (jede Rolle)
  // ---------------------------------------------------------------------------

  /** Self-Service Kommen/Gehen: setzt tenantId/userId aus dem JWT, zeitpunkt = jetzt. */
  async stempeln(user: AuthUser, dto: StempelDto): Promise<TimeEntryView> {
    // Mandantentrennung: optionaler Standort muss zum eigenen Betrieb gehoeren.
    await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');

    // Plausibilitaet: Kommen/Gehen muss sich abwechseln (kein doppeltes Kommen
    // bzw. Gehen ohne vorheriges Kommen) -> sonst sinnlose Dauerberechnung.
    const letzter = await this.repo.findOne({
      where: { tenantId: user.tenantId, userId: user.id },
      order: { zeitpunkt: 'DESC' },
    });
    if (letzter && letzter.art === dto.art) {
      throw new BadRequestException(
        dto.art === TimeEntryType.KOMMEN
          ? 'Sie sind bereits eingestempelt.'
          : 'Sie sind bereits ausgestempelt – bitte zuerst einstempeln.',
      );
    }

    const eintrag = this.repo.create({
      tenantId: user.tenantId,
      userId: user.id,
      art: dto.art,
      locationId: dto.locationId ?? null,
      zeitpunkt: new Date(),
      korrigiert: false,
      notiz: dto.notiz,
    });
    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'TimeEntry',
      entityId: saved.id,
      payload: { art: dto.art },
    });
    return this.decorate(saved);
  }

  /** Aktueller Ein-/Ausstempel-Status des eigenen Users (letzter Eintrag entscheidet). */
  async aktuellerStatus(
    user: AuthUser,
  ): Promise<{ eingestempelt: boolean; seit: Date | null; letzter: TimeEntryView | null }> {
    const letzter = await this.repo.findOne({
      where: { tenantId: user.tenantId, userId: user.id },
      order: { zeitpunkt: 'DESC' },
    });
    const eingestempelt = letzter?.art === TimeEntryType.KOMMEN;
    return {
      eingestempelt,
      seit: eingestempelt && letzter ? letzter.zeitpunkt : null,
      letzter: letzter ? await this.decorate(letzter) : null,
    };
  }

  /** Eigene Stempel-Historie (tenant- und user-gebunden). */
  async meineEintraege(user: AuthUser): Promise<TimeEntryView[]> {
    const eintraege = await this.repo.find({
      where: { tenantId: user.tenantId, userId: user.id },
      order: { zeitpunkt: 'DESC' },
    });
    return this.decorateMany(user.tenantId, eintraege);
  }

  // ---------------------------------------------------------------------------
  // Leitung (Verwaltung)
  // ---------------------------------------------------------------------------

  /** Leitungs-Liste mit optionalen Filtern; immer strikt nach tenantId. */
  async findAll(tenantId: string, query: TimeEntryQueryDto): Promise<TimeEntryView[]> {
    const where: FindOptionsWhere<TimeEntry> = { tenantId };
    if (query.userId) where.userId = query.userId;
    if (query.locationId) where.locationId = query.locationId;

    const von = query.von ? new Date(query.von) : null;
    const bis = query.bis ? new Date(query.bis) : null;
    if (von && bis) where.zeitpunkt = Between(von, bis);
    else if (von) where.zeitpunkt = MoreThanOrEqual(von);
    else if (bis) where.zeitpunkt = LessThanOrEqual(bis);

    const eintraege = await this.repo.find({ where, order: { zeitpunkt: 'DESC' } });
    return this.decorateMany(tenantId, eintraege);
  }

  /** Leitung legt einen (als korrigiert markierten) Eintrag fuer einen Mitarbeiter an. */
  async create(user: AuthUser, dto: CreateTimeEntryDto): Promise<TimeEntryView> {
    // Mandantentrennung: Mitarbeiter (Pflicht) und Standort (optional) muessen zum eigenen Betrieb gehoeren.
    await assertRefInTenant(this.userRepo, user, dto.userId, 'Mitarbeiter');
    await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');
    const zeitpunkt = new Date(dto.zeitpunkt);
    this.assertNichtZukunft(zeitpunkt);
    const eintrag = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      zeitpunkt,
      korrigiert: true,
    });
    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'TimeEntry',
      entityId: saved.id,
      payload: { art: dto.art, userId: dto.userId },
    });
    return this.decorate(saved);
  }

  /** Leitung korrigiert einen bestehenden Eintrag; Laden via {id, tenantId}. */
  async update(user: AuthUser, id: string, dto: UpdateTimeEntryDto): Promise<TimeEntryView> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Eintrag nicht gefunden');

    // FK-Re-Link nur auf eigene Entities zulassen (Cross-Tenant-Injection verhindern).
    await assertRefInTenant(this.userRepo, user, dto.userId, 'Mitarbeiter');
    await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');

    if (dto.userId !== undefined) eintrag.userId = dto.userId;
    if (dto.art !== undefined) eintrag.art = dto.art;
    if (dto.zeitpunkt !== undefined) {
      const zeitpunkt = new Date(dto.zeitpunkt);
      this.assertNichtZukunft(zeitpunkt);
      eintrag.zeitpunkt = zeitpunkt;
    }
    if (dto.locationId !== undefined) eintrag.locationId = dto.locationId;
    if (dto.notiz !== undefined) eintrag.notiz = dto.notiz;
    eintrag.korrigiert = true;

    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'TimeEntry',
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return this.decorate(saved);
  }

  /** Leitung loescht einen Eintrag; Laden via {id, tenantId}. */
  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Eintrag nicht gefunden');
    await this.repo.remove(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'TimeEntry',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  /** Verhindert (Leitungs-)Stempel mit Zeitpunkt in der Zukunft (2 Min Drift-Toleranz). */
  private assertNichtZukunft(zeitpunkt: Date): void {
    if (Number.isNaN(zeitpunkt.getTime())) {
      throw new BadRequestException('Ungueltiger Zeitpunkt.');
    }
    if (zeitpunkt.getTime() > Date.now() + 2 * 60 * 1000) {
      throw new BadRequestException('Der Zeitpunkt darf nicht in der Zukunft liegen.');
    }
  }

  /** Reichert einen einzelnen Eintrag um Mitarbeiter-/Standortnamen an. */
  private async decorate(eintrag: TimeEntry): Promise<TimeEntryView> {
    const [views] = await this.decorateMany(eintrag.tenantId, [eintrag]);
    return views;
  }

  /**
   * Reichert mehrere Eintraege an: laedt einmalig je Tenant eine User-Map
   * (Vor- + Nachname) und Location-Map (analog zu listOverview in subscriptions).
   */
  private async decorateMany(tenantId: string, eintraege: TimeEntry[]): Promise<TimeEntryView[]> {
    if (eintraege.length === 0) return [];
    const [users, locations] = await Promise.all([
      this.userRepo.find({ where: { tenantId } }),
      this.locationRepo.find({ where: { tenantId } }),
    ]);
    const userById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const locationById = new Map(locations.map((l) => [l.id, l.name]));

    return eintraege.map((e) => ({
      ...e,
      mitarbeiterName: userById.get(e.userId) ?? 'Unbekannt',
      standortName: e.locationId ? locationById.get(e.locationId) ?? null : null,
    }));
  }
}
