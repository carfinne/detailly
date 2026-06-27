import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { AcceptBookingRequestDto } from './dto/accept-booking-request.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

/**
 * Nach aussen (Operator-Client) sichtbare Sicht auf eine Anfrage. BEWUSST OHNE
 * interne/forensische Felder wie sourceIpHash und tenantId (Datensparsamkeit –
 * der gehashte Kunden-IP gehoert nicht in die Verwaltungs-UI).
 */
export interface BookingRequestView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  serviceName: string | null;
  fahrzeug: string | null;
  wunschtermin: Date | null;
  nachricht: string | null;
  status: BookingRequestStatus;
  reference: string;
  createdAt: Date;
}

@Injectable()
export class BookingRequestsService {
  constructor(
    @InjectRepository(BookingRequest) private readonly repo: Repository<BookingRequest>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Projektion auf die nach aussen sichtbaren Felder (kein sourceIpHash/tenantId). */
  private toView(r: BookingRequest): BookingRequestView {
    return {
      id: r.id,
      name: r.name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      serviceName: r.serviceName ?? null,
      fahrzeug: r.fahrzeug ?? null,
      wunschtermin: r.wunschtermin ?? null,
      nachricht: r.nachricht ?? null,
      status: r.status,
      reference: r.reference,
      createdAt: r.createdAt,
    };
  }

  /** Anfragen des eigenen Betriebs, neueste zuerst. Optional nach Status gefiltert. */
  async findAll(tenantId: string, status?: BookingRequestStatus): Promise<BookingRequestView[]> {
    const where: Record<string, unknown> = { tenantId };
    // Nur gueltige Enum-Werte als Filter zulassen (ungueltig -> ignorieren statt leer).
    if (status && Object.values(BookingRequestStatus).includes(status)) where.status = status;
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toView(r));
  }

  /** Anzahl neuer (unbearbeiteter) Anfragen – fuer das Navigations-Badge. */
  async countNeu(tenantId: string): Promise<{ neu: number }> {
    const neu = await this.repo.count({
      where: { tenantId, status: BookingRequestStatus.NEU },
    });
    return { neu };
  }

  async findOne(tenantId: string, id: string): Promise<BookingRequest> {
    const req = await this.repo.findOne({ where: { id, tenantId } });
    if (!req) throw new NotFoundException('Anfrage nicht gefunden');
    return req;
  }

  /**
   * Nimmt eine Anfrage an: erzeugt einen bestaetigten Termin (+ optional einen
   * Kunden aus den Kontaktdaten) und markiert die Anfrage als angenommen – alles
   * in EINER Transaktion. Der Status-Guard liegt INNERHALB der Transaktion, damit
   * ein zweifaches Annehmen (Race) nicht doppelt Termine erzeugt.
   */
  async accept(
    user: AuthUser,
    id: string,
    dto: AcceptBookingRequestDto,
  ): Promise<{ appointment: Appointment; request: BookingRequestView }> {
    const result = await this.dataSource.transaction(async (m) => {
      const req = await m.findOne(BookingRequest, { where: { id, tenantId: user.tenantId } });
      if (!req) throw new NotFoundException('Anfrage nicht gefunden');
      if (req.status !== BookingRequestStatus.NEU) {
        throw new BadRequestException('Diese Anfrage wurde bereits bearbeitet.');
      }

      const start = dto.start
        ? new Date(dto.start)
        : req.wunschtermin
          ? new Date(req.wunschtermin)
          : new Date();
      const ende = dto.ende ? new Date(dto.ende) : new Date(start.getTime() + 60 * 60 * 1000);
      if (ende.getTime() <= start.getTime()) {
        throw new BadRequestException('Das Ende muss nach dem Beginn liegen.');
      }
      const titel = dto.titel?.trim() || `Online-Anfrage: ${req.name}`;

      // Optional Kunde anlegen (Default: ja). Bewusst der direkte Repo-Pfad statt
      // CustomersService (der braucht einen User-Kontext fuer Audit/sevDesk-Sync).
      let customerId: string | undefined;
      if (dto.kundeAnlegen !== false) {
        const [firstName, ...rest] = req.name.trim().split(/\s+/);
        const customer = await m.save(
          m.create(Customer, {
            tenantId: user.tenantId,
            type: CustomerType.PRIVATE,
            firstName: firstName || req.name,
            lastName: rest.join(' ') || undefined,
            email: req.email || undefined,
            phone: req.phone || undefined,
            notes: this.buildNotes(req),
            isActive: true,
          }),
        );
        customerId = customer.id;
      }

      const appointment = await m.save(
        m.create(Appointment, {
          tenantId: user.tenantId,
          titel,
          start,
          ende,
          status: AppointmentStatus.BESTAETIGT,
          customerId,
          notiz: this.buildNotiz(req),
        }),
      );

      req.status = BookingRequestStatus.ANGENOMMEN;
      await m.save(req);

      return { appointment, request: req, customerId };
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'booking_request_accepted',
      entityType: 'BookingRequest',
      entityId: id,
      payload: { appointmentId: result.appointment.id, customerId: result.customerId },
    });

    return { appointment: result.appointment, request: this.toView(result.request) };
  }

  /** Lehnt eine Anfrage ab. Es entsteht KEIN Stammdatensatz. */
  async reject(user: AuthUser, id: string): Promise<BookingRequestView> {
    const req = await this.findOne(user.tenantId, id);
    if (req.status !== BookingRequestStatus.NEU) {
      throw new BadRequestException('Diese Anfrage wurde bereits bearbeitet.');
    }
    req.status = BookingRequestStatus.ABGELEHNT;
    const saved = await this.repo.save(req);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'booking_request_rejected',
      entityType: 'BookingRequest',
      entityId: id,
    });
    return this.toView(saved);
  }

  /** Kundennotiz aus der Anfrage (Herkunft + Freitext). */
  private buildNotes(req: BookingRequest): string {
    const teile = ['Aus Online-Terminanfrage'];
    if (req.nachricht) teile.push(`Nachricht: ${req.nachricht}`);
    return teile.join(' · ');
  }

  /** Terminnotiz aus der Anfrage (Leistung/Fahrzeug/Nachricht/Referenz). */
  private buildNotiz(req: BookingRequest): string {
    const teile: string[] = [];
    if (req.serviceName) teile.push(`Leistung: ${req.serviceName}`);
    if (req.fahrzeug) teile.push(`Fahrzeug: ${req.fahrzeug}`);
    if (req.nachricht) teile.push(`Nachricht: ${req.nachricht}`);
    teile.push(`Anfrage-Referenz: ${req.reference}`);
    return teile.join('\n');
  }
}
