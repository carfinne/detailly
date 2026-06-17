import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, customerId?: string): Promise<Vehicle[]> {
    const where: Record<string, unknown> = { tenantId };
    if (customerId) where.customerId = customerId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
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
    await this.repo.remove(vehicle);
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
