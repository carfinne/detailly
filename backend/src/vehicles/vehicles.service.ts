import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { clampPageQuery } from '../common/util/pagination';

/**
 * Sicherheitsventil fuer den unpaginierten Array-Modus (T-009) - KEIN
 * Produktlimit. Bewusst ueber der Loadtest-Groesse (1500 Fahrzeuge), damit
 * Dropdowns (Plantafel, Fahrzeugannahme, Inspektion) vollstaendig bleiben.
 */
const MAX_ARRAY_VEHICLES = 2000;

/** Wie viele letzte Auftraege der Kennzeichen-Lookup je Fahrzeug zurueckgibt. */
const LOOKUP_RECENT_ORDERS = 5;

// Re-Export fuer Bestands-Verwender (Specs, kuenftige Aufrufer); die Definition
// lebt jetzt in kennzeichen.util.ts, damit die Vehicle-Entity sie hook-seitig
// nutzen kann ohne Zirkular-Import.
export { normalizeKennzeichen } from './kennzeichen.util';
import { normalizeKennzeichen } from './kennzeichen.util';

/** Schlanke Projektion einer Fahrzeug-Zeile fuer den Schnellannahme-Lookup. */
export interface VehicleLookupOrder {
  id: string;
  auftragsnummer: string;
  serviceType: string;
  status: string;
  createdAt: Date;
}
export interface VehicleLookupResult {
  found: boolean;
  /** Das normalisierte, gesuchte Kennzeichen (fuer die Anzeige im Frontend). */
  kennzeichen: string;
  vehicle: {
    id: string;
    customerId: string;
    make: string;
    model: string;
    variant: string | null;
    year: number | null;
    color: string | null;
    licensePlate: string | null;
    fuelType: string | null;
  } | null;
  customer: {
    id: string;
    type: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
  } | null;
  recentOrders: VehicleLookupOrder[];
}

/**
 * Vorschlaege fuer die Marke-/Modell-Eingabehilfe: die vom EIGENEN Betrieb
 * bereits erfassten Marken und Marke/Modell-Kombinationen. Kein Voll-Scan,
 * kein N+1 — zwei schlanke GROUP-BY-Aggregate, nach Haeufigkeit sortiert und
 * hart gedeckelt.
 */
export interface VehicleSuggestions {
  makes: string[];
  models: { make: string; model: string }[];
}

/** Deckel fuer die Historien-Vorschlaege (Payload klein halten). */
const SUGGESTION_MAKE_LIMIT = 100;
const SUGGESTION_MODEL_LIMIT = 500;

@Injectable()
export class VehiclesService implements OnModuleInit {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Backfill fuer Bestandsdaten: Fahrzeuge, die vor Einfuehrung der Spalte
   * kennzeichenNormalisiert angelegt wurden (oder an den Entity-Hooks vorbei,
   * z. B. Loadtest-insertChunked), bekommen sie hier beim Boot nachgezogen.
   * Idempotent + billig: trifft nur Zeilen mit Kennzeichen aber ohne Normalform;
   * im Regelbetrieb ist das Ergebnis leer. Bewusst JS-seitig normalisiert
   * (umlautfest) statt per SQL UPPER() — genau dessen SQLite-ASCII-Verhalten
   * war der Bug. Kein tenant-Filter: technischer Systemjob ueber alle Betriebe,
   * es fliessen keine Daten nach aussen.
   */
  async onModuleInit(): Promise<void> {
    const offen = await this.repo.find({
      select: ['id', 'licensePlate'],
      where: { licensePlate: Not(IsNull()), kennzeichenNormalisiert: IsNull() },
      withDeleted: true,
    });
    for (const fahrzeug of offen) {
      const norm = normalizeKennzeichen(fahrzeug.licensePlate) || null;
      if (norm) await this.repo.update(fahrzeug.id, { kennzeichenNormalisiert: norm });
    }
  }

  /**
   * Fahrzeug-Liste. ABWAERTSKOMPATIBEL (T-009): ohne page/limit das bisherige
   * Array (Dropdowns/Bestands-Consumer), gedeckelt per Sicherheitsventil;
   * MIT page/limit eine paginierte Antwort {data,total,page,limit}.
   */
  async findAll(
    tenantId: string,
    query: { customerId?: string; page?: number; limit?: number } = {},
  ) {
    // Listen-Projektion: NUR die in Fahrzeug-Listen/Dropdowns gezeigten Spalten.
    // Spart Payload (notes-Text, vin, ppfTemplate, colorCode, masse, estimatedSqm
    // u.a. wurden mitgeschickt: ~719KB bei 1500 Fahrzeugen). Detailfelder kommen
    // aus findOne/getDossier. Der QueryBuilder respektiert Soft-Delete automatisch
    // (deletedAt IS NULL), solange kein withDeleted() gesetzt ist.
    const qb = this.repo
      .createQueryBuilder('v')
      .select([
        'v.id',
        'v.customerId',
        'v.make',
        'v.model',
        'v.variant',
        'v.year',
        'v.color',
        'v.licensePlate',
        'v.fuelType',
        'v.createdAt',
      ])
      .where('v.tenantId = :tenantId', { tenantId });
    if (query.customerId) {
      qb.andWhere('v.customerId = :customerId', { customerId: query.customerId });
    }
    qb.orderBy('v.createdAt', 'DESC');

    if (query.page == null && query.limit == null) {
      return qb.take(MAX_ARRAY_VEHICLES).getMany();
    }

    const { page, limit, skip, take } = clampPageQuery(query);
    const [data, total] = await qb.skip(skip).take(take).getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Kennzeichen-Schnellsuche fuer die Fahrzeugannahme. STRIKT tenant-gescopt:
   * die tenantId kommt aus dem JWT (req.user), NIE aus dem Client. Sucht das
   * Fahrzeug des eigenen Betriebs (Kennzeichen tolerant normalisiert) und liefert
   * eine schlanke Projektion: Fahrzeug-Basisdaten + minimaler Kunde + die letzten
   * Auftraege genau dieses Fahrzeugs. Kein Voll-Entity-Dump, keine Fremd-Tenant-
   * Daten. Bei leerem/zu kurzem Kennzeichen oder ohne Treffer: found=false ohne
   * Fehler (der Aufrufer faellt dann in den normalen Neuanlage-Flow).
   */
  async lookupByKennzeichen(tenantId: string, kennzeichenRoh: string): Promise<VehicleLookupResult> {
    const kennzeichen = normalizeKennzeichen(kennzeichenRoh);
    const leer: VehicleLookupResult = {
      found: false,
      kennzeichen,
      vehicle: null,
      customer: null,
      recentOrders: [],
    };
    // Erst ab 2 Zeichen suchen (spart Last bei getippten Einzelzeichen).
    if (kennzeichen.length < 2) return leer;

    // Vergleich gegen die serverseitig befuellte Spalte kennzeichenNormalisiert
    // (JS-Normalisierung, siehe Entity-Hooks) statt DB-seitigem UPPER():
    // SQLite uppercased nur ASCII, Umlaut-Kuerzel (LÖ/MÜ/SÜW) traefen sonst nie.
    // Nebeneffekt: die Punktabfrage nutzt den Index (tenantId, kennzeichenNormalisiert).
    // Der tenantId-Filter ist der erste WHERE-Zweig -> fail-closed gegen
    // Cross-Tenant-Leaks.
    const vehicle = await this.repo
      .createQueryBuilder('v')
      .select([
        'v.id',
        'v.customerId',
        'v.make',
        'v.model',
        'v.variant',
        'v.year',
        'v.color',
        'v.licensePlate',
        'v.fuelType',
      ])
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.kennzeichenNormalisiert = :kennzeichen', { kennzeichen })
      .orderBy('v.createdAt', 'DESC')
      .getOne();

    if (!vehicle) return leer;

    // Kunde (minimal) + letzte Auftraege des Fahrzeugs – beide erneut tenant-scoped.
    const [customer, recentOrders] = await Promise.all([
      this.customerRepo.findOne({
        where: { id: vehicle.customerId, tenantId },
        select: ['id', 'type', 'firstName', 'lastName', 'companyName'],
      }),
      this.orderRepo.find({
        where: { tenantId, vehicleId: vehicle.id },
        order: { createdAt: 'DESC' },
        take: LOOKUP_RECENT_ORDERS,
        select: ['id', 'auftragsnummer', 'serviceType', 'status', 'createdAt'],
      }),
    ]);

    return {
      found: true,
      kennzeichen,
      vehicle: {
        id: vehicle.id,
        customerId: vehicle.customerId,
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant ?? null,
        year: vehicle.year ?? null,
        color: vehicle.color ?? null,
        licensePlate: vehicle.licensePlate ?? null,
        fuelType: vehicle.fuelType ?? null,
      },
      customer: customer
        ? {
            id: customer.id,
            type: customer.type,
            firstName: customer.firstName ?? null,
            lastName: customer.lastName ?? null,
            companyName: customer.companyName ?? null,
          }
        : null,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        auftragsnummer: o.auftragsnummer,
        serviceType: o.serviceType,
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }

  /**
   * Marke-/Modell-Vorschlaege aus der EIGENEN Historie (Eingabehilfe beim
   * Fahrzeug-Anlegen). STRIKT tenant-gescopt: tenantId kommt aus dem JWT, nie
   * aus dem Client. Zwei GROUP-BY-Aggregate (make; make+model), nach Haeufigkeit
   * absteigend sortiert (die im Betrieb gaengigsten Marken zuerst) und gedeckelt.
   *
   * Kein N+1, kein Voll-Entity-Dump: es fliessen nur die reinen Textwerte make/
   * model zurueck. Soft-geloeschte Zeilen bleiben aussen vor (QueryBuilder setzt
   * deletedAt IS NULL automatisch). Der tenantId-Filter ist der erste WHERE-Zweig
   * -> fail-closed gegen Cross-Tenant-Leaks. (make/model sind NOT-NULL-Spalten;
   * die Leerwert-Filter sind reine Defensive.)
   */
  async suggestions(tenantId: string): Promise<VehicleSuggestions> {
    const makeRows = await this.repo
      .createQueryBuilder('v')
      .select('v.make', 'make')
      .addSelect('COUNT(*)', 'cnt')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.make IS NOT NULL')
      .andWhere("v.make <> ''")
      .groupBy('v.make')
      .orderBy('cnt', 'DESC')
      .addOrderBy('v.make', 'ASC')
      .limit(SUGGESTION_MAKE_LIMIT)
      .getRawMany<{ make: string; cnt: number }>();

    const modelRows = await this.repo
      .createQueryBuilder('v')
      .select('v.make', 'make')
      .addSelect('v.model', 'model')
      .addSelect('COUNT(*)', 'cnt')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('v.make IS NOT NULL')
      .andWhere("v.make <> ''")
      .andWhere('v.model IS NOT NULL')
      .andWhere("v.model <> ''")
      .groupBy('v.make')
      .addGroupBy('v.model')
      .orderBy('cnt', 'DESC')
      .addOrderBy('v.model', 'ASC')
      .limit(SUGGESTION_MODEL_LIMIT)
      .getRawMany<{ make: string; model: string; cnt: number }>();

    return {
      makes: makeRows.map((r) => r.make),
      models: modelRows.map((r) => ({ make: r.make, model: r.model })),
    };
  }

  async findOne(tenantId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.repo.findOne({ where: { id, tenantId } });
    if (!vehicle) throw new NotFoundException('Fahrzeug nicht gefunden');
    return vehicle;
  }

  /** Fahrzeugakte: Fahrzeug plus zugehoerige Auftragshistorie. */
  async getDossier(tenantId: string, id: string) {
    const vehicle = await this.findOne(tenantId, id);
    const orders = await this.orderRepo.find({
      where: { tenantId, vehicleId: id },
      order: { createdAt: 'DESC' },
    });
    return { vehicle, orders };
  }

  async create(user: AuthUser, dto: CreateVehicleDto): Promise<Vehicle> {
    // Mandantentrennung: verknuepfter Kunde muss zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection).
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    const vehicle = this.repo.create({ ...dto, tenantId: user.tenantId });
    const saved = await this.repo.save(vehicle);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Vehicle',
      entityId: saved.id,
      payload: { make: saved.make, model: saved.model, licensePlate: saved.licensePlate },
    });
    return saved;
  }

  async update(user: AuthUser, id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(user.tenantId, id);
    // Mandantentrennung: nur pruefen, wenn customerId im DTO gesetzt ist.
    if (dto.customerId !== undefined) {
      await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    }
    Object.assign(vehicle, dto);
    const saved = await this.repo.save(vehicle);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Vehicle',
      entityId: id,
      payload: dto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const vehicle = await this.findOne(user.tenantId, id);
    // Soft-Delete statt hart: erhaelt FK-Referenzen (Auftraege/Termine) + Historie.
    // Die GDPR-Anonymisierung loescht Fahrzeug-PII weiterhin physisch (eigener Pfad).
    await this.repo.softRemove(vehicle);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'Vehicle',
      entityId: id,
    });
    return { success: true };
  }
}
