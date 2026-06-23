import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
  ) {}

  /**
   * Mandantentrennung: verknuepfte Fremdschluessel muessen zum eigenen Betrieb gehoeren
   * (sonst Cross-Tenant-Reference-Injection). Optionale FKs werden nur validiert, wenn gesetzt.
   */
  private async assertRefs(
    user: AuthUser,
    dto: CreateAppointmentDto | UpdateAppointmentDto,
  ): Promise<void> {
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.vehicleRepo, user, dto.vehicleId, 'Fahrzeug');
    await assertRefInTenant(this.userRepo, user, dto.assignedUserId, 'Mitarbeiter');
    await assertRefInTenant(this.locationRepo, user, dto.locationId, 'Standort');
  }

  /** Termine in einem Zeitraum (fuer die Plantafel/Kalenderansicht). */
  findRange(tenantId: string, from?: string, to?: string): Promise<Appointment[]> {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.repo.find({
      where: { tenantId, start: Between(start, end) },
      order: { start: 'ASC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { id, tenantId } });
    if (!appt) throw new NotFoundException('Termin nicht gefunden');
    return appt;
  }

  async create(user: AuthUser, dto: CreateAppointmentDto): Promise<Appointment> {
    await this.assertRefs(user, dto);
    return this.repo.save(
      this.repo.create({
        ...dto,
        tenantId: user.tenantId,
        start: new Date(dto.start),
        ende: new Date(dto.ende),
      }),
    );
  }

  async update(user: AuthUser, id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const appt = await this.findOne(user.tenantId, id);
    await this.assertRefs(user, dto);
    Object.assign(appt, dto);
    if (dto.start) appt.start = new Date(dto.start);
    if (dto.ende) appt.ende = new Date(dto.ende);
    return this.repo.save(appt);
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const appt = await this.findOne(user.tenantId, id);
    await this.repo.remove(appt);
    return { success: true };
  }
}
