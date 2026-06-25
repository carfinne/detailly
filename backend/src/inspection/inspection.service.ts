import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DamageInspection } from './entities/damage-inspection.entity';
import { DamageItem } from './entities/damage-item.entity';
import { DamagePhoto } from './entities/damage-photo.entity';
import { DamageItemPhoto } from './entities/damage-item-photo.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { CreateDamageItemDto } from './dto/create-damage-item.dto';
import { UpdateDamageItemDto } from './dto/update-damage-item.dto';
import { CreateDamagePhotoDto } from './dto/create-damage-photo.dto';
import { LinkPhotosDto } from './dto/link-photos.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertRefInTenant,
  findOneScoped,
  scopedQuery,
  withTenant,
} from '../common/tenant/tenant-scope';

/** Filter fuer die Inspektions-Liste. */
export interface InspectionListFilter {
  orderId?: string;
  vehicleId?: string;
  typ?: string;
  status?: string;
}

/**
 * Verwaltet 3D-Schadensinspektionen, ihre Schaeden und Foto-Metadaten.
 *
 * Mandantentrennung (PFLICHT, sicherheitskritisch):
 * - `withTenant()` setzt tenantId beim Anlegen aus dem Nutzer, nie aus dem Body.
 * - `findOneScoped()` fuer JEDEN Lookup einer eigenen Entity.
 * - `assertRefInTenant()` fuer JEDE Fremd-ID VOR dem Speichern
 *   (customerId/vehicleId/orderId, inspectionId, photoId).
 */
@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(DamageInspection)
    private readonly inspectionRepo: Repository<DamageInspection>,
    @InjectRepository(DamageItem)
    private readonly itemRepo: Repository<DamageItem>,
    @InjectRepository(DamagePhoto)
    private readonly photoRepo: Repository<DamagePhoto>,
    @InjectRepository(DamageItemPhoto)
    private readonly itemPhotoRepo: Repository<DamageItemPhoto>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Inspektionen
  // ---------------------------------------------------------------------------

  /** Listet Inspektionen des eigenen Betriebs mit optionalen Filtern. */
  async findAllInspections(
    user: AuthUser,
    filter: InspectionListFilter = {},
  ): Promise<DamageInspection[]> {
    const qb = scopedQuery(this.inspectionRepo, user, 'i');
    if (filter.orderId) qb.andWhere('i.orderId = :orderId', { orderId: filter.orderId });
    if (filter.vehicleId) qb.andWhere('i.vehicleId = :vehicleId', { vehicleId: filter.vehicleId });
    if (filter.typ) qb.andWhere('i.typ = :typ', { typ: filter.typ });
    if (filter.status) qb.andWhere('i.status = :status', { status: filter.status });
    return qb.orderBy('i.createdAt', 'DESC').getMany();
  }

  /**
   * Einzelne Inspektion inkl. Schaeden + Fotos (tenant-scoped). Jeder Schaden
   * traegt zusaetzlich seine verknuepften Fotos (`photos`), aufgeloest ueber die
   * DamageItemPhoto-Join-Tabelle – so kann die UI Fotos je Schaden anzeigen.
   */
  async findOneInspection(
    user: AuthUser,
    id: string,
  ): Promise<
    DamageInspection & {
      items: (DamageItem & { photos: DamagePhoto[] })[];
      photos: DamagePhoto[];
    }
  > {
    const inspection = await findOneScoped(
      this.inspectionRepo,
      user,
      id,
      'Inspektion nicht gefunden',
    );
    const [items, photos] = await Promise.all([
      this.itemRepo.find({
        where: { tenantId: user.tenantId, inspectionId: id },
        order: { createdAt: 'ASC' },
      }),
      this.photoRepo.find({
        where: { tenantId: user.tenantId, inspectionId: id },
        order: { reihenfolge: 'ASC', createdAt: 'ASC' },
      }),
    ]);

    // Item<->Foto-Verknuepfungen laden und je Schaden seine Fotos anhaengen.
    const itemIds = items.map((it) => it.id);
    const links = itemIds.length
      ? await this.itemPhotoRepo.find({
          where: { tenantId: user.tenantId, damageItemId: In(itemIds) },
        })
      : [];
    const photoById = new Map(photos.map((p) => [p.id, p]));
    const fotosProItem = new Map<string, DamagePhoto[]>();
    for (const link of links) {
      const foto = photoById.get(link.photoId);
      if (!foto) continue;
      const liste = fotosProItem.get(link.damageItemId) ?? [];
      liste.push(foto);
      fotosProItem.set(link.damageItemId, liste);
    }
    const itemsMitFotos = items.map((it) => ({
      ...it,
      photos: fotosProItem.get(it.id) ?? [],
    }));

    return { ...inspection, items: itemsMitFotos, photos };
  }

  /**
   * Legt eine Inspektion an. Bei typ='ausgang' + previousInspectionId werden
   * alle DamageItem der Vor-Inspektion als origin='vorschaden', istUebernommen=true,
   * carriedFromItemId=<alte id> kopiert (Carry-over-Mechanik).
   */
  async createInspection(user: AuthUser, dto: CreateInspectionDto): Promise<DamageInspection> {
    // Jede Fremd-ID VOR dem Speichern tenant-validieren.
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    // previousInspectionId gegen das eigene inspectionRepo (nicht aus dem Body uebernehmen).
    const previous = await assertRefInTenant(
      this.inspectionRepo,
      user,
      dto.previousInspectionId,
      'Vor-Inspektion',
    );
    // Carry-over nur, wenn die Vor-Inspektion denselben Kunden betrifft – sonst
    // wuerden Vorschaeden eines fremden Kunden (gleicher Mandant) kopiert.
    if (dto.typ === 'ausgang' && previous && previous.customerId !== dto.customerId) {
      throw new BadRequestException('Die Vor-Inspektion gehört zu einem anderen Kunden.');
    }

    const inspection = this.inspectionRepo.create(
      withTenant(user, {
        // id nur uebernehmen, wenn client-seitig vorgegeben (Offline-Idempotenz).
        ...(dto.id ? { id: dto.id } : {}),
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        orderId: dto.orderId,
        typ: dto.typ,
        previousInspectionId: dto.previousInspectionId,
        modelKey: dto.modelKey,
        kmStand: dto.kmStand,
        tankstand: dto.tankstand,
        notiz: dto.notiz,
        erfasstVonUserId: user.id,
        erfasstVonRolle: user.role,
        clientUuid: dto.clientUuid,
      }),
    );
    const saved = await this.inspectionRepo.save(inspection);

    let carriedCount = 0;
    if (dto.typ === 'ausgang' && previous) {
      carriedCount = await this.carryOverItems(user, previous.id, saved.id);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'DamageInspection',
      entityId: saved.id,
      payload: { typ: saved.typ, carriedItems: carriedCount },
    });
    return saved;
  }

  /** Teil-Aktualisierung einer Inspektion (tenant-scoped). */
  async updateInspection(
    user: AuthUser,
    id: string,
    dto: UpdateInspectionDto,
  ): Promise<DamageInspection> {
    const inspection = await findOneScoped(
      this.inspectionRepo,
      user,
      id,
      'Inspektion nicht gefunden',
    );
    if (dto.kmStand !== undefined) inspection.kmStand = dto.kmStand;
    if (dto.tankstand !== undefined) inspection.tankstand = dto.tankstand;
    if (dto.status !== undefined) inspection.status = dto.status;
    if (dto.modelKey !== undefined) inspection.modelKey = dto.modelKey;
    if (dto.notiz !== undefined) inspection.notiz = dto.notiz;

    const saved = await this.inspectionRepo.save(inspection);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'DamageInspection',
      entityId: saved.id,
      payload: dto as Record<string, unknown>,
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Schaeden (DamageItem)
  // ---------------------------------------------------------------------------

  /** Listet Schaeden einer Inspektion, optional nach origin gefiltert. */
  async findItems(user: AuthUser, inspectionId: string, origin?: string): Promise<DamageItem[]> {
    // Sicherstellen, dass die Inspektion zum Betrieb gehoert (kein Fremdzugriff).
    await findOneScoped(this.inspectionRepo, user, inspectionId, 'Inspektion nicht gefunden');
    const qb = scopedQuery(this.itemRepo, user, 'd').andWhere('d.inspectionId = :inspectionId', {
      inspectionId,
    });
    if (origin) qb.andWhere('d.origin = :origin', { origin });
    return qb.orderBy('d.createdAt', 'ASC').getMany();
  }

  /**
   * Legt einen Schaden an einer Inspektion an. inspectionId wird tenant-validiert.
   * Optional uebergebene photoIds[] werden als n:m-Join-Rows angelegt
   * (jede photoId vorab tenant-validiert).
   */
  async createItem(
    user: AuthUser,
    inspectionId: string,
    dto: CreateDamageItemDto,
  ): Promise<DamageItem> {
    // inspectionId gegen das eigene inspectionRepo validieren.
    await assertRefInTenant(this.inspectionRepo, user, inspectionId, 'Inspektion');
    // Jede photoId VOR dem Speichern tenant-validieren.
    if (dto.photoIds?.length) {
      for (const photoId of dto.photoIds) {
        await assertRefInTenant(this.photoRepo, user, photoId, 'Foto');
      }
    }

    const item = this.itemRepo.create(
      withTenant(user, {
        ...(dto.id ? { id: dto.id } : {}),
        inspectionId,
        partId: dto.partId,
        partLabel: dto.partLabel,
        positionMode: dto.positionMode,
        position3d: dto.position3d ?? null,
        ansicht2d: dto.ansicht2d,
        x2d: dto.x2d,
        y2d: dto.y2d,
        origin: dto.origin,
        art: dto.art,
        schweregrad: dto.schweregrad,
        groesseLaengeMm: dto.groesseLaengeMm,
        groesseBreiteMm: dto.groesseBreiteMm,
        ausmass: dto.ausmass,
        reparaturart: dto.reparaturart,
        kostenSchaetzung: dto.kostenSchaetzung,
        notiz: dto.notiz,
        clientUuid: dto.clientUuid,
      }),
    );
    const saved = await this.itemRepo.save(item);

    if (dto.photoIds?.length) {
      await this.linkPhotosToItem(user, saved.id, dto.photoIds);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'DamageItem',
      entityId: saved.id,
      payload: { inspectionId, origin: saved.origin, art: saved.art, partId: saved.partId },
    });
    return saved;
  }

  /** Teil-Aktualisierung eines Schadens (tenant-scoped). */
  async updateItem(user: AuthUser, id: string, dto: UpdateDamageItemDto): Promise<DamageItem> {
    const item = await findOneScoped(this.itemRepo, user, id, 'Schaden nicht gefunden');
    if (dto.art !== undefined) item.art = dto.art;
    if (dto.schweregrad !== undefined) item.schweregrad = dto.schweregrad;
    if (dto.origin !== undefined) item.origin = dto.origin;
    if (dto.status !== undefined) item.status = dto.status;
    if (dto.reparaturart !== undefined) item.reparaturart = dto.reparaturart;
    if (dto.groesseLaengeMm !== undefined) item.groesseLaengeMm = dto.groesseLaengeMm;
    if (dto.groesseBreiteMm !== undefined) item.groesseBreiteMm = dto.groesseBreiteMm;
    if (dto.ausmass !== undefined) item.ausmass = dto.ausmass;
    if (dto.kostenSchaetzung !== undefined) item.kostenSchaetzung = dto.kostenSchaetzung;
    if (dto.behobenBeiAusgang !== undefined) item.behobenBeiAusgang = dto.behobenBeiAusgang;
    if (dto.notiz !== undefined) item.notiz = dto.notiz;

    const saved = await this.itemRepo.save(item);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'DamageItem',
      entityId: saved.id,
      payload: dto as Record<string, unknown>,
    });
    return saved;
  }

  /** Loescht einen Schaden (tenant-scoped) inkl. seiner Foto-Zuordnungen. */
  async deleteItem(user: AuthUser, id: string): Promise<{ deleted: true }> {
    const item = await findOneScoped(this.itemRepo, user, id, 'Schaden nicht gefunden');
    await this.itemPhotoRepo.delete({ tenantId: user.tenantId, damageItemId: item.id });
    await this.itemRepo.remove(item);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'DamageItem',
      entityId: id,
      payload: { inspectionId: item.inspectionId },
    });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Fotos (Metadaten) + n:m-Zuordnung
  // ---------------------------------------------------------------------------

  /**
   * Phase 1: Foto-Upload. `dto.bild` ist eine Data-URL (Muster wie
   * Orders.uploadFotos): validieren, Groesse begrenzen, als Datei unter
   * uploads/inspections/<tenantId>/ ablegen und pfad selbst setzen. Optional
   * direkt an einen Schaden gehaengt (damageItemId tenant-validiert ->
   * DamageItemPhoto-Row). Thumbnails/EXIF (sharp) folgen im Feinschliff.
   */
  async createPhoto(
    user: AuthUser,
    inspectionId: string,
    dto: CreateDamagePhotoDto,
  ): Promise<DamagePhoto> {
    await assertRefInTenant(this.inspectionRepo, user, inspectionId, 'Inspektion');
    // damageItemId optional, aber falls gesetzt: tenant-validieren.
    await assertRefInTenant(this.itemRepo, user, dto.damageItemId, 'Schaden');

    // Data-URL validieren + Datei schreiben. Tenant-Ordner, damit Fotos
    // verschiedener Mandanten physisch getrennt liegen.
    const pfad = await this.speichereBild(user.tenantId, inspectionId, dto.bild);

    const photo = this.photoRepo.create(
      withTenant(user, {
        inspectionId,
        pfad,
        thumbnailPfad: pfad, // Rohling: noch kein eigenes Thumbnail (sharp = Feinschliff)
        partId: dto.partId,
        kategorie: dto.kategorie ?? 'detail',
        reihenfolge: dto.reihenfolge,
        clientUuid: dto.clientUuid,
      }),
    );
    const saved = await this.photoRepo.save(photo);

    if (dto.damageItemId) {
      await this.linkPhotosToItem(user, dto.damageItemId, [saved.id]);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'DamagePhoto',
      entityId: saved.id,
      payload: { inspectionId, damageItemId: dto.damageItemId ?? null },
    });
    return saved;
  }

  /**
   * Schreibt eine Bild-Data-URL als Datei unter private-uploads/inspections/<tenantId>/.
   * Dieses Verzeichnis ist BEWUSST NICHT statisch gemountet (FIX 2/DSGVO) – Fotos
   * sind nur ueber den guard-geschuetzten InspectionPhotoController abrufbar.
   * Validiert Format und begrenzt die Groesse. Bewusst ohne sharp (= Feinschliff).
   */
  private async speichereBild(
    tenantId: string,
    inspectionId: string,
    datenUrl: string,
  ): Promise<string> {
    const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(datenUrl ?? '');
    if (!match) {
      throw new BadRequestException('Ungültiges Bildformat (nur PNG/JPG/WebP als Data-URL).');
    }
    const endung = match[1] === 'jpeg' ? 'jpg' : match[1];
    const inhalt = Buffer.from(match[2], 'base64');
    // Groesse begrenzen (max. 8 MB je Bild) – schuetzt vor Speicher-Missbrauch.
    if (inhalt.byteLength > 8 * 1024 * 1024) {
      throw new BadRequestException('Bild zu groß (max. 8 MB).');
    }
    const unterordner = join('inspections', tenantId);
    // private-uploads/ ist NICHT statisch gemountet -> kein oeffentlicher Zugriff.
    const zielVerzeichnis = join(process.cwd(), 'private-uploads', unterordner);
    await fs.mkdir(zielVerzeichnis, { recursive: true });
    const dateiname = `${inspectionId}_${randomUUID()}.${endung}`;
    await fs.writeFile(join(zielVerzeichnis, dateiname), inhalt);
    // Logischer Pfad (NICHT web-abrufbar). Auslieferung nur ueber den Guard-Endpoint
    // GET /api/v1/inspections/photos/:id; dort wird nur der Dateiname (basename) genutzt.
    return `/private-uploads/${unterordner.replace(/\\/g, '/')}/${dateiname}`;
  }

  /**
   * n:m-Mehrfachzuordnung mehrerer Fotos zu einem Schaden in einem Call.
   * damageItemId + jede photoId werden tenant-validiert; bestehende
   * Zuordnungen idempotent uebersprungen.
   */
  async linkPhotos(
    user: AuthUser,
    damageItemId: string,
    dto: LinkPhotosDto,
  ): Promise<DamageItemPhoto[]> {
    await assertRefInTenant(this.itemRepo, user, damageItemId, 'Schaden');
    // Hauptfoto muss Teil der zugeordneten Fotos sein (lokale Kopie, kein DTO-Seiteneffekt).
    const ids =
      dto.hauptfotoId && !dto.photoIds.includes(dto.hauptfotoId)
        ? [...dto.photoIds, dto.hauptfotoId]
        : dto.photoIds;
    const links = await this.linkPhotosToItem(user, damageItemId, ids, dto.hauptfotoId);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'link',
      entityType: 'DamageItemPhoto',
      entityId: damageItemId,
      payload: { photoIds: dto.photoIds },
    });
    return links;
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  /**
   * Verknuepft Fotos n:m mit einem Schaden. Jede photoId wird tenant-validiert.
   * Bereits bestehende Zuordnungen werden uebersprungen (idempotent, Unique-Index).
   */
  private async linkPhotosToItem(
    user: AuthUser,
    damageItemId: string,
    photoIds: string[],
    hauptfotoId?: string,
  ): Promise<DamageItemPhoto[]> {
    const result: DamageItemPhoto[] = [];
    for (const photoId of photoIds) {
      await assertRefInTenant(this.photoRepo, user, photoId, 'Foto');
      const existing = await this.itemPhotoRepo.findOne({
        where: { tenantId: user.tenantId, damageItemId, photoId },
      });
      if (existing) {
        result.push(existing);
        continue;
      }
      const link = this.itemPhotoRepo.create(
        withTenant(user, {
          damageItemId,
          photoId,
          istHauptfoto: hauptfotoId === photoId,
        }),
      );
      result.push(await this.itemPhotoRepo.save(link));
    }
    return result;
  }

  /**
   * Carry-over: kopiert alle Schaeden der Vor-Inspektion in die neue
   * (Ausgangs-)Inspektion als origin='vorschaden', istUebernommen=true,
   * carriedFromItemId=<alte id>. Liefert die Anzahl uebernommener Schaeden.
   */
  private async carryOverItems(
    user: AuthUser,
    previousInspectionId: string,
    newInspectionId: string,
  ): Promise<number> {
    const previousItems = await this.itemRepo.find({
      where: { tenantId: user.tenantId, inspectionId: previousInspectionId },
      order: { createdAt: 'ASC' },
    });
    const copies = previousItems.map((src) =>
      this.itemRepo.create(
        withTenant(user, {
          inspectionId: newInspectionId,
          partId: src.partId,
          partLabel: src.partLabel,
          positionMode: src.positionMode,
          position3d: src.position3d,
          ansicht2d: src.ansicht2d,
          x2d: src.x2d,
          y2d: src.y2d,
          origin: 'vorschaden' as const,
          art: src.art,
          schweregrad: src.schweregrad,
          groesseLaengeMm: src.groesseLaengeMm,
          groesseBreiteMm: src.groesseBreiteMm,
          ausmass: src.ausmass,
          reparaturart: src.reparaturart,
          status: 'uebernommen' as const,
          kostenSchaetzung: src.kostenSchaetzung,
          notiz: src.notiz,
          carriedFromItemId: src.id,
          istUebernommen: true,
        }),
      ),
    );
    if (copies.length) await this.itemRepo.save(copies);
    return copies.length;
  }
}
