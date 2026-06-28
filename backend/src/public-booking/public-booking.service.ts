import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { ServiceItem } from '../services/entities/service-item.entity';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { MailService } from '../mailer/mail.service';

/** Maximale unbearbeitete Aufbewahrung: opportunistisch beim Eingang aufgeraeumt. */
const RETENTION_DAYS = 90;
/** Pro-Betrieb-Obergrenze pro Stunde (gegen verteilte Bots, ergaenzt IP-Throttle). */
const TENANT_HOURLY_CAP = 20;

/** Nach aussen sichtbare Betriebsdaten (STRIKTE Whitelist – keine internen IDs/E-Mail). */
export interface PublicBetrieb {
  name: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
  businessHours: object | null;
}

export interface PublicLeistung {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  basispreis: number;
  einheit: string;
}

/**
 * Oeffentliche Status-Ansicht einer Terminanfrage (per Referenz abrufbar).
 * BEWUSST minimal: KEINE Kontaktdaten (Name/E-Mail/Telefon/Nachricht) – nur was
 * der Anfragende ohnehin kennt, plus der Bearbeitungsstand.
 */
export interface PublicBookingStatus {
  betrieb: string;
  status: string;
  leistung: string | null;
  wunschtermin: string | null;
  eingegangenAm: string;
}

@Injectable()
export class PublicBookingService {
  private readonly logger = new Logger(PublicBookingService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(ServiceItem) private readonly serviceRepo: Repository<ServiceItem>,
    @InjectRepository(BookingRequest) private readonly bookingRepo: Repository<BookingRequest>,
    private readonly mail: MailService,
  ) {}

  /**
   * Loest den Betrieb anhand des Slugs auf. Laedt nur die serverseitig benoetigten
   * Felder (inkl. id+email fuer interne Nutzung), gibt sie aber NIE direkt nach
   * aussen. Unbekannt ODER inaktiv -> 404 (keine Status-Enumeration).
   */
  private async resolveTenant(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({
      where: { slug },
      select: [
        'id',
        'name',
        'email',
        'phone',
        'street',
        'city',
        'postalCode',
        'country',
        'logoUrl',
        'businessHours',
        'status',
      ],
    });
    if (!tenant || tenant.status === TenantStatus.INACTIVE) {
      throw new NotFoundException('Betrieb nicht gefunden');
    }
    return tenant;
  }

  /** Oeffentliche Betriebsinfo + buchbare (aktive) Leistungen. */
  async getBetrieb(slug: string): Promise<{ betrieb: PublicBetrieb; leistungen: PublicLeistung[] }> {
    const tenant = await this.resolveTenant(slug);
    const leistungen = await this.serviceRepo.find({
      where: { tenantId: tenant.id, aktiv: true },
      order: { kategorie: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'beschreibung', 'kategorie', 'basispreis', 'einheit'],
    });
    return {
      betrieb: {
        name: tenant.name,
        phone: tenant.phone ?? null,
        street: tenant.street ?? null,
        city: tenant.city ?? null,
        postalCode: tenant.postalCode ?? null,
        country: tenant.country ?? null,
        logoUrl: tenant.logoUrl ?? null,
        businessHours: (tenant.businessHours as object) ?? null,
      },
      leistungen: leistungen.map((l) => ({
        id: l.id,
        name: l.name,
        beschreibung: l.beschreibung ?? null,
        kategorie: l.kategorie,
        basispreis: Number(l.basispreis),
        einheit: l.einheit,
      })),
    };
  }

  /**
   * Oeffentlicher Bearbeitungsstand einer Anfrage anhand der Referenz. Format-
   * Plausibilitaet vor dem DB-Treffer (begrenzt Enumeration). Unbekannt -> 404
   * (kein Hinweis, ob die Referenz existiert). Liefert KEINE Kontaktdaten.
   */
  async statusByReference(reference: string): Promise<PublicBookingStatus> {
    const ref = (reference || '').trim().toUpperCase();
    // Referenz-Format: "AF-" + 12 Hex (randomBytes(6)).
    if (!/^AF-[0-9A-F]{12}$/.test(ref)) throw new NotFoundException('Anfrage nicht gefunden');
    const req = await this.bookingRepo.findOne({
      where: { reference: ref },
      select: ['id', 'tenantId', 'status', 'serviceName', 'wunschtermin', 'createdAt'],
    });
    if (!req) throw new NotFoundException('Anfrage nicht gefunden');
    const tenant = await this.tenantRepo.findOne({
      where: { id: req.tenantId },
      select: ['id', 'name'],
    });
    return {
      betrieb: tenant?.name ?? 'Detailly',
      status: req.status,
      leistung: req.serviceName ?? null,
      wunschtermin: req.wunschtermin ? new Date(req.wunschtermin).toISOString() : null,
      eingegangenAm: new Date(req.createdAt).toISOString(),
    };
  }

  /**
   * Nimmt eine Terminanfrage entgegen. Antwortet NUR mit einer Referenz (kein Echo
   * der Eingaben). tenantId kommt ausschliesslich aus dem per Slug aufgeloesten
   * Betrieb, nie aus dem Body.
   */
  async createAnfrage(
    slug: string,
    dto: CreateBookingRequestDto,
    ip?: string,
  ): Promise<{ reference: string }> {
    // Honeypot: gefuellt => Bot. Erfolg vortaeuschen, NICHTS speichern.
    if (dto.website && dto.website.trim().length > 0) {
      return { reference: this.makeReference() };
    }

    const tenant = await this.resolveTenant(slug);

    const email = dto.email?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    if (!email && !phone) {
      throw new BadRequestException('Bitte mindestens E-Mail oder Telefonnummer angeben.');
    }

    // Optionale Leistung gegen den Betrieb validieren (Cross-Tenant + aktiv).
    let serviceName: string | undefined;
    if (dto.serviceItemId) {
      const svc = await this.serviceRepo.findOne({
        where: { id: dto.serviceItemId, tenantId: tenant.id, aktiv: true },
        select: ['id', 'name'],
      });
      if (!svc) throw new BadRequestException('Die gewählte Leistung ist nicht verfügbar.');
      serviceName = svc.name;
    }

    // Pro-Betrieb-Stundenlimit (verhindert E-Mail-/Datensatz-Flut eines Betriebs).
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const lastHour = await this.bookingRepo.count({
      where: { tenantId: tenant.id, createdAt: MoreThan(since) },
    });
    if (lastHour >= TENANT_HOURLY_CAP) {
      throw new HttpException(
        'Zu viele Anfragen für diesen Betrieb. Bitte später erneut versuchen.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const reference = this.makeReference();
    const entity = this.bookingRepo.create({
      tenantId: tenant.id, // serverseitig aus Slug – NIE vom Client
      name: dto.name.trim().slice(0, 100),
      email,
      phone,
      serviceItemId: dto.serviceItemId,
      serviceName,
      fahrzeug: dto.fahrzeug?.trim() || undefined,
      wunschtermin: dto.wunschtermin ? new Date(dto.wunschtermin) : undefined,
      nachricht: dto.nachricht?.trim() || undefined,
      status: BookingRequestStatus.NEU,
      reference,
      sourceIpHash: this.hashIp(ip),
    });
    await this.bookingRepo.save(entity);

    // Aufbewahrung begrenzen (kein Scheduler im Projekt): opportunistisch alte,
    // nicht angenommene Anfragen dieses Betriebs entfernen.
    void this.cleanupOld(tenant.id);
    // Eingangs-Benachrichtigung an den Betrieb (best effort, blockiert nie).
    void this.notifyBetrieb(tenant, entity);

    return { reference };
  }

  /** Loescht abgelaufene, nicht angenommene Anfragen eines Betriebs (Datensparsamkeit). */
  private async cleanupOld(tenantId: string): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await this.bookingRepo.delete({
        tenantId,
        status: Not(BookingRequestStatus.ANGENOMMEN),
        createdAt: LessThan(cutoff),
      });
    } catch (e) {
      this.logger.warn(`Retention-Cleanup fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  /** Informiert den Betrieb per Mail ueber eine neue Anfrage (No-op ohne SMTP). */
  private async notifyBetrieb(tenant: Tenant, req: BookingRequest): Promise<void> {
    const to = tenant.email?.trim();
    if (!to) return;
    try {
      const e = (s?: string | null) => this.escapeHtml(s ?? '');
      const zeile = (label: string, val?: string | null) =>
        val ? `<tr><td style="padding:2px 12px 2px 0;color:#888">${e(label)}</td><td>${e(val)}</td></tr>` : '';
      const wunsch = req.wunschtermin ? new Date(req.wunschtermin).toLocaleString('de-DE') : '';
      const html =
        `<p>Es ist eine neue Online-Terminanfrage eingegangen.</p>` +
        `<table style="font-size:14px;border-collapse:collapse">` +
        zeile('Name', req.name) +
        zeile('E-Mail', req.email) +
        zeile('Telefon', req.phone) +
        zeile('Leistung', req.serviceName) +
        zeile('Fahrzeug', req.fahrzeug) +
        zeile('Wunschtermin', wunsch) +
        zeile('Nachricht', req.nachricht) +
        zeile('Referenz', req.reference) +
        `</table>` +
        `<p style="color:#888;font-size:13px">Anfrage im Bereich „Anfragen“ annehmen oder ablehnen.</p>`;
      const text =
        `Neue Online-Terminanfrage\n\n` +
        `Name: ${req.name}\n` +
        (req.email ? `E-Mail: ${req.email}\n` : '') +
        (req.phone ? `Telefon: ${req.phone}\n` : '') +
        (req.serviceName ? `Leistung: ${req.serviceName}\n` : '') +
        (req.fahrzeug ? `Fahrzeug: ${req.fahrzeug}\n` : '') +
        (wunsch ? `Wunschtermin: ${wunsch}\n` : '') +
        (req.nachricht ? `Nachricht: ${req.nachricht}\n` : '') +
        `Referenz: ${req.reference}\n`;
      await this.mail.send({
        to,
        subject: `Neue Terminanfrage: ${req.name}`,
        html,
        text,
      });
    } catch (e) {
      this.logger.warn(`Anfrage-Benachrichtigung fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  /** Nicht-erratbare Referenz (zufaellig, kein Zaehler). */
  private makeReference(): string {
    return `AF-${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  /** IP pseudonymisieren (mit Server-Secret gesalzen -> nicht trivial reversierbar). */
  private hashIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    const salt = process.env.JWT_SECRET || 'detailly';
    return createHash('sha256').update(`${ip}${salt}`).digest('hex').slice(0, 32);
  }

  /** Minimal-Escaping fuer die (operatorseitige) Benachrichtigungs-Mail. */
  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
