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
import { Appointment } from '../appointments/entities/appointment.entity';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { MailService } from '../mailer/mail.service';
import { resolveKalender } from '../common/kalender/kalender-config';
import { resolveBuchung } from '../common/kalender/buchung-config';
import {
  berechneFreieSlots,
  istSlotModusAktiv,
  parseDatumStrikt,
} from '../common/kalender/slot-berechnung';
import { findeBelegteTermineBetriebsweit } from '../common/kalender/appointment-overlap';
import { resolveSteuer } from '../common/steuer';
import { baueImpressum, resolveImpressum, type ImpressumAusgabe } from '../common/impressum';

/**
 * Maximale Aufbewahrung unbearbeiteter/abgelehnter Anfragen (Tage). Single Source
 * of Truth: sowohl der create-getriggerte Backstop (cleanupOld) als auch der
 * periodische Retention-Job (BookingRetentionService) verwenden diesen Wert.
 */
export const RETENTION_DAYS = 90;
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
 * PII-freier Buchungs-Meta-Block der oeffentlichen Betriebsinfo (W2): sagt dem
 * Portal, OB der Slot-Picker aktiv ist (Arbeitszeiten gepflegt) und mit welchen
 * Rahmenwerten (Slot-Dauer, Vorlauf). Bewusst KEINE Arbeitszeiten-Details –
 * konkrete Zeiten liefert nur der Slots-Endpoint je Tag.
 */
export interface PublicBuchungMeta {
  slotModus: boolean;
  slotDauerMin: number;
  vorlaufMinStunden: number;
  vorlaufMaxTage: number;
}

/** Freie Slots eines Tages – NUR Zeitfenster, keine IDs/Titel/Personen (PII-frei). */
export interface PublicSlots {
  datum: string;
  slotDauerMin: number;
  slots: string[];
}

/**
 * Oeffentliche Status-Ansicht einer Terminanfrage (per Referenz abrufbar).
 * BEWUSST minimal: KEINE Kontaktdaten (Name/E-Mail/Telefon/Nachricht) – nur was
 * der Anfragende ohnehin kennt, plus der Bearbeitungsstand.
 */
export interface PublicBookingStatus {
  betrieb: string;
  /** Slug des Betriebs (public, PII-frei) – ermoeglicht den Impressum-Footer-Link. */
  betriebSlug: string | null;
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
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
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
        // Nur fuer die serverseitige Slot-/Portal-Konfiguration (kalender/buchung)
        // – verlaesst das Backend NIE als Ganzes (strikte Whitelist unten).
        'settings',
      ],
    });
    if (!tenant || tenant.status === TenantStatus.INACTIVE) {
      throw new NotFoundException('Betrieb nicht gefunden');
    }
    return tenant;
  }

  /** Oeffentliche Betriebsinfo + buchbare (aktive) Leistungen + Buchungs-Meta. */
  async getBetrieb(slug: string): Promise<{
    betrieb: PublicBetrieb;
    leistungen: PublicLeistung[];
    buchung: PublicBuchungMeta;
  }> {
    const tenant = await this.resolveTenant(slug);
    const leistungen = await this.serviceRepo.find({
      where: { tenantId: tenant.id, aktiv: true },
      order: { kategorie: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'beschreibung', 'kategorie', 'basispreis', 'einheit'],
    });
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const kalender = resolveKalender(settings.kalender);
    const buchung = resolveBuchung(settings.buchung);
    return {
      buchung: {
        slotModus: istSlotModusAktiv(settings.kalender),
        slotDauerMin: kalender.slotDauerMin,
        vorlaufMinStunden: buchung.vorlaufMinStunden,
        vorlaufMaxTage: buchung.vorlaufMaxTage,
      },
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
   * Freie Slots EINES Tages fuer das oeffentliche Buchungsportal (W2). Striktes
   * Datums-Parsing (Format-Muell -> 400 ohne DB-Treffer), Tenant NUR aus dem
   * Slug, Belegung betriebsweit (tenant-scoped, Status geplant/bestaetigt/laeuft).
   * Antwort ist STRIKT PII-frei: nur 'HH:MM'-Zeitfenster, keine IDs/Titel/Namen.
   * Zeitzonen-Annahme: Server-Lokalzeit (siehe slot-berechnung.ts).
   */
  async getSlots(slug: string, datum: string): Promise<PublicSlots> {
    const d = parseDatumStrikt((datum || '').trim());
    if (!d) throw new BadRequestException('Bitte ein Datum im Format JJJJ-MM-TT angeben.');

    const tenant = await this.resolveTenant(slug);
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const kalender = resolveKalender(settings.kalender);

    // Slot-Modus aus (Arbeitszeiten nicht gepflegt) -> leere Liste statt Slots aus
    // Default-Arbeitszeiten: das Portal zeigt dann den Freitext-Flow, und der
    // Endpoint verraet keine (womoeglich falschen) Default-Oeffnungszeiten.
    if (!istSlotModusAktiv(settings.kalender)) {
      return { datum: (datum || '').trim(), slotDauerMin: kalender.slotDauerMin, slots: [] };
    }

    const buchung = resolveBuchung(settings.buchung);
    // Belegte Termine des Tages laden – Fenster um den Puffer erweitert, damit
    // auch ein knapp ausserhalb liegender Termin per Puffer in den Tag hineinragt.
    const pufferMs = kalender.pufferMin * 60_000;
    const tagesanfang = new Date(d.jahr, d.monat - 1, d.tag, 0, 0, 0, 0);
    const tagesende = new Date(d.jahr, d.monat - 1, d.tag + 1, 0, 0, 0, 0);
    const belegt = await findeBelegteTermineBetriebsweit(
      this.appointmentRepo.manager,
      tenant.id,
      new Date(tagesanfang.getTime() - pufferMs),
      new Date(tagesende.getTime() + pufferMs),
    );
    const slots = berechneFreieSlots(
      d,
      kalender,
      buchung,
      belegt.map((b) => ({ start: new Date(b.start), ende: new Date(b.ende) })),
      new Date(),
    );
    return { datum: (datum || '').trim(), slotDauerMin: kalender.slotDauerMin, slots };
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
      select: ['id', 'name', 'slug'],
    });
    return {
      betrieb: tenant?.name ?? 'Detailly',
      betriebSlug: tenant?.slug ?? null,
      status: req.status,
      leistung: req.serviceName ?? null,
      wunschtermin: req.wunschtermin ? new Date(req.wunschtermin).toISOString() : null,
      eingegangenAm: new Date(req.createdAt).toISOString(),
    };
  }

  /**
   * OEFFENTLICHES Impressum des Betriebs (§ 5 DDG) – strikt PII-frei nach dem
   * Whitelist-Prinzip (baueImpressum): NUR die Angaben, die ohnehin veroeffentlicht
   * werden MUESSEN (Firma, Anschrift, vertretungsber. Person, Telefon, E-Mail,
   * Registerangaben, USt-IdNr. sowie optional Berufshaftpflicht/Aufsichtsbehoerde).
   * NIEMALS Steuernummer, IBAN, DATEV, interne IDs oder Kundendaten.
   *
   * Best-effort: fehlende Felder bleiben leer und werden in der Anzeige ausgelassen –
   * der Impressum-Link muss laut § 5 DDG immer erreichbar sein. Die Vollstaendigkeits-
   * warnung sieht NUR der eingeloggte Betrieb (Einstellungen), nie der Endkunde.
   */
  async getImpressum(slug: string): Promise<ImpressumAusgabe> {
    const tenant = await this.resolveTenant(slug);
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const steuer = resolveSteuer(settings.steuer);
    const impressum = resolveImpressum(settings.impressum);
    const ustId = typeof settings.ustId === 'string' ? settings.ustId.trim() : '';
    return baueImpressum({
      firmenname: tenant.name ?? '',
      strasse: tenant.street ?? '',
      plz: tenant.postalCode ?? '',
      ort: tenant.city ?? '',
      land: tenant.country ?? '',
      telefon: tenant.phone ?? '',
      email: tenant.email ?? '',
      rechtsform: steuer.rechtsform,
      vertretungsberechtigte: steuer.vertretungsberechtigte,
      registergericht: steuer.registergericht,
      registernummer: steuer.registernummer,
      // NUR die USt-IdNr. (§ 27a) – die Steuernummer gehoert NIE ins Impressum.
      ustId,
      berufshaftpflicht: impressum.berufshaftpflicht,
      aufsichtsbehoerde: impressum.aufsichtsbehoerde,
    });
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

    // Aufbewahrung begrenzen: opportunistischer Backstop, der beim Eingang alte,
    // nicht angenommene Anfragen dieses Betriebs entfernt. Die verlaessliche
    // Loeschung (auch bei geringem Anfrage-Volumen) leistet der periodische
    // BookingRetentionService – dieser create-getriggerte Aufruf bleibt als
    // guenstiger Zusatz erhalten.
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
    // Kein statischer Fallback-Salt mehr: JWT_SECRET ist per env.validation Pflicht
    // beim Boot. Faellt es wider Erwarten weg, ist ein leerer Salt ehrlicher als
    // ein oeffentlich bekannter ('detailly'), der Pseudonymisierung nur vortaeuscht.
    const salt = process.env.JWT_SECRET ?? '';
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
