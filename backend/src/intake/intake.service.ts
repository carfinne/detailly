import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleIntake } from './entities/vehicle-intake.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { CreateIntakeDto } from './dto/create-intake.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';

/**
 * Verwaltet Fahrzeugannahme-Protokolle. Alle Abfragen sind tenant-gebunden
 * (Mandantentrennung gemaess deutschem Datenschutzrecht).
 */
@Injectable()
export class IntakeService {
  constructor(
    @InjectRepository(VehicleIntake)
    private readonly repo: Repository<VehicleIntake>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string): Promise<VehicleIntake[]> {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<VehicleIntake> {
    const intake = await this.repo.findOne({ where: { id, tenantId } });
    if (!intake) throw new NotFoundException('Annahmeprotokoll nicht gefunden');
    return intake;
  }

  async create(user: AuthUser, dto: CreateIntakeDto): Promise<VehicleIntake> {
    // Mandantentrennung: verknuepfte Fremdschluessel muessen zum eigenen Betrieb
    // gehoeren (sonst Cross-Tenant-Reference-Injection). vehicleId/orderId optional.
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    const intake = this.repo.create({
      tenantId: user.tenantId,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      orderId: dto.orderId,
      kmStand: dto.kmStand,
      tankstand: dto.tankstand,
      marker: dto.marker ?? [],
      notiz: dto.notiz,
    });
    const saved = await this.repo.save(intake);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'VehicleIntake',
      entityId: saved.id,
      payload: { markerAnzahl: saved.marker?.length ?? 0 },
    });
    return saved;
  }
}
