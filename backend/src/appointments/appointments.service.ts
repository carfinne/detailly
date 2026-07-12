import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, Between, DataSource, EntityManager } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { PatchAppointmentTimeDto } from './dto/patch-appointment-time.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import {
  KonfliktScope,
  assertKeinTerminKonflikt,
  ladeKonfliktSettings,
} from '../common/kalender/appointment-overlap';

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
    @InjectDataSource() private readonly dataSource: DataSource,
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

  /**
   * Doppelbuchungs-Schutz + Speichern in EINER Transaktion (race-sicher, kein
   * read-then-write; Muster analog shop.service.createRental). Die
   * Konflikt-Settings des Betriebs (warnen/blockieren, Standort-Check) werden im
   * selben Transaktions-Snapshot gelesen. `persist` legt den Termin im Manager an.
   */
  private async speichereMitKonfliktpruefung(
    user: AuthUser,
    scope: KonfliktScope,
    konfliktBestaetigt: boolean | undefined,
    persist: (m: EntityManager) => Promise<Appointment>,
  ): Promise<Appointment> {
    return this.dataSource.transaction(async (m) => {
      const settings = await ladeKonfliktSettings(m, user.tenantId);
      await assertKeinTerminKonflikt(m, user.tenantId, scope, settings, konfliktBestaetigt);
      return persist(m);
    });
  }

  /**
   * Termine in einem Zeitraum (Plantafel) ODER – wenn customerId gesetzt ist –
   * alle Termine eines Kunden (neueste zuerst, fuer die Kunden-Detailansicht).
   */
  findRange(tenantId: string, from?: string, to?: string, customerId?: string): Promise<Appointment[]> {
    if (customerId) {
      return this.repo.find({
        where: { tenantId, customerId },
        order: { start: 'DESC' },
        take: 50,
      });
    }
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    // take: Sicherheitsventil (T-009), kein Produktlimit - der Zeitraum begrenzt
    // die Menge ohnehin (Plantafel laedt wochenweise); faengt absurde Ranges ab.
    return this.repo.find({
      where: { tenantId, start: Between(start, end) },
      order: { start: 'ASC' },
      take: 1000,
    });
  }

  async findOne(tenantId: string, id: string): Promise<Appointment> {
    const appt = await this.repo.findOne({ where: { id, tenantId } });
    if (!appt) throw new NotFoundException('Termin nicht gefunden');
    return appt;
  }

  async create(user: AuthUser, dto: CreateAppointmentDto): Promise<Appointment> {
    await this.assertRefs(user, dto);
    const start = new Date(dto.start);
    const ende = new Date(dto.ende);
    // Plausibilitaet: Das Ende muss nach dem Start liegen (kein leerer/negativer
    // Zeitraum in der Plantafel).
    if (!(ende.getTime() > start.getTime())) {
      throw new BadRequestException('Das Ende des Termins muss nach dem Start liegen.');
    }
    const { konfliktBestaetigt, ...rest } = dto;
    return this.speichereMitKonfliktpruefung(
      user,
      {
        start,
        ende,
        assignedUserId: dto.assignedUserId ?? null,
        locationId: dto.locationId ?? null,
        status: dto.status,
      },
      konfliktBestaetigt,
      (m) => m.save(m.create(Appointment, { ...rest, tenantId: user.tenantId, start, ende })),
    );
  }

  async update(user: AuthUser, id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const appt = await this.findOne(user.tenantId, id);
    await this.assertRefs(user, dto);
    const { konfliktBestaetigt, ...rest } = dto;
    Object.assign(appt, rest);
    if (dto.start) appt.start = new Date(dto.start);
    if (dto.ende) appt.ende = new Date(dto.ende);
    // Plausibilitaet auch nach Teil-Update: Ende muss nach Start liegen (der
    // effektive Zeitraum nach dem Patch wird geprueft, nicht nur die neuen Felder).
    if (!(appt.ende.getTime() > appt.start.getTime())) {
      throw new BadRequestException('Das Ende des Termins muss nach dem Start liegen.');
    }
    return this.speichereMitKonfliktpruefung(
      user,
      {
        id: appt.id,
        start: appt.start,
        ende: appt.ende,
        assignedUserId: appt.assignedUserId ?? null,
        locationId: appt.locationId ?? null,
        status: appt.status,
      },
      konfliktBestaetigt,
      (m) => m.save(appt),
    );
  }

  /**
   * Verschieben eines Termins auf der Plantafel (Drag & Drop): nur Start/Ende und
   * optional der zugewiesene Mitarbeiter (Ziehen in eine andere Spalte). Loest den
   * gleichen Doppelbuchungs-Schutz aus wie create/update.
   */
  async patchTime(user: AuthUser, id: string, dto: PatchAppointmentTimeDto): Promise<Appointment> {
    const appt = await this.findOne(user.tenantId, id);
    if (dto.assignedUserId !== undefined) {
      await assertRefInTenant(this.userRepo, user, dto.assignedUserId, 'Mitarbeiter');
      // '' entfernt die Zuweisung (assertRefInTenant behandelt '' als "nicht gesetzt").
      appt.assignedUserId = (dto.assignedUserId || null) as unknown as string;
    }
    const start = new Date(dto.start);
    const ende = new Date(dto.ende);
    if (!(ende.getTime() > start.getTime())) {
      throw new BadRequestException('Das Ende des Termins muss nach dem Start liegen.');
    }
    appt.start = start;
    appt.ende = ende;
    return this.speichereMitKonfliktpruefung(
      user,
      {
        id: appt.id,
        start,
        ende,
        assignedUserId: appt.assignedUserId ?? null,
        locationId: appt.locationId ?? null,
        status: appt.status,
      },
      dto.konfliktBestaetigt,
      (m) => m.save(appt),
    );
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const appt = await this.findOne(user.tenantId, id);
    await this.repo.remove(appt);
    return { success: true };
  }
}
