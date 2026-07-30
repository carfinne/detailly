import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { OrderTime } from './entities/order-time.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { CreateOrderTimeDto, UpdateOrderTimeDto } from './dto/order-time.dto';

/** Rollen, die fremde Eintraege verwalten / fuer andere erfassen duerfen. */
const LEITUNG_ROLLEN = ['platform_admin', 'owner', 'manager'];

/**
 * Auftrags-Status, auf die KEINE Projektzeit mehr gebucht/geaendert werden darf
 * (an die GoBD-Sperre `istAbgerechnet` der OrdersService angelehnt: der abgerechnete
 * bzw. stornierte Auftrag ist wirtschaftlich abgeschlossen). Job-Costing nach der
 * Abrechnung wuerde das Nachkalkulations-Bild nachtraeglich verschieben.
 */
const GESPERRTE_STATUS: OrderStatus[] = [OrderStatus.ABGERECHNET, OrderStatus.STORNIERT];

/**
 * Reine, testbare Soll-Berechnung eines Auftrags in Minuten:
 * - Ist die geplante Gesamtdauer am Auftrag GESETZT (Override durch den Meister),
 *   gewinnt sie.
 * - Sonst wird das Soll aus der Summe der Positions-Dauern gebildet
 *   (fehlende Positions-Dauern zaehlen als 0).
 * Kein Soll hinterlegt -> 0 (die Nachkalkulation zeigt dann "kein Soll", ohne je
 * durch 0 zu teilen).
 */
export function computeSollMinuten(order: {
  geplanteDauerMinuten?: number | null;
  items?: Array<{ geplanteDauerMinuten?: number | null }>;
}): number {
  if (order.geplanteDauerMinuten != null) return Number(order.geplanteDauerMinuten) || 0;
  return (order.items ?? []).reduce((s, it) => s + (Number(it.geplanteDauerMinuten ?? 0) || 0), 0);
}

/**
 * Eintrag angereichert um den Mitarbeiternamen (fuer alle) und – NUR fuer die
 * Leitung – die Lohnkosten in € (aus Stundenlohn * Dauer). `kosten` bleibt fuer
 * Mitarbeiter undefiniert (Gehaltsdaten).
 */
export interface OrderTimeView extends OrderTime {
  mitarbeiterName: string;
  kosten?: number;
}

/** Auftrag, auf den Projektzeit gebucht werden kann (offen/laufend). */
export interface BookableOrder {
  id: string;
  auftragsnummer: string;
  kundeName: string;
  kennzeichen: string | null;
  status: OrderStatus;
  serviceType: string;
}

/** Eine Zeile der Soll/Ist-Uebersicht ueber mehrere Auftraege. */
export interface UebersichtZeile {
  orderId: string;
  auftragsnummer: string;
  kundeName: string;
  status: OrderStatus;
  sollMinuten: number;
  gebuchtMinuten: number;
  abweichungMinuten: number;
}

/**
 * Auftragszeiten (Job-Costing). Mitarbeiter erfassen ihre EIGENE Zeit und duerfen
 * eigene, noch nicht abgerechnete Buchungen korrigieren/loeschen; die Leitung
 * verwaltet alle. Alles tenant-gebunden.
 *
 * FACHLICH GETRENNT von der Stempeluhr (TimeEntry = Anwesenheit): Projektzeit ist
 * KEINE Arbeitszeitdokumentation, sondern die auf einen Auftrag verbuchte Dauer.
 */
@Injectable()
export class OrderTimeService {
  constructor(
    @InjectRepository(OrderTime) private readonly repo: Repository<OrderTime>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    private readonly audit: AuditService,
  ) {}

  private istLeitung(role: string): boolean {
    return LEITUNG_ROLLEN.includes(role);
  }

  /**
   * Laedt einen Auftrag tenant-scoped (404 bei Fremd-/Nichtexistenz – existenz-
   * orakel-sicher) und stellt sicher, dass darauf noch gebucht werden darf.
   * Wirft 409, wenn der Auftrag abgerechnet/storniert ist (Sperre).
   */
  private async assertBuchbarerAuftrag(tenantId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId },
      select: ['id', 'status'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');
    if (GESPERRTE_STATUS.includes(order.status)) {
      throw new ConflictException(
        'Auftrag ist abgerechnet/storniert – es kann keine Zeit mehr gebucht oder geändert werden.',
      );
    }
    return order;
  }

  /**
   * Reichert Eintraege um den Mitarbeiternamen an (tenant-scoped). `mitKosten`
   * (nur Leitung) ergaenzt die Lohnkosten je Eintrag aus dem Stundenlohn.
   */
  private async decorate(
    tenantId: string,
    rows: OrderTime[],
    mitKosten: boolean,
  ): Promise<OrderTimeView[]> {
    const ids = [...new Set(rows.map((r) => r.userId))];
    const users = ids.length
      ? await this.userRepo.find({
          where: { id: In(ids), tenantId },
          // Stundenlohn (Gehaltsdaten) NUR laden, wenn der Abrufer Leitung ist.
          select: mitKosten
            ? ['id', 'firstName', 'lastName', 'stundenlohn']
            : ['id', 'firstName', 'lastName'],
        })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id]),
    );
    const lohnById = new Map(users.map((u) => [u.id, Number(u.stundenlohn ?? 0)]));
    return rows.map((r) => {
      const view: OrderTimeView = { ...r, mitarbeiterName: nameById.get(r.userId) ?? '—' };
      if (mitKosten) {
        view.kosten = Math.round((Number(r.minuten) / 60) * (lohnById.get(r.userId) ?? 0) * 100) / 100;
      }
      return view;
    });
  }

  /**
   * Alle Zeiteintraege eines Auftrags (neueste zuerst) + Summe in Minuten, dazu
   * das Soll (geplante Dauer) und die Abweichung fuer die Nachkalkulation. Fuer
   * die Leitung zusaetzlich die Gesamt-Lohnkosten (summeKosten in €).
   */
  async listForOrder(
    user: AuthUser,
    orderId: string,
  ): Promise<{
    eintraege: OrderTimeView[];
    summeMinuten: number;
    sollMinuten: number;
    abweichungMinuten: number;
    summeKosten?: number;
  }> {
    if (!orderId) {
      return { eintraege: [], summeMinuten: 0, sollMinuten: 0, abweichungMinuten: 0 };
    }
    const mitKosten = this.istLeitung(user.role);
    const [rows, order] = await Promise.all([
      this.repo.find({
        where: { tenantId: user.tenantId, orderId },
        order: { datum: 'DESC', createdAt: 'DESC' },
      }),
      // Soll aus dem tenant-scoped Auftrag (mit Positionen) – null-sicher.
      this.orderRepo.findOne({ where: { id: orderId, tenantId: user.tenantId }, relations: ['items'] }),
    ]);
    const eintraege = await this.decorate(user.tenantId, rows, mitKosten);
    const summeMinuten = rows.reduce((s, r) => s + Number(r.minuten || 0), 0);
    const sollMinuten = order ? computeSollMinuten(order) : 0;
    const out: {
      eintraege: OrderTimeView[];
      summeMinuten: number;
      sollMinuten: number;
      abweichungMinuten: number;
      summeKosten?: number;
    } = {
      eintraege,
      summeMinuten,
      sollMinuten,
      abweichungMinuten: summeMinuten - sollMinuten,
    };
    if (mitKosten) {
      out.summeKosten = Math.round(eintraege.reduce((s, e) => s + (e.kosten ?? 0), 0) * 100) / 100;
    }
    return out;
  }

  /**
   * Offene/laufende Auftraege des Betriebs zum Buchen von Projektzeit
   * (abgerechnete/stornierte fallen raus). Optional durchsuchbar nach
   * Auftragsnummer ODER Kundenname (gleiches Muster wie die Auftragsliste).
   * Liefert je Auftrag Nummer, Kunde, Kennzeichen und Status – tenant-scoped,
   * gedeckelt (50), ohne N+1 (Kunden/Fahrzeuge in je einer Sammelquery).
   */
  async bookableOrders(user: AuthUser, search?: string): Promise<BookableOrder[]> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select(['o.id', 'o.auftragsnummer', 'o.customerId', 'o.vehicleId', 'o.status', 'o.serviceType'])
      .where('o.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('o.status NOT IN (:...gesperrt)', { gesperrt: GESPERRTE_STATUS });

    const term = search?.trim().toLowerCase();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const kunden = await this.customerRepo
        .createQueryBuilder('c')
        .select(['c.id'])
        .where('c.tenantId = :tenantId', { tenantId: user.tenantId })
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

    const orders = await qb.orderBy('o.createdAt', 'DESC').take(50).getMany();
    if (orders.length === 0) return [];

    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean))];
    const vehIds = [...new Set(orders.map((o) => o.vehicleId).filter(Boolean))];
    const [customers, vehicles] = await Promise.all([
      custIds.length
        ? this.customerRepo.find({
            where: { id: In(custIds), tenantId: user.tenantId },
            select: ['id', 'firstName', 'lastName', 'companyName'],
          })
        : Promise.resolve([]),
      vehIds.length
        ? this.vehicleRepo.find({
            where: { id: In(vehIds), tenantId: user.tenantId },
            select: ['id', 'licensePlate'],
          })
        : Promise.resolve([]),
    ]);
    const nameById = new Map(
      customers.map((c) => [
        c.id,
        c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
      ]),
    );
    const plateById = new Map(vehicles.map((v) => [v.id, v.licensePlate]));

    return orders.map((o) => ({
      id: o.id,
      auftragsnummer: o.auftragsnummer,
      kundeName: nameById.get(o.customerId) ?? '—',
      kennzeichen: o.vehicleId ? plateById.get(o.vehicleId) ?? null : null,
      status: o.status,
      serviceType: o.serviceType,
    }));
  }

  /**
   * Soll/Ist-Uebersicht ueber mehrere Auftraege in einem Zeitraum: je Auftrag
   * Soll, gebuchte Minuten und Abweichung (ueber/unter Plan) plus die gebuchten
   * Stunden je Mitarbeiter. Aggregat-Queries (GROUP BY) statt N+1, tenant-scoped.
   *
   * Rollen: die Leitung sieht ALLE Buchungen (optional nach Mitarbeiter gefiltert);
   * ein normaler Mitarbeiter sieht ausschliesslich seine EIGENEN Buchungen
   * (userId wird hart auf sich selbst gesetzt).
   */
  async uebersicht(
    user: AuthUser,
    opts: { von?: string; bis?: string; userId?: string } = {},
  ): Promise<{
    auftraege: UebersichtZeile[];
    proMitarbeiter: Array<{ userId: string; name: string; gebuchtMinuten: number }>;
    summeGebuchtMinuten: number;
  }> {
    const tenantId = user.tenantId;
    // Nicht-Leitung: hart auf die eigenen Buchungen einschraenken.
    const userFilter = this.istLeitung(user.role) ? opts.userId?.trim() || undefined : user.id;

    const vonD = opts.von ? new Date(opts.von) : null;
    const bisD = opts.bis ? new Date(opts.bis) : null;
    if (bisD) bisD.setHours(23, 59, 59, 999); // inklusiver Endtag
    const gueltigVon = vonD && !Number.isNaN(vonD.getTime()) ? vonD : null;
    const gueltigBis = bisD && !Number.isNaN(bisD.getTime()) ? bisD : null;

    const applyFilter = (qb: ReturnType<Repository<OrderTime>['createQueryBuilder']>) => {
      qb.where('ot.tenantId = :tenantId', { tenantId });
      if (userFilter) qb.andWhere('ot.userId = :userFilter', { userFilter });
      if (gueltigVon) qb.andWhere('ot.datum >= :von', { von: gueltigVon });
      if (gueltigBis) qb.andWhere('ot.datum <= :bis', { bis: gueltigBis });
      return qb;
    };

    // 1) Gebuchte Minuten je Auftrag.
    const bookedRows = await applyFilter(this.repo.createQueryBuilder('ot'))
      .select('ot.orderId', 'orderId')
      .addSelect('SUM(ot.minuten)', 'gebucht')
      .groupBy('ot.orderId')
      .getRawMany<{ orderId: string; gebucht: string }>();
    const gebuchtById = new Map(bookedRows.map((r) => [r.orderId, Number(r.gebucht) || 0]));
    const summeGebuchtMinuten = bookedRows.reduce((s, r) => s + (Number(r.gebucht) || 0), 0);

    // 2) Gebuchte Minuten je Mitarbeiter.
    const perUserRows = await applyFilter(this.repo.createQueryBuilder('ot'))
      .select('ot.userId', 'userId')
      .addSelect('SUM(ot.minuten)', 'gebucht')
      .groupBy('ot.userId')
      .getRawMany<{ userId: string; gebucht: string }>();

    const orderIds = [...gebuchtById.keys()];
    if (orderIds.length === 0) {
      return { auftraege: [], proMitarbeiter: [], summeGebuchtMinuten: 0 };
    }

    // 3) Auftraege (Soll-Override + Nummer + Kunde + Status) tenant-scoped.
    const orders = await this.orderRepo.find({
      where: { id: In(orderIds), tenantId },
      select: ['id', 'auftragsnummer', 'customerId', 'status', 'geplanteDauerMinuten'],
    });

    // 4) Positions-Soll je Auftrag (nur fuer Auftraege OHNE Override relevant).
    //    order_items hat keine tenantId – die orderIds stammen bereits aus
    //    tenant-scoped Auftraegen, daher ist das In(orderIds) tenant-sicher.
    const itemSollRows = await this.orderItemRepo
      .createQueryBuilder('i')
      .select('i.orderId', 'orderId')
      .addSelect('SUM(i.geplanteDauerMinuten)', 'soll')
      .where('i.orderId IN (:...ids)', { ids: orderIds })
      .groupBy('i.orderId')
      .getRawMany<{ orderId: string; soll: string }>();
    const itemSollById = new Map(itemSollRows.map((r) => [r.orderId, Number(r.soll) || 0]));

    // 5) Kundennamen sammeln.
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean))];
    const customers = custIds.length
      ? await this.customerRepo.find({
          where: { id: In(custIds), tenantId },
          select: ['id', 'firstName', 'lastName', 'companyName'],
        })
      : [];
    const kundeById = new Map(
      customers.map((c) => [
        c.id,
        c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
      ]),
    );

    const auftraege: UebersichtZeile[] = orders.map((o) => {
      const sollMinuten =
        o.geplanteDauerMinuten != null ? Number(o.geplanteDauerMinuten) || 0 : itemSollById.get(o.id) ?? 0;
      const gebuchtMinuten = gebuchtById.get(o.id) ?? 0;
      return {
        orderId: o.id,
        auftragsnummer: o.auftragsnummer,
        kundeName: kundeById.get(o.customerId) ?? '—',
        status: o.status,
        sollMinuten,
        gebuchtMinuten,
        abweichungMinuten: gebuchtMinuten - sollMinuten,
      };
    });
    // Am staerksten ueber Plan zuerst (die relevanten Ausreisser oben).
    auftraege.sort((a, b) => b.abweichungMinuten - a.abweichungMinuten);

    // 6) Mitarbeiternamen fuer die Personen-Aggregation.
    const userIds = [...new Set(perUserRows.map((r) => r.userId).filter(Boolean))];
    const users = userIds.length
      ? await this.userRepo.find({
          where: { id: In(userIds), tenantId },
          select: ['id', 'firstName', 'lastName'],
        })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id]),
    );
    const proMitarbeiter = perUserRows
      .map((r) => ({
        userId: r.userId,
        name: nameById.get(r.userId) ?? '—',
        gebuchtMinuten: Number(r.gebucht) || 0,
      }))
      .sort((a, b) => b.gebuchtMinuten - a.gebuchtMinuten);

    return { auftraege, proMitarbeiter, summeGebuchtMinuten };
  }

  /**
   * Bucht Arbeitszeit auf einen Auftrag. Mandantentrennung: der Auftrag muss zum
   * eigenen Betrieb gehoeren (sonst 404) und darf nicht abgerechnet/storniert sein
   * (sonst 409). `userId` wird NUR fuer die Leitung beachtet – ein normaler
   * Mitarbeiter bucht immer auf sich selbst (Anti-Betrug).
   */
  async create(user: AuthUser, dto: CreateOrderTimeDto): Promise<OrderTimeView> {
    await this.assertBuchbarerAuftrag(user.tenantId, dto.orderId);

    let userId = user.id;
    if (this.istLeitung(user.role) && dto.userId) {
      await assertRefInTenant(this.userRepo, user, dto.userId, 'Mitarbeiter');
      userId = dto.userId;
    }

    const eintrag = this.repo.create({
      tenantId: user.tenantId,
      orderId: dto.orderId,
      userId,
      datum: new Date(dto.datum),
      minuten: dto.minuten,
      notiz: dto.notiz,
      erfasstVon: user.id,
    });
    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'OrderTime',
      entityId: saved.id,
      payload: { orderId: dto.orderId, minuten: dto.minuten, fuerUser: userId },
    });
    return (await this.decorate(user.tenantId, [saved], this.istLeitung(user.role)))[0];
  }

  /**
   * Korrigiert einen Eintrag. Erlaubt fuer die Leitung (alle) oder den EIGENTUEMER
   * der Buchung (eigene Zeit) – solange der Auftrag nicht abgerechnet/storniert ist.
   * Das Umbuchen auf einen anderen Mitarbeiter (dto.userId) bleibt der Leitung
   * vorbehalten.
   */
  async update(user: AuthUser, id: string, dto: UpdateOrderTimeDto): Promise<OrderTimeView> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Zeiteintrag nicht gefunden');

    const leitung = this.istLeitung(user.role);
    if (!leitung && eintrag.userId !== user.id) {
      throw new ForbiddenException('Nur eigene Zeitbuchungen können geändert werden.');
    }
    // Sperre pruefen (abgerechnet/storniert -> keine Aenderung).
    await this.assertBuchbarerAuftrag(user.tenantId, eintrag.orderId);

    // Truthy-Check (nicht !== undefined): ein leerer String wuerde von
    // assertRefInTenant als "keine FK" durchgewunken und den Eintrag verwaisen
    // lassen. Nur die Leitung darf zudem den Mitarbeiter umbuchen.
    if (leitung && dto.userId) {
      await assertRefInTenant(this.userRepo, user, dto.userId, 'Mitarbeiter');
      eintrag.userId = dto.userId;
    }
    if (dto.datum !== undefined) eintrag.datum = new Date(dto.datum);
    if (dto.minuten !== undefined) eintrag.minuten = dto.minuten;
    if (dto.notiz !== undefined) eintrag.notiz = dto.notiz;

    const saved = await this.repo.save(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'OrderTime',
      entityId: id,
    });
    return (await this.decorate(user.tenantId, [saved], leitung))[0];
  }

  /**
   * Arbeitszeiten-Export als CSV fuers Lohnbuero (NUR Leitung – enthaelt
   * Loehne; der Controller gated per @Roles). Detailzeilen je Buchung +
   * Summenblock je Mitarbeiter. Lohnkosten = aktueller Stundenlohn * Dauer.
   */
  async buildPayrollCsv(
    tenantId: string,
    von?: string,
    bis?: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const where: Record<string, unknown> = { tenantId };
    const vonD = von ? new Date(von) : null;
    const bisD = bis ? new Date(bis) : null;
    if (bisD) bisD.setHours(23, 59, 59, 999); // inklusiver Endtag
    if (vonD && bisD) where.datum = Between(vonD, bisD);
    else if (vonD) where.datum = MoreThanOrEqual(vonD);
    else if (bisD) where.datum = LessThanOrEqual(bisD);

    const rows = await this.repo.find({ where, order: { userId: 'ASC', datum: 'ASC' } });

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const orderIds = [...new Set(rows.map((r) => r.orderId))];
    const users = userIds.length
      ? await this.userRepo.find({
          where: { id: In(userIds), tenantId },
          select: ['id', 'firstName', 'lastName', 'stundenlohn'],
        })
      : [];
    const orders = orderIds.length
      ? await this.orderRepo.find({ where: { id: In(orderIds), tenantId }, select: ['id', 'auftragsnummer'] })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id]),
    );
    const lohnById = new Map(users.map((u) => [u.id, Number(u.stundenlohn ?? 0)]));
    const auftragById = new Map(orders.map((o) => [o.id, o.auftragsnummer]));

    const SEP = ';';
    const csv = (s: unknown) => {
      const v = String(s ?? '');
      return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const num = (n: number) => Number(n).toFixed(2).replace('.', ',');
    const datumDe = (d: Date) => {
      const x = new Date(d);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
    };

    const zeilen = [['Mitarbeiter', 'Datum', 'Auftrag', 'Notiz', 'Stunden', 'Stundenlohn', 'Lohnkosten'].join(SEP)];
    const summe = new Map<string, { name: string; std: number; kosten: number }>();
    let gesamtStd = 0;
    let gesamtKosten = 0;
    for (const r of rows) {
      const std = Number(r.minuten) / 60;
      const lohn = lohnById.get(r.userId) ?? 0;
      const kosten = Math.round(std * lohn * 100) / 100;
      const name = nameById.get(r.userId) ?? '—';
      zeilen.push(
        [
          csv(name),
          datumDe(r.datum),
          csv(auftragById.get(r.orderId) ?? ''),
          csv(r.notiz ?? ''),
          num(std),
          num(lohn),
          num(kosten),
        ].join(SEP),
      );
      const agg = summe.get(r.userId) ?? { name, std: 0, kosten: 0 };
      agg.std += std;
      agg.kosten += kosten;
      summe.set(r.userId, agg);
      gesamtStd += std;
      gesamtKosten += kosten;
    }

    // Summenblock je Mitarbeiter (durch Leerzeile getrennt).
    zeilen.push('');
    zeilen.push('Summe je Mitarbeiter');
    zeilen.push(['Mitarbeiter', 'Stunden', 'Lohnkosten'].join(SEP));
    for (const agg of summe.values()) {
      zeilen.push([csv(agg.name), num(agg.std), num(agg.kosten)].join(SEP));
    }
    zeilen.push(['Gesamt', num(gesamtStd), num(gesamtKosten)].join(SEP));

    // BOM fuer korrekte Umlaut-Darstellung in Excel; CRLF-Zeilenenden.
    const buffer = Buffer.from('﻿' + zeilen.join('\r\n') + '\r\n', 'utf-8');
    const range = [von, bis].filter(Boolean).join('_') || 'alle';
    return { buffer, filename: `Arbeitszeiten_${range}.csv`, contentType: 'text/csv; charset=utf-8' };
  }

  /**
   * Loescht einen Eintrag. Erlaubt fuer die Leitung (alle) oder den EIGENTUEMER
   * (eigene Zeit) – solange der Auftrag nicht abgerechnet/storniert ist.
   */
  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId: user.tenantId } });
    if (!eintrag) throw new NotFoundException('Zeiteintrag nicht gefunden');

    if (!this.istLeitung(user.role) && eintrag.userId !== user.id) {
      throw new ForbiddenException('Nur eigene Zeitbuchungen können gelöscht werden.');
    }
    await this.assertBuchbarerAuftrag(user.tenantId, eintrag.orderId);

    await this.repo.remove(eintrag);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'OrderTime',
      entityId: id,
    });
    return { success: true };
  }
}
