import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { MailService } from '../mailer/mail.service';
import { anrede, formatDatumZeit, linesToHtml, MailZeile } from '../mailer/kunden-mail';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import { resolveKundenkommunikation } from '../common/kundenkommunikation';

const HOUR_MS = 60 * 60 * 1000;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;
/** Standard-Intervall: stuendlich – klein genug, um Termine punktgenau (~Vorlauf) zu treffen. */
const DEFAULT_INTERVAL_MS = HOUR_MS;

/** Kennzahlen eines Job-Laufs (Rueckgabe fuer Ops/Tests, kein DB-Effekt). */
export interface TerminErinnerungErgebnis {
  /** Betriebe mit aktiver Termin-Erinnerung, die abgearbeitet wurden. */
  tenants: number;
  /** Termine im Vorlauf-Fenster insgesamt geprueft. */
  geprueft: number;
  /** Tatsaechlich versendete Erinnerungen. */
  erinnert: number;
  /** Termine, deren Erinnerung fehlschlug (uebersprungen, Lauf lief weiter). */
  fehler: number;
}

/** Aktive Terminstatus (Erinnerung nur fuer geplante/bestaetigte, kuenftige Termine). */
const AKTIVE_STATUS = [AppointmentStatus.GEPLANT, AppointmentStatus.BESTAETIGT];

/**
 * Feature 1 (Kundenkommunikation): periodischer Job, der Endkunden ~24 h vor
 * ihrem Termin EINMAL per Mail erinnert. Dependency-freier IntervalScheduler
 * (wie mahn-automatik/booking-retention), stuendlicher Lauf.
 *
 * Ablauf je Lauf:
 *  - Nur Betriebe mit `settings.kundenkommunikation.terminErinnerungAktiv === true`
 *    (Opt-in, Default AUS – Review-before-send: automatische Kunden-Mails brauchen
 *    einen bewussten Schalter). Die Vorlaufzeit (`stundenVorlauf`, Default 24) ist
 *    je Betrieb konfigurierbar.
 *  - Je Betrieb STRIKT tenant-scoped: Termine mit `start` im Fenster (jetzt .. jetzt +
 *    Vorlauf), aktivem Status (geplant/bestaetigt), gesetztem `customerId` und noch
 *    NICHT gesendeter Erinnerung (`erinnerungGesendetAm IS NULL`). Vergangene und
 *    abgesagte/abgeschlossene Termine sind ausgeschlossen.
 *
 * Doppelversand-Schutz (idempotent, nie zweimal): der Job "claimt" `erinnerungGesendetAm`
 * KONDITIONAL (WHERE ... IS NULL) VOR dem Versand. Nur wer den Claim gewinnt (affected=1),
 * sendet – zwei parallele Laeufe koennen dieselbe Erinnerung nie doppelt schicken.
 * At-most-once: schlaegt der Versand danach fehl, bleibt der Claim bestehen (kein
 * erneuter Versuch) – konsistent mit dem Fire-and-forget der uebrigen Kunden-Mails.
 *
 * Robust: Fehler je Termin/Betrieb werden gefangen und geloggt; ein Fehler stoppt
 * weder die restlichen Termine noch die restlichen Betriebe. Der Timer-Lauf wirft nie.
 */
@Injectable()
export class TerminErinnerungService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TerminErinnerungService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly mail: MailService,
  ) {
    this.scheduler = new IntervalScheduler(
      'termin-erinnerung',
      async () => {
        await this.runOnce();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext KEIN Hintergrund-Timer (Jest setzt NODE_ENV=test).
    // TERMIN_ERINNERUNG_DISABLED=1 erlaubt zusaetzlich ein bewusstes Abschalten.
    if (process.env.NODE_ENV === 'test' || process.env.TERMIN_ERINNERUNG_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (TERMIN_ERINNERUNG_INTERVAL_MS), Default 1 h, mind. 60 s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.TERMIN_ERINNERUNG_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DEFAULT_INTERVAL_MS;
  }

  /**
   * Ein Lauf: iteriert alle Betriebe mit aktiver Termin-Erinnerung und erinnert
   * deren faellige Termine. Direkt aufrufbar (Tests/Ops); `now` injizierbar fuer
   * deterministische Tests. Faengt Lade-/Verarbeitungsfehler ab und gibt eine
   * Kennzahl-Zusammenfassung zurueck.
   */
  async runOnce(now: Date = new Date()): Promise<TerminErinnerungErgebnis> {
    const ergebnis: TerminErinnerungErgebnis = { tenants: 0, geprueft: 0, erinnert: 0, fehler: 0 };

    let tenants: Tenant[];
    try {
      // id + name/email (Branding/Reply-To) + settings (verschluesselt -> Transformer).
      tenants = await this.tenantRepo.find({ select: { id: true, name: true, email: true, settings: true } });
    } catch (err) {
      this.logger.error(
        `Termin-Erinnerung: Betriebsliste konnte nicht geladen werden: ${(err as Error).message}`,
      );
      return ergebnis;
    }

    for (const tenant of tenants) {
      const cfg = resolveKundenkommunikation((tenant.settings as Record<string, unknown> | null)?.kundenkommunikation);
      if (!cfg.terminErinnerungAktiv) continue; // Erinnerung aus -> Betrieb ueberspringen
      ergebnis.tenants += 1;
      await this.processTenant(tenant, cfg.stundenVorlauf, now, ergebnis);
    }

    if (ergebnis.erinnert > 0 || ergebnis.fehler > 0) {
      this.logger.log(
        `Termin-Erinnerung: ${ergebnis.erinnert} Erinnerung(en) versendet ` +
          `(${ergebnis.tenants} Betrieb(e), ${ergebnis.geprueft} geprueft, ${ergebnis.fehler} Fehler).`,
      );
    }
    return ergebnis;
  }

  /**
   * Arbeitet die faelligen Termine EINES Betriebs ab. STRIKT auf `tenant.id`
   * beschraenkt (jede Query traegt tenantId). Fehler je Termin werden gefangen;
   * der Lauf geht weiter.
   */
  private async processTenant(
    tenant: Tenant,
    stundenVorlauf: number,
    now: Date,
    ergebnis: TerminErinnerungErgebnis,
  ): Promise<void> {
    const cutoff = new Date(now.getTime() + stundenVorlauf * HOUR_MS);
    let termine: Appointment[];
    try {
      termine = await this.appointmentRepo.find({
        where: {
          tenantId: tenant.id,
          status: In(AKTIVE_STATUS),
          customerId: Not(IsNull()),
          erinnerungGesendetAm: IsNull(),
          start: Between(now, cutoff),
        },
        order: { start: 'ASC' },
      });
    } catch (err) {
      ergebnis.fehler += 1;
      this.logger.warn(
        `Termin-Erinnerung: Terminliste fuer Betrieb ${tenant.id} fehlgeschlagen: ${(err as Error).message}`,
      );
      return;
    }

    for (const termin of termine) {
      ergebnis.geprueft += 1;
      try {
        const versendet = await this.erinnere(tenant, termin, now);
        if (versendet) ergebnis.erinnert += 1;
      } catch (err) {
        ergebnis.fehler += 1;
        this.logger.warn(
          `Termin-Erinnerung: Termin ${termin.id} (Betrieb ${tenant.id}) nicht erinnert: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Erinnert an EINEN Termin. Reihenfolge: (1) Kunde/E-Mail pruefen, (2) `erinnerungGesendetAm`
   * KONDITIONAL claimen (nur wenn noch NULL), (3) erst dann senden. So geht keine
   * Erinnerung zweimal raus. Rueckgabe: true bei tatsaechlichem Versand.
   */
  private async erinnere(tenant: Tenant, termin: Appointment, now: Date): Promise<boolean> {
    const customer = await this.customerRepo.findOne({
      where: { id: termin.customerId, tenantId: tenant.id },
    });
    const email = customer?.email?.trim();
    if (!email) {
      // Kein Kanal -> nicht claimen, nicht senden (der Termin faellt nach seinem
      // Start ohnehin aus dem Fenster; kein Endlos-Requery-Problem).
      return false;
    }

    // Doppelversand-Schutz: konditional claimen. Verliert der Claim (affected=0),
    // hat ein paralleler Lauf bereits erinnert -> hier nichts tun.
    const claim = await this.appointmentRepo.update(
      { id: termin.id, tenantId: tenant.id, erinnerungGesendetAm: IsNull() },
      { erinnerungGesendetAm: now },
    );
    if (!claim.affected) return false;

    const betrieb = tenant.name?.trim() || 'Ihr Aufbereitungsbetrieb';
    const kundeName =
      customer.type === CustomerType.BUSINESS
        ? customer.companyName
        : [customer.firstName, customer.lastName].filter(Boolean).join(' ');

    const vehicle = termin.vehicleId
      ? await this.vehicleRepo.findOne({
          where: { id: termin.vehicleId, tenantId: tenant.id },
          select: ['make', 'model', 'variant', 'licensePlate'],
        })
      : null;
    const fahrzeug = vehicle
      ? [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ')
      : '';

    const zeilen: string[] = [
      anrede(kundeName),
      '',
      `wir möchten Sie an Ihren Termin bei ${betrieb} erinnern.`,
      `Termin: ${formatDatumZeit(termin.start)}`,
    ];
    if (termin.titel?.trim()) zeilen.push(`Anlass: ${termin.titel.trim()}`);
    if (fahrzeug) {
      zeilen.push(`Fahrzeug: ${fahrzeug}${vehicle?.licensePlate ? ` (${vehicle.licensePlate})` : ''}`);
    }
    zeilen.push('', 'Bitte melden Sie sich kurz bei uns, falls der Termin nicht passt.');
    const schluss = ['', 'Mit freundlichen Grüßen', betrieb];

    const text = [...zeilen, ...schluss].join('\n');
    const htmlZeilen: MailZeile[] = [...zeilen, ...schluss];

    await this.mail.send({
      to: email,
      subject: `Terminerinnerung – ${betrieb}`,
      html: linesToHtml(htmlZeilen),
      text,
      // Antworten sollen beim Betrieb landen, nicht bei der Plattform.
      replyTo: tenant.email?.trim() || undefined,
      // Sendet – falls konfiguriert – ueber den betriebseigenen SMTP/Absender.
      tenantId: tenant.id,
    });
    this.logger.log(`Termin-Erinnerung versendet. appointment=${termin.id}`);
    return true;
  }
}
