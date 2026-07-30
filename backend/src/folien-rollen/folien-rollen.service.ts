import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolienRolle, FolienRolleStatus } from './entities/folien-rolle.entity';
import { Product } from '../shop/entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant, findOneScoped } from '../common/tenant/tenant-scope';
import { CreateFolienRolleDto, UpdateFolienRolleDto } from './dto/folien-rolle.dto';

/**
 * Restrollen-Register der Werkstatt. Entkoppelt vom Produkt-`bestand`
 * (siehe FolienRolle-Entity). Alle Zugriffe sind tenant-gebunden
 * (Mandantentrennung).
 */
@Injectable()
export class FolienRollenService {
  constructor(
    @InjectRepository(FolienRolle) private readonly repo: Repository<FolienRolle>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly audit: AuditService,
  ) {}

  /** Restrollen des Betriebs, optional nach Produkt/Status gefiltert (neueste zuerst). */
  async findAll(
    tenantId: string,
    filter: { productId?: string; status?: FolienRolleStatus } = {},
  ): Promise<FolienRolle[]> {
    const where: Record<string, unknown> = { tenantId };
    if (filter.productId) where.productId = filter.productId;
    if (filter.status) where.status = filter.status;
    // take: defensives Sicherheitsventil (T-009) - Restrollen bleiben ueberschaubar.
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 1000 });
  }

  /**
   * Restrollen-Matcher (Welle 2-D): passende Reste fuer einen Materialbedarf.
   * Nur EIGENE (tenant-scoped), nur VERFUEGBAR und nur zur gewaehlten Folie
   * (productId) – dadurch stimmen Breite UND Farbe/Serie automatisch, weil die
   * FolienRolle Breite/Farbe aus ihrem Produkt ableitet (die Entity fuehrt keine
   * eigene Breite). Gefiltert auf restLfm >= benoetigtLfm; sortiert der KNAPPSTE
   * passende Rest zuerst (Verschnitt minimieren).
   *
   * Filter/Sort bewusst IN MEMORY statt im SQL-WHERE: SQLite speichert decimal
   * (restLfm) als String -> ein `MoreThanOrEqual` vergliche lexikografisch
   * ("9" > "10") und liefe damit falsch. Die Menge verfuegbarer Reste je Folie
   * ist klein, der In-Memory-Schritt also unkritisch. Ohne productId oder ohne
   * plausiblen Bedarf (<= 0) gibt es keinen Treffer -> leere Liste.
   */
  async findPassend(
    tenantId: string,
    opts: { productId?: string; benoetigtLfm?: number } = {},
  ): Promise<FolienRolle[]> {
    const productId = opts.productId?.trim();
    const benoetigt = Number(opts.benoetigtLfm);
    if (!productId || !Number.isFinite(benoetigt) || benoetigt <= 0) return [];
    const kandidaten = await this.repo.find({
      where: { tenantId, productId, status: FolienRolleStatus.VERFUEGBAR },
      take: 1000,
    });
    return kandidaten
      .filter((r) => Number(r.restLfm) >= benoetigt)
      .sort((a, b) => Number(a.restLfm) - Number(b.restLfm));
  }

  async create(user: AuthUser, dto: CreateFolienRolleDto): Promise<FolienRolle> {
    // Optionaler Produktbezug muss zum eigenen Betrieb gehoeren (Cross-Tenant-Schutz).
    await assertRefInTenant(this.productRepo, user, dto.productId, 'Produkt');
    const rolle = this.repo.create({ ...dto, tenantId: user.tenantId });
    const saved = await this.repo.save(rolle);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'FolienRolle',
      entityId: saved.id,
    });
    return saved;
  }

  async update(user: AuthUser, id: string, dto: UpdateFolienRolleDto): Promise<FolienRolle> {
    const rolle = await findOneScoped(this.repo, user, id, 'Restrolle nicht gefunden');
    Object.assign(rolle, dto);
    const saved = await this.repo.save(rolle);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'FolienRolle',
      entityId: id,
    });
    return saved;
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    // Hartes Loeschen ist Leitung-only (Controller): fuer Tippfehler. Regulaeres
    // Abschreiben laeuft ueber status=ENTSORGT, damit der Schwund sichtbar bleibt.
    const rolle = await findOneScoped(this.repo, user, id, 'Restrolle nicht gefunden');
    await this.repo.remove(rolle);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'FolienRolle',
      entityId: id,
    });
    return { success: true };
  }
}
