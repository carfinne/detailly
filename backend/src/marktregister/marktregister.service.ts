import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MarktBeobachtung,
  MARKT_KATEGORIEN,
  MARKT_PRIORITAETEN,
  MARKT_STATUS,
  type MarktKategorie,
  type MarktPrioritaet,
  type MarktStatus,
} from './entities/markt-beobachtung.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateMarktBeobachtungDto,
  UpdateMarktBeobachtungDto,
} from './dto/markt-beobachtung.dto';

export interface MarktListResult {
  data: MarktBeobachtung[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * MARKTRECHERCHE-REGISTER (Plattform-intern, NICHT mandantenscoped).
 *
 * BEWUSST OHNE Mandantenfilter: das Register ist plattformweit (die eine interne
 * Sicht des Detailly-Betreibers). Die Zugriffsgrenze ist der RolesGuard am
 * Controller (strikt PLATFORM_ADMIN) – NICHT ein tenantId. Jede Mutation wird
 * per AuditService protokolliert (Rechenschaft); die Audit-Zeile bucht auf den
 * Akteur-Tenant bzw. 'platform' (null-sicher), Muster wie im Betreiber-Cockpit.
 *
 * NEUTRALITAET: Der Service speichert/liest nur die vom Betreiber selbst
 * eingetragenen sachlichen Freitexte + Metadaten. Es wird nichts automatisch
 * generiert und kein Wettbewerber bewertet/herabgesetzt.
 */
@Injectable()
export class MarktregisterService {
  constructor(
    @InjectRepository(MarktBeobachtung)
    private readonly repo: Repository<MarktBeobachtung>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Liste plattformweit (NICHT tenant-scoped), neueste zuerst. Optional gefiltert
   * nach status/kategorie/prioritaet – jeweils nur bei gueltigem Wert (ungueltige
   * Filter werden ignoriert, kein Fehler). Limit hart gedeckelt (1..100).
   */
  async list(params: {
    status?: string;
    kategorie?: string;
    prioritaet?: string;
    limit?: string;
    offset?: string;
  }): Promise<MarktListResult> {
    const limit = clampLimit(params.limit, 25, 100);
    const offset = clampOffset(params.offset);

    const where: Record<string, unknown> = {};
    if (params.status && (MARKT_STATUS as readonly string[]).includes(params.status)) {
      where.status = params.status as MarktStatus;
    }
    if (params.kategorie && (MARKT_KATEGORIEN as readonly string[]).includes(params.kategorie)) {
      where.kategorie = params.kategorie as MarktKategorie;
    }
    if (params.prioritaet && (MARKT_PRIORITAETEN as readonly string[]).includes(params.prioritaet)) {
      where.prioritaet = params.prioritaet as MarktPrioritaet;
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async create(user: AuthUser, dto: CreateMarktBeobachtungDto): Promise<MarktBeobachtung> {
    const eintrag = this.repo.create({
      wettbewerber: dto.wettbewerber,
      kategorie: dto.kategorie,
      beobachtung: dto.beobachtung,
      quelleUrl: dto.quelleUrl ?? null,
      beobachtetAm: dto.beobachtetAm,
      abgeleiteteIdee: dto.abgeleiteteIdee,
      status: dto.status ?? 'neu',
      prioritaet: dto.prioritaet ?? 'mittel',
      erstelltVonUserId: user?.id ?? null,
    });
    const saved = await this.repo.save(eintrag);
    await this.logMutation(user, 'create', saved.id);
    return saved;
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateMarktBeobachtungDto,
  ): Promise<MarktBeobachtung> {
    const eintrag = await this.getOrThrow(id);
    // Nur uebergebene Felder anwenden; quelleUrl darf explizit auf leer gesetzt
    // werden (leerer String -> null), erstelltVonUserId bleibt unberuehrt.
    if (dto.wettbewerber !== undefined) eintrag.wettbewerber = dto.wettbewerber;
    if (dto.kategorie !== undefined) eintrag.kategorie = dto.kategorie;
    if (dto.beobachtung !== undefined) eintrag.beobachtung = dto.beobachtung;
    if (dto.quelleUrl !== undefined) eintrag.quelleUrl = dto.quelleUrl || null;
    if (dto.beobachtetAm !== undefined) eintrag.beobachtetAm = dto.beobachtetAm;
    if (dto.abgeleiteteIdee !== undefined) eintrag.abgeleiteteIdee = dto.abgeleiteteIdee;
    if (dto.status !== undefined) eintrag.status = dto.status;
    if (dto.prioritaet !== undefined) eintrag.prioritaet = dto.prioritaet;

    const saved = await this.repo.save(eintrag);
    await this.logMutation(user, 'update', id);
    return saved;
  }

  async setStatus(user: AuthUser, id: string, status: MarktStatus): Promise<MarktBeobachtung> {
    const eintrag = await this.getOrThrow(id);
    eintrag.status = status;
    const saved = await this.repo.save(eintrag);
    await this.logMutation(user, 'update.status', id, { status });
    return saved;
  }

  async setPrioritaet(
    user: AuthUser,
    id: string,
    prioritaet: MarktPrioritaet,
  ): Promise<MarktBeobachtung> {
    const eintrag = await this.getOrThrow(id);
    eintrag.prioritaet = prioritaet;
    const saved = await this.repo.save(eintrag);
    await this.logMutation(user, 'update.prioritaet', id, { prioritaet });
    return saved;
  }

  /**
   * Echtes Loeschen ist hier zulaessig: interne Betreiber-Notizen, KEINE
   * GoBD-/DSGVO-relevanten Daten (kein Kundenbezug). Die Aktion wird auditiert.
   */
  async remove(user: AuthUser, id: string): Promise<{ success: true }> {
    const eintrag = await this.getOrThrow(id);
    await this.repo.remove(eintrag);
    await this.logMutation(user, 'delete', id);
    return { success: true };
  }

  private async getOrThrow(id: string): Promise<MarktBeobachtung> {
    const eintrag = await this.repo.findOne({ where: { id } });
    if (!eintrag) throw new NotFoundException('Marktbeobachtung nicht gefunden');
    return eintrag;
  }

  /**
   * Rechenschaft je Mutation. Plattformweit -> keine tenantId; wir buchen auf den
   * Akteur-Tenant bzw. 'platform' (null-sicher), Muster wie im Betreiber-Cockpit.
   */
  private async logMutation(
    user: AuthUser,
    action: string,
    entityId: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.log({
      tenantId: user?.tenantId || 'platform',
      userId: user?.id,
      action: `marktregister.${action}`,
      entityType: 'MarktBeobachtung',
      entityId,
      payload,
    });
  }
}

// --- Hilfen -----------------------------------------------------------------

function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(1, n), max);
}

function clampOffset(raw: string | undefined): number {
  const n = raw != null ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return 0;
  return Math.max(0, n);
}
