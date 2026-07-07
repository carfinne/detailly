import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { AuditService } from '../audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

const OFFENE_STATUS = [
  OrderStatus.ANGEFRAGT,
  OrderStatus.KALKULIERT,
  OrderStatus.BESTAETIGT,
  OrderStatus.IN_ARBEIT,
  OrderStatus.QUALITAETSKONTROLLE,
];

export interface StandortAuswertung {
  locationId: string | null;
  name: string;
  umsatz: number;
  offeneAuftraege: number;
  termine: number;
}

/**
 * Verwaltet Standorte und liefert eine standortuebergreifende Auswertung.
 * Alle Abfragen sind tenant-gebunden (Mandantentrennung).
 */
@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location) private readonly repo: Repository<Location>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async findAll(tenantId: string): Promise<Location[]> {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Location> {
    const location = await this.repo.findOne({ where: { id, tenantId } });
    if (!location) throw new NotFoundException('Standort nicht gefunden');
    return location;
  }

  async create(user: AuthUser, dto: CreateLocationDto): Promise<Location> {
    // Tarif-Limit (maxLocations), tenant-scoped: nur AKTIVE Standorte zaehlen –
    // deaktivierte geben ihren Platz frei; soft-geloeschte filtert count() ohnehin.
    const aktiveStandorte = await this.repo.count({
      where: { tenantId: user.tenantId, isActive: true },
    });
    await this.subscriptions.assertLimit(user.tenantId, 'maxLocations', aktiveStandorte);

    const location = this.repo.create({ ...dto, tenantId: user.tenantId });
    const saved = await this.repo.save(location);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Location',
      entityId: saved.id,
    });
    return saved;
  }

  async update(user: AuthUser, id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.findOne(user.tenantId, id);
    // Reaktivierung = Anlage-Aequivalent fuers Tarif-Limit: sonst liesse sich
    // maxLocations per Deaktivieren/Reaktivieren umgehen. Gleiche Zaehlweise
    // wie in create() (nur aktive Standorte, tenant-scoped).
    if (dto.isActive === true && location.isActive === false) {
      const aktiveStandorte = await this.repo.count({
        where: { tenantId: user.tenantId, isActive: true },
      });
      await this.subscriptions.assertLimit(user.tenantId, 'maxLocations', aktiveStandorte);
    }
    Object.assign(location, dto);
    const saved = await this.repo.save(location);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Location',
      entityId: id,
    });
    return saved;
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const location = await this.findOne(user.tenantId, id);
    // Soft-Delete statt hart: erhaelt FK-Referenzen (Order/Appointment.locationId)
    // + Historie; aus Listen/Auswertung sind soft-geloeschte Standorte ausgeblendet.
    await this.repo.softRemove(location);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'Location',
      entityId: id,
    });
    return { success: true };
  }

  /**
   * Aggregiert Umsatz (bezahlte Rechnungen), offene Auftraege und Termine je
   * Standort innerhalb des Tenants. Datensaetze ohne locationId werden unter
   * "Ohne Standort" gebuendelt.
   *
   * T-009: Aggregation laeuft in der DB (COUNT/SUM + GROUP BY) statt alle
   * Orders/Termine/Rechnungen in den Speicher zu laden - JS mappt nur noch
   * eine Handvoll Gruppenzeilen in die Standort-Buckets.
   */
  async auswertung(tenantId: string): Promise<StandortAuswertung[]> {
    const [standorte, offeneRows, terminRows, umsatzRows] = await Promise.all([
      this.repo.find({ where: { tenantId } }),
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.locationId', 'locationId')
        .addSelect('COUNT(*)', 'anzahl')
        .where('o.tenantId = :tenantId', { tenantId })
        .andWhere('o.status IN (:...status)', { status: OFFENE_STATUS })
        .groupBy('o.locationId')
        .getRawMany<{ locationId: string | null; anzahl: string | number }>(),
      this.apptRepo
        .createQueryBuilder('a')
        .select('a.locationId', 'locationId')
        .addSelect('COUNT(*)', 'anzahl')
        .where('a.tenantId = :tenantId', { tenantId })
        .groupBy('a.locationId')
        .getRawMany<{ locationId: string | null; anzahl: string | number }>(),
      // Umsatz = bezahlte Rechnungen; der Standort kommt vom verknuepften
      // Auftrag (LEFT JOIN, tenant-gebunden). Rechnung ohne Auftrag/Standort
      // faellt auf NULL -> Bucket "Ohne Standort".
      this.invoiceRepo
        .createQueryBuilder('i')
        .leftJoin(Order, 'o', 'o.id = i.orderId AND o.tenantId = i.tenantId')
        .select('o.locationId', 'locationId')
        .addSelect('SUM(i.brutto)', 'summe')
        .where('i.tenantId = :tenantId', { tenantId })
        .andWhere('i.art = :art', { art: InvoiceKind.RECHNUNG })
        .andWhere('i.status = :bezahlt', { bezahlt: InvoiceStatus.BEZAHLT })
        .groupBy('o.locationId')
        .getRawMany<{ locationId: string | null; summe: string | number | null }>(),
    ]);

    const init = (): Omit<StandortAuswertung, 'locationId' | 'name'> => ({
      umsatz: 0,
      offeneAuftraege: 0,
      termine: 0,
    });

    const OHNE = '__ohne__';
    const werte = new Map<string, Omit<StandortAuswertung, 'locationId' | 'name'>>();
    werte.set(OHNE, init());
    for (const s of standorte) werte.set(s.id, init());

    // Unbekannte locationIds (z.B. soft-geloeschter Standort) landen wie bisher
    // im Bucket "Ohne Standort".
    const bucket = (locId?: string | null) => {
      const key = locId && werte.has(locId) ? locId : OHNE;
      return werte.get(key)!;
    };

    // Aggregatwerte per Number() wandeln: Postgres liefert COUNT/SUM als String,
    // SQLite als Zahl.
    for (const r of offeneRows) bucket(r.locationId).offeneAuftraege += Number(r.anzahl);
    for (const r of terminRows) bucket(r.locationId).termine += Number(r.anzahl);
    for (const r of umsatzRows) bucket(r.locationId).umsatz += Number(r.summe ?? 0);

    const ergebnis: StandortAuswertung[] = standorte.map((s) => ({
      locationId: s.id,
      name: s.name,
      ...werte.get(s.id)!,
    }));
    const ohne = werte.get(OHNE)!;
    if (ohne.umsatz > 0 || ohne.offeneAuftraege > 0 || ohne.termine > 0) {
      ergebnis.push({ locationId: null, name: 'Ohne Standort', ...ohne });
    }
    return ergebnis.map((e) => ({ ...e, umsatz: Math.round(e.umsatz * 100) / 100 }));
  }
}
