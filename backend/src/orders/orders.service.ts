import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { CreateOrderDto, UpdateOrderDto, OrderItemDto } from './dto/order.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { nextSequentialNumber } from '../common/numbering';

const MWST_SATZ = 0.19;

/** Obergrenze Fotos je Auftrag (Vorher+Nachher) gegen Disk-Abuse. */
const MAX_FOTOS_PRO_AUFTRAG = 40;

/**
 * Prueft, ob die DEKODIERTEN Bytes wirklich zum behaupteten Bildtyp passen
 * (Magic Number), statt nur dem Data-URL-Praefix zu vertrauen. Verhindert, dass
 * Nicht-Bild-Inhalte (z. B. HTML/SVG -> Sniff-XSS) mit Bild-Endung gespeichert
 * werden. `typ` ist die normalisierte Endung ('png'|'jpg'|'webp'|'gif').
 */
export function istBildMitMagic(buf: Buffer, typ: string): boolean {
  if (buf.length < 12) return false;
  switch (typ) {
    case 'png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case 'jpg':
    case 'jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'gif':
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38; // "GIF8"
    case 'webp':
      // "RIFF" .... "WEBP"
      return (
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
      );
    default:
      return false;
  }
}

/** Erlaubte Statusuebergaenge im Auftrags-Workflow. */
const STATUS_UEBERGAENGE: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.ANGEFRAGT]: [OrderStatus.KALKULIERT, OrderStatus.STORNIERT],
  [OrderStatus.KALKULIERT]: [OrderStatus.BESTAETIGT, OrderStatus.STORNIERT],
  [OrderStatus.BESTAETIGT]: [OrderStatus.IN_ARBEIT, OrderStatus.STORNIERT],
  [OrderStatus.IN_ARBEIT]: [OrderStatus.QUALITAETSKONTROLLE, OrderStatus.STORNIERT],
  [OrderStatus.QUALITAETSKONTROLLE]: [OrderStatus.FERTIG, OrderStatus.IN_ARBEIT],
  [OrderStatus.FERTIG]: [OrderStatus.ABGERECHNET],
  [OrderStatus.ABGERECHNET]: [],
  [OrderStatus.STORNIERT]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly audit: AuditService,
  ) {}

  /** Berechnet Positionssummen sowie Netto/MwSt/Brutto eines Auftrags. */
  private calculate(items: OrderItem[], materialkosten = 0) {
    const positionsSumme = items.reduce((sum, item) => {
      item.gesamtpreis = Number(item.menge) * Number(item.einzelpreis);
      return sum + item.gesamtpreis;
    }, 0);
    const nettoSumme = positionsSumme + Number(materialkosten || 0);
    const mwstBetrag = Math.round(nettoSumme * MWST_SATZ * 100) / 100;
    const gesamtpreis = Math.round((nettoSumme + mwstBetrag) * 100) / 100;
    return { nettoSumme, mwstBetrag, gesamtpreis };
  }

  private buildItems(dtoItems: OrderItemDto[] = []): OrderItem[] {
    return dtoItems.map((i) =>
      this.itemRepo.create({
        beschreibung: i.beschreibung,
        typ: i.typ,
        menge: i.menge,
        einzelpreis: i.einzelpreis,
        gesamtpreis: Number(i.menge) * Number(i.einzelpreis),
      }),
    );
  }

  async findAll(tenantId: string, query: { status?: OrderStatus; customerId?: string } = {}) {
    // Listen-Projektion: NUR die in der Tabelle gezeigten Spalten. KEINE
    // items-Relation (Detail/PDF) und KEIN internerHinweis (verschluesselt) ->
    // kein Join + kein AES-Decrypt pro Zeile (war Haupt-Latenzquelle bei Volumen).
    const qb = this.repo
      .createQueryBuilder('o')
      .select([
        'o.id',
        'o.auftragsnummer',
        'o.customerId',
        'o.vehicleId',
        'o.serviceType',
        'o.status',
        'o.nettoSumme',
        'o.mwstBetrag',
        'o.gesamtpreis',
        'o.geplanterStart',
        'o.geplantesEnde',
        'o.createdAt',
      ])
      .where('o.tenantId = :tenantId', { tenantId });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.customerId) qb.andWhere('o.customerId = :customerId', { customerId: query.customerId });
    return qb.orderBy('o.createdAt', 'DESC').getMany();
  }

  async findOne(tenantId: string, id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    return order;
  }

  async create(user: AuthUser, dto: CreateOrderDto): Promise<Order> {
    // Mandantentrennung: verknuepfte FKs muessen zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection).
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    await assertRefInTenant(this.userRepo, user, dto.assignedUserId, 'Mitarbeiter');
    await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');

    const auftragsnummer = await nextSequentialNumber(this.repo, user.tenantId, 'AU');
    const items = this.buildItems(dto.items);
    const totals = this.calculate(items, dto.materialkosten);

    const order = this.repo.create({
      tenantId: user.tenantId,
      auftragsnummer,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      assignedUserId: dto.assignedUserId,
      locationId: dto.locationId,
      serviceType: dto.serviceType,
      materialkosten: dto.materialkosten ?? 0,
      arbeitsstunden: dto.arbeitsstunden ?? 0,
      geplanterStart: dto.geplanterStart ? new Date(dto.geplanterStart) : null,
      geplantesEnde: dto.geplantesEnde ? new Date(dto.geplantesEnde) : null,
      internerHinweis: dto.internerHinweis,
      // Fotos werden NICHT beim Anlegen gesetzt, sondern ausschliesslich via
      // uploadFotos (serverseitige Dateinamen). Start daher immer leer.
      bilderVorher: [],
      bilderNachher: [],
      items,
      ...totals,
    });

    const saved = await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Order',
      entityId: saved.id,
      payload: { auftragsnummer, gesamtpreis: totals.gesamtpreis },
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(user.tenantId, id);

    // Mandantentrennung: nur uebernommene FKs validieren (assertRefInTenant
    // ignoriert null/undefined/'' und prueft sonst Zugehoerigkeit zum Betrieb).
    if (dto.customerId !== undefined)
      await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    if (dto.vehicleId !== undefined)
      await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    if (dto.assignedUserId !== undefined)
      await assertRefInTenant(this.userRepo, user, dto.assignedUserId, 'Mitarbeiter');
    if (dto.locationId !== undefined)
      await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');

    if (dto.items) {
      await this.itemRepo.delete({ orderId: id });
      order.items = this.buildItems(dto.items).map((i) => {
        i.orderId = id;
        return i;
      });
    }

    const assignable: (keyof UpdateOrderDto)[] = [
      'customerId',
      'vehicleId',
      'assignedUserId',
      'locationId',
      'serviceType',
      'materialkosten',
      'arbeitsstunden',
      'internerHinweis',
      // bilderVorher/bilderNachher bewusst NICHT zuweisbar -> nur via uploadFotos.
      'leistungDetails',
    ];
    for (const key of assignable) {
      if (dto[key] !== undefined) (order as any)[key] = dto[key];
    }
    if (dto.geplanterStart !== undefined)
      order.geplanterStart = dto.geplanterStart ? new Date(dto.geplanterStart) : null;
    if (dto.geplantesEnde !== undefined)
      order.geplantesEnde = dto.geplantesEnde ? new Date(dto.geplantesEnde) : null;

    const totals = this.calculate(order.items ?? [], order.materialkosten);
    Object.assign(order, totals);

    const saved = await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Order',
      entityId: id,
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async changeStatus(user: AuthUser, id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(user.tenantId, id);
    const erlaubt = STATUS_UEBERGAENGE[order.status] ?? [];
    if (order.status !== status && !erlaubt.includes(status)) {
      throw new BadRequestException(
        `Statuswechsel von "${order.status}" zu "${status}" ist nicht erlaubt.`,
      );
    }
    const vorher = order.status;
    order.status = status;
    const saved = await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'Order',
      entityId: id,
      payload: { von: vorher, nach: status },
    });
    return saved;
  }

  /**
   * Speichert hochgeladene Fotos (Data-URLs) als Dateien tenant-segmentiert unter
   * `private-uploads/orders/<tenantId>/` (NICHT statisch gemountet) und haengt nur
   * den DATEINAMEN an `bilderVorher`/`bilderNachher` an. Ausgeliefert werden die
   * Bilder ausschliesslich guard-geschuetzt ueber GET /orders/:id/fotos/:datei
   * (OrderPhotoController). Tenant-gebunden ueber findOne.
   */
  async uploadFotos(
    user: AuthUser,
    id: string,
    phase: 'vorher' | 'nachher',
    bilder: string[],
  ): Promise<Order> {
    const order = await this.findOne(user.tenantId, id);

    // Disk-Abuse-Schutz: Gesamtzahl je Auftrag deckeln (DTO begrenzt zusaetzlich
    // 20 Bilder/Request + Groesse je Bild).
    const vorhanden = (order.bilderVorher?.length ?? 0) + (order.bilderNachher?.length ?? 0);
    if (vorhanden + bilder.length > MAX_FOTOS_PRO_AUFTRAG) {
      throw new BadRequestException(`Maximal ${MAX_FOTOS_PRO_AUFTRAG} Fotos pro Auftrag.`);
    }

    const uploadDir = join(process.cwd(), 'private-uploads', 'orders', user.tenantId);
    await fs.mkdir(uploadDir, { recursive: true });

    const dateinamen: string[] = [];
    for (const datenUrl of bilder) {
      const match = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/.exec(datenUrl);
      if (!match) {
        throw new BadRequestException('Ungültiges Bildformat (nur Data-URLs erlaubt).');
      }
      const endung = match[2] === 'jpeg' ? 'jpg' : match[2];
      const inhalt = Buffer.from(match[3], 'base64');
      // Groesse begrenzen (max. 5 MB je Bild).
      if (inhalt.byteLength > 5 * 1024 * 1024) {
        throw new BadRequestException('Bild zu groß (max. 5 MB).');
      }
      // Magic-Byte-Pruefung: Inhalt muss wirklich das behauptete Bild sein.
      if (!istBildMitMagic(inhalt, endung)) {
        throw new BadRequestException('Datei ist kein gueltiges Bild (Inhalt passt nicht zum Format).');
      }
      const dateiname = `${id}_${phase}_${randomUUID()}.${endung}`;
      await fs.writeFile(join(uploadDir, dateiname), inhalt);
      dateinamen.push(dateiname);
    }

    const feld = phase === 'vorher' ? 'bilderVorher' : 'bilderNachher';
    order[feld] = [...(order[feld] ?? []), ...dateinamen];
    await this.repo.save(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'upload_fotos',
      entityType: 'Order',
      entityId: id,
      payload: { phase, anzahl: dateinamen.length },
    });
    return this.findOne(user.tenantId, id);
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const order = await this.findOne(user.tenantId, id);
    await this.repo.remove(order);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'Order',
      entityId: id,
    });
    return { success: true };
  }
}
