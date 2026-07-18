import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratMeldung } from './entities/geraete-inserat-meldung.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { clampPageQuery, PaginatedResult } from '../common/util/pagination';
import {
  MeldungenQueryDto,
  ModerationInserateQueryDto,
  ModerationInseratDto,
  UpdateMeldungDto,
} from './dto/meldung.dto';

/** Kurz-Projektion des Inserats fuer die Meldungs-Queue (Betreiber-Sicht). */
export interface MeldungMitInserat {
  meldung: GeraeteInseratMeldung;
  inserat: {
    id: string;
    tenantId: string;
    titel: string;
    status: string;
    moderationStatus: string;
  } | null;
}

/**
 * Betreiber-Moderation des Geraetemarkts (PR3). Plattformweit – BEWUSST OHNE
 * tenantId-Scope (der Betreiber ist nicht mandantengebunden). Der Rollenschutz
 * (nur PLATFORM_*) sitzt ausschliesslich im Controller (JwtAuthGuard+RolesGuard).
 *
 * Jede Mutation wird auditiert – bewusst unter der tenantId des BETROFFENEN
 * Inserats (userId = Moderator), damit der betroffene Betrieb die Massnahme in
 * seiner eigenen Audit-Historie sieht.
 */
@Injectable()
export class GeraeteModerationService {
  constructor(
    @InjectRepository(GeraeteInserat)
    private readonly inseratRepo: Repository<GeraeteInserat>,
    @InjectRepository(GeraeteInseratMeldung)
    private readonly meldungRepo: Repository<GeraeteInseratMeldung>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Meldungs-Queue (paginiert). Default nur offene Meldungen. Zu jeder Meldung
   * wird der Inseratbezug (id/tenant/titel/status/moderation) mitgeliefert.
   */
  async listMeldungen(
    query: MeldungenQueryDto,
  ): Promise<PaginatedResult<MeldungMitInserat>> {
    const { page, limit, skip, take } = clampPageQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const status = query.status ?? 'offen';

    const [meldungen, total] = await this.meldungRepo.findAndCount({
      where: { status },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    const inseratIds = [...new Set(meldungen.map((m) => m.inseratId))];
    const inserate = inseratIds.length
      ? await this.inseratRepo.find({ where: { id: In(inseratIds) } })
      : [];
    const byId = new Map(inserate.map((i) => [i.id, i]));

    const data: MeldungMitInserat[] = meldungen.map((meldung) => {
      const i = byId.get(meldung.inseratId);
      return {
        meldung,
        inserat: i
          ? {
              id: i.id,
              tenantId: i.tenantId,
              titel: i.titel,
              status: i.status,
              moderationStatus: i.moderationStatus,
            }
          : null,
      };
    });

    return { data, total, page, limit };
  }

  /**
   * Alle Inserate fuer die Moderation (INKL. verborgene/entfernte), paginiert und
   * optional nach moderationStatus gefiltert. Volle Entity (Betreiber-Sicht).
   */
  async listInserate(
    query: ModerationInserateQueryDto,
  ): Promise<PaginatedResult<GeraeteInserat>> {
    const { page, limit, skip, take } = clampPageQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const where = query.moderationStatus ? { moderationStatus: query.moderationStatus } : {};

    const [data, total] = await this.inseratRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, page, limit };
  }

  /**
   * Setzt den Moderations-Status eines Inserats (ok/verborgen/entfernt).
   * „verborgen"/„entfernt" nimmt das Inserat sofort aus dem cross-tenant Browse
   * (dort gilt moderationStatus=ok). Audit unter der tenantId des Inserats.
   */
  async moderateInserat(
    moderator: AuthUser,
    id: string,
    dto: ModerationInseratDto,
  ): Promise<GeraeteInserat> {
    const inserat = await this.inseratRepo.findOne({ where: { id } });
    if (!inserat) throw new NotFoundException('Inserat nicht gefunden');

    inserat.moderationStatus = dto.moderationStatus;
    const saved = await this.inseratRepo.save(inserat);

    await this.audit.log({
      tenantId: inserat.tenantId,
      userId: moderator.id,
      action: 'moderation',
      entityType: 'GeraeteInserat',
      entityId: id,
      payload: { moderationStatus: dto.moderationStatus, vermerk: dto.vermerk },
    });
    return saved;
  }

  /**
   * Schliesst eine Meldung ab (erledigt) oder verwirft sie (verworfen). Audit
   * unter der tenantId des betroffenen Inserats (userId = Moderator).
   */
  async updateMeldung(
    moderator: AuthUser,
    id: string,
    dto: UpdateMeldungDto,
  ): Promise<GeraeteInseratMeldung> {
    const meldung = await this.meldungRepo.findOne({ where: { id } });
    if (!meldung) throw new NotFoundException('Meldung nicht gefunden');

    meldung.status = dto.status;
    meldung.bearbeitetVonUserId = moderator.id;
    meldung.bearbeitetAm = new Date();
    const saved = await this.meldungRepo.save(meldung);

    const inserat = await this.inseratRepo.findOne({ where: { id: meldung.inseratId } });
    await this.audit.log({
      // Falls das Inserat schon geloescht wurde, faellt der Audit auf die
      // melderTenantId zurueck (nie ohne tenantId protokollieren).
      tenantId: inserat?.tenantId ?? meldung.melderTenantId,
      userId: moderator.id,
      action: 'meldung_bearbeitet',
      entityType: 'GeraeteInseratMeldung',
      entityId: id,
      payload: { status: dto.status, inseratId: meldung.inseratId },
    });
    return saved;
  }
}
