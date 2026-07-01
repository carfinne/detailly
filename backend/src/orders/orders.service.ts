import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
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

/**
 * Oeffentliche Tracking-Ansicht ("Wo ist mein Auto?"). BEWUSST minimal: nur was
 * der Kunde ohnehin kennt (sein Auto, seine Auftragsnummer, der Status). KEINE
 * Preise, KEINE Notizen, KEINE Daten anderer Kunden.
 */
export interface PublicTrackingView {
  betrieb: string;
  auftragsnummer: string;
  serviceType: string;
  status: string;
  fahrzeug: string | null;
  kennzeichen: string | null;
  geplanterStart: string | null;
  geplantesEnde: string | null;
  aktualisiertAm: string;
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
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
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

  /**
   * Auftrags-Liste. ABWAERTSKOMPATIBEL: ohne page/limit das bisherige Array
   * (Dropdowns wie die Inspektions-Auswahl, Kunden-Akte); MIT page/limit eine
   * paginierte Antwort {data,total,page,limit} fuer die Listen-Seite.
   */
  async findAll(
    tenantId: string,
    query: { status?: OrderStatus; customerId?: string; page?: number; limit?: number } = {},
  ) {
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
    qb.orderBy('o.createdAt', 'DESC');

    if (query.page == null && query.limit == null) return qb.getMany();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, limit };
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

  /**
   * Liefert das Tracking-Token eines Auftrags (erzeugt es beim ersten Mal).
   * Tenant-geprueft ueber die WHERE-Klausel.
   */
  async getOrCreateTrackingToken(user: AuthUser, id: string): Promise<{ token: string }> {
    const order = await this.repo.findOne({
      where: { id, tenantId: user.tenantId },
      select: ['id', 'freigabeToken'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    if (order.freigabeToken) return { token: order.freigabeToken };
    const token = randomBytes(24).toString('hex');
    await this.repo.update({ id, tenantId: user.tenantId }, { freigabeToken: token });
    return { token };
  }

  /** Erzeugt ein NEUES Tracking-Token (alter Link wird ungueltig). */
  async regenerateTrackingToken(user: AuthUser, id: string): Promise<{ token: string }> {
    const order = await this.repo.findOne({
      where: { id, tenantId: user.tenantId },
      select: ['id'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    const token = randomBytes(24).toString('hex');
    await this.repo.update({ id, tenantId: user.tenantId }, { freigabeToken: token });
    return { token };
  }

  /**
   * OEFFENTLICHE Tracking-Ansicht ueber das geheime Token. Kein Login, kein
   * tenantId von aussen: der Tenant ergibt sich aus dem Token-Treffer. Ungueltiges
   * Token -> 404 (nie 401, kein Hinweis ob ein Token existiert). Liefert nur
   * unkritische Anzeigefelder.
   */
  async trackingByToken(token: string): Promise<PublicTrackingView> {
    const clean = (token || '').trim();
    // Plausibilitaet vor DB-Treffer: nur Hex, sinnvolle Laenge -> keine
    // Enumeration/teure Volltreffer-Versuche mit Muelldaten.
    if (!/^[a-f0-9]{32,64}$/.test(clean)) throw new NotFoundException('Auftrag nicht gefunden');
    const order = await this.repo.findOne({
      where: { freigabeToken: clean },
      select: [
        'id', 'tenantId', 'auftragsnummer', 'serviceType', 'status',
        'vehicleId', 'geplanterStart', 'geplantesEnde', 'updatedAt',
      ],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');

    const [vehicle, tenant] = await Promise.all([
      order.vehicleId
        ? this.vehicleRepo.findOne({
            where: { id: order.vehicleId, tenantId: order.tenantId },
            select: ['make', 'model', 'variant', 'licensePlate'],
          })
        : Promise.resolve(null),
      this.tenantRepo.findOne({ where: { id: order.tenantId }, select: ['id', 'name'] }),
    ]);

    const fahrzeug = vehicle
      ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || null
      : null;

    return {
      betrieb: tenant?.name ?? 'Detailly',
      auftragsnummer: order.auftragsnummer,
      serviceType: order.serviceType,
      status: order.status,
      fahrzeug,
      kennzeichen: vehicle?.licensePlate ?? null,
      geplanterStart: order.geplanterStart ? new Date(order.geplanterStart).toISOString() : null,
      geplantesEnde: order.geplantesEnde ? new Date(order.geplantesEnde).toISOString() : null,
      aktualisiertAm: new Date(order.updatedAt).toISOString(),
    };
  }
}
