import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratBild } from './entities/geraete-inserat-bild.entity';
import { GeraeteMeldungService } from './geraete-meldung.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { findOneScoped } from '../common/tenant/tenant-scope';
import { clampPageQuery, PaginatedResult } from '../common/util/pagination';
import {
  CreateInseratDto,
  UpdateInseratDto,
  UpdateInseratStatusDto,
  BrowseInseratDto,
} from './dto/inserat.dto';
import { SICHTBARE_STATUS, INSERAT_LAUFZEIT_TAGE } from './geraetemarkt.constants';

/**
 * Referenz auf ein Galerie-Bild (kontaktfrei). Nur `id` (fuer den auth
 * Bild-Stream) + `sortIndex` (Galerie-Reihenfolge) – KEINE Datei-/PII-Daten.
 */
export interface InseratBildRef {
  id: string;
  sortIndex: number;
}

/**
 * Oeffentliche (kontaktfreie) Projektion eines Inserats fuer Browse/Detail.
 * Enthaelt bewusst KEIN tenantId/userId/moderationStatus/updatedAt – die
 * Verkaeufer-Identitaet und der Kontakt werden erst in PR3 (Kontakt-Reveal)
 * offengelegt. `bilder` ist die kontaktfreie Galerie-Referenzliste (sortiert).
 */
export interface InseratPublicView {
  id: string;
  titel: string;
  beschreibung: string;
  kategorie: string;
  zustand: string;
  preis: number | null;
  preisModus: string;
  plzRegion: string | null;
  ort: string | null;
  status: string;
  createdAt: Date;
  ablaufAm: Date | null;
  bilder: InseratBildRef[];
}

/** Nur diese Spalten laedt der cross-tenant Browse (Projektion ohne PII). */
const PUBLIC_COLUMNS = [
  'id',
  'titel',
  'beschreibung',
  'kategorie',
  'zustand',
  'preis',
  'preisModus',
  'plzRegion',
  'ort',
  'status',
  'createdAt',
  'ablaufAm',
] as const;

@Injectable()
export class GeraetemarktService {
  constructor(
    @InjectRepository(GeraeteInserat) private readonly repo: Repository<GeraeteInserat>,
    private readonly audit: AuditService,
    private readonly meldungen: GeraeteMeldungService,
    @InjectRepository(GeraeteInseratBild)
    private readonly bildRepo: Repository<GeraeteInseratBild>,
  ) {}

  // ---------------------------------------------------------------------------
  // Mutationen (strikt {id, tenantId}-gescoped)
  // ---------------------------------------------------------------------------

  async create(user: AuthUser, dto: CreateInseratDto): Promise<GeraeteInserat> {
    const { gewerblichBestaetigt, ...rest } = dto;
    // Konsistenz preis/preisModus: bei 'anfrage' immer NULL, sonst Pflicht.
    const preis = this.normalisierePreis(rest.preisModus, rest.preis);

    const ablaufAm = new Date();
    ablaufAm.setDate(ablaufAm.getDate() + INSERAT_LAUFZEIT_TAGE);

    const inserat = this.repo.create({
      ...rest,
      preis,
      tenantId: user.tenantId,
      userId: user.id,
      status: 'aktiv',
      moderationStatus: 'ok',
      ablaufAm,
    });
    const saved = await this.repo.save(inserat);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'GeraeteInserat',
      entityId: saved.id,
    });
    // Weiche Chemie-Vorpruefung: markiert verdaechtige Inserate fuer die
    // Betreiber-Moderation, blockt aber NIE das Anlegen (best-effort).
    await this.meldungen.pruefeChemieVerdacht(saved);
    return saved;
  }

  async update(user: AuthUser, id: string, dto: UpdateInseratDto): Promise<GeraeteInserat> {
    const inserat = await findOneScoped(this.repo, user, id, 'Inserat nicht gefunden');
    Object.assign(inserat, dto);
    // Effektive Werte nach dem Merge pruefen (preisModus/preis koennen einzeln kommen).
    inserat.preis = this.normalisierePreis(inserat.preisModus, inserat.preis ?? undefined);
    const saved = await this.repo.save(inserat);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'GeraeteInserat',
      entityId: id,
    });
    return saved;
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    dto: UpdateInseratStatusDto,
  ): Promise<GeraeteInserat> {
    const inserat = await findOneScoped(this.repo, user, id, 'Inserat nicht gefunden');
    inserat.status = dto.status;
    const saved = await this.repo.save(inserat);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'GeraeteInserat',
      entityId: id,
      payload: { status: dto.status },
    });
    return saved;
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const inserat = await findOneScoped(this.repo, user, id, 'Inserat nicht gefunden');
    await this.repo.remove(inserat);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'GeraeteInserat',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Lesen
  // ---------------------------------------------------------------------------

  /** Eigene Inserate des Betriebs (voll, inkl. Status/Moderation). */
  async findMine(tenantId: string): Promise<GeraeteInserat[]> {
    // take: defensives Sicherheitsventil; ein Betrieb hat ueberschaubar viele Inserate.
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 1000 });
  }

  /**
   * Cross-tenant Browse: paginiert + gefiltert, nur SICHTBARE Inserate,
   * projiziert OHNE Kontakt/PII (kein tenantId/userId/moderationStatus).
   */
  async browse(query: BrowseInseratDto): Promise<PaginatedResult<InseratPublicView>> {
    const { page, limit, skip, take } = clampPageQuery(query, { defaultLimit: 24, maxLimit: 60 });

    const qb = this.repo
      .createQueryBuilder('i')
      .select(PUBLIC_COLUMNS.map((c) => `i.${c}`))
      // Sichtbarkeit: moderiert ok + aktiver/reservierter Status + nicht abgelaufen.
      .where('i.moderationStatus = :ok', { ok: 'ok' })
      .andWhere('i.status IN (:...sichtbar)', { sichtbar: SICHTBARE_STATUS })
      .andWhere('(i.ablaufAm IS NULL OR i.ablaufAm > :now)', { now: new Date() });

    if (query.kategorie) qb.andWhere('i.kategorie = :kategorie', { kategorie: query.kategorie });
    if (query.zustand) qb.andWhere('i.zustand = :zustand', { zustand: query.zustand });
    if (query.plzRegion) qb.andWhere('i.plzRegion = :plzRegion', { plzRegion: query.plzRegion });
    if (query.preisMin !== undefined) qb.andWhere('i.preis >= :preisMin', { preisMin: query.preisMin });
    if (query.preisMax !== undefined) qb.andWhere('i.preis <= :preisMax', { preisMax: query.preisMax });

    if (query.sort === 'preis_auf') qb.orderBy('i.preis', 'ASC');
    else if (query.sort === 'preis_ab') qb.orderBy('i.preis', 'DESC');
    else qb.orderBy('i.createdAt', 'DESC');

    qb.skip(skip).take(take);

    const [rows, total] = await qb.getManyAndCount();
    const views = rows.map((r) => this.toPublicView(r));
    // Bilder EINMAL sammeln (ueber alle Treffer der Seite) statt je Inserat -> kein N+1.
    const bilderMap = await this.ladeBilder(views.map((v) => v.id));
    for (const v of views) v.bilder = bilderMap.get(v.id) ?? [];
    return { data: views, total, page, limit };
  }

  /**
   * Detail: eigenes Inserat -> voll; fremdes -> nur wenn sichtbar, dann
   * projiziert ohne PII. Fremd+unsichtbar/fehlt -> 404 (kein Existenz-Orakel).
   */
  async findOnePublic(
    user: AuthUser,
    id: string,
  ): Promise<(GeraeteInserat & { bilder: InseratBildRef[] }) | InseratPublicView> {
    const inserat = await this.repo.findOne({ where: { id } });
    if (!inserat) throw new NotFoundException('Inserat nicht gefunden');
    const bilder = (await this.ladeBilder([inserat.id])).get(inserat.id) ?? [];
    // Eigenes Inserat: volle Sicht (Verkaeufer-Ansicht) + Galerie.
    if (inserat.tenantId === user.tenantId) return { ...inserat, bilder };
    // Fremdes Inserat: nur sichtbar herausgeben, sonst 404 (kein Existenz-Orakel).
    if (!this.istSichtbar(inserat)) throw new NotFoundException('Inserat nicht gefunden');
    const view = this.toPublicView(inserat);
    view.bilder = bilder;
    return view;
  }

  // ---------------------------------------------------------------------------
  // Helfer
  // ---------------------------------------------------------------------------

  /** bei 'anfrage' -> null; sonst muss ein Preis gesetzt sein (BadRequest). */
  private normalisierePreis(preisModus: string, preis: number | null | undefined): number | null {
    if (preisModus === 'anfrage') return null;
    if (preis === null || preis === undefined) {
      throw new BadRequestException('Bei Preis-Modus "fest"/"vb" ist ein Preis erforderlich');
    }
    return preis;
  }

  /**
   * Laedt die Galerie-Referenzen (id + sortIndex, sortiert) fuer eine Menge von
   * Inseraten in EINER Sammelabfrage (kein N+1). Select-Projektion: nur die
   * Galerie-Felder, KEINE Datei-Pfade/PII. Rueckgabe je inseratId gruppiert.
   */
  private async ladeBilder(inseratIds: string[]): Promise<Map<string, InseratBildRef[]>> {
    const map = new Map<string, InseratBildRef[]>();
    if (inseratIds.length === 0) return map;
    const bilder = await this.bildRepo.find({
      where: { inseratId: In(inseratIds) },
      select: { id: true, inseratId: true, sortIndex: true },
      order: { sortIndex: 'ASC' },
    });
    for (const b of bilder) {
      const liste = map.get(b.inseratId) ?? [];
      liste.push({ id: b.id, sortIndex: b.sortIndex });
      map.set(b.inseratId, liste);
    }
    return map;
  }

  private istSichtbar(i: GeraeteInserat): boolean {
    if (i.moderationStatus !== 'ok') return false;
    if (!SICHTBARE_STATUS.includes(i.status as (typeof SICHTBARE_STATUS)[number])) return false;
    if (i.ablaufAm && i.ablaufAm.getTime() <= Date.now()) return false;
    return true;
  }

  private toPublicView(i: GeraeteInserat): InseratPublicView {
    return {
      id: i.id,
      titel: i.titel,
      beschreibung: i.beschreibung,
      kategorie: i.kategorie,
      zustand: i.zustand,
      preis: i.preis,
      preisModus: i.preisModus,
      plzRegion: i.plzRegion,
      ort: i.ort,
      status: i.status,
      createdAt: i.createdAt,
      ablaufAm: i.ablaufAm,
      // Standard: leere Galerie; die Sammelabfrage (ladeBilder) fuellt sie nach.
      bilder: [],
    };
  }
}
