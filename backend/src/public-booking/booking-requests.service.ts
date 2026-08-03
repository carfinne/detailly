import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { BookingRequest, BookingRequestStatus } from './entities/booking-request.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Order, OrderStatus, ServiceType } from '../orders/entities/order.entity';
import { OrderItem, OrderItemType } from '../orders/entities/order-item.entity';
import { ServiceItem, ServiceCategory } from '../services/entities/service-item.entity';
import { User } from '../users/entities/user.entity';
import { AcceptBookingRequestDto } from './dto/accept-booking-request.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import {
  KONFLIKT_MAX,
  assertKeinTerminKonflikt,
  findeBelegteTermineBetriebsweit,
  ladeKonfliktSettings,
  toKonfliktPayload,
} from '../common/kalender/appointment-overlap';
import { AuditService } from '../audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MailService } from '../mailer/mail.service';
import { nextSequentialNumber } from '../common/numbering';
import { withUniqueRetry } from '../common/unique-retry';
import { resolveSteuer } from '../common/steuer';
import { anrede, formatDatumZeit, htmlLink, linesToHtml, MailZeile } from '../mailer/kunden-mail';

/**
 * ServiceItem-Kategorie -> Order-serviceType. Die Enum-WERTE sind heute identisch,
 * das explizite Mapping haelt die beiden Enums aber unabhaengig voneinander
 * (eine neue Kategorie faellt hier als Compile-Fehler auf statt still zu casten).
 */
const KATEGORIE_ZU_SERVICETYPE: Record<ServiceCategory, ServiceType> = {
  [ServiceCategory.AUFBEREITUNG]: ServiceType.AUFBEREITUNG,
  [ServiceCategory.FOLIERUNG]: ServiceType.FOLIERUNG,
  [ServiceCategory.PPF]: ServiceType.PPF,
  [ServiceCategory.SONSTIGES]: ServiceType.SONSTIGES,
};

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
  private readonly logger = new Logger(BookingRequestsService.name);

  constructor(
    @InjectRepository(BookingRequest) private readonly repo: Repository<BookingRequest>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
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
   * Kunden aus den Kontaktdaten und einen Auftrag mit der angefragten Leistung,
   * T-004) und markiert die Anfrage als angenommen – alles in EINER Transaktion.
   * Gegen doppeltes Annehmen (Race) ist der Status-Flip NEU->ANGENOMMEN ein
   * KONDITIONALES Update als erster Schritt der Transaktion: genau ein Aufrufer
   * gewinnt (affected=1), der andere bricht ab, bevor Kunde/Auftrag/Termin
   * entstehen. Wirft die Transaktion spaeter, rollt auch der Flip zurueck.
   */
  async accept(
    user: AuthUser,
    id: string,
    dto: AcceptBookingRequestDto,
  ): Promise<{
    appointment: Appointment;
    request: BookingRequestView;
    order: { id: string; auftragsnummer: string } | null;
  }> {
    // Ein Auftrag braucht zwingend einen Kunden (orders.customerId ist Pflicht):
    // widerspruechliche Flags frueh und EXPLIZIT ablehnen, statt still einen
    // Auftrag ohne Kunden zu versuchen. Nur bei ausdruecklichem true – ohne
    // Angabe wird der Auftrag unten still uebersprungen (abwaertskompatibel).
    if (dto.kundeAnlegen === false && dto.auftragAnlegen === true) {
      throw new BadRequestException(
        'Ein Auftrag benötigt einen Kunden – bitte die Kundenanlage aktivieren (kundeAnlegen).',
      );
    }

    // Tarif-Limit (maxCustomers) VOR der Transaktion pruefen: sonst waere das
    // Kunden-Limit ueber die Annahme von Online-Anfragen umgehbar. Der Hinweis
    // nennt den vorhandenen Ausweg (Annahme ohne Kundenanlage).
    if (dto.kundeAnlegen !== false) {
      const aktiveKunden = await this.dataSource
        .getRepository(Customer)
        .count({ where: { tenantId: user.tenantId, isActive: true } });
      await this.subscriptions.assertLimit(
        user.tenantId,
        'maxCustomers',
        aktiveKunden,
        'Die Anfrage kann ohne Kundenanlage angenommen werden (kundeAnlegen=false).',
      );
    }

    // Mandantentrennung: ein optional zugewiesener Mitarbeiter muss zum eigenen
    // Betrieb gehoeren (Cross-Tenant-Reference-Injection). Vor der Transaktion
    // pruefen (fail-fast, wie das Limit oben).
    if (dto.assignedUserId) {
      await assertRefInTenant(
        this.dataSource.getRepository(User),
        user,
        dto.assignedUserId,
        'Mitarbeiter',
      );
    }

    // C1: Die AU-Nummer wird in createOrderForRequest INNERHALB dieser Transaktion
    // gezogen. Kollidiert der Unique-Index (tenantId, auftragsnummer), wirft die
    // Transaktion, rollt vollstaendig zurueck (auch der Status-Flip) und wird von
    // withUniqueRetry erneut ausgefuehrt -> beim zweiten Lauf ist die Anfrage
    // wieder NEU und der Flip gewinnt erneut.
    const result = await withUniqueRetry(() =>
      this.dataSource.transaction(async (m) => {
      // Konditionaler Status-Flip statt read-then-check: schreibt NUR, wenn der
      // Status in der DB noch NEU ist. Zwei parallele Annahmen koennten sonst
      // beide NEU lesen und doppelt Kunde/Auftrag/Termin erzeugen – so gewinnt
      // genau eine (affected=1), die andere ist ein No-op und bricht hier ab.
      const flip = await m.update(
        BookingRequest,
        { id, tenantId: user.tenantId, status: BookingRequestStatus.NEU },
        { status: BookingRequestStatus.ANGENOMMEN },
      );
      const req = await m.findOne(BookingRequest, { where: { id, tenantId: user.tenantId } });
      if (!flip.affected) {
        // Kein Treffer: entweder gibt es die Anfrage nicht (404) oder sie wurde
        // bereits bearbeitet (400) – wie bisher unterscheiden.
        if (!req) throw new NotFoundException('Anfrage nicht gefunden');
        throw new BadRequestException('Diese Anfrage wurde bereits bearbeitet.');
      }
      if (!req) throw new NotFoundException('Anfrage nicht gefunden');

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

      // Doppelbuchungs-Schutz: wird die Anfrage direkt einem Mitarbeiter zugewiesen,
      // gegen dessen bestehende Termine pruefen (gleiche Logik wie in der Plantafel,
      // in DERSELBEN Transaktion -> race-sicher, rollt bei 409 mit dem Flip zurueck).
      const kalenderSettings = await ladeKonfliktSettings(m, user.tenantId);
      if (dto.assignedUserId) {
        await assertKeinTerminKonflikt(
          m,
          user.tenantId,
          {
            start,
            ende,
            assignedUserId: dto.assignedUserId,
            status: AppointmentStatus.BESTAETIGT,
          },
          kalenderSettings,
          dto.konfliktBestaetigt,
        );
      }

      // BETRIEBSWEITER Kollisionscheck (Kalender 2.0 W2): Das Buchungsportal
      // rechnet freie Slots betriebsweit – der Betrieb ist in W2 EINE
      // Kapazitaets-Ressource. Damit "Slot frei laut Portal" und "Annahme ohne
      // 409" dieselbe Wahrheit sind, prueft auch die Annahme betriebsweit
      // (Status geplant/bestaetigt/laeuft, ohne Mitarbeiter-Dimension).
      // Mehr-Mitarbeiter-Betriebe leben gut mit Default `warnen` +
      // konfliktBestaetigt-Override ("Trotzdem annehmen"); bei `blockieren`
      // bleibt der 409 hart. W3 verfeinert auf Mitarbeiter-Kapazitaet.
      const belegt = await findeBelegteTermineBetriebsweit(m, user.tenantId, start, ende);
      if (
        belegt.length > 0 &&
        !(kalenderSettings.konfliktverhalten === 'warnen' && dto.konfliktBestaetigt === true)
      ) {
        throw new ConflictException(toKonfliktPayload(belegt.slice(0, KONFLIKT_MAX)));
      }

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

      // Optional Auftrag anlegen (Default: ja, sofern ein Kunde entsteht) –
      // T-004: Leistung/Fahrzeug aus der Anfrage muessen nicht mehr unter
      // /auftraege neu erfasst werden. BEWUSST ohne OrdersService (das Modul
      // importiert keine internen Service-Schichten, s. Modul-Doku) – alles
      // laeuft ueber den Transaktions-Manager und rollt mit zurueck.
      let order: Order | undefined;
      if (dto.auftragAnlegen !== false && customerId) {
        order = await this.createOrderForRequest(m, user.tenantId, customerId, req, start, ende);
      }

      const appointment = await m.save(
        m.create(Appointment, {
          tenantId: user.tenantId,
          titel,
          start,
          ende,
          status: AppointmentStatus.BESTAETIGT,
          customerId,
          assignedUserId: dto.assignedUserId,
          orderId: order?.id,
          notiz: this.buildNotiz(req),
        }),
      );

      // M3 (DSGVO): Ist die Kontakt-PII in einen Customer kopiert (redundant),
      // wird sie in der Anfrage GENULLT/geleert. Angenommene Anfragen ueberspringt
      // der Retention-Cleanup -> ohne diesen Schritt bliebe Klartext-PII unbefristet
      // in booking_requests liegen, ausserhalb von Loeschung/Auskunft. Im Customer
      // unterliegt sie bereits der DSGVO. Das In-Memory-req bleibt fuer die
      // Terminbestaetigung + die Antwort intakt; nur die persistierte Zeile ist
      // danach PII-frei. serviceName (keine PII) bleibt fuer die Betriebs-Uebersicht.
      // Bewusster Rest: bei kundeAnlegen=false wird NICHT genullt – die PII wurde
      // nirgends redundant kopiert, Nullen wuerde den einzigen Datensatz vernichten.
      if (customerId) {
        await m.update(
          BookingRequest,
          { id, tenantId: user.tenantId },
          {
            name: '(angenommen)',
            email: null as unknown as string,
            phone: null as unknown as string,
            fahrzeug: null as unknown as string,
            nachricht: null as unknown as string,
          },
        );
      }

      // Status ist bereits oben konditional auf ANGENOMMEN geflippt.
      return { appointment, request: req, customerId, order };
      }),
    );

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'booking_request_accepted',
      entityType: 'BookingRequest',
      entityId: id,
      payload: {
        appointmentId: result.appointment.id,
        customerId: result.customerId,
        orderId: result.order?.id,
        auftragsnummer: result.order?.auftragsnummer,
      },
    });

    // Terminbestaetigung an den Endkunden (T-003): fire-and-forget NACH dem
    // Commit – ein Mail-Problem darf die Annahme NIE blockieren.
    void this.sendTerminbestaetigung(user.tenantId, result.request, result.appointment, result.order);

    return {
      appointment: result.appointment,
      request: this.toView(result.request),
      order: result.order
        ? { id: result.order.id, auftragsnummer: result.order.auftragsnummer }
        : null,
    };
  }

  /**
   * Legt in der accept()-Transaktion den Auftrag zur Anfrage an (T-004).
   *
   * Leistung: KEIN Name-Matching – die Anfrage traegt bereits eine beim Erstellen
   * tenant-validierte serviceItemId. Existiert die Leistung noch (auch wenn
   * inzwischen deaktiviert – sie war beim Anfragen gueltig), wird sie als
   * Position mit aktuellem Basispreis uebernommen; sonst faellt die Position auf
   * den serviceName-Snapshot mit 0 € zurueck (Hinweis "Preis pruefen" im internen
   * Hinweis). Ohne Leistungsangabe entsteht ein Auftrag ohne Positionen.
   *
   * Fahrzeug: BEWUSST keine Auto-Anlage (Vehicle braucht make/model/customerId,
   * Freitext-Parsing erzeugt Muelldaten) – der Freitext landet im verschluesselten
   * internen Hinweis; vehicleId bleibt leer und wird am Auftrag nachgepflegt.
   *
   * Status: direkt BESTAETIGT – die Annahme IST die Bestaetigung (der Termin ist
   * bestaetigt, die Terminbestaetigungs-Mail traegt den Track-Link; die Track-
   * Seite soll dem Kunden nicht "angefragt" zeigen). Kein changeStatus-Durchlauf
   * -> keine doppelte Status-Mail.
   */
  private async createOrderForRequest(
    m: EntityManager,
    tenantId: string,
    customerId: string,
    req: BookingRequest,
    start: Date,
    ende: Date,
  ): Promise<Order> {
    const svc = req.serviceItemId
      ? await m.findOne(ServiceItem, { where: { id: req.serviceItemId, tenantId } })
      : null;

    const items: OrderItem[] = [];
    if (svc) {
      items.push(
        m.create(OrderItem, {
          beschreibung: svc.name,
          typ: OrderItemType.LEISTUNG,
          menge: 1,
          einzelpreis: Number(svc.basispreis),
          gesamtpreis: Number(svc.basispreis),
        }),
      );
    } else if (req.serviceName) {
      // Leistung zwischenzeitlich geloescht: Snapshot-Name als 0-€-Position,
      // damit die Anfrage-Info nicht verloren geht; den Preis prueft der Betrieb.
      items.push(
        m.create(OrderItem, {
          beschreibung: req.serviceName,
          typ: OrderItemType.LEISTUNG,
          menge: 1,
          einzelpreis: 0,
          gesamtpreis: 0,
        }),
      );
    }

    // Summen wie OrdersService.calculate – die Rechen-Logik bleibt bewusst lokal:
    // das public-booking-Modul importiert keine internen Service-Schichten. Der
    // MwSt-Satz kommt aus dem EFFEKTIVEN Steuersatz des Betriebs (resolveSteuer);
    // Kleinunternehmer (§ 19 UStG) -> 0 %, damit der aus der Anfrage angelegte
    // Auftrag mit demselben Satz rechnet wie die spaetere Rechnung (kein Phantom-MwSt).
    const tenant = await m.findOne(Tenant, { where: { id: tenantId }, select: ['id', 'settings'] });
    const steuer = resolveSteuer(((tenant?.settings ?? {}) as Record<string, unknown>).steuer);
    const satz = steuer.kleinunternehmer ? 0 : steuer.standardMwstSatz / 100;
    const nettoSumme = items.reduce((s, i) => s + Number(i.gesamtpreis), 0);
    const mwstBetrag = Math.round(nettoSumme * satz * 100) / 100;
    const gesamtpreis = Math.round((nettoSumme + mwstBetrag) * 100) / 100;

    const auftragsnummer = await nextSequentialNumber(m.getRepository(Order), tenantId, 'AU');

    return m.save(
      m.create(Order, {
        tenantId,
        auftragsnummer,
        customerId,
        serviceType: svc ? KATEGORIE_ZU_SERVICETYPE[svc.kategorie] : ServiceType.SONSTIGES,
        status: OrderStatus.BESTAETIGT,
        materialkosten: 0,
        arbeitsstunden: 0,
        geplanterStart: start,
        geplantesEnde: ende,
        internerHinweis: this.buildInternerHinweis(req, !svc),
        bilderVorher: [],
        bilderNachher: [],
        // Track-Token direkt beim Anlegen: die Terminbestaetigungs-Mail kann den
        // Link ohne zweiten Write mitschicken (Spalte existiert, select:false).
        freigabeToken: randomBytes(24).toString('hex'),
        items,
        nettoSumme,
        mwstBetrag,
        gesamtpreis,
      }),
    );
  }

  /** Lehnt eine Anfrage ab. Es entsteht KEIN Stammdatensatz. */
  async reject(user: AuthUser, id: string): Promise<BookingRequestView> {
    const req = await this.findOne(user.tenantId, id);
    if (req.status !== BookingRequestStatus.NEU) {
      throw new BadRequestException('Diese Anfrage wurde bereits bearbeitet.');
    }
    // DSGVO (Art. 17): eine abgelehnte Anfrage begruendet KEINEN Stammdatensatz –
    // die Kontakt-PII wird deshalb SOFORT genullt (nicht erst durch die 90-Tage-
    // Retention), exakt nach dem accept()-Muster: `name` ist NOT NULL -> Platzhalter,
    // der Rest (E-Mail/Telefon/Fahrzeug/Nachricht) wird geleert. Status + Referenz
    // bleiben fuer die oeffentliche Statusauskunft; serviceName (keine PII) bleibt
    // fuer die Betriebs-Uebersicht.
    // OFFENER PUNKT (bewusst NICHT hier): vollstaendige Art.-15-Auskunft / Art.-17-
    // Loeschung per E-Mail-/Telefon-Matching ueber alle Anfragen eines Kontakts –
    // zu gross fuer diesen Fix, separat einzuplanen.
    req.status = BookingRequestStatus.ABGELEHNT;
    req.name = '(abgelehnt)';
    req.email = null as unknown as string;
    req.phone = null as unknown as string;
    req.fahrzeug = null as unknown as string;
    req.nachricht = null as unknown as string;
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

  /**
   * Interner Hinweis des automatisch angelegten Auftrags: Herkunft, Fahrzeug-
   * Freitext (kein Vehicle-Datensatz, s. createOrderForRequest) und ggf. der
   * Pruef-Hinweis, wenn keine hinterlegte Leistung uebernommen werden konnte.
   */
  private buildInternerHinweis(req: BookingRequest, leistungFehlt: boolean): string {
    const teile = [`Aus Online-Anfrage ${req.reference}`];
    if (req.fahrzeug) teile.push(`Fahrzeug (Freitext aus Anfrage): ${req.fahrzeug}`);
    if (req.nachricht) teile.push(`Nachricht: ${req.nachricht}`);
    if (leistungFehlt) {
      teile.push(
        req.serviceName
          ? `Preis prüfen: Leistung "${req.serviceName}" ist nicht (mehr) hinterlegt – Position mit 0 € übernommen.`
          : 'Leistung prüfen: Anfrage ohne gewählte Leistung – Positionen bitte ergänzen.',
      );
    }
    return teile.join('\n');
  }

  /** Basis-URL fuer den Track-Link in Mails (gleiches Muster wie OrdersService.appBaseUrl). */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  /**
   * Terminbestaetigung an den Endkunden nach Annahme (T-003). Sie-Ton; seit
   * T-004 MIT Track-Link, wenn beim Annehmen ein Auftrag entstand (das Token
   * wird direkt beim Auftrag-INSERT gesetzt – kein zweiter Write, kein Race).
   * Ohne Auftrag (kundeAnlegen/auftragAnlegen=false) bleibt die Mail linklos.
   * BLOCKIERT NIE die Annahme: alles in try/catch, Fehler -> Warn-Log.
   * Kein Versand ohne Kunden-E-Mail oder bei abgeschaltetem Flag.
   */
  private async sendTerminbestaetigung(
    tenantId: string,
    req: BookingRequest,
    appointment: Appointment,
    order?: Order,
  ): Promise<void> {
    try {
      const email = req.email?.trim();
      if (!email) {
        this.logger.debug(`Terminbestaetigung uebersprungen (Anfrage ohne E-Mail). request=${req.id}`);
        return;
      }

      const tenant = await this.dataSource
        .getRepository(Tenant)
        .findOne({ where: { id: tenantId } });
      // Opt-out-Flag in tenant.settings (Default AN, solange nicht '0').
      const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
      if (settings.kundenmailTerminbestaetigung === '0') return;

      const betrieb = tenant?.name?.trim() || 'Ihr Aufbereitungsbetrieb';
      const zeilen: string[] = [
        anrede(req.name),
        '',
        'vielen Dank für Ihre Anfrage – Ihr Termin ist bestätigt.',
        `Termin: ${formatDatumZeit(appointment.start)}`,
      ];
      if (req.serviceName) zeilen.push(`Leistung: ${req.serviceName}`);
      if (req.fahrzeug) zeilen.push(`Fahrzeug: ${req.fahrzeug}`);
      zeilen.push(`Ihre Anfrage-Referenz: ${req.reference}`);

      // Betriebs-Identitaet (Vertragspartner) – gehoert auf die Bestaetigung auf
      // dauerhaftem Datentraeger (§312f BGB).
      const identitaet: string[] = [];
      const plzOrt = [tenant?.postalCode, tenant?.city].filter(Boolean).join(' ');
      if (tenant?.name?.trim()) identitaet.push(tenant.name.trim());
      if (tenant?.street?.trim()) identitaet.push(tenant.street.trim());
      if (plzOrt) identitaet.push(plzOrt);
      if (tenant?.phone?.trim()) identitaet.push(`Telefon: ${tenant.phone.trim()}`);
      if (tenant?.email?.trim()) identitaet.push(`E-Mail: ${tenant.email.trim()}`);
      if (identitaet.length) zeilen.push('', 'Ihr Vertragspartner:', ...identitaet);
      // Im verbindlichen Modus wurde die Widerrufsbelehrung mit der Buchungs-
      // bestaetigung (bei Absendung) zugestellt – hier nur der Hinweis darauf.
      if (req.abschlussModus === 'verbindlich') {
        zeilen.push(
          '',
          'Ihre Widerrufsbelehrung und das Muster-Widerrufsformular haben Sie mit der Buchungsbestätigung per E-Mail erhalten.',
        );
      }

      const trackUrl = order?.freigabeToken
        ? `${this.appBaseUrl()}/track/?t=${order.freigabeToken}`
        : null;
      if (trackUrl) {
        zeilen.push('', 'Den aktuellen Stand Ihres Auftrags können Sie hier jederzeit einsehen:');
      }
      const schluss = ['', 'Wir freuen uns auf Sie.', '', 'Mit freundlichen Grüßen', betrieb];

      const text = [...zeilen, ...(trackUrl ? [trackUrl] : []), ...schluss].join('\n');
      const htmlZeilen: MailZeile[] = [
        ...zeilen,
        ...(trackUrl ? [htmlLink(trackUrl, 'Auftragsstatus ansehen')] : []),
        ...schluss,
      ];

      await this.mail.send({
        to: email,
        subject: `Terminbestätigung von ${betrieb}`,
        html: linesToHtml(htmlZeilen),
        text,
        // Antworten sollen beim Betrieb landen, nicht bei der Plattform.
        replyTo: tenant?.email?.trim() || undefined,
        // Sendet – falls konfiguriert – ueber den betriebseigenen SMTP/Absender.
        tenantId,
      });
      this.logger.log(`Terminbestaetigung versendet. request=${req.id}`);
    } catch (e) {
      this.logger.warn(
        `Terminbestaetigung fehlgeschlagen (Annahme bleibt gueltig): ${(e as Error).message}`,
      );
    }
  }
}
