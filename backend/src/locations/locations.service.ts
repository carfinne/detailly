import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    await this.repo.remove(location);
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
   */
  async auswertung(tenantId: string): Promise<StandortAuswertung[]> {
    const [standorte, orders, termine, rechnungen] = await Promise.all([
      this.repo.find({ where: { tenantId } }),
      this.orderRepo.find({ where: { tenantId } }),
      this.apptRepo.find({ where: { tenantId } }),
      this.invoiceRepo.find({
        where: { tenantId, art: InvoiceKind.RECHNUNG, status: InvoiceStatus.BEZAHLT },
      }),
    ]);

    // orderId -> locationId fuer die Umsatzzuordnung der Rechnungen.
    const orderLocation = new Map<string, string | undefined>();
    for (const o of orders) orderLocation.set(o.id, o.locationId);

    const init = (): Omit<StandortAuswertung, 'locationId' | 'name'> => ({
      umsatz: 0,
      offeneAuftraege: 0,
      termine: 0,
    });

    const OHNE = '__ohne__';
    const werte = new Map<string, Omit<StandortAuswertung, 'locationId' | 'name'>>();
    werte.set(OHNE, init());
    for (const s of standorte) werte.set(s.id, init());

    const bucket = (locId?: string) => {
      const key = locId && werte.has(locId) ? locId : OHNE;
      return werte.get(key)!;
    };

    for (const o of orders) {
      if (OFFENE_STATUS.includes(o.status)) bucket(o.locationId).offeneAuftraege += 1;
    }
    for (const t of termine) bucket(t.locationId).termine += 1;
    for (const r of rechnungen) {
      const locId = r.orderId ? orderLocation.get(r.orderId) : undefined;
      bucket(locId).umsatz += Number(r.brutto);
    }

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
