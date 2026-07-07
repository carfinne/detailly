import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class VehiclesService {
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
