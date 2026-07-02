import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { AuditService } from '../audit/audit.service';
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
   * Rechnet in der DB (GROUP-BY), NICHT in JS: frueher wurden ALLE Orders/Termine/
   * bezahlten Rechnungen als volle Entities geladen (inkl. AES-Decrypt pro Zeile) und
   * in Schleifen summiert -> linear zum Haenger bei Volumen. Jetzt drei Aggregat-
   * Queries (portabel SQLite + Postgres, Muster wie platform-analytics.service).
   */
  async auswertung(tenantId: string): Promise<StandortAuswertung[]> {
    const [standorte, offeneRows, terminRows, umsatzRows] = await Promise.all([
      this.repo.find({ where: { tenantId } }),
      // Offene Auftraege je Standort (COUNT), nur die offenen Status.
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.locationId', 'locationId')
        .addSelect('COUNT(*)', 'anzahl')
        .where('o.tenantId = :tenantId', { tenantId })
        .andWhere('o.status IN (:...offen)', { offen: OFFENE_STATUS })
        .groupBy('o.locationId')
        .getRawMany<{ locationId: string | null; anzahl: string }>(),
      // Termine je Standort (COUNT).
      this.apptRepo
        .createQueryBuilder('a')
        .select('a.locationId', 'locationId')
        .addSelect('COUNT(*)', 'anzahl')
        .where('a.tenantId = :tenantId', { tenantId })
        .groupBy('a.locationId')
        .getRawMany<{ locationId: string | null; anzahl: string }>(),
      // Umsatz je Standort: bezahlte Rechnungen, Standort ueber den verknuepften
      // Auftrag. leftJoin (nicht inner!), damit Rechnungen OHNE orderId erhalten
      // bleiben (o.locationId = null -> "Ohne Standort"), exakt wie die alte Logik.
      this.invoiceRepo
        .createQueryBuilder('i')
        .leftJoin(Order, 'o', 'o.id = i.orderId')
        .select('o.locationId', 'locationId')
        .addSelect('COALESCE(SUM(i.brutto), 0)', 'umsatz')
        .where('i.tenantId = :tenantId', { tenantId })
        .andWhere('i.art = :art', { art: InvoiceKind.RECHNUNG })
        .andWhere('i.status = :status', { status: InvoiceStatus.BEZAHLT })
        .groupBy('o.locationId')
        .getRawMany<{ locationId: string | null; umsatz: string }>(),
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

    // Roh-Rows in Buckets falten: eine locationId, die keinem AKTIVEN (nicht soft-
    // geloeschten) Standort entspricht (null oder z.B. geloeschter Standort), faellt
    // in den OHNE-Bucket -- identisch zum frueheren werte.has(locId)-Check.
    const bucket = (locId: string | null) => {
      const key = locId && werte.has(locId) ? locId : OHNE;
      return werte.get(key)!;
    };
    for (const r of offeneRows) bucket(r.locationId).offeneAuftraege += Number(r.anzahl);
    for (const r of terminRows) bucket(r.locationId).termine += Number(r.anzahl);
    for (const r of umsatzRows) bucket(r.locationId).umsatz += Number(r.umsatz);

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
