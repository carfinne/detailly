import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

/** Max. Treffer pro Kategorie (die Palette soll kompakt bleiben). */
const LIMIT_PRO_TYP = 6;
/** Ab dieser Laenge wird gesucht (1 Zeichen liefert zu viel Rauschen). */
const MIN_LEN = 2;

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
}

export interface GlobalSearchResult {
  query: string;
  customers: SearchHit[];
  vehicles: SearchHit[];
  orders: SearchHit[];
  invoices: SearchHit[];
  appointments: SearchHit[];
  total: number;
}

// Kleine, in sich geschlossene Anzeige-Labels (bewusst kein Import aus dem
// Frontend; die Suche liefert fertige Strings, das Frontend bleibt ein dummer
// Renderer). Bei neuen Enum-Werten hier ergaenzen.
const SERVICE_LABEL: Record<string, string> = {
  aufbereitung: 'Aufbereitung',
  folierung: 'Folierung',
  ppf: 'PPF',
  sonstiges: 'Sonstiges',
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  angefragt: 'Angefragt',
  kalkuliert: 'Kalkuliert',
  bestaetigt: 'Bestätigt',
  in_arbeit: 'In Arbeit',
  qualitaetskontrolle: 'Qualitätskontrolle',
  fertig: 'Fertig',
  abgerechnet: 'Abgerechnet',
  storniert: 'Storniert',
};
const INVOICE_KIND_LABEL: Record<string, string> = {
  angebot: 'Angebot',
  rechnung: 'Rechnung',
};
const INVOICE_STATUS_LABEL: Record<string, string> = {
  entwurf: 'Entwurf',
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  storniert: 'Storniert',
};

/** DD.MM.YYYY ohne Locale-/ICU-Abhaengigkeit. */
function kurzDatum(d?: Date | null): string | undefined {
  if (!d) return undefined;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function join(parts: Array<string | undefined | null>): string | undefined {
  const s = parts.filter(Boolean).join(' · ');
  return s || undefined;
}

/**
 * Globale Suche ueber die wichtigsten Entitaeten. Strikt tenant-scoped und
 * NUR auf unverschluesselten Spalten (Select-Projektion ohne die
 * encryptedStringTransformer-Felder wie order.internerHinweis /
 * invoice.hinweis|empfaenger* -> kein Decrypt, kein Leak, kein LIKE auf
 * Zufallsbytes). Case-insensitiv portabel via LOWER(col) LIKE LOWER(:q).
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  async globalSearch(tenantId: string, rawQuery: string): Promise<GlobalSearchResult> {
    // Laenge kappen: begrenzt die Kosten des LIKE '%...%' ueber alle Spalten/Tabellen.
    const query = (rawQuery ?? '').trim().slice(0, 100);
    const leer: GlobalSearchResult = {
      query,
      customers: [],
      vehicles: [],
      orders: [],
      invoices: [],
      appointments: [],
      total: 0,
    };
    if (query.length < MIN_LEN) return leer;

    // Wildcards im User-Input entschaerfen, damit % und _ nicht als
    // LIKE-Operatoren wirken (Parameter-Binding verhindert ohnehin Injection).
    const escaped = query.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
    const like = `%${escaped}%`;

    const [customers, vehicles, orders, invoices, appointments] = await Promise.all([
      this.searchCustomers(tenantId, like),
      this.searchVehicles(tenantId, like),
      this.searchOrders(tenantId, like),
      this.searchInvoices(tenantId, like),
      this.searchAppointments(tenantId, like),
    ]);

    const total =
      customers.length + vehicles.length + orders.length + invoices.length + appointments.length;
    return { query, customers, vehicles, orders, invoices, appointments, total };
  }

  private searchCustomers(tenantId: string, like: string): Promise<SearchHit[]> {
    return this.customerRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.type', 'c.firstName', 'c.lastName', 'c.companyName', 'c.email', 'c.phone', 'c.mobile', 'c.city'])
      .where('c.tenantId = :tenantId', { tenantId })
      // isActive=false deckt auch DSGVO-anonymisierte Kunden ab (Art.17 setzt es).
      .andWhere('c.isActive = :active', { active: true })
      .andWhere(
        "(LOWER(c.firstName) LIKE :like ESCAPE '\\' OR LOWER(c.lastName) LIKE :like ESCAPE '\\' OR " +
          "LOWER(c.companyName) LIKE :like ESCAPE '\\' OR LOWER(c.email) LIKE :like ESCAPE '\\' OR " +
          "LOWER(c.phone) LIKE :like ESCAPE '\\' OR LOWER(c.mobile) LIKE :like ESCAPE '\\')",
        { like },
      )
      .orderBy('c.lastName', 'ASC')
      .limit(LIMIT_PRO_TYP)
      .getMany()
      .then((rows) =>
        rows.map((c) => {
          const person = [c.firstName, c.lastName].filter(Boolean).join(' ');
          const title =
            c.type === 'business'
              ? c.companyName || person || 'Kunde'
              : person || c.companyName || 'Kunde';
          return { id: c.id, title, subtitle: join([c.email, c.phone || c.mobile, c.city]) };
        }),
      );
  }

  private searchVehicles(tenantId: string, like: string): Promise<SearchHit[]> {
    return this.vehicleRepo
      .createQueryBuilder('v')
      .select(['v.id', 'v.make', 'v.model', 'v.variant', 'v.licensePlate', 'v.vin', 'v.year'])
      .where('v.tenantId = :tenantId', { tenantId })
      // Soft-Delete explizit (der QueryBuilder tut das per Default, aber so bleibt
      // es robust, falls jemand spaeter withDeleted()/Rohprojektion einbaut).
      .andWhere('v.deletedAt IS NULL')
      .andWhere(
        "(LOWER(v.make) LIKE :like ESCAPE '\\' OR LOWER(v.model) LIKE :like ESCAPE '\\' OR " +
          "LOWER(v.variant) LIKE :like ESCAPE '\\' OR LOWER(v.licensePlate) LIKE :like ESCAPE '\\' OR " +
          "LOWER(v.vin) LIKE :like ESCAPE '\\')",
        { like },
      )
      .orderBy('v.createdAt', 'DESC')
      .limit(LIMIT_PRO_TYP)
      .getMany()
      .then((rows) =>
        rows.map((v) => ({
          id: v.id,
          title: [v.make, v.model, v.variant].filter(Boolean).join(' ') || 'Fahrzeug',
          subtitle: join([v.licensePlate, v.year ? String(v.year) : undefined]),
        })),
      );
  }

  private searchOrders(tenantId: string, like: string): Promise<SearchHit[]> {
    return this.orderRepo
      .createQueryBuilder('o')
      .select(['o.id', 'o.auftragsnummer', 'o.serviceType', 'o.status'])
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere("LOWER(o.auftragsnummer) LIKE :like ESCAPE '\\'", { like })
      .orderBy('o.createdAt', 'DESC')
      .limit(LIMIT_PRO_TYP)
      .getMany()
      .then((rows) =>
        rows.map((o) => ({
          id: o.id,
          title: o.auftragsnummer,
          subtitle: join([SERVICE_LABEL[o.serviceType], ORDER_STATUS_LABEL[o.status]]),
        })),
      );
  }

  private searchInvoices(tenantId: string, like: string): Promise<SearchHit[]> {
    return this.invoiceRepo
      .createQueryBuilder('i')
      .select(['i.id', 'i.nummer', 'i.art', 'i.status'])
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere("LOWER(i.nummer) LIKE :like ESCAPE '\\'", { like })
      .orderBy('i.createdAt', 'DESC')
      .limit(LIMIT_PRO_TYP)
      .getMany()
      .then((rows) =>
        rows.map((i) => ({
          id: i.id,
          title: i.nummer || 'Entwurf',
          subtitle: join([INVOICE_KIND_LABEL[i.art], INVOICE_STATUS_LABEL[i.status]]),
        })),
      );
  }

  private searchAppointments(tenantId: string, like: string): Promise<SearchHit[]> {
    return this.appointmentRepo
      .createQueryBuilder('a')
      .select(['a.id', 'a.titel', 'a.start', 'a.status'])
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere("LOWER(a.titel) LIKE :like ESCAPE '\\'", { like })
      .orderBy('a.start', 'DESC')
      .limit(LIMIT_PRO_TYP)
      .getMany()
      .then((rows) =>
        rows.map((a) => ({
          id: a.id,
          title: a.titel,
          subtitle: kurzDatum(a.start),
        })),
      );
  }
}
