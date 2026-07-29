import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { ServiceItem } from '../services/entities/service-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { MailService } from '../mailer/mail.service';
import { resolveKalender } from '../common/kalender/kalender-config';
import { resolveBuchung, type BuchungModus } from '../common/kalender/buchung-config';
import { sanitizeLogoUrl } from '../common/logo-url';
import {
  berechneFreieSlots,
  istSlotModusAktiv,
  parseDatumStrikt,
} from '../common/kalender/slot-berechnung';
import { findeBelegteTermineBetriebsweit } from '../common/kalender/appointment-overlap';
import { resolveSteuer } from '../common/steuer';
import { baueImpressum, resolveImpressum, type ImpressumAusgabe } from '../common/impressum';
import { anrede, formatDatumZeit, htmlLink, linesToHtml, type MailZeile } from '../mailer/kunden-mail';
import {
  WIDERRUF_KARENZ_MS,
  baueMusterWiderrufsformular,
  baueWiderrufsbelehrung,
  istInnerhalbWiderrufsfrist,
  type WiderrufBetrieb,
} from '../common/booking/widerruf';

/**
 * Maximale Aufbewahrung unbearbeiteter/abgelehnter Anfragen (Tage). Single Source
 * of Truth: sowohl der create-getriggerte Backstop (cleanupOld) als auch der
 * periodische Retention-Job (BookingRetentionService) verwenden diesen Wert.
 */
export const RETENTION_DAYS = 90;
/** Pro-Betrieb-Obergrenze pro Stunde (gegen verteilte Bots, ergaenzt IP-Throttle). */
const TENANT_HOURLY_CAP = 20;

/**
 * Missbrauchs-Deckel fuer die Kunden-Bestaetigungsmail: max. so viele Bestaetigungs-
 * Mails pro (Betrieb, E-Mail) und Stunde. Verhindert Mail-Bombing / Fake-
 * Bestaetigungen an eine fremd eingegebene Adresse, ohne eine (unverhaeltnismaessige)
 * Mail-Verifikation zu verlangen. Der Buchungs-Datensatz entsteht weiterhin – nur der
 * (wiederholte) Mailversand an dieselbe Adresse wird gedrosselt. 3/Stunde ist fuer
 * jede legitime Nutzung reichlich (4+ Buchungen mit derselben Adresse beim selben
 * Betrieb in einer Stunde sind praktisch nur Missbrauch).
 */
const BESTAETIGUNG_MAIL_CAP = 3;

/** Nach aussen sichtbare Betriebsdaten (STRIKTE Whitelist – keine internen IDs/E-Mail). */
export interface PublicBetrieb {
  name: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
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
  /**
   * Rechtlicher Abschluss-Modus der Buchungsseite (PII-frei). Steuert im Frontend
   * Button-Wortlaut + Pflicht-Zustimmungen: `anfrage` (unverbindlich, Default) vs.
   * `verbindlich` (§312j-Button-Loesung + Widerruf).
   */
  modus: BuchungModus;
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
    private readonly config: ConfigService,
  ) {}

  /**
   * Basis-URL fuer den Status-Link in der Kunden-Bestaetigung (gleiches Muster wie
   * OrdersService/BookingRequestsService.appBaseUrl). Zeigt auf die oeffentliche,
   * login-freie Status-Seite des Frontends.
   */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

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
        modus: buchung.modus,
      },
      betrieb: {
        name: tenant.name,
        phone: tenant.phone ?? null,
        street: tenant.street ?? null,
        city: tenant.city ?? null,
        postalCode: tenant.postalCode ?? null,
        country: tenant.country ?? null,
        // Gemeinsame Whitelist (Defense-in-Depth): nur http(s) ODER validiertes
        // data:image-Raster – kein SVG/text/javascript ins oeffentliche <img>.
        logoUrl: sanitizeLogoUrl(tenant.logoUrl),
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
    // Preis/Einheit werden fuer die Pflichtinfo (Gesamtpreis/Berechnungsgrundlage)
    // der Kunden-Bestaetigung mitgeladen.
    let serviceName: string | undefined;
    let svc: Pick<ServiceItem, 'name' | 'basispreis' | 'einheit'> | null = null;
    if (dto.serviceItemId) {
      svc = await this.serviceRepo.findOne({
        where: { id: dto.serviceItemId, tenantId: tenant.id, aktiv: true },
        select: ['id', 'name', 'basispreis', 'einheit'],
      });
      if (!svc) throw new BadRequestException('Die gewählte Leistung ist nicht verfügbar.');
      serviceName = svc.name;
    }

    // Rechtlicher Abschluss-Modus des Betriebs (serverseitig, NIE aus dem Client).
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const modus = resolveBuchung(settings.buchung).modus;
    const wunschterminDate = dto.wunschtermin ? new Date(dto.wunschtermin) : undefined;
    const jetzt = new Date();

    // Verbraucherrechtliche DURCHSETZUNG (nur `verbindlich`): fehlt eine noetige
    // Zustimmung -> 400. Im Modus `anfrage` kommt kein Vertrag zustande, daher
    // wird KEINE Widerruf-/Pflichtinfo-Zustimmung verlangt.
    let pflichtinfoBestaetigtAm: string | undefined;
    let vorzeitigerLeistungsbeginnAm: string | undefined;
    if (modus === 'verbindlich') {
      // §312f BGB: die Bestaetigung auf dauerhaftem Datentraeger (inkl.
      // Widerrufsbelehrung) MUSS zustellbar sein – ohne E-Mail beginnt die
      // Widerrufsfrist nicht (§356 Abs. 3) und der Vertrag waere ohne pflicht-
      // gemaesse Bestaetigung geschlossen. Daher im verbindlichen Modus E-Mail
      // HART erzwingen (Telefon-only bleibt nur der unverbindlichen Anfrage).
      if (!email) {
        throw new BadRequestException(
          'Für eine verbindliche, zahlungspflichtige Buchung benötigen wir Ihre E-Mail-Adresse (für die Buchungsbestätigung und die Widerrufsbelehrung).',
        );
      }
      // §312j Abs. 2 BGB: wesentliche Merkmale + Gesamtpreis muessen unmittelbar
      // vor dem Button feststehen. Ohne gewaehlte Leistung gibt es weder das eine
      // noch das andere -> ein verbindlicher, zahlungspflichtiger Vertrag waere
      // inhaltsleer. Eine Leistung ist daher Pflicht (Freitext-Wunsch gehoert in
      // den `anfrage`-Modus).
      if (!svc) {
        throw new BadRequestException(
          'Für eine verbindliche Buchung wählen Sie bitte eine Leistung aus.',
        );
      }
      if (dto.pflichtinfoBestaetigt !== true) {
        throw new BadRequestException(
          'Bitte bestätigen Sie die Pflichtinformationen und die Widerrufsbelehrung, um zahlungspflichtig zu buchen.',
        );
      }
      pflichtinfoBestaetigtAm = jetzt.toISOString();
      // §356 Abs. 4 BGB: Beginnt die Leistung vor Ablauf der 14-taegigen
      // Widerrufsfrist, ist die ausdrueckliche Zustimmung zum vorzeitigen
      // Leistungsbeginn Pflicht.
      if (istInnerhalbWiderrufsfrist(wunschterminDate, jetzt, WIDERRUF_KARENZ_MS)) {
        if (dto.vorzeitigerLeistungsbeginn !== true) {
          throw new BadRequestException(
            'Für einen Termin innerhalb der 14-tägigen Widerrufsfrist benötigen wir Ihre ausdrückliche Zustimmung zum vorzeitigen Leistungsbeginn.',
          );
        }
        vorzeitigerLeistungsbeginnAm = jetzt.toISOString();
      }
    }
    // Datenschutz-Kenntnisnahme: freiwillig (Kopplungsverbot) – nur als Nachweis
    // gespeichert, blockiert nie.
    const datenschutzHinweisAm =
      dto.datenschutzHinweis === true ? jetzt.toISOString() : undefined;

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
      wunschtermin: wunschterminDate,
      nachricht: dto.nachricht?.trim() || undefined,
      status: BookingRequestStatus.NEU,
      reference,
      sourceIpHash: this.hashIp(ip),
      // Verbraucherrechtlicher Abschluss-Nachweis (§312j/§356 BGB).
      abschlussModus: modus,
      pflichtinfoBestaetigtAm,
      vorzeitigerLeistungsbeginnAm,
      datenschutzHinweisAm,
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
    // Bestaetigung an den Endkunden auf dauerhaftem Datentraeger (§312f BGB):
    // im Modus `verbindlich` MIT Vertragsinhalt + Widerrufsbelehrung/-formular,
    // im Modus `anfrage` als unverbindliche Eingangsbestaetigung. Transaktional,
    // fire-and-forget – ein Mail-Problem darf die Absendung NIE blockieren.
    void this.sendKundenBestaetigung(tenant, entity, modus, svc);

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

  /**
   * Bestaetigung an den Endkunden auf dauerhaftem Datentraeger (§312f BGB).
   *
   * Modus `verbindlich`: vollstaendiger Vertragsinhalt (Leistung, Termin,
   * Gesamtpreis/Berechnungsgrundlage, Betriebs-Identitaet) + Widerrufsbelehrung +
   * Muster-Widerrufsformular – LEGAL PFLICHT, daher NICHT durch das Opt-out-Flag
   * unterdrueckbar.
   * Modus `anfrage`: unverbindliche Eingangsbestaetigung (Anfrageinhalt + klarer
   * Hinweis "es kommt noch kein Vertrag zustande") – Kulanz-Mail, respektiert das
   * Opt-out-Flag kundenmailTerminbestaetigung='0'.
   *
   * BLOCKIERT NIE: alles in try/catch, ohne Kunden-E-Mail kein Versand.
   */
  private async sendKundenBestaetigung(
    tenant: Tenant,
    req: BookingRequest,
    modus: BuchungModus,
    svc: Pick<ServiceItem, 'name' | 'basispreis' | 'einheit'> | null,
  ): Promise<void> {
    try {
      const email = req.email?.trim();
      if (!email) return;

      const settings = (tenant.settings ?? {}) as Record<string, unknown>;
      // Nur im unverbindlichen Modus ist der Versand abschaltbar; die verbindliche
      // §312f-Bestaetigung ist zwingend.
      if (modus === 'anfrage' && settings.kundenmailTerminbestaetigung === '0') return;

      // Missbrauchs-Deckel gegen Mail-Bombing an eine fremd eingegebene Adresse:
      // die IP-/Betriebs-Throttles begrenzen das Gesamtvolumen, aber NICHT die
      // Zahl der Mails an EIN bestimmtes Opfer. Daher hier je (Betrieb, E-Mail) und
      // Stunde deckeln. Der schon gespeicherte Datensatz zaehlt mit -> ab dem
      // (CAP+1)-ten Eingang wird der Mailversand ausgelassen (der Betrieb sieht die
      // Buchung dennoch).
      const seitEinerStunde = new Date(Date.now() - 60 * 60 * 1000);
      const mailsLetzteStunde = await this.bookingRepo.count({
        where: { tenantId: tenant.id, email, createdAt: MoreThan(seitEinerStunde) },
      });
      if (mailsLetzteStunde > BESTAETIGUNG_MAIL_CAP) {
        this.logger.warn(
          `Kunden-Bestaetigung gedrosselt (Missbrauchs-Deckel ${BESTAETIGUNG_MAIL_CAP}/h je Adresse). request=${req.id}`,
        );
        return;
      }

      const betrieb = tenant.name?.trim() || 'Ihr Aufbereitungsbetrieb';
      const identitaet = this.betriebIdentitaetZeilen(tenant);
      const wunsch = req.wunschtermin ? formatDatumZeit(new Date(req.wunschtermin)) : null;

      const kopf: string[] = [anrede(req.name), ''];
      const anliegen: string[] = [];
      if (req.serviceName) anliegen.push(`Leistung: ${req.serviceName}`);
      anliegen.push(this.preisInfoZeile(svc, modus));
      if (wunsch) anliegen.push(`Termin: ${wunsch}`);
      if (req.fahrzeug) anliegen.push(`Fahrzeug: ${req.fahrzeug}`);
      anliegen.push(`Referenz: ${req.reference}`);

      let subject: string;
      let einleitung: string[];
      const rechtsBloecke: string[] = [];
      if (modus === 'verbindlich') {
        subject = `Buchungsbestätigung von ${betrieb}`;
        einleitung = [
          'vielen Dank für Ihre verbindliche, zahlungspflichtige Buchung. Diese Nachricht bestätigt den Vertragsschluss und enthält die gesetzlichen Pflichtinformationen.',
        ];
        if (req.vorzeitigerLeistungsbeginnAm) {
          rechtsBloecke.push(
            '',
            'Vorzeitiger Leistungsbeginn: Sie haben ausdrücklich verlangt, dass mit der Ausführung vor Ablauf der Widerrufsfrist begonnen wird, und bestätigt, dass Sie bei vollständiger Vertragserfüllung Ihr Widerrufsrecht verlieren.',
          );
        }
        const widerrufBetrieb = this.widerrufBetrieb(tenant);
        rechtsBloecke.push('', ...baueWiderrufsbelehrung(widerrufBetrieb));
        rechtsBloecke.push('', ...baueMusterWiderrufsformular(widerrufBetrieb));
      } else {
        subject = `Eingang Ihrer Terminanfrage bei ${betrieb}`;
        einleitung = [
          'vielen Dank für Ihre unverbindliche Terminanfrage. Mit dieser Anfrage kommt noch kein Vertrag zustande – der Betrieb meldet sich, um Ihren Termin zu bestätigen.',
        ];
      }

      const anbieter = ['', 'Ihr Vertragspartner:', ...identitaet];
      const schluss = ['', 'Mit freundlichen Grüßen', betrieb];

      // Klickbarer Status-Link auf die oeffentliche, login-freie Status-Seite. Die
      // Referenz ist der Zugang (?ref=AF-...); die Seite zeigt nur PII-arme Infos
      // (Betrieb/Status/Leistung/Termin), nie Kontaktdaten. Text und HTML werden
      // getrennt aufgebaut (Muster orders.service): im Text die nackte URL, im HTML
      // der htmlLink-Baustein – so entsteht im Text nie "[object Object]".
      const statusUrl = `${this.appBaseUrl()}/status/?ref=${encodeURIComponent(req.reference)}`;
      const statusHinweis = 'Den Status Ihrer Anfrage können Sie jederzeit hier einsehen:';
      const statusBlockText = ['', statusHinweis, statusUrl];
      const statusBlockHtml: MailZeile[] = [
        '',
        statusHinweis,
        htmlLink(statusUrl, 'Status Ihrer Anfrage ansehen'),
      ];

      const textZeilen: string[] = [
        ...kopf,
        ...einleitung,
        '',
        ...anliegen,
        ...statusBlockText,
        ...anbieter,
        ...rechtsBloecke,
        ...schluss,
      ];
      const htmlZeilen: MailZeile[] = [
        ...kopf,
        ...einleitung,
        '',
        ...anliegen,
        ...statusBlockHtml,
        ...anbieter,
        ...rechtsBloecke,
        ...schluss,
      ];

      await this.mail.send({
        to: email,
        subject,
        html: linesToHtml(htmlZeilen),
        text: textZeilen.join('\n'),
        replyTo: tenant.email?.trim() || undefined,
        tenantId: tenant.id,
      });
      this.logger.log(`Kunden-Bestaetigung (${modus}) versendet. request=${req.id}`);
    } catch (e) {
      this.logger.warn(`Kunden-Bestaetigung fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  /** Betriebs-Identitaet (Vertragspartner) als Textzeilen fuer die Bestaetigung. */
  private betriebIdentitaetZeilen(tenant: Tenant): string[] {
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const steuer = resolveSteuer(settings.steuer);
    const impressum = baueImpressum({
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
      ustId: typeof settings.ustId === 'string' ? settings.ustId.trim() : '',
      berufshaftpflicht: resolveImpressum(settings.impressum).berufshaftpflicht,
      aufsichtsbehoerde: resolveImpressum(settings.impressum).aufsichtsbehoerde,
    });
    const zeilen: string[] = [];
    const nameZeile = [impressum.firmenname, impressum.rechtsformLabel].filter(Boolean).join(' · ');
    if (nameZeile) zeilen.push(nameZeile);
    if (impressum.anschrift.strasse) zeilen.push(impressum.anschrift.strasse);
    if (impressum.anschrift.plzOrt) zeilen.push(impressum.anschrift.plzOrt);
    if (impressum.anschrift.land) zeilen.push(impressum.anschrift.land);
    if (impressum.telefon) zeilen.push(`Telefon: ${impressum.telefon}`);
    if (impressum.email) zeilen.push(`E-Mail: ${impressum.email}`);
    if (impressum.ustId) zeilen.push(`USt-IdNr.: ${impressum.ustId}`);
    return zeilen;
  }

  /** Betriebs-Kontaktdaten fuer die Widerrufsbelehrung/das Muster-Formular. */
  private widerrufBetrieb(tenant: Tenant): WiderrufBetrieb {
    const plzOrt = [tenant.postalCode ?? '', tenant.city ?? ''].map((s) => s.trim()).filter(Boolean).join(' ');
    const land = (tenant.country ?? '').trim();
    return {
      name: tenant.name?.trim() ?? '',
      strasse: tenant.street?.trim() ?? '',
      plzOrt,
      land: !land || land.toUpperCase() === 'DE' ? 'Deutschland' : land,
      telefon: tenant.phone?.trim() ?? '',
      email: tenant.email?.trim() ?? '',
    };
  }

  /**
   * Pflichtinfo-Zeile zum Preis (Art. 246a §1 EGBGB): Gesamtpreis ODER
   * Berechnungsgrundlage, je nach Einheit der Leistung. Ohne gewaehlte Leistung
   * bleibt der Endpreis der Begutachtung vorbehalten.
   */
  private preisInfoZeile(
    svc: Pick<ServiceItem, 'basispreis' | 'einheit'> | null,
    modus: BuchungModus,
  ): string {
    if (!svc) {
      return modus === 'verbindlich'
        ? 'Gesamtpreis: nach Begutachtung des Fahrzeugs / individueller Absprache.'
        : 'Preis: nach Begutachtung / individueller Absprache.';
    }
    const betrag = `${Number(svc.basispreis).toFixed(2).replace('.', ',')} €`;
    if (svc.einheit === 'qm') {
      return `Berechnungsgrundlage: ${betrag} pro m² – der Gesamtpreis ergibt sich nach Aufmaß/Begutachtung.`;
    }
    if (svc.einheit === 'stunde') {
      return `Berechnungsgrundlage: ${betrag} pro Stunde – der Gesamtpreis ergibt sich nach Aufwand.`;
    }
    // Pauschale (Festpreis): im verbindlichen Modus ist das der VERBINDLICHE
    // Gesamtpreis (Art. 246a §1 Nr. 4 EGBGB – Gesamtpreis unmittelbar vor dem
    // Button), kein Richtwert-Vorbehalt. Im anfrage-Modus bleibt es ein Richtwert.
    if (modus === 'verbindlich') {
      return `Gesamtpreis: ${betrag}`;
    }
    return `Preis (Richtwert): ${betrag} – der verbindliche Endpreis wird nach Begutachtung ermittelt.`;
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
