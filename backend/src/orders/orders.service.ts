import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CreateOrderDto, UpdateOrderDto, OrderItemDto } from './dto/order.dto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mailer/mail.service';
import { anrede, formatDatumZeit, htmlLink, linesToHtml, MailZeile } from '../mailer/kunden-mail';
import { resolveBewertung } from '../common/kundenkommunikation';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { nextSequentialNumber } from '../common/numbering';
import { withUniqueRetry } from '../common/unique-retry';
import { MWST_SATZ } from '../common/steuer';
import { clampPageQuery } from '../common/util/pagination';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FEATURE_KUNDENERLEBNIS } from '../subscriptions/plan-catalog';
import { buildMappeView, MappeView } from './mappe-view';

/**
 * Akzentfarbe je Betriebstyp (Spiegel von frontend `branche.tsx`, sprachneutral).
 * Quelle fuer die Faerbung des gebrandeten Tickers/der Mappe, wenn der Betrieb
 * keine eigene `settings.akzentfarbe` gesetzt hat.
 */
const AKZENT_BY_BETRIEBSTYP: Record<string, string> = {
  aufbereitung: '#E8923B',
  folierung: '#9B76FC',
  ppf: '#3EBFB9',
  komplett: '#E8923B',
};

/** Endzustaende, in denen die Uebergabe-Mappe im oeffentlichen Link erscheint. */
const MAPPE_STATUS: OrderStatus[] = [OrderStatus.FERTIG, OrderStatus.ABGERECHNET];

/**
 * Loest die Betriebs-Akzentfarbe als validiertes Hex auf: bevorzugt die
 * gepflegte `settings.akzentfarbe`, sonst die Betriebstyp-Farbe, sonst Kupfer.
 * Nur 3-/6-stelliges Hex wird durchgelassen (Style-Injection-sicher).
 */
function resolveTenantAkzent(tenant: { betriebstyp?: string; settings?: unknown } | null): string {
  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const custom = typeof settings.akzentfarbe === 'string' ? settings.akzentfarbe.trim() : '';
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(custom)) return custom;
  return AKZENT_BY_BETRIEBSTYP[tenant?.betriebstyp ?? 'komplett'] ?? '#E8923B';
}

/** Nur echte http(s)-URLs als Logo zulassen (kein javascript:/data: im <img>). */
function safeLogoUrl(url?: string | null): string | null {
  const s = (url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

/** Obergrenze Fotos je Auftrag (Vorher+Nachher) gegen Disk-Abuse. */
const MAX_FOTOS_PRO_AUFTRAG = 40;

/**
 * Sicherheitsventil fuer den unpaginierten Array-Modus von findAll (T-009,
 * analog MAX_ARRAY_VEHICLES) - KEIN Produktlimit. Dropdown-/Bestands-Consumer
 * (Inspektions-Auswahl, Kunden-Akte) bleiben weit darunter vollstaendig.
 */
const MAX_ARRAY_ORDERS = 2000;

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
  /**
   * Progressive Enhancement (Pro-Feature `kundenerlebnis`): NUR gesetzt, wenn der
   * Betrieb das Add-on hat. Fehlt das Feature, bleiben die Felder undefined und
   * der Basis-Ticker (fuer ALLE Tarife) ist unveraendert.
   */
  logo?: string | null;
  akzent?: string | null;
  /** Uebergabe-Mappe im Link verfuegbar (Feature ∧ Status fertig/abgerechnet). */
  mappeVerfuegbar?: boolean;
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
  private readonly logger = new Logger(OrdersService.name);

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
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    // Nur fuer das serverseitige Tenant-Gate der oeffentlichen Erlebnis-Endpunkte
    // (Ticker-Branding + Mappe). @Global SubscriptionsModule -> kein Modul-Import.
    private readonly subscriptions: SubscriptionsService,
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
   * `search` (T-021): Auftragsnummer ODER Kundenname, Muster wie bei Belegen.
   */
  async findAll(
    tenantId: string,
    query: {
      status?: OrderStatus;
      customerId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
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

    // Suche: Auftragsnummer ODER Kundenname (T-021, gleiches Muster wie Belege).
    // Wildcards entschaerfen; Namens-Treffer tenant-scoped zu IDs aufloesen
    // (gedeckelt), dann OR IN.
    const term = query.search?.trim().toLowerCase();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const kunden = await this.customerRepo
        .createQueryBuilder('c')
        .select(['c.id'])
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere(
          "(LOWER(c.firstName) LIKE :like ESCAPE '\\' OR LOWER(c.lastName) LIKE :like ESCAPE '\\' OR " +
            "LOWER(c.companyName) LIKE :like ESCAPE '\\')",
          { like },
        )
        .limit(200)
        .getMany();
      const ids = kunden.map((k) => k.id);
      if (ids.length > 0) {
        qb.andWhere("(LOWER(o.auftragsnummer) LIKE :like ESCAPE '\\' OR o.customerId IN (:...ids))", {
          like,
          ids,
        });
      } else {
        qb.andWhere("LOWER(o.auftragsnummer) LIKE :like ESCAPE '\\'", { like });
      }
    }

    qb.orderBy('o.createdAt', 'DESC');

    if (query.page == null && query.limit == null) {
      return qb.take(MAX_ARRAY_ORDERS).getMany();
    }

    const { page, limit, skip, take } = clampPageQuery(query);
    const [data, total] = await qb.skip(skip).take(take).getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    return order;
  }

  /**
   * Laedt die tenant-scoped Daten fuer das Uebergabe-/Garantie-PDF (Welle 1, F4):
   * Auftrag (inkl. Positionen), Kunde, Fahrzeug und Tenant (Absender). findOne
   * wirft NotFound bei Fremd-/Nichtexistenz; die verknuepften Objekte werden
   * ebenfalls tenant-scoped geladen. Das Rendern selbst uebernimmt der Controller
   * (OrdersPdfService), damit dieser Service keinen neuen Constructor-Param braucht.
   */
  async getUebergabeContext(tenantId: string, id: string): Promise<{
    order: Order;
    customer: Customer | null;
    vehicle: Vehicle | null;
    tenant: Tenant | null;
  }> {
    const order = await this.findOne(tenantId, id);
    const [customer, vehicle, tenant] = await Promise.all([
      this.customerRepo.findOne({ where: { id: order.customerId, tenantId } }),
      order.vehicleId
        ? this.vehicleRepo.findOne({ where: { id: order.vehicleId, tenantId } })
        : Promise.resolve(null),
      this.tenantRepo.findOne({ where: { id: tenantId } }),
    ]);
    return { order, customer, vehicle, tenant };
  }

  async create(user: AuthUser, dto: CreateOrderDto): Promise<Order> {
    // Mandantentrennung: verknuepfte FKs muessen zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection).
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    await assertRefInTenant(this.userRepo, user, dto.assignedUserId, 'Mitarbeiter');
    await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');

    const items = this.buildItems(dto.items);
    const totals = this.calculate(items, dto.materialkosten);

    const order = this.repo.create({
      tenantId: user.tenantId,
      // auftragsnummer wird unten in der Retry-Schleife gezogen (C1).
      auftragsnummer: '',
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

    // C1: Nummernvergabe serialisieren. Die AU-Nummer wird INNERHALB der Retry-
    // Schleife gezogen; kollidiert der Unique-Index (tenantId, auftragsnummer),
    // wird nach dem Commit der Konkurrenz neu gezaehlt und erneut gespeichert.
    const saved = await withUniqueRetry(async () => {
      order.auftragsnummer = await nextSequentialNumber(this.repo, user.tenantId, 'AU');
      return this.repo.save(order);
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Order',
      entityId: saved.id,
      payload: { auftragsnummer: saved.auftragsnummer, gesamtpreis: totals.gesamtpreis },
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
    // Gleicher Status = No-op: nichts schreiben, kein Audit, keine Mail.
    if (vorher === status) return order;

    // Optimistisch-konditionales Update: schreibt NUR, wenn der Status in der DB
    // noch "vorher" ist. Bei zwei parallelen identischen Wechseln gewinnt genau
    // einer (affected=1) -> genau EIN Audit-Eintrag und EINE Kunden-Mail; der
    // Verlierer ist ein No-op. Nebeneffekt: es wird ausschliesslich die
    // status-Spalte geschrieben (freigabeToken & Co. bleiben garantiert unberuehrt).
    const res = await this.repo.update({ id, tenantId: user.tenantId, status: vorher }, { status });
    if (!res.affected) {
      // Race verloren (paralleler Wechsel war schneller): aktuellen Stand
      // zurueckgeben, ohne eigene Nebenwirkungen (der Gewinner hat sie ausgeloest).
      return this.findOne(user.tenantId, id);
    }

    order.status = status;
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'Order',
      entityId: id,
      payload: { von: vorher, nach: status },
    });
    // Status-Mail an den Endkunden (T-003): fire-and-forget NACH Update+Audit –
    // ein Mail-Problem darf den Statuswechsel NIE blockieren.
    void this.sendStatusMail(order, vorher, status);
    return order;
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
    // GoBD-Nachvollziehbarkeit: ein Auftrag, auf den eine FESTGESETZTE Rechnung
    // (art=RECHNUNG, Status != Entwurf) verweist, darf nicht hart geloescht werden.
    // Sonst zeigt invoice.orderId ins Leere und die order_items/Fotos verschwinden
    // per FK-Cascade -> Beleg <-> zugrundeliegender Auftrag waere gebrochen.
    const festgesetzt = await this.invoiceRepo.count({
      where: {
        tenantId: user.tenantId,
        orderId: id,
        art: InvoiceKind.RECHNUNG,
        status: Not(InvoiceStatus.ENTWURF),
      },
    });
    if (festgesetzt > 0) {
      throw new ConflictException(
        'Auftrag mit festgesetzter Rechnung kann nicht geloescht werden - bitte die Rechnung stornieren.',
      );
    }
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
      this.tenantRepo.findOne({
        where: { id: order.tenantId },
        // logoUrl/betriebstyp/settings nur fuer das gebrandete Pro-Add-on.
        select: ['id', 'name', 'logoUrl', 'betriebstyp', 'settings'],
      }),
    ]);

    const fahrzeug = vehicle
      ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ') || null
      : null;

    const view: PublicTrackingView = {
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

    // Progressive Enhancement: Branding + Mappe-Hinweis NUR fuer Pro-Betriebe
    // (Tenant-Gate ueber das Token). Ohne Feature bleibt der Basis-Ticker.
    if (await this.subscriptions.hasFeatureForTenant(order.tenantId, FEATURE_KUNDENERLEBNIS)) {
      view.logo = safeLogoUrl(tenant?.logoUrl);
      view.akzent = resolveTenantAkzent(tenant);
      view.mappeVerfuegbar = MAPPE_STATUS.includes(order.status);
    }

    return view;
  }

  // ---------------------------------------------------------------------------
  // Oeffentliche Uebergabe-Mappe (Pro-Feature `kundenerlebnis`, Welle 1)
  // ---------------------------------------------------------------------------

  /**
   * Laedt + GATET den Auftrag hinter dem oeffentlichen Token fuer die Uebergabe-
   * Mappe. Kein Login, tenantId aus dem Token. Fail-closed als 404 bei JEDEM
   * Fehlgrund (ungueltiges Token, kein Treffer, Feature fehlt, Status noch nicht
   * fertig) – bewusst KEIN 403, damit der Link nicht verraet, ob/warum es eine
   * Mappe gibt (kein Orakel). Laedt Kunde/Fahrzeug/Tenant tenant-scoped.
   */
  private async loadMappeContext(token: string): Promise<{
    order: Order;
    customer: Customer | null;
    vehicle: Vehicle | null;
    tenant: Tenant | null;
  }> {
    const clean = (token || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(clean)) throw new NotFoundException('Nicht gefunden');
    const order = await this.repo.findOne({ where: { freigabeToken: clean }, relations: ['items'] });
    if (!order) throw new NotFoundException('Nicht gefunden');

    // Tenant-Gate + Status-Gate (Review-before-send: der Betrieb steuert den Status).
    const hatFeature = await this.subscriptions.hasFeatureForTenant(
      order.tenantId,
      FEATURE_KUNDENERLEBNIS,
    );
    if (!hatFeature || !MAPPE_STATUS.includes(order.status)) {
      throw new NotFoundException('Nicht gefunden');
    }

    const [customer, vehicle, tenant] = await Promise.all([
      this.customerRepo.findOne({ where: { id: order.customerId, tenantId: order.tenantId } }),
      order.vehicleId
        ? this.vehicleRepo.findOne({ where: { id: order.vehicleId, tenantId: order.tenantId } })
        : Promise.resolve(null),
      this.tenantRepo.findOne({ where: { id: order.tenantId } }),
    ]);
    return { order, customer, vehicle, tenant };
  }

  /** Oeffentliche Web-Ansicht der Uebergabe-Mappe (PII-arm). */
  async mappeWebByToken(token: string): Promise<MappeView> {
    const { order, vehicle, tenant } = await this.loadMappeContext(token);
    return buildMappeView(order as any, vehicle as any, {
      ...(tenant as any),
      akzent: resolveTenantAkzent(tenant),
    });
  }

  /**
   * Kontext + Branding fuer das oeffentliche Mappe-PDF. Der Controller rendert
   * (OrdersPdfService), damit dieser Service kein PDF-Constructor-Dependency hat.
   * Kunde wird NAMENS-only weitergereicht (keine Adresse ins token-oeffentliche PDF).
   */
  async mappePdfContextByToken(token: string): Promise<{
    order: Order;
    customer: { type?: string; firstName?: string; lastName?: string; companyName?: string } | null;
    vehicle: Vehicle | null;
    tenant: Tenant | null;
    akzent: string;
    logoDataUrl: string | null;
  }> {
    const { order, customer, vehicle, tenant } = await this.loadMappeContext(token);
    // PII-arm: nur Name (kein street/city) ins token-oeffentliche PDF.
    const nameOnly = customer
      ? {
          type: customer.type,
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyName: customer.companyName,
        }
      : null;
    // Logo nur einbetten, wenn es bereits eine data:-URL ist (kein Server-Fetch).
    const logoDataUrl =
      typeof tenant?.logoUrl === 'string' && tenant.logoUrl.startsWith('data:')
        ? tenant.logoUrl
        : null;
    return { order, customer: nameOnly, vehicle, tenant, akzent: resolveTenantAkzent(tenant), logoDataUrl };
  }

  // ---------------------------------------------------------------------------
  // Automatische Status-Mails an den Endkunden (T-003)
  // ---------------------------------------------------------------------------

  /** Basis-URL fuer den Track-Link in Mails (gleiches Muster wie AuthService.appBaseUrl). */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  /**
   * Stellt sicher, dass der Auftrag ein Tracking-Token hat – internes Pendant zu
   * getOrCreateTrackingToken ohne AuthUser (tenantId kommt vom bereits
   * tenant-geprueft geladenen Auftrag). Gleiche Semantik wie der UI-Button.
   */
  private async ensureTrackingToken(orderId: string, tenantId: string): Promise<string> {
    const row = await this.repo.findOne({
      where: { id: orderId, tenantId },
      select: ['id', 'freigabeToken'],
    });
    if (!row) throw new NotFoundException('Auftrag nicht gefunden');
    if (row.freigabeToken) return row.freigabeToken;
    const token = randomBytes(24).toString('hex');
    // Konditionales Update: schreibt nur, wenn noch KEIN Token existiert. Hat
    // ein paralleler Erzeuger gewonnen (affected=0), dessen Token nachlesen und
    // verwenden -> es kursiert nie mehr als EIN gueltiger Link je Auftrag.
    const res = await this.repo.update(
      { id: orderId, tenantId, freigabeToken: IsNull() },
      { freigabeToken: token },
    );
    if (res.affected) return token;
    const nachgelesen = await this.repo.findOne({
      where: { id: orderId, tenantId },
      select: ['id', 'freigabeToken'],
    });
    if (!nachgelesen?.freigabeToken) throw new NotFoundException('Auftrag nicht gefunden');
    return nachgelesen.freigabeToken;
  }

  /**
   * Versendet die Status-Mail an den Endkunden (Sie-Ton, mit Track-Link).
   * BLOCKIERT NIE den Statuswechsel: komplett in try/catch, Fehler -> Warn-Log.
   *
   * Kuratierte Status statt jedem internen Schritt (Spam-Schutz):
   *  - bestaetigt            -> "Ihr Auftrag ist bestätigt" (fuehrt den Link ein)
   *  - in_arbeit             -> nur beim ERSTEN Eintritt (vorher=bestaetigt);
   *                             Ruecksprung aus der Qualitaetskontrolle mailt nicht erneut
   *  - fertig                -> "Ihr Fahrzeug ist abholbereit" (Feature 3: bereits
   *                             die "Fertig"-Kundeninfo – hier nur veredelt/steuerbar,
   *                             NICHT neu gebaut)
   * Bewusst KEINE Mail bei kalkuliert/qualitaetskontrolle (intern), abgerechnet
   * (Rechnungs-Mail existiert) und storniert (persoenliche Kommunikation).
   *
   * Feature 2 (Bewertungs-Bitte): Bei fertig wird – wenn `settings.bewertung.aktiv`
   * UND eine Google-URL hinterlegt sind – ein freundlicher Bewertungs-Link an DIESELBE
   * "abholbereit"-Mail angehaengt (kein neuer Kanal; die Bitte reitet mit, gated ueber
   * denselben kundenmailStatus-Schalter). Ohne aktiv/URL bleibt die Mail unveraendert.
   */
  private async sendStatusMail(order: Order, vorher: OrderStatus, nach: OrderStatus): Promise<void> {
    try {
      const relevant =
        nach === OrderStatus.BESTAETIGT ||
        nach === OrderStatus.FERTIG ||
        (nach === OrderStatus.IN_ARBEIT && vorher === OrderStatus.BESTAETIGT);
      if (!relevant) return;

      const tenant = await this.tenantRepo.findOne({ where: { id: order.tenantId } });
      // Opt-out-Flag in tenant.settings (Default AN, solange nicht '0').
      const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
      if (settings.kundenmailStatus === '0') return;

      const customer = await this.customerRepo.findOne({
        where: { id: order.customerId, tenantId: order.tenantId },
      });
      const email = customer?.email?.trim();
      if (!email) {
        // Bewusst stiller Skip (kein Fehler): automatische Mail, der Statuswechsel
        // selbst ist die Hauptsache. Anders als beim manuellen Rechnungsversand.
        this.logger.debug(`Status-Mail uebersprungen (Kunde ohne E-Mail). order=${order.id}`);
        return;
      }

      const token = await this.ensureTrackingToken(order.id, order.tenantId);
      const trackUrl = `${this.appBaseUrl()}/track/?t=${token}`;
      const betrieb = tenant?.name?.trim() || 'Ihr Aufbereitungsbetrieb';

      const vehicle = order.vehicleId
        ? await this.vehicleRepo.findOne({
            where: { id: order.vehicleId, tenantId: order.tenantId },
            select: ['make', 'model', 'variant', 'licensePlate'],
          })
        : null;
      const fahrzeug = vehicle
        ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ')
        : '';

      const kundeName =
        customer.type === CustomerType.BUSINESS
          ? customer.companyName
          : [customer.firstName, customer.lastName].filter(Boolean).join(' ');

      let subject: string;
      const zeilen: string[] = [anrede(kundeName), ''];
      if (nach === OrderStatus.BESTAETIGT) {
        subject = `Auftragsbestätigung ${order.auftragsnummer} von ${betrieb}`;
        zeilen.push(`Ihr Auftrag ${order.auftragsnummer} wurde bestätigt.`);
        if (order.geplanterStart) {
          zeilen.push(`Geplanter Beginn: ${formatDatumZeit(order.geplanterStart)}.`);
        }
      } else if (nach === OrderStatus.IN_ARBEIT) {
        subject = `Ihr Auftrag ${order.auftragsnummer} ist jetzt in Arbeit – ${betrieb}`;
        zeilen.push(`wir haben mit der Arbeit an Ihrem Auftrag ${order.auftragsnummer} begonnen.`);
      } else {
        subject = `Ihr Fahrzeug ist abholbereit – ${betrieb}`;
        zeilen.push(
          `Ihr Auftrag ${order.auftragsnummer} ist fertig – Ihr Fahrzeug kann abgeholt werden.`,
        );
      }
      if (fahrzeug) {
        zeilen.push(`Fahrzeug: ${fahrzeug}${vehicle?.licensePlate ? ` (${vehicle.licensePlate})` : ''}`);
      }
      zeilen.push('', 'Den aktuellen Stand Ihres Auftrags können Sie hier jederzeit einsehen:');

      // Feature 2 (Bewertungs-Bitte): NUR bei fertig + aktiv + hinterlegter Google-URL.
      // Haengt an die bestehende "abholbereit"-Mail an – kein separater Versand.
      const bewertungTextZeilen: string[] = [];
      const bewertungHtmlZeilen: MailZeile[] = [];
      if (nach === OrderStatus.FERTIG) {
        const bewertung = resolveBewertung(settings.bewertung);
        if (bewertung.aktiv && bewertung.googleUrl) {
          const einladung =
            bewertung.text ||
            'Waren Sie zufrieden? Über eine kurze Bewertung bei Google freuen wir uns sehr:';
          bewertungTextZeilen.push('', einladung, bewertung.googleUrl);
          bewertungHtmlZeilen.push('', einladung, htmlLink(bewertung.googleUrl, 'Jetzt bei Google bewerten'));
        }
      }

      const text = [
        ...zeilen,
        trackUrl,
        ...bewertungTextZeilen,
        '',
        'Mit freundlichen Grüßen',
        betrieb,
      ].join('\n');
      const htmlZeilen: MailZeile[] = [
        ...zeilen,
        htmlLink(trackUrl, 'Auftragsstatus ansehen'),
        ...bewertungHtmlZeilen,
        '',
        'Mit freundlichen Grüßen',
        betrieb,
      ];

      await this.mail.send({
        to: email,
        subject,
        html: linesToHtml(htmlZeilen),
        text,
        // Antworten sollen beim Betrieb landen, nicht bei der Plattform.
        replyTo: tenant?.email?.trim() || undefined,
        // Sendet – falls konfiguriert – ueber den betriebseigenen SMTP/Absender.
        tenantId: order.tenantId,
      });
      this.logger.log(`Status-Mail (${nach}) an Kunden versendet. order=${order.id}`);
    } catch (e) {
      this.logger.warn(
        `Status-Mail fehlgeschlagen (Statuswechsel bleibt gueltig): ${(e as Error).message}`,
      );
    }
  }
}
