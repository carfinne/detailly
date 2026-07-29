import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { AngebotStatus, Invoice, InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import {
  AccountingExportService,
  DatevConfig,
  DATEV_DEFAULTS,
} from './accounting-export.service';
import { MailService } from '../mailer/mail.service';
import { istAngebotEntschieden, istFestgesetzt, statuswechselErlaubt } from './invoice-rules';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order, OrderStatus, ServiceType } from '../orders/entities/order.entity';
import { OrderItem, OrderItemType } from '../orders/entities/order-item.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceItemDto,
  CreateAngebotsSetDto,
  CreateAnzahlungDto,
} from './dto/invoice.dto';
import { AuditService } from '../audit/audit.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { clampPageQuery } from '../common/util/pagination';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { nextSequentialNumber } from '../common/numbering';
import { withUniqueRetry, isUniqueViolation } from '../common/unique-retry';
import { isSqlite } from '../common/database.types';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvoicePdfService } from './invoice-pdf.service';
import { MAHN_TITEL } from './invoice-pdf';
import { buildEpcQrPayload } from './epc-qr';
import { resolveMahnwesenConfig } from '../common/mahnwesen/mahnwesen-config';
import { SteuerConfig, resolveSteuer } from '../common/steuer';

const MWST_SATZ = 0.19;

/**
 * Antwort des §19-Umsatzgrenzen-Waechters (Welle 2). Fuer Nicht-Kleinunternehmer
 * nur `{ istKleinunternehmer: false }`; sonst der volle Grenzwert-Status.
 */
export interface KleinunternehmerStatus {
  istKleinunternehmer: boolean;
  jahr?: number;
  umsatzLaufend?: number;
  grenze?: number;
  warnstufe?: 'ok' | 'nah' | 'kritisch' | 'ueberschritten';
}

/** Standard-Gueltigkeit eines Angebots ab Erstellung (Welle 1, F2). */
const ANGEBOT_GUELTIGKEIT_TAGE = 14;

/** Kaufmaennisch auf Cent runden. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Sicherheitsventil fuer den unpaginierten Array-Modus von findAll (T-009,
 * analog MAX_ARRAY_VEHICLES) - KEIN Produktlimit fuer Bestands-Consumer.
 */
const MAX_ARRAY_INVOICES = 2000;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
    private readonly sevdesk: SevdeskService,
    private readonly pdf: InvoicePdfService,
    private readonly mail: MailService,
    private readonly accExport: AccountingExportService,
  ) {}

  // ---------------------------------------------------------------------------
  // Buchhaltungs-Export (CSV + DATEV)
  // ---------------------------------------------------------------------------

  /** Laedt die zu exportierenden Rechnungen (tenant-scoped) + Kundenstamm. */
  private async collectForExport(tenantId: string, von: Date, bis: Date) {
    // Buchungsrelevant: gestellte Rechnungen (offen/bezahlt) mit Nummer im
    // Zeitraum. Angebote/Entwuerfe = keine Buchungsbelege; storniert hier
    // bewusst NICHT (saubere Stornobuchung waere ein eigenes Thema).
    const invoices = await this.repo.find({
      where: {
        tenantId,
        art: InvoiceKind.RECHNUNG,
        status: In([InvoiceStatus.OFFEN, InvoiceStatus.BEZAHLT]),
        datum: Between(von, bis),
      },
      order: { datum: 'ASC', nummer: 'ASC' },
    });
    const valid = invoices.filter((i) => i.nummer);
    const ids = [...new Set(valid.map((i) => i.customerId))];
    const customers = ids.length
      ? await this.customerRepo.find({ where: { id: In(ids), tenantId } })
      : [];
    const customerById = new Map(customers.map((c) => [c.id, c]));
    return { invoices: valid, customerById };
  }

  /** Loest die DATEV-Konfiguration aus tenant.settings (mit SKR03-Defaults). */
  private async resolveDatevConfig(tenantId: string): Promise<DatevConfig> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const s = (tenant?.settings ?? {}) as Record<string, unknown>;
    const get = (key: string, def = ''): string => {
      const v = s[key];
      return typeof v === 'string' && v.trim() ? v.trim() : def;
    };
    const beraterNr = get('datevBeraterNr');
    const mandantNr = get('datevMandantNr');
    if (!beraterNr || !mandantNr) {
      throw new BadRequestException(
        'Fuer den DATEV-Export bitte zuerst Berater- und Mandantennummer in den Einstellungen hinterlegen.',
      );
    }
    return {
      beraterNr,
      mandantNr,
      skr: get('datevSkr', DATEV_DEFAULTS.skr),
      erloeskonto19: get('datevErloeskonto19', DATEV_DEFAULTS.erloeskonto19),
      erloeskonto7: get('datevErloeskonto7', DATEV_DEFAULTS.erloeskonto7),
      erloeskonto0: get('datevErloeskonto0', DATEV_DEFAULTS.erloeskonto0),
      debitorSammelkonto: get('datevDebitorSammelkonto', DATEV_DEFAULTS.debitorSammelkonto),
    };
  }

  /**
   * Baut den Buchhaltungs-Export (CSV universell ODER DATEV-Buchungsstapel) fuer
   * einen Zeitraum. Gibt Buffer + Dateiname + Content-Type zurueck.
   */
  async buildExport(
    tenantId: string,
    opts: { format: 'csv' | 'datev'; von: string; bis: string },
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const von = new Date(`${opts.von}T00:00:00`);
    const bis = new Date(`${opts.bis}T23:59:59.999`);
    if (Number.isNaN(von.getTime()) || Number.isNaN(bis.getTime())) {
      throw new BadRequestException('Ungueltiges Datum (Format YYYY-MM-DD erwartet).');
    }
    if (bis < von) {
      throw new BadRequestException('Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    }
    const spanne = `${opts.von}_${opts.bis}`;
    const { invoices, customerById } = await this.collectForExport(tenantId, von, bis);

    if (opts.format === 'datev') {
      if (von.getFullYear() !== bis.getFullYear()) {
        throw new BadRequestException(
          'DATEV-Export bitte je Wirtschaftsjahr exportieren (Von und Bis im selben Jahr).',
        );
      }
      const cfg = await this.resolveDatevConfig(tenantId);
      const buffer = this.accExport.buildDatev(invoices, customerById, cfg, von, bis);
      return {
        buffer,
        filename: `EXTF_Buchungsstapel_${spanne}.csv`,
        contentType: 'text/plain; charset=windows-1252',
      };
    }

    const buffer = this.accExport.buildCsv(invoices, customerById);
    return {
      buffer,
      filename: `Buchhaltung_${spanne}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  // ---------------------------------------------------------------------------
  // §19-Umsatzgrenzen-Waechter (Welle 2)
  // ---------------------------------------------------------------------------
  /**
   * Laufender Kalenderjahr-Umsatz eines Kleinunternehmers (§ 19 UStG) gegen die
   * 100.000-EUR-Grenze (2025er-Recht: bei Ueberschreiten sofortiger Wechsel zur
   * Regelbesteuerung). Summiert TENANT-SCOPED die festgesetzten Rechnungen
   * (Status offen/bezahlt – nicht Entwurf, nicht storniert) des laufenden Jahres;
   * bei §19 ist USt = 0, also brutto = netto. Nur relevant fuer Kleinunternehmer –
   * sonst { istKleinunternehmer: false }. Jahr aus Serverzeit.
   *
   * Warnstufen (Anteil am Grenzwert): nah >= 80 %, kritisch >= 95 %,
   * ueberschritten >= 100 %.
   */
  async kleinunternehmerStatus(tenantId: string): Promise<KleinunternehmerStatus> {
    const steuer = await this.steuerConfig(tenantId);
    if (!steuer.kleinunternehmer) return { istKleinunternehmer: false };

    const jahr = new Date().getFullYear();
    const von = new Date(jahr, 0, 1, 0, 0, 0, 0);
    const bis = new Date(jahr, 11, 31, 23, 59, 59, 999);
    const row = await this.repo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.brutto), 0)', 'summe')
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere('i.art = :art', { art: InvoiceKind.RECHNUNG })
      .andWhere('i.status IN (:...status)', {
        status: [InvoiceStatus.OFFEN, InvoiceStatus.BEZAHLT],
      })
      .andWhere('i.datum BETWEEN :von AND :bis', { von, bis })
      .getRawOne<{ summe: string }>();

    const umsatzLaufend = round2(Number(row?.summe ?? 0));
    const grenze = 100000;
    const anteil = umsatzLaufend / grenze;
    const warnstufe: NonNullable<KleinunternehmerStatus['warnstufe']> =
      anteil >= 1 ? 'ueberschritten' : anteil >= 0.95 ? 'kritisch' : anteil >= 0.8 ? 'nah' : 'ok';

    return { istKleinunternehmer: true, jahr, umsatzLaufend, grenze, warnstufe };
  }

  // ---------------------------------------------------------------------------
  // Einnahmenuebersicht-Export (Welle 2, EUeR-orientiert)
  // ---------------------------------------------------------------------------
  /**
   * Laedt die BEZAHLTEN Rechnungen (tenant-scoped) im Zeitraum + Kundenstamm.
   * Zeitraumfilter nach ZUFLUSS (Zahldatum, Fallback Belegdatum fuer Altbestand
   * ohne gesetztes Zahldatum) – das ist die korrekte EUeR-Logik (Einnahme zaehlt,
   * wenn das Geld eingegangen ist).
   */
  private async collectPaidForExport(tenantId: string, von: Date, bis: Date) {
    const invoices = await this.repo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere('i.art = :art', { art: InvoiceKind.RECHNUNG })
      .andWhere('i.status = :status', { status: InvoiceStatus.BEZAHLT })
      .andWhere('COALESCE(i.zahldatum, i.datum) BETWEEN :von AND :bis', { von, bis })
      .orderBy('COALESCE(i.zahldatum, i.datum)', 'ASC')
      .addOrderBy('i.nummer', 'ASC')
      .getMany();
    const valid = invoices.filter((i) => i.nummer);
    const ids = [...new Set(valid.map((i) => i.customerId))];
    const customers = ids.length
      ? await this.customerRepo.find({ where: { id: In(ids), tenantId } })
      : [];
    const customerById = new Map(customers.map((c) => [c.id, c]));
    return { invoices: valid, customerById };
  }

  /**
   * Baut die Einnahmenuebersicht (CSV) fuer einen Zeitraum: reine Einnahmen aus
   * BEZAHLTEN Rechnungen. Zeitraum max. 400 Tage (auf 400 begrenzt). BEWUSST
   * KEINE Ausgaben – ehrliche Einnahmenliste, kein voller EUeR-Abschluss.
   */
  async buildEinnahmenExport(
    tenantId: string,
    opts: { von: string; bis: string },
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const von = new Date(`${opts.von}T00:00:00`);
    const bis = new Date(`${opts.bis}T23:59:59.999`);
    if (Number.isNaN(von.getTime()) || Number.isNaN(bis.getTime())) {
      throw new BadRequestException('Ungueltiges Datum (Format YYYY-MM-DD erwartet).');
    }
    if (bis < von) {
      throw new BadRequestException('Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    }
    const MAX_TAGE = 400;
    const tage = (bis.getTime() - von.getTime()) / 86_400_000;
    if (tage > MAX_TAGE) {
      throw new BadRequestException(`Der Zeitraum darf hoechstens ${MAX_TAGE} Tage umfassen.`);
    }
    const { invoices, customerById } = await this.collectPaidForExport(tenantId, von, bis);
    const steuer = await this.steuerConfig(tenantId);
    const buffer = this.accExport.buildEinnahmenCsv(invoices, customerById, steuer.kleinunternehmer);
    return {
      buffer,
      filename: `Einnahmen_${opts.von}_${opts.bis}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private buildItems(dtoItems: InvoiceItemDto[]): InvoiceItem[] {
    return dtoItems.map((i) =>
      this.itemRepo.create({
        beschreibung: i.beschreibung,
        menge: i.menge,
        einzelpreis: i.einzelpreis,
        // Kaufmaennisch auf Cent runden, damit die persistierte Zeilensumme (decimal 10,2)
        // mit dem aus diesen Zeilen gebildeten netto uebereinstimmt -> PDF geht auf.
        gesamtpreis: Math.round(Number(i.menge) * Number(i.einzelpreis) * 100) / 100,
      }),
    );
  }

  /** Summen aus den Zeilen. `satzProzent` ist der MwSt-Satz in Prozent (Default 19). */
  private totals(items: InvoiceItem[], satzProzent: number = MWST_SATZ * 100) {
    const netto = items.reduce((sum, i) => sum + Number(i.gesamtpreis), 0);
    const mwst = Math.round(netto * (Number(satzProzent) / 100) * 100) / 100;
    const brutto = Math.round((netto + mwst) * 100) / 100;
    return { netto, mwst, brutto };
  }

  private prefix(art: InvoiceKind): string {
    return art === InvoiceKind.ANGEBOT ? 'AN' : 'RE';
  }

  /**
   * Beleg-Liste. ABWAERTSKOMPATIBEL: ohne page/limit das bisherige Array (fuer
   * Kunden-Akte u.a.); MIT page/limit eine paginierte Antwort inkl. Status-
   * Zaehlern fuer die Filter-Reiter. Optionale Suche ueber Belegnummer ODER
   * Kundenname (Namens-Treffer werden vorab tenant-scoped zu IDs aufgeloest).
   */
  async findAll(
    tenantId: string,
    query: {
      art?: InvoiceKind;
      status?: InvoiceStatus;
      customerId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    // Listen-Projektion: nur Tabellen-Spalten. KEINE items-Relation und KEINE
    // verschluesselten Felder (hinweis/empfaenger*) -> kein Join + kein
    // AES-Decrypt pro Zeile (Haupt-Latenzquelle bei Volumen) + kein Daten-Leck.
    const qb = this.repo
      .createQueryBuilder('i')
      .select([
        'i.id',
        'i.nummer',
        'i.art',
        'i.customerId',
        'i.orderId',
        'i.status',
        'i.datum',
        'i.netto',
        'i.mwst',
        'i.brutto',
        'i.mwstSatz',
        'i.faelligkeitsdatum',
        'i.zahlungsziel',
        'i.zahldatum',
        'i.mahnstufe',
        'i.versendetAm',
        'i.createdAt',
        // Welle 1 (Angebote): reine Tabellen-Spalten – kein Join, kein Decrypt,
        // damit die Projektions-Performance erhalten bleibt. Das Frontend buendelt
        // Varianten-Sets (varianteGruppeId), zeigt Angebots-Status/Ablauf und die
        // gewaehlte Variante sowie Anzahlungs-Belege.
        'i.varianteGruppeId',
        'i.varianteLabel',
        'i.istGewaehlt',
        'i.gueltigBis',
        'i.angebotStatus',
        'i.istAnzahlung',
      ])
      .where('i.tenantId = :tenantId', { tenantId });
    if (query.art) qb.andWhere('i.art = :art', { art: query.art });
    if (query.customerId) qb.andWhere('i.customerId = :customerId', { customerId: query.customerId });

    // Suche: Nummer ODER Kundenname. Wildcards entschaerfen; Namens-Treffer
    // tenant-scoped zu IDs aufloesen (gedeckelt), dann OR IN.
    const term = query.search?.trim().toLowerCase();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const kunden = await this.customerRepo
        .createQueryBuilder('c')
        .select(['c.id'])
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere(
          "(LOWER(c.firstName) LIKE :like ESCAPE '\\' OR LOWER(c.lastName) LIKE :like ESCAPE '\\' OR " +
            "LOWER(c.companyName) LIKE :like ESCAPE '\\')",
          { like },
        )
        .limit(200)
        .getMany();
      const ids = kunden.map((k) => k.id);
      if (ids.length > 0) {
        qb.andWhere("(LOWER(i.nummer) LIKE :like ESCAPE '\\' OR i.customerId IN (:...ids))", { like, ids });
      } else {
        qb.andWhere("LOWER(i.nummer) LIKE :like ESCAPE '\\'", { like });
      }
    }

    // Ohne Paginierung: bisheriges Verhalten (Array) fuer Bestands-Verbraucher.
    // take: Sicherheitsventil (T-009, analog MAX_ARRAY_VEHICLES), kein Produktlimit.
    if (query.page == null && query.limit == null) {
      if (query.status) qb.andWhere('i.status = :status', { status: query.status });
      return qb.orderBy('i.createdAt', 'DESC').take(MAX_ARRAY_INVOICES).getMany();
    }

    // Status-Zaehler fuer die Reiter: gleiche Filter (art/customerId/Suche),
    // aber OHNE den Status-Filter selbst – sonst zeigen die anderen Reiter 0.
    const countRows = await qb
      .clone()
      .select('i.status', 'status')
      .addSelect('COUNT(*)', 'anzahl')
      .groupBy('i.status')
      .getRawMany<{ status: string; anzahl: string }>();
    const counts = { alle: 0, offen: 0, bezahlt: 0 };
    for (const r of countRows) {
      const n = Number(r.anzahl);
      counts.alle += n;
      if (r.status === InvoiceStatus.OFFEN) counts.offen = n;
      if (r.status === InvoiceStatus.BEZAHLT) counts.bezahlt = n;
    }

    if (query.status) qb.andWhere('i.status = :status', { status: query.status });
    const { page, limit, skip, take } = clampPageQuery(query);
    const [data, total] = await qb
      .orderBy('i.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return { data, total, page, limit, counts };
  }

  async findOne(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.repo.findOne({ where: { id, tenantId }, relations: ['items'] });
    if (!invoice) throw new NotFoundException('Beleg nicht gefunden');
    return invoice;
  }

  /**
   * Standard-Zahlungsziel (Tage) aus tenant.settings.rechnungZahlungszielTage;
   * unplausible/fehlende Werte fallen auf 14 Tage zurueck.
   */
  private async defaultZahlungsziel(tenantId: string): Promise<number> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const raw = ((t?.settings ?? {}) as Record<string, unknown>).rechnungZahlungszielTage;
    return this.clampZahlungsziel(raw) ?? 14;
  }

  /**
   * Steuer-Einstellungen des Betriebs (tenant.settings.steuer), defensiv
   * aufgeloest. §19 (Kleinunternehmer) erzwingt auf NEUEN/geaenderten Belegen
   * serverseitig 0 % MwSt – der Client-Wert wird dann ignoriert. Bestehende
   * festgesetzte Belege bleiben unangetastet (Satz je Beleg persistiert).
   */
  private async steuerConfig(tenantId: string): Promise<SteuerConfig> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return resolveSteuer(((t?.settings ?? {}) as Record<string, unknown>).steuer);
  }

  /**
   * Klammert ein Zahlungsziel (Tage) auf den plausiblen Bereich 1..365. Ungueltige
   * Werte (negativ, >365, NaN, nicht-numerisch) liefern null -> der Aufrufer faellt
   * dann auf das Standard-Zahlungsziel (14 Tage) zurueck. Bewusste Entscheidung
   * (M2): 0 gilt hier NICHT als gueltig, sondern faellt – wie der Settings-Fallback
   * – auf den Standard. Diese Klammer greift fuer den Client-Wert (dto.zahlungsziel)
   * UND den Settings-Wert, damit beide Pfade identisch normalisiert werden und kein
   * riesiges/negatives Zahlungsziel ein Invalid-Date/sofort-ueberfaellige Rechnung erzeugt.
   */
  private clampZahlungsziel(raw: unknown): number | null {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) && n >= 1 && n <= 365 ? n : null;
  }

  async create(user: AuthUser, dto: CreateInvoiceDto): Promise<Invoice> {
    // Mandantentrennung: verknuepfte Kunden-/Auftrags-ID muss zum eigenen Betrieb gehoeren
    // (sonst Cross-Tenant-Reference-Injection: Beleg fuer fremden Kunden/Auftrag).
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    const art = dto.art ?? InvoiceKind.RECHNUNG;
    const items = this.buildItems(dto.items);
    // Welle 1 (§19 UStG): Kleinunternehmer -> 0 % SERVERSEITIG erzwingen (der
    // Client-Wert wird ignoriert). Sonst gilt der Client-Satz (19/7/0, DTO-
    // validiert) bzw. als Default der in den Einstellungen gepflegte
    // Standardsatz (statt hart 19).
    const steuer = await this.steuerConfig(user.tenantId);
    const mwstSatz = steuer.kleinunternehmer ? 0 : dto.mwstSatz ?? steuer.standardMwstSatz;
    const t = this.totals(items, mwstSatz);

    const datum = new Date();
    // Faelligkeit ist ein reines Rechnungs-Konzept (Angebote haben kein Zahlungsziel).
    // Ohne explizite Angabe gilt das in den Einstellungen gepflegte Standard-
    // Zahlungsziel des Betriebs (Fallback: 14 Tage).
    // M2: Client-Wert durch dieselbe 1..365-Klammer schicken wie den Settings-
    // Fallback; unplausible/fehlende Angabe -> Standard-Zahlungsziel des Betriebs.
    const zahlungsziel =
      art === InvoiceKind.RECHNUNG
        ? this.clampZahlungsziel(dto.zahlungsziel) ?? (await this.defaultZahlungsziel(user.tenantId))
        : undefined;
    const faelligkeitsdatum =
      zahlungsziel != null
        ? new Date(datum.getTime() + zahlungsziel * 24 * 60 * 60 * 1000)
        : undefined;

    // Welle 1 (F2): Angebote bekommen eine Gueltigkeit (Default +14 Tage) und den
    // Angebots-Lebenszyklus 'offen'. Bei Rechnungen bleiben beide Felder NULL.
    const istAngebot = art === InvoiceKind.ANGEBOT;
    const gueltigBis = istAngebot
      ? new Date(datum.getTime() + ANGEBOT_GUELTIGKEIT_TAGE * 24 * 60 * 60 * 1000)
      : undefined;

    const invoice = this.repo.create({
      tenantId: user.tenantId,
      // Angebot: lueckenlose AN-Nummer sofort (unten in der Retry-Schleife
      // gezogen). Rechnung: NULL (Entwurf) – die RE-Nummer wird erst bei der
      // Festsetzung (changeStatus -> Offen) vergeben.
      nummer: null,
      art,
      customerId: dto.customerId,
      orderId: dto.orderId,
      status: InvoiceStatus.ENTWURF,
      datum,
      leistungsdatum: datum,
      zahlungsziel,
      faelligkeitsdatum,
      hinweis: dto.hinweis,
      mwstSatz,
      gueltigBis,
      angebotStatus: istAngebot ? AngebotStatus.OFFEN : undefined,
      items,
      ...t,
    });
    // C1: Nummernvergabe serialisieren. Bei Angebot die AN-Nummer INNERHALB der
    // Retry-Schleife ziehen; kollidiert der Unique-Index (tenantId, nummer),
    // wird nach dem Commit der Konkurrenz neu gezaehlt und erneut gespeichert.
    const saved = await withUniqueRetry(async () => {
      if (art === InvoiceKind.ANGEBOT) {
        invoice.nummer = await nextSequentialNumber(this.repo, user.tenantId, 'AN', {
          nummerFeld: 'nummer',
        });
      }
      return this.repo.save(invoice);
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'Invoice',
      entityId: saved.id,
      payload: { nummer: saved.nummer, art, brutto: t.brutto },
    });
    return this.findOne(user.tenantId, saved.id);
  }

  /** Erzeugt aus einem Auftrag eine Rechnung (oder Angebot) inkl. Positionen. */
  async createFromOrder(
    user: AuthUser,
    orderId: string,
    art = InvoiceKind.RECHNUNG,
    mwstSatz?: number,
  ): Promise<Invoice> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId: user.tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Auftrag nicht gefunden');

    const items: InvoiceItemDto[] = (order.items ?? []).map((i) => ({
      beschreibung: i.beschreibung,
      menge: Number(i.menge),
      einzelpreis: Number(i.einzelpreis),
    }));
    if (Number(order.materialkosten) > 0) {
      items.push({ beschreibung: 'Materialkosten', menge: 1, einzelpreis: Number(order.materialkosten) });
    }

    // Welle 1 (F3): Bei einer SCHLUSSRECHNUNG bereits BEZAHLTE Anzahlungen des
    // Auftrags als negative Positionen abziehen. KEIN Re-Rounding: die gespeicherte
    // Netto-Position der Anzahlungsrechnung wird 1:1 uebernommen; bei gleichem
    // MwSt-Satz (Default 19 %) netzt der Brutto-Abzug exakt auf den gezahlten Betrag.
    // Angebote werden NICHT abgezogen.
    const verrechneteAnzahlungIds: string[] = [];
    if (art === InvoiceKind.RECHNUNG) {
      const anzahlungen = await this.repo.find({
        where: {
          tenantId: user.tenantId,
          orderId: order.id,
          istAnzahlung: true,
          status: InvoiceStatus.BEZAHLT,
          // Finding 6: nur NOCH NICHT verrechnete Anzahlungen -> eine zweite
          // Schlussrechnung zieht nichts doppelt ab.
          anzahlungFuerInvoiceId: IsNull(),
        },
        order: { datum: 'ASC', nummer: 'ASC' },
      });
      for (const a of anzahlungen) {
        items.push({
          beschreibung: `Anzahlung ${a.nummer ?? ''} (bereits bezahlt)`.replace(/\s+/g, ' ').trim(),
          menge: 1,
          einzelpreis: -Number(a.netto),
        });
        verrechneteAnzahlungIds.push(a.id);
      }

      // Finding 3: Der Abzug darf die Auftragssumme nicht uebersteigen. Bei negativem
      // Netto (Anzahlungen > Auftragssumme) -> 400 statt einer negativen Rechnung.
      const nettoNachAbzug = round2(
        items.reduce((s, i) => s + Number(i.menge) * Number(i.einzelpreis), 0),
      );
      if (nettoNachAbzug < 0) {
        throw new BadRequestException(
          'Bezahlte Anzahlungen übersteigen die Auftragssumme — bitte Gutschrift manuell erstellen.',
        );
      }
    }

    // Satz nur uebernehmen, wenn gueltig (0/7/19) – sonst Default 19 % in create().
    const satz = [0, 7, 19].includes(Number(mwstSatz)) ? Number(mwstSatz) : undefined;
    const schlussrechnung = await this.create(user, {
      customerId: order.customerId,
      orderId: order.id,
      art,
      items,
      mwstSatz: satz,
    });

    // Finding 6: verrechnete Anzahlungen an DIESE Schlussrechnung binden – konditional
    // (nur solange anzahlungFuerInvoiceId noch NULL), damit ein zweiter Lauf sie nicht
    // erneut abzieht.
    if (verrechneteAnzahlungIds.length) {
      await this.repo.update(
        { tenantId: user.tenantId, id: In(verrechneteAnzahlungIds), anzahlungFuerInvoiceId: IsNull() },
        { anzahlungFuerInvoiceId: schlussrechnung.id },
      );
    }
    return schlussrechnung;
  }

  // ---------------------------------------------------------------------------
  // Welle 1 (F1): Angebots-Set aus 2-3 Varianten
  // ---------------------------------------------------------------------------

  /**
   * Erzeugt ein Angebots-SET: N Angebote (art=ANGEBOT) mit gemeinsamer
   * varianteGruppeId. Jede Variante bekommt – wie ein Einzelangebot – ihre eigene
   * AN-Nummer (GoBD, ueber create()). Der Einzelangebots-Flow bleibt unveraendert.
   */
  async createAngebotsSet(user: AuthUser, dto: CreateAngebotsSetDto): Promise<Invoice[]> {
    await assertRefInTenant(this.customerRepo, user, dto.customerId, 'Kunde');
    await assertRefInTenant(this.orderRepo, user, dto.orderId, 'Auftrag');
    if (!dto.varianten || dto.varianten.length < 2) {
      throw new BadRequestException('Ein Angebots-Set braucht mindestens 2 Varianten.');
    }
    const varianteGruppeId = randomUUID();
    const ergebnis: Invoice[] = [];
    for (const v of dto.varianten) {
      // create() zieht die AN-Nummer (withUniqueRetry) und setzt Gueltigkeit/Status.
      const inv = await this.create(user, {
        customerId: dto.customerId,
        orderId: dto.orderId,
        art: InvoiceKind.ANGEBOT,
        hinweis: v.hinweis,
        mwstSatz: v.mwstSatz,
        items: v.items,
      });
      // Gruppe/Label setzen (create() kennt diese Welle-1-Felder nicht). Tenant-scoped.
      await this.repo.update(
        { id: inv.id, tenantId: user.tenantId },
        { varianteGruppeId, varianteLabel: v.label },
      );
      ergebnis.push(await this.findOne(user.tenantId, inv.id));
    }
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'angebots_set',
      entityType: 'Invoice',
      entityId: ergebnis[0]?.id,
      payload: { varianteGruppeId, anzahl: ergebnis.length },
    });
    return ergebnis;
  }

  // ---------------------------------------------------------------------------
  // Welle 1 (F2): Angebot annehmen -> Auftrag
  // ---------------------------------------------------------------------------

  /** Annahme durch einen eingeloggten Benutzer (Betrieb). */
  async acceptAngebot(user: AuthUser, id: string): Promise<Order> {
    return this.acceptAngebotCore(user.tenantId, id, user.id);
  }

  /**
   * Kern der Angebots-Annahme (geteilt von auth + public). Tenant-scoped, idempotent,
   * in EINER Transaktion:
   *  - laedt das Angebot (tenantId+id); Nicht-Angebot -> 400
   *  - existiert bereits ein Auftrag mit angebotInvoiceId=id -> diesen zurueckgeben (idempotent)
   *  - abgelaufenes Angebot (gueltigBis < jetzt) -> 410
   *  - erzeugt einen Auftrag (Positionen aus den Angebots-Positionen, AU-Nummer via
   *    withUniqueRetry) mit Rueckverweis angebotInvoiceId
   *  - markiert das gewaehlte Angebot (istGewaehlt + angebotStatus=angenommen) und
   *    lehnt die Geschwister der Gruppe ab (angebotStatus=abgelehnt)
   */
  private async acceptAngebotCore(
    tenantId: string,
    id: string,
    actorUserId?: string,
  ): Promise<Order> {
    let order: Order;
    try {
      order = await this.repo.manager.transaction(async (mgr) => {
        const invRepo = mgr.getRepository(Invoice);
        const ordRepo = mgr.getRepository(Order);

        const angebot = await invRepo.findOne({ where: { id, tenantId }, relations: ['items'] });
        if (!angebot) throw new NotFoundException('Angebot nicht gefunden');
        if (angebot.art !== InvoiceKind.ANGEBOT) {
          throw new BadRequestException('Nur Angebote koennen angenommen werden.');
        }

        // Race-Schutz (nur Postgres; SQLite kann das Lock-API nicht und serialisiert
        // Schreib-Transaktionen ohnehin global): die ganze Varianten-Gruppe
        // pessimistisch sperren, sodass konkurrierende Annahmen – auch VERSCHIEDENER
        // Varianten – serialisieren. DB-agnostischer Backstop ist zusaetzlich der
        // Unique-Index (tenantId, angebotInvoiceId) auf orders (siehe catch unten).
        if (!isSqlite()) {
          const sperrScope = angebot.varianteGruppeId
            ? { tenantId, varianteGruppeId: angebot.varianteGruppeId }
            : { tenantId, id };
          await invRepo.find({
            where: sperrScope,
            select: ['id'],
            lock: { mode: 'pessimistic_write' },
          });
        }

        // Gruppen-Mitglieder bestimmen (fuer die GRUPPEN-weite Idempotenz/Guard).
        const gruppenIds = angebot.varianteGruppeId
          ? (
              await invRepo.find({
                where: { tenantId, varianteGruppeId: angebot.varianteGruppeId },
                select: ['id'],
              })
            ).map((g) => g.id)
          : [id];
        if (!gruppenIds.includes(id)) gruppenIds.push(id);

        // Idempotenz + Gruppen-Guard: existiert bereits ein Auftrag aus EINEM Mitglied
        // dieser Gruppe? Aus DERSELBEN Variante -> idempotent zurueckgeben; aus einer
        // ANDEREN Variante -> Konflikt (je Gruppe darf nur eine Variante angenommen werden).
        const bestehend = await ordRepo.findOne({
          where: { tenantId, angebotInvoiceId: In(gruppenIds) },
        });
        if (bestehend) {
          if (bestehend.angebotInvoiceId === id) return bestehend;
          throw new ConflictException(
            'Aus dieser Angebots-Gruppe wurde bereits eine andere Variante angenommen.',
          );
        }
        // Zweitschutz: diese Variante wurde bereits abgelehnt (weil ein Geschwister
        // angenommen wurde). NULL/Altbestand-Angebote bleiben erlaubt.
        if (angebot.angebotStatus === AngebotStatus.ABGELEHNT) {
          throw new ConflictException(
            'Aus dieser Angebots-Gruppe wurde bereits eine andere Variante angenommen.',
          );
        }

        if (angebot.gueltigBis && new Date(angebot.gueltigBis).getTime() < Date.now()) {
          throw new GoneException(
            'Dieses Angebot ist abgelaufen und kann nicht mehr angenommen werden.',
          );
        }

        // Quell-Auftrag (falls das Angebot aus einem Auftrag entstand) fuer serviceType/Fahrzeug.
        const quelle = angebot.orderId
          ? await ordRepo.findOne({ where: { id: angebot.orderId, tenantId } })
          : null;

        const items = (angebot.items ?? []).map(
          (i) =>
            ({
              beschreibung: i.beschreibung,
              typ: OrderItemType.LEISTUNG,
              menge: Number(i.menge),
              einzelpreis: Number(i.einzelpreis),
              gesamtpreis: round2(Number(i.menge) * Number(i.einzelpreis)),
            }) as OrderItem,
        );
        const nettoSumme = round2(items.reduce((s, i) => s + Number(i.gesamtpreis), 0));
        const mwstBetrag = round2(nettoSumme * MWST_SATZ);
        const gesamtpreis = round2(nettoSumme + mwstBetrag);

        const neu = ordRepo.create({
          tenantId,
          auftragsnummer: '',
          customerId: angebot.customerId,
          vehicleId: quelle?.vehicleId ?? null,
          locationId: quelle?.locationId ?? null,
          serviceType: quelle?.serviceType ?? ServiceType.FOLIERUNG,
          status: OrderStatus.BESTAETIGT,
          angebotInvoiceId: id,
          // Welle 1-A (F3): Nur die ONLINE-Annahme (oeffentlicher Token, kein
          // eingeloggter Betrieb -> actorUserId undefined) meldet die Glocke. Nimmt
          // der Betrieb selbst an (actorUserId gesetzt), bleibt der Marker null –
          // der "heisse Umsatzmoment" ist dann ohnehin sichtbar.
          angebotOnlineAngenommenAm: actorUserId ? null : new Date(),
          materialkosten: 0,
          arbeitsstunden: 0,
          bilderVorher: [],
          bilderNachher: [],
          items,
          nettoSumme,
          mwstBetrag,
          gesamtpreis,
        });
        const gespeichert = await withUniqueRetry(async () => {
          neu.auftragsnummer = await nextSequentialNumber(ordRepo, tenantId, 'AU');
          return ordRepo.save(neu);
        });

        // Gewaehlte Variante markieren, Geschwister ablehnen (tenant + Gruppe scoped).
        angebot.istGewaehlt = true;
        angebot.angebotStatus = AngebotStatus.ANGENOMMEN;
        await invRepo.save(angebot);
        if (angebot.varianteGruppeId) {
          await invRepo.update(
            { tenantId, varianteGruppeId: angebot.varianteGruppeId, id: Not(id) },
            { angebotStatus: AngebotStatus.ABGELEHNT, istGewaehlt: false },
          );
        }
        return gespeichert;
      });
    } catch (e) {
      // Backstop-Race (gleiche Variante gleichzeitig): der Unique-Index
      // (tenantId, angebotInvoiceId) auf orders hat den Zweit-Insert abgewiesen.
      // Der Gewinner hat den Auftrag bereits angelegt -> idempotent zurueckgeben.
      if (isUniqueViolation(e)) {
        const bestehend = await this.orderRepo.findOne({
          where: { tenantId, angebotInvoiceId: id },
        });
        if (bestehend) return bestehend;
      }
      throw e;
    }

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'angebot_angenommen',
      entityType: 'Invoice',
      entityId: id,
      payload: { orderId: order.id, auftragsnummer: order.auftragsnummer },
    });
    return order;
  }

  // ---------------------------------------------------------------------------
  // Welle 1 (F2): oeffentliche Kunden-Freigabe (Token)
  // ---------------------------------------------------------------------------

  /**
   * Erzeugt/liefert das oeffentliche Freigabe-Token eines Angebots. Das Token wird
   * auf ALLE Mitglieder der Varianten-Gruppe geschrieben (identischer Wert, daher
   * nicht unique). Nur der Link wird erzeugt – es wird NICHTS versendet (Review-before-send).
   */
  async getOrCreateAngebotToken(user: AuthUser, id: string): Promise<{ token: string }> {
    const inv = await this.repo.findOne({
      where: { id, tenantId: user.tenantId },
      select: ['id', 'art', 'varianteGruppeId', 'angebotToken'],
    });
    if (!inv) throw new NotFoundException('Angebot nicht gefunden');
    if (inv.art !== InvoiceKind.ANGEBOT) {
      throw new BadRequestException('Nur Angebote koennen freigegeben werden.');
    }
    if (inv.angebotToken) return { token: inv.angebotToken };
    // 48 Hex-Zeichen (24 Byte) -> Entropie deutlich ueber der 32-Hex-Untergrenze.
    const token = randomBytes(24).toString('hex');
    // Konditional (nur wenn noch KEIN Token gesetzt) wie ensureTrackingToken: bei
    // paralleler Erzeugung setzt der erste Aufruf die ganze Gruppe auf EIN Token
    // (alle Mitglieder waren NULL), ein zweiter trifft keine NULL-Zeile mehr ->
    // keine divergierenden Gruppen-Tokens. Danach den tatsaechlich gespeicherten
    // Wert re-lesen und zurueckgeben (der Gewinner-Token, egal wer geschrieben hat).
    const scope = inv.varianteGruppeId
      ? { tenantId: user.tenantId, varianteGruppeId: inv.varianteGruppeId, angebotToken: IsNull() }
      : { id, tenantId: user.tenantId, angebotToken: IsNull() };
    await this.repo.update(scope, { angebotToken: token });
    const nach = await this.repo.findOne({
      where: { id, tenantId: user.tenantId },
      select: ['id', 'angebotToken'],
    });
    return { token: nach?.angebotToken ?? token };
  }

  /**
   * Loest ein Angebot-Token zu {id, tenantId, varianteGruppeId} auf. Hex-Plausibilitaet
   * vor dem DB-Treffer; unbekannt -> 404. Der Tenant ergibt sich AUS dem Treffer.
   */
  private async resolveAngebotToken(
    token: string,
  ): Promise<Pick<Invoice, 'id' | 'tenantId' | 'varianteGruppeId'>> {
    const clean = (token || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(clean)) throw new NotFoundException('Angebot nicht gefunden');
    const treffer = await this.repo.findOne({
      where: { angebotToken: clean },
      select: ['id', 'tenantId', 'varianteGruppeId'],
    });
    if (!treffer) throw new NotFoundException('Angebot nicht gefunden');
    return treffer;
  }

  /**
   * OEFFENTLICHE Gruppen-Ansicht ueber das Token: alle Varianten der Gruppe (read-only
   * Kerndaten). Die Gruppe wird STRIKT ueber tenantId (aus dem Treffer) + varianteGruppeId
   * geladen -> selbst bei einer (astronomisch unwahrscheinlichen) Token-Kollision kein
   * Fremd-Tenant-Leak. Keine sensiblen Felder (Kunde/Hinweis/Tokens).
   */
  async angebotGruppeByToken(token: string): Promise<{
    betrieb: string;
    varianten: Array<{
      id: string;
      nummer: string | null;
      label: string | null;
      status: string | null;
      istGewaehlt: boolean;
      gueltigBis: string | null;
      istAbgelaufen: boolean;
      netto: number;
      mwst: number;
      brutto: number;
      positionen: Array<{
        beschreibung: string;
        menge: number;
        einzelpreis: number;
        gesamtpreis: number;
      }>;
    }>;
  }> {
    const treffer = await this.resolveAngebotToken(token);
    const clean = (token || '').trim();
    const varianten = treffer.varianteGruppeId
      ? await this.repo.find({
          where: {
            tenantId: treffer.tenantId,
            varianteGruppeId: treffer.varianteGruppeId,
            angebotToken: clean,
          },
          relations: ['items'],
          order: { createdAt: 'ASC' },
        })
      : await this.repo.find({
          where: { tenantId: treffer.tenantId, id: treffer.id, angebotToken: clean },
          relations: ['items'],
        });
    const tenant = await this.tenantRepo.findOne({ where: { id: treffer.tenantId } });
    const jetzt = Date.now();
    return {
      betrieb: tenant?.name ?? 'Detailly',
      varianten: varianten.map((v) => ({
        id: v.id,
        nummer: v.nummer ?? null,
        label: v.varianteLabel ?? null,
        status: v.angebotStatus ?? null,
        istGewaehlt: !!v.istGewaehlt,
        gueltigBis: v.gueltigBis ? new Date(v.gueltigBis).toISOString() : null,
        istAbgelaufen: v.gueltigBis ? new Date(v.gueltigBis).getTime() < jetzt : false,
        netto: Number(v.netto),
        mwst: Number(v.mwst),
        brutto: Number(v.brutto),
        positionen: (v.items ?? []).map((i) => ({
          beschreibung: i.beschreibung,
          menge: Number(i.menge),
          einzelpreis: Number(i.einzelpreis),
          gesamtpreis: Number(i.gesamtpreis),
        })),
      })),
    };
  }

  /**
   * OEFFENTLICHE Annahme einer Variante ueber das Token. Die gewaehlte invoiceId muss
   * zur Token-Gruppe (und damit zum Tenant des Treffers) gehoeren -> kein Fremd-Zugriff.
   * Delegiert an acceptAngebotCore (tenantId aus dem Token, NICHT aus dem Request).
   */
  async acceptAngebotByToken(token: string, invoiceId: string): Promise<Order> {
    const treffer = await this.resolveAngebotToken(token);
    const clean = (token || '').trim();
    const ziel = await this.repo.findOne({
      where: { id: invoiceId, tenantId: treffer.tenantId, angebotToken: clean },
      select: ['id', 'tenantId'],
    });
    if (!ziel) throw new NotFoundException('Angebot nicht gefunden');
    return this.acceptAngebotCore(ziel.tenantId, ziel.id);
  }

  // ---------------------------------------------------------------------------
  // Welle 1 (F3): Anzahlung/Abschlag
  // ---------------------------------------------------------------------------

  /**
   * Erzeugt eine Anzahlungsrechnung (art=rechnung, GoBD: RE-Nummer erst bei
   * Festsetzung) mit einer Position "Anzahlung auf ...". Basis ist eine Rechnung
   * (invoiceId) ODER ein Auftrag (orderId); die Hoehe kommt als BRUTTO-Betrag ODER
   * Prozent vom Basis-Brutto. Intern: netto = round2(brutto / (1 + satz/100)),
   * Position einzelpreis = netto, MwSt am Beleg-Satz -> der Kunde zahlt exakt den
   * genannten Betrag. Setzt istAnzahlung=true + Verweise (orderId / anzahlungFuerInvoiceId).
   */
  async createAnzahlung(user: AuthUser, dto: CreateAnzahlungDto): Promise<Invoice> {
    if (!dto.invoiceId && !dto.orderId) {
      throw new BadRequestException('Bitte eine Basis angeben (invoiceId oder orderId).');
    }
    if (dto.betragBrutto == null && dto.prozent == null) {
      throw new BadRequestException('Bitte eine Hoehe angeben (betragBrutto oder prozent).');
    }

    // Basis (tenant-scoped) aufloesen: Brutto, MwSt-Satz, Kunde, Auftrag.
    let basisBrutto: number;
    let satz: number;
    let customerId: string;
    let orderId: string | undefined;
    let bezug: string;
    if (dto.invoiceId) {
      const inv = await this.repo.findOne({ where: { id: dto.invoiceId, tenantId: user.tenantId } });
      if (!inv) throw new NotFoundException('Basis-Rechnung nicht gefunden');
      basisBrutto = Number(inv.brutto);
      satz = Number(inv.mwstSatz) || MWST_SATZ * 100;
      customerId = inv.customerId;
      orderId = inv.orderId ?? undefined;
      bezug = inv.nummer ? `Rechnung ${inv.nummer}` : 'Rechnung';
    } else {
      const order = await this.orderRepo.findOne({
        where: { id: dto.orderId, tenantId: user.tenantId },
      });
      if (!order) throw new NotFoundException('Basis-Auftrag nicht gefunden');
      basisBrutto = Number(order.gesamtpreis);
      satz = MWST_SATZ * 100;
      customerId = order.customerId;
      orderId = order.id;
      bezug = `Auftrag ${order.auftragsnummer}`;
    }

    // Welle 1 (§19 UStG): Kleinunternehmer -> 0 % erzwingen, damit die
    // Netto-aus-Brutto-Rechnung unten (netto = brutto/(1+satz/100)) zum in
    // create() serverseitig erzwungenen 0 %-Satz passt (sonst Brutto-Diff).
    const steuer = await this.steuerConfig(user.tenantId);
    if (steuer.kleinunternehmer) satz = 0;

    // Brutto bestimmen (expliziter Betrag ODER Prozent vom Basis-Brutto).
    const brutto =
      dto.betragBrutto != null
        ? round2(Number(dto.betragBrutto))
        : round2((basisBrutto * Number(dto.prozent)) / 100);
    if (!(brutto > 0)) {
      throw new BadRequestException('Der Anzahlungsbetrag muss groesser als 0 sein.');
    }
    // Netto aus Brutto herausrechnen; Position = netto, MwSt am Beleg-Satz -> das
    // Beleg-Brutto trifft den genannten Betrag wieder genau.
    const netto = round2(brutto / (1 + satz / 100));

    const invoice = await this.create(user, {
      customerId,
      orderId,
      art: InvoiceKind.RECHNUNG,
      mwstSatz: [0, 7, 19].includes(satz) ? satz : undefined,
      items: [{ beschreibung: `Anzahlung auf ${bezug}`, menge: 1, einzelpreis: netto }],
    });
    // Anzahlungs-Flags setzen (create() kennt sie nicht). Tenant-scoped.
    await this.repo.update(
      { id: invoice.id, tenantId: user.tenantId },
      { istAnzahlung: true, anzahlungFuerInvoiceId: dto.invoiceId ?? null },
    );
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'anzahlung_erstellt',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: { brutto, netto, bezug },
    });
    return this.findOne(user.tenantId, invoice.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    // GoBD-Aenderungssperre: eine festgesetzte (gestellte) Rechnung ist
    // unveraenderlich - Korrektur nur per Storno + neue Rechnung.
    if (istFestgesetzt(invoice.art, invoice.status)) {
      throw new ConflictException(
        'Festgesetzte Rechnung ist unveraenderlich - bitte stornieren und neu erstellen.',
      );
    }
    // GoBD-Nachvollziehbarkeit: ein ENTSCHIEDENES Angebot (angenommen ODER
    // abgelehnt) ist ein abgeschlossener Vorgang -> ebenfalls unveraenderlich.
    // Ein angenommenes Angebot ist der Beleg, aus dem ein Auftrag entstand; ein
    // abgelehntes ist die dokumentierte Absage (z. B. eine nicht gewaehlte
    // Set-Variante). Der Zustand liegt im SEPARATEN Feld angebotStatus (nicht im
    // InvoiceStatus, der bei Angeboten auf ENTWURF bleibt). Offene Angebote –
    // inkl. clientseitig „abgelaufener", die persistiert weiter OFFEN sind –
    // bleiben editierbar (Gueltigkeit/Preis anpassen und neu versenden).
    if (invoice.art === InvoiceKind.ANGEBOT && istAngebotEntschieden(invoice.angebotStatus)) {
      throw new ConflictException(
        'Dieses Angebot ist abgeschlossen (angenommen oder abgelehnt) und kann nicht mehr ' +
          'geaendert werden - bitte ein neues Angebot erstellen.',
      );
    }
    // Welle 1 (§19 UStG): Kleinunternehmer -> 0 % auch beim Bearbeiten erzwingen
    // (Client-Wert ignorieren). Betrifft nur Entwuerfe/Angebote – festgesetzte
    // Rechnungen sind oben bereits gesperrt (GoBD).
    const steuer = await this.steuerConfig(user.tenantId);
    const satzVorher = Number(invoice.mwstSatz);
    if (steuer.kleinunternehmer) invoice.mwstSatz = 0;
    else if (dto.mwstSatz !== undefined) invoice.mwstSatz = dto.mwstSatz;
    if (dto.items) {
      // Positionen nur IM SPEICHER vorbereiten – das Loeschen der alten Zeilen
      // passiert unten atomar zusammen mit dem Speichern.
      invoice.items = this.buildItems(dto.items).map((i) => {
        i.invoiceId = id;
        return i;
      });
    }
    // Bei geaenderten Positionen ODER geaendertem Satz (inkl. §19-Erzwingung):
    // Summen neu mit dem tatsaechlichen Satz der Rechnung berechnen (nicht stur 19 %).
    if (dto.items || dto.mwstSatz !== undefined || Number(invoice.mwstSatz) !== satzVorher) {
      Object.assign(invoice, this.totals(invoice.items, Number(invoice.mwstSatz)));
    }
    if (dto.hinweis !== undefined) invoice.hinweis = dto.hinweis;
    // Bei geaenderten Positionen: alte Positionen loeschen UND die Rechnung (inkl.
    // neuer Positionen via Cascade) in EINER Transaktion speichern. Sonst koennte
    // ein Absturz zwischen delete und save eine Rechnung OHNE Positionen
    // hinterlassen. Ohne Positionsaenderung genuegt der einfache save.
    const saved = dto.items
      ? await this.repo.manager.transaction(async (m) => {
          await m.delete(InvoiceItem, { invoiceId: id });
          return m.save(invoice);
        })
      : await this.repo.save(invoice);
    // GoBD-Nachvollziehbarkeit: WELCHE Bestandteile eines noch aenderbaren Belegs
    // geaendert wurden, wird mitprotokolliert (v. a. Positionsaenderungen).
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'Invoice',
      entityId: id,
      payload: {
        itemsGeaendert: dto.items !== undefined,
        hinweisGeaendert: dto.hinweis !== undefined,
        mwstSatzGeaendert: dto.mwstSatz !== undefined,
      },
    });
    return this.findOne(user.tenantId, saved.id);
  }

  async changeStatus(user: AuthUser, id: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    if (!statuswechselErlaubt(invoice.art, invoice.status, status)) {
      throw new ConflictException(
        `Statuswechsel "${invoice.status}" -> "${status}" ist fuer diese Rechnung nicht erlaubt.`,
      );
    }

    // GoBD: Bei der Festsetzung (Entwurf -> Offen) bekommt die Rechnung ihre
    // lueckenlose RE-Nummer (falls noch keine vorhanden).
    const mussNummerZiehen =
      status === InvoiceStatus.OFFEN &&
      invoice.art === InvoiceKind.RECHNUNG &&
      !invoice.nummer;

    invoice.status = status;
    // Konsistenz: jeder Weg nach 'bezahlt' erfasst das Zahldatum (auch der generische
    // Statuswechsel, nicht nur POST /:id/bezahlt).
    if (status === InvoiceStatus.BEZAHLT && !invoice.zahldatum) {
      invoice.zahldatum = new Date();
    }

    // GoBD (B4): Bei der Festsetzung ist das Belegdatum der Festsetzungszeitpunkt,
    // damit Rechnungsdatum-Jahr und Nummernkreis-Jahr (nextSequentialNumber nutzt
    // das aktuelle Jahr) garantiert uebereinstimmen — sonst entsteht bei einem
    // Jahreswechsel (Entwurf im Vorjahr) ein rueckdatierter Beleg mit falscher
    // Steuerperiode. Ein am Entwurf gepflegtes leistungsdatum bleibt erhalten.
    if (mussNummerZiehen) {
      invoice.datum = new Date();
    }

    // C1: RE-Nummer INNERHALB der Retry-Schleife ziehen und speichern. Bei einer
    // Unique-Kollision (tenantId, nummer) wird nach dem Commit der Konkurrenz neu
    // gezaehlt und erneut gespeichert -> keine doppelte Rechnungsnummer (GoBD).
    const saved = await withUniqueRetry(async () => {
      if (mussNummerZiehen) {
        invoice.nummer = await nextSequentialNumber(this.repo, user.tenantId, 'RE', {
          nummerFeld: 'nummer',
        });
      }
      return this.repo.save(invoice);
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'status_change',
      entityType: 'Invoice',
      entityId: id,
      payload: { status },
    });

    // Beim Stellen einer Rechnung (offen) optional an sevDesk pushen – NACH der
    // Festsetzung (best effort), damit ein sevDesk-Fehler die bereits vergebene
    // RE-Nummer nicht zurueckrollt.
    if (status === InvoiceStatus.OFFEN && invoice.art === InvoiceKind.RECHNUNG) {
      await this.syncToSevdesk(user, saved);
    }
    return this.findOne(user.tenantId, id);
  }

  /**
   * Pusht eine gestellte Rechnung best effort an sevDesk (Kontakt sicherstellen,
   * dann Rechnung anlegen). Idempotent (vorhandene sevdeskInvoiceId -> nichts).
   * Faengt ALLE Fehler ab – die Rechnungs-Festsetzung darf nie blockiert werden.
   * Ohne hinterlegten Token ist die Integration aus (No-op).
   */
  private async syncToSevdesk(user: AuthUser, invoice: Invoice): Promise<void> {
    if (invoice.sevdeskInvoiceId) return;
    try {
      const token = await this.sevdesk.loadToken(user.tenantId);
      if (!token) return;
      const ctx = { tenantId: user.tenantId, token };

      const customer = await this.customerRepo.findOne({
        where: { id: invoice.customerId, tenantId: user.tenantId },
      });
      let contactId = customer?.sevdeskContactId ?? null;
      if (customer && !contactId) {
        contactId = await this.sevdesk.syncContact(ctx, customer);
        if (contactId) {
          customer.sevdeskContactId = contactId;
          await this.customerRepo.save(customer);
        }
      }
      if (!contactId) throw new Error('Kein sevDesk-Kontakt fuer den Kunden vorhanden.');

      const sevdeskId = await this.sevdesk.createInvoice(ctx, invoice, contactId);
      if (sevdeskId) {
        await this.repo.update(
          { id: invoice.id, tenantId: user.tenantId },
          { sevdeskInvoiceId: sevdeskId },
        );
      }
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'sevdesk_sync',
        entityType: 'Invoice',
        entityId: invoice.id,
        payload: { sevdeskInvoiceId: sevdeskId },
      });
    } catch (err) {
      // Nie die Festsetzung blockieren -> nur loggen + Audit (ohne Token).
      this.logger.warn(`sevdesk-Sync fehlgeschlagen (Invoice ${invoice.id}): ${(err as Error).message}`);
      await this.audit
        .log({
          tenantId: user.tenantId,
          userId: user.id,
          action: 'sevdesk_sync_failed',
          entityType: 'Invoice',
          entityId: invoice.id,
          payload: { error: (err as Error).message },
        })
        .catch(() => undefined);
    }
  }

  /**
   * Rendert die PDF eines Belegs. Laedt die Invoice tenant-scoped (findOne wirft
   * NotFound bei Fremd-/Nichtexistenz) und zusaetzlich Customer (im selben Tenant)
   * + Tenant (Absender). Gibt einen PDF-Buffer zurueck.
   */
  /** Laedt Invoice (tenant-scoped, items) + Customer + Tenant fuer PDF/Versand. */
  private async loadContext(tenantId: string, id: string) {
    const invoice = await this.findOne(tenantId, id);
    const customer = await this.customerRepo.findOne({
      where: { id: invoice.customerId, tenantId },
    });
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return { invoice, customer, tenant };
  }

  async buildPdf(tenantId: string, id: string): Promise<{ buffer: Buffer; nummer: string }> {
    const { invoice, customer, tenant } = await this.loadContext(tenantId, id);
    const buffer = await this.pdf.render(invoice as any, customer as any, tenant as any);
    return { buffer, nummer: invoice.nummer ?? 'Entwurf' };
  }

  // ---------------------------------------------------------------------------
  // Oeffentlicher Download-Link (Kunde laedt sein PDF ohne Login)
  // ---------------------------------------------------------------------------

  /** Nur gestellte Belege (offen/bezahlt) sind oeffentlich teilbar/abrufbar. */
  private static readonly DOWNLOAD_STATUS: InvoiceStatus[] = [
    InvoiceStatus.OFFEN,
    InvoiceStatus.BEZAHLT,
  ];

  /** Liefert das Download-Token eines Belegs (erzeugt es beim ersten Mal). */
  async getOrCreateDownloadToken(user: AuthUser, id: string): Promise<{ token: string }> {
    const inv = await this.repo.findOne({
      where: { id, tenantId: user.tenantId },
      select: ['id', 'status', 'downloadToken'],
    });
    if (!inv) throw new NotFoundException('Beleg nicht gefunden');
    if (!InvoicesService.DOWNLOAD_STATUS.includes(inv.status)) {
      throw new BadRequestException('Nur offene oder bezahlte Belege koennen geteilt werden.');
    }
    if (inv.downloadToken) return { token: inv.downloadToken };
    const token = randomBytes(24).toString('hex');
    await this.repo.update({ id, tenantId: user.tenantId }, { downloadToken: token });
    return { token };
  }

  /** Erzeugt ein NEUES Download-Token (alter Link wird ungueltig). */
  async regenerateDownloadToken(user: AuthUser, id: string): Promise<{ token: string }> {
    const inv = await this.repo.findOne({
      where: { id, tenantId: user.tenantId },
      select: ['id', 'status'],
    });
    if (!inv) throw new NotFoundException('Beleg nicht gefunden');
    if (!InvoicesService.DOWNLOAD_STATUS.includes(inv.status)) {
      throw new BadRequestException('Nur offene oder bezahlte Belege koennen geteilt werden.');
    }
    const token = randomBytes(24).toString('hex');
    await this.repo.update({ id, tenantId: user.tenantId }, { downloadToken: token });
    return { token };
  }

  /**
   * Loest ein Download-Token zu einem freigegebenen Beleg auf. Hex-Plausibilitaet
   * vor dem DB-Treffer; nur offene/bezahlte Belege gelten (Entwurf/Storno -> 404,
   * kein Hinweis ob das Token existiert). Der Tenant ergibt sich aus dem Treffer.
   */
  private async resolveByToken(token: string): Promise<Invoice> {
    const clean = (token || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(clean)) throw new NotFoundException('Beleg nicht gefunden');
    const inv = await this.repo.findOne({
      where: { downloadToken: clean },
      select: ['id', 'tenantId', 'status', 'nummer', 'art', 'brutto', 'datum'],
    });
    if (!inv || !InvoicesService.DOWNLOAD_STATUS.includes(inv.status)) {
      throw new NotFoundException('Beleg nicht gefunden');
    }
    return inv;
  }

  /**
   * Oeffentliche Meta-Ansicht fuer die Download-Seite (kein PDF, nur Eckdaten).
   *
   * P3-4 (T-006): Fuer OFFENE Rechnungen zusaetzlich ein `zahlung`-Block
   * ("Jetzt bezahlen"): Bankverbindung + GiroCode-Payload (EPC-QR) und optional
   * der eigene Online-Zahlungslink des Betriebs (tenant.settings). Es fliesst
   * KEIN Geld ueber die Plattform – wir zeigen nur die Ueberweisungsdaten, die
   * heute schon im PDF-Fusser desselben Belegs stehen (gleiche Token-Huerde).
   * Angebote und bereits bezahlte/stornierte Belege bekommen keinen Block.
   */
  async downloadMetaByToken(token: string): Promise<{
    betrieb: string;
    betriebSlug: string | null;
    nummer: string;
    art: string;
    status: string;
    brutto: number;
    datum: string | null;
    zahlung: {
      empfaenger: string;
      iban: string;
      bic: string;
      bankname: string;
      betrag: number;
      verwendungszweck: string;
      epcQrData: string | null;
      paymentLink: string | null;
    } | null;
  }> {
    const inv = await this.resolveByToken(token);
    // Ohne select-Projektion: fuer den Zahlungsblock werden die (verschluesselt
    // gespeicherten) settings gebraucht; select:false-Spalten (Tokens) bleiben aussen vor.
    const tenant = await this.tenantRepo.findOne({ where: { id: inv.tenantId } });

    let zahlung: {
      empfaenger: string;
      iban: string;
      bic: string;
      bankname: string;
      betrag: number;
      verwendungszweck: string;
      epcQrData: string | null;
      paymentLink: string | null;
    } | null = null;

    if (inv.art === InvoiceKind.RECHNUNG && inv.status === InvoiceStatus.OFFEN && tenant) {
      const s = (tenant.settings ?? {}) as Record<string, unknown>;
      const str = (key: string): string => {
        const v = s[key];
        return typeof v === 'string' ? v.trim() : '';
      };
      const iban = str('iban');
      // Defense-in-depth: der Link wird beim Speichern validiert, hier trotzdem
      // nur mit https:// ausliefern (settings koennten anderweitig befuellt sein).
      const rohLink = str('rechnungPaymentLink');
      const paymentLink = /^https:\/\/\S+$/.test(rohLink) ? rohLink : null;
      const betrag = Number(inv.brutto || 0);

      if (iban || paymentLink) {
        const verwendungszweck = inv.nummer ? `Rechnung ${inv.nummer}` : 'Rechnung';
        zahlung = {
          empfaenger: tenant.name ?? '',
          iban,
          bic: str('bic'),
          bankname: str('bankname'),
          betrag,
          verwendungszweck,
          // Fail-closed: bei ungueltiger IBAN/Betrag liefert der Builder null ->
          // die Seite zeigt dann nur die Textdaten bzw. den Link.
          epcQrData: iban
            ? buildEpcQrPayload({
                name: tenant.name ?? '',
                iban,
                bic: str('bic'),
                betrag,
                verwendungszweck,
              })
            : null,
          paymentLink,
        };
      }
    }

    return {
      betrieb: tenant?.name ?? 'Detailly',
      // Slug (public, PII-frei) fuer den Impressum-Footer-Link der Belegseite.
      betriebSlug: tenant?.slug ?? null,
      nummer: inv.nummer ?? '',
      art: inv.art,
      status: inv.status,
      brutto: Number(inv.brutto || 0),
      datum: inv.datum ? new Date(inv.datum).toISOString() : null,
      zahlung,
    };
  }

  /** Oeffentliches PDF ueber Token (delegiert nach Aufloesung an buildPdf). */
  async buildPdfByToken(token: string): Promise<{ buffer: Buffer; nummer: string }> {
    const inv = await this.resolveByToken(token);
    return this.buildPdf(inv.tenantId, inv.id);
  }

  /**
   * Versendet den Beleg als PDF-Anhang per E-Mail an die Kunden-Adresse. Nur Belege
   * MIT Nummer (Angebot hat sie ab Anlage; Rechnung erst nach Festsetzung) – ein
   * Rechnungs-Entwurf ohne Nummer wird abgelehnt. Stornierte Belege ebenfalls.
   * Setzt versendetAm. Ohne SMTP (Dev) loggt MailService nur – Status wird trotzdem
   * gesetzt, damit der Ablauf testbar bleibt.
   */
  async sendByEmail(user: AuthUser, id: string): Promise<Invoice> {
    const { invoice, customer, tenant } = await this.loadContext(user.tenantId, id);
    if (invoice.status === InvoiceStatus.STORNIERT) {
      throw new BadRequestException('Ein stornierter Beleg kann nicht versendet werden.');
    }
    if (!invoice.nummer) {
      throw new BadRequestException(
        'Bitte die Rechnung zuerst festsetzen (Nummer vergeben), bevor sie versendet wird.',
      );
    }
    const email = customer?.email?.trim();
    if (!email) {
      throw new BadRequestException('Der Kunde hat keine E-Mail-Adresse hinterlegt.');
    }

    const buffer = await this.pdf.render(invoice as any, customer as any, tenant as any);
    const { subject, html, text } = this.buildBelegMail(invoice, customer, tenant);
    await this.mail.send({
      to: email,
      subject,
      html,
      text,
      attachments: [{ filename: `${invoice.nummer}.pdf`, content: buffer }],
      // Sendet – falls konfiguriert – ueber den betriebseigenen SMTP/Absender.
      tenantId: user.tenantId,
    });

    await this.repo.update({ id, tenantId: user.tenantId }, { versendetAm: new Date() });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'email_sent',
      entityType: 'Invoice',
      entityId: id,
      payload: { nummer: invoice.nummer, to: email },
    });
    return this.findOne(user.tenantId, id);
  }

  /** Baut Betreff + HTML/Text der Beleg-Mail (Angebot oder Rechnung). */
  private buildBelegMail(invoice: Invoice, customer: Customer | null, tenant: Tenant | null) {
    const istAngebot = invoice.art === InvoiceKind.ANGEBOT;
    const doc = istAngebot ? 'Angebot' : 'Rechnung';
    const betrieb = tenant?.name?.trim() || 'Ihr Aufbereitungsbetrieb';
    const brutto = this.formatEuro(Number(invoice.brutto));
    const subject = `${doc} ${invoice.nummer} von ${betrieb}`;

    const zeilen: string[] = [this.kundenAnrede(customer), ''];
    if (istAngebot) {
      zeilen.push(`anbei erhalten Sie unser Angebot ${invoice.nummer} über ${brutto}.`);
      zeilen.push('Bei Fragen oder zur Beauftragung melden Sie sich gerne bei uns.');
    } else {
      zeilen.push(`anbei erhalten Sie Ihre Rechnung ${invoice.nummer} über ${brutto}.`);
      if (invoice.faelligkeitsdatum) {
        zeilen.push(`Wir bitten um Zahlung bis zum ${this.formatDatum(invoice.faelligkeitsdatum)}.`);
      }
    }
    zeilen.push('', 'Das Dokument finden Sie im PDF-Anhang.', '', 'Mit freundlichen Grüßen', betrieb);
    return { subject, html: this.linesToHtml(zeilen), text: zeilen.join('\n') };
  }

  /**
   * Baut Betreff + HTML/Text einer Mahnung/Zahlungserinnerung. `gebuehr` (EUR,
   * Cent-normalisiert; Default 0) wird – falls > 0 – als separater Posten genannt
   * und in den zu zahlenden Gesamtbetrag (brutto + Gebuehr) eingerechnet.
   */
  private buildMahnungMail(
    invoice: Invoice,
    customer: Customer | null,
    tenant: Tenant | null,
    stufe: number,
    zahlbarBis: Date,
    gebuehr = 0,
  ) {
    const titel = MAHN_TITEL[stufe] ?? 'Zahlungserinnerung';
    const betrieb = tenant?.name?.trim() || 'Ihr Aufbereitungsbetrieb';
    const bruttoNum = Number(invoice.brutto);
    const brutto = this.formatEuro(bruttoNum);
    const hatGebuehr = gebuehr > 0;
    const zahlbetrag = this.formatEuro(Math.round((bruttoNum + gebuehr) * 100) / 100);
    const subject = `${titel}: Rechnung ${invoice.nummer} von ${betrieb}`;

    const zeilen: string[] = [this.kundenAnrede(customer), ''];
    if (stufe <= 1) {
      zeilen.push(`unsere Rechnung ${invoice.nummer} über ${brutto} ist bei uns noch offen.`);
      zeilen.push('Falls Sie bereits gezahlt haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.');
    } else {
      zeilen.push(`zu unserer Rechnung ${invoice.nummer} über ${brutto} liegt uns noch kein Zahlungseingang vor.`);
    }
    if (hatGebuehr) {
      zeilen.push(
        `Zzgl. Mahngebühr ${this.formatEuro(gebuehr)} beträgt der offene Gesamtbetrag ${zahlbetrag}.`,
      );
    }
    zeilen.push(
      `Wir bitten um Ausgleich ${hatGebuehr ? 'des Gesamtbetrags ' : ''}bis zum ${this.formatDatum(zahlbarBis)}.`,
    );
    zeilen.push('', 'Die Einzelheiten finden Sie im PDF-Anhang.', '', 'Mit freundlichen Grüßen', betrieb);
    return { subject, html: this.linesToHtml(zeilen), text: zeilen.join('\n') };
  }

  private linesToHtml(zeilen: string[]): string {
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6">${zeilen
      .map((z) => (z === '' ? '<br/>' : `<p style="margin:0 0 4px">${this.escapeHtml(z)}</p>`))
      .join('')}</div>`;
  }

  private kundenAnrede(customer: Customer | null): string {
    const name =
      customer?.type === CustomerType.BUSINESS
        ? customer?.companyName
        : [customer?.firstName, customer?.lastName].filter(Boolean).join(' ');
    return name ? `Guten Tag ${name},` : 'Guten Tag,';
  }

  private formatEuro(value: number): string {
    return `${value.toFixed(2).replace('.', ',')} €`;
  }

  private formatDatum(d: Date): string {
    const date = new Date(d);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  private escapeHtml(s: string): string {
    return s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
    );
  }

  /** Markiert eine Rechnung als bezahlt und erfasst das Zahldatum. */
  async markPaid(user: AuthUser, id: string): Promise<Invoice> {
    const invoice = await this.findOne(user.tenantId, id);
    // Nur gestellte (offene) Rechnungen koennen bezahlt werden – ein Entwurf
    // muss erst festgesetzt werden (sonst Rechnung ohne Nummer).
    if (!statuswechselErlaubt(invoice.art, invoice.status, InvoiceStatus.BEZAHLT)) {
      throw new ConflictException(
        'Nur gestellte (offene) Rechnungen koennen als bezahlt markiert werden.',
      );
    }
    invoice.status = InvoiceStatus.BEZAHLT;
    // GoBD/EUeR: das Zahldatum wird nur beim ERSTEN Mal gesetzt. Ein idempotenter
    // Re-Call auf BEZAHLT darf den gebuchten Zahlungszufluss (Steuerperiode) nie
    // verschieben (analog zum Guard in changeStatus).
    if (!invoice.zahldatum) invoice.zahldatum = new Date();
    const saved = await this.repo.save(invoice);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'mark_paid',
      entityType: 'Invoice',
      entityId: id,
      payload: { zahldatum: invoice.zahldatum },
    });
    return saved;
  }

  /** Tage, die eine Rechnung ueber ihre (ggf. abgeleitete) Faelligkeit hinaus ist. */
  private tageUeberfaellig(inv: Invoice): number {
    const tag = 24 * 60 * 60 * 1000;
    const faellig = inv.faelligkeitsdatum
      ? new Date(inv.faelligkeitsdatum).getTime()
      : inv.datum
        ? new Date(inv.datum).getTime() + (inv.zahlungsziel ?? 14) * tag
        : null;
    if (faellig == null) return 0;
    return Math.max(0, Math.floor((Date.now() - faellig) / tag));
  }

  /**
   * Mahnt eine offene Rechnung (manueller Aufruf aus dem Controller). Delegiert an
   * die geteilte Kern-Logik `sendMahnung`; `user` liefert Tenant + Audit-Akteur.
   */
  async mahnen(user: AuthUser, id: string): Promise<Invoice> {
    return this.sendMahnung(user.tenantId, id, user.id);
  }

  /**
   * Kern-Mahnlogik (geteilt von manuellem Endpoint UND Auto-Mahn-Job): erhoeht die
   * Mahnstufe um EINE Stufe (max 3), rendert das passende Mahn-/Erinnerungs-PDF und
   * versendet es per E-Mail an den Kunden. Setzt `versendetAm` (Nachweis + Grundlage
   * der Tages-Idempotenz des Auto-Jobs).
   *
   * Strikt tenant-scoped: laedt die Rechnung ueber `findOne(tenantId, id)` (wirft
   * NotFound bei Fremd-/Nichtexistenz). Mahnt NUR gestellte, OFFENE Rechnungen mit
   * Nummer – Angebote/Entwuerfe/bezahlte/stornierte -> 400 (Schutz gegen falsche
   * Mahnungen; im Auto-Job faengt der Aufrufer diese Faelle je Rechnung ab).
   * `actorUserId` = ausloesender Benutzer (Audit); im Auto-Job undefined (System).
   */
  async sendMahnung(tenantId: string, id: string, actorUserId?: string): Promise<Invoice> {
    const { invoice, customer, tenant } = await this.loadContext(tenantId, id);
    if (invoice.art !== InvoiceKind.RECHNUNG) {
      throw new BadRequestException('Nur Rechnungen können gemahnt werden.');
    }
    if (invoice.status !== InvoiceStatus.OFFEN || !invoice.nummer) {
      throw new BadRequestException('Nur gestellte, offene Rechnungen können gemahnt werden.');
    }
    const email = customer?.email?.trim();
    if (!email) {
      throw new BadRequestException('Der Kunde hat keine E-Mail-Adresse hinterlegt.');
    }

    const altStufe = invoice.mahnstufe ?? 0;
    const neueStufe = Math.min(altStufe + 1, 3);
    const mahndatum = new Date();
    const zahlbarBis = new Date(mahndatum.getTime() + 7 * 24 * 60 * 60 * 1000);

    // B6: konfigurierte Mahngebuehr der Stufe anwenden. Stufen-Semantik wie
    // MAHN_TITEL/mahnwesen-config: 1 = Zahlungserinnerung (0 €), 2 = 1. Mahnung
    // (gebuehr.mahnung1), 3 = 2. Mahnung (gebuehr.mahnung2). Config wird defensiv
    // aus tenant.settings.mahnwesen aufgeloest (Muster wie im Auto-Mahn-Job).
    const mahnCfg = resolveMahnwesenConfig(
      (tenant?.settings as Record<string, unknown> | null)?.mahnwesen,
    );
    const gebuehr =
      neueStufe === 2 ? mahnCfg.gebuehr.mahnung1 : neueStufe === 3 ? mahnCfg.gebuehr.mahnung2 : 0;
    const gesamtbetrag = Math.round((Number(invoice.brutto) + gebuehr) * 100) / 100;

    // C2: Idempotenz gegen Doppelklick/Retry. (a) Tages-Guard wie im Auto-Job –
    // heute schon gemahnt? -> 409, kein zweiter Versand.
    if (
      invoice.versendetAm &&
      new Date(invoice.versendetAm).toDateString() === mahndatum.toDateString()
    ) {
      throw new ConflictException('Diese Rechnung wurde heute bereits gemahnt.');
    }
    // (b) Race-Schutz: die Stufen-Erhoehung ATOMAR beanspruchen, BEVOR gerendert/
    // gemailt wird. Nur der Gewinner (affected===1) versendet; ein zeitgleicher
    // zweiter Aufruf verliert das konditionale Update und wird abgewiesen.
    const anspruch = await this.repo.update(
      { id, tenantId, mahnstufe: altStufe },
      { mahnstufe: neueStufe, versendetAm: mahndatum },
    );
    // affected===0 = kein Treffer (Race verloren / Stufe bereits erhoeht). Ein echter
    // DB-Update liefert 0 oder 1; nur der eindeutige Verlust wird abgewiesen.
    if (anspruch?.affected === 0) {
      throw new ConflictException('Für diese Rechnung wird bereits eine Mahnung versendet.');
    }

    try {
      const buffer = await this.pdf.renderMahnung(invoice as any, customer as any, tenant as any, {
        mahnstufe: neueStufe,
        mahndatum,
        zahlbarBis,
        tageUeberfaellig: this.tageUeberfaellig(invoice),
        gebuehr,
        gesamtbetrag,
      });
      const { subject, html, text } = this.buildMahnungMail(
        invoice,
        customer,
        tenant,
        neueStufe,
        zahlbarBis,
        gebuehr,
      );
      const dateiTitel = (MAHN_TITEL[neueStufe] ?? 'Mahnung').replace(/[^A-Za-z0-9]+/g, '-');
      await this.mail.send({
        to: email,
        subject,
        html,
        text,
        attachments: [{ filename: `${dateiTitel}_${invoice.nummer}.pdf`, content: buffer }],
        // Sendet – falls konfiguriert – ueber den betriebseigenen SMTP/Absender.
        tenantId,
      });
    } catch (e) {
      // Versand fehlgeschlagen -> Anspruch zuruecknehmen, damit erneut gemahnt werden kann.
      await this.repo.update(
        { id, tenantId },
        { mahnstufe: altStufe, versendetAm: invoice.versendetAm ?? null },
      );
      throw e;
    }
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'mahnung_sent',
      entityType: 'Invoice',
      entityId: id,
      payload: { mahnstufe: neueStufe, to: email, auto: !actorUserId },
    });
    return this.findOne(tenantId, id);
  }

  /**
   * Mahnliste: offene Rechnungen, deren Faelligkeit ueberschritten ist. Tenant-scoped
   * via where {tenantId, status: OFFEN, art: RECHNUNG}. Effektive Faelligkeit =
   * gespeichertes faelligkeitsdatum, sonst (Altbestand) aus datum + zahlungsziel
   * (Default 14 Tage) abgeleitet, damit alte offene Rechnungen ohne gesetztes
   * Faelligkeitsdatum nicht durch die Mahnliste fallen. Vergleich bewusst in JS
   * (TypeORM-Date-Vergleich ist treiberabhaengig).
   */
  async mahnliste(tenantId: string): Promise<Array<Invoice & { tageUeberfaellig: number }>> {
    const offene = await this.repo.find({
      where: { tenantId, status: InvoiceStatus.OFFEN, art: InvoiceKind.RECHNUNG },
      relations: ['items'],
    });
    const now = Date.now();
    const tag = 24 * 60 * 60 * 1000;
    const faelligVon = (inv: Invoice): number | null => {
      if (inv.faelligkeitsdatum) return new Date(inv.faelligkeitsdatum).getTime();
      if (inv.datum) return new Date(inv.datum).getTime() + (inv.zahlungsziel ?? 14) * tag;
      return null;
    };
    return offene
      .map((inv) => ({ inv, faellig: faelligVon(inv) }))
      .filter((x) => x.faellig != null && x.faellig < now)
      .map(({ inv, faellig }) => ({
        ...inv,
        tageUeberfaellig: Math.floor((now - (faellig as number)) / tag),
      }))
      .sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig);
  }
}
