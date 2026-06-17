import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
  ) {}

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

  create(user: AuthUser, dto: CreateAppointmentDto): Promise<Appointment> {
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
