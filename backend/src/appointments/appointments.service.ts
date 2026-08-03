import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, Between, DataSource, EntityManager, In, Not } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { PatchAppointmentTimeDto } from './dto/patch-appointment-time.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { assertRefInTenant } from '../common/tenant/tenant-scope';
import { resolveKalender } from '../common/kalender/kalender-config';
import {
  KonfliktScope,
  assertKeinTerminKonflikt,
  ladeKonfliktSettings,
} from '../common/kalender/appointment-overlap';

/** Ein Kalendertag des Umsatz-Aggregats (Chef-Layer). */
export interface UmsatzTag {
  /** Kalendertag 'YYYY-MM-DD' (Server-Lokalzeit = Betriebs-Zeitzone). */
  datum: string;
  /** Brutto-Summe der Auftraege, deren FRUEHESTER Termin im Zeitraum an diesem Tag startet. */
  summe: number;
  /** Anzahl nicht-abgesagter Termine mit Start an diesem Tag (Auslastung, inkl. Termine ohne Auftrag). */
  anzahl: number;
}

export interface UmsatzAggregat {
  von: string;
  bis: string;
  /** Jeder Kalendertag des Zeitraums, 0-gefuellt (deterministisch fuer den Chart). */
  tage: UmsatzTag[];
  /** Summe ueber alle Tage (brutto). */
  gesamt: number;
  /** Wochen-Umsatzziel aus settings.kalender.umsatzZielWoche; null = kein Ziel. */
  zielWoche: number | null;
}

/** Maximale Zeitspanne des Umsatz-Aggregats in Kalendertagen (inklusive). */
export const UMSATZ_MAX_TAGE = 400;

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
    // Bewusst als LETZTER Parameter (nach dataSource): bestehende Specs
    // konstruieren den Service positional mit 7 Argumenten.
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
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
    const altStart = appt.start; // Original-Start VOR dem Patch (fuer Erinnerungs-Reset).
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
    resetErinnerungBeiVerschiebung(appt, altStart);
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
    const altStart = appt.start; // Original-Start VOR dem Verschieben (fuer Erinnerungs-Reset).
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
    resetErinnerungBeiVerschiebung(appt, altStart);
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

  /**
   * Umsatz-Aggregat fuer den Kalender-Chef-Layer (`GET /appointments/umsatz`):
   * je Kalendertag Brutto-Summe + Terminanzahl, dazu `gesamt` und das Wochenziel.
   *
   * Semantik (dokumentierte Entscheidungen):
   * - Datenquelle: nicht-abgesagte Termine mit Start im Zeitraum; `anzahl` je Tag
   *   zaehlt ALLE davon (Auslastungs-Indikator, auch Termine ohne Auftrag);
   *   mehrtaegige Termine zaehlen am Start-Tag.
   * - `summe`: Bruttobetrag (`order.gesamtpreis`) je Auftrag GENAU EINMAL - am Tag
   *   seines FRUEHESTEN Termins IM ABGEFRAGTEN ZEITRAUM. Achtung: Bei einem anderen
   *   Zeitfenster kann derselbe Auftrag dadurch einem anderen Tag zugeordnet werden;
   *   Teilzeitraum-Summen addieren sich deshalb nicht zwingend exakt zur Summe des
   *   Gesamtzeitraums. Auftrag ohne Betrag zaehlt 0.
   * - Aggregation bewusst im Service statt GROUP BY nach Datum: es gibt keinen
   *   cross-DB-Datums-Trunkierungs-Helfer (SQLite strftime vs. pg to_char), die
   *   Einmal-Zaehlung braeuchte Window-Functions, und rohe SQLite-Timestamps sind
   *   eine UTC-Parsing-Falle. Beide Queries sind tenant-gescoped mit Select-
   *   Projektion; die 400-Tage-Validierung begrenzt die Datenmenge (kein stilles
   *   take-Cap, das die Summen verfaelschen wuerde).
   * - Tagesgrenzen/Tages-Keys in Server-Lokalzeit (Betriebs-Zeitzone), konsistent
   *   zum setHours-Muster in verschnitt.aggregat.
   */
  async umsatzProTag(tenantId: string, von?: string, bis?: string): Promise<UmsatzAggregat> {
    const vonD = parseTagLokal(von, 'von');
    const bisD = parseTagLokal(bis, 'bis');
    if (bisD.getTime() < vonD.getTime()) {
      throw new BadRequestException('`bis` darf nicht vor `von` liegen.');
    }
    const tageAnzahl = Math.round((bisD.getTime() - vonD.getTime()) / TAG_MS) + 1;
    if (tageAnzahl > UMSATZ_MAX_TAGE) {
      throw new BadRequestException(
        `Zeitraum zu gross: maximal ${UMSATZ_MAX_TAGE} Tage (angefragt: ${tageAnzahl}).`,
      );
    }
    const bisEnde = new Date(bisD.getFullYear(), bisD.getMonth(), bisD.getDate(), 23, 59, 59, 999);

    // Query 1 (tenant-gescoped, Projektion): alle nicht-abgesagten Termine des
    // Zeitraums, aufsteigend nach Start -> "erster Treffer je orderId" = fruehester Termin.
    const termine = await this.repo.find({
      where: { tenantId, start: Between(vonD, bisEnde), status: Not(AppointmentStatus.ABGESAGT) },
      select: ['id', 'orderId', 'start'],
      order: { start: 'ASC' },
    });

    // Query 2 (tenant-gescoped): Bruttobetraege der verknuepften Auftraege.
    // decimal kommt aus pg als String -> Number()-Cast (locations-Muster).
    const orderIds = [...new Set(termine.map((t) => t.orderId).filter((id): id is string => !!id))];
    const brutto = new Map<string, number>();
    if (orderIds.length) {
      // STORNIERTE Auftraege NICHT mitzaehlen: ein stornierter Auftrag, dessen
      // Termin nicht mit abgesagt wurde, wuerde sonst mit vollem Preis in Umsatz-
      // Chart und Plantafel einfliessen (Bruttobetrag zu hoch).
      const orders = await this.orderRepo.find({
        where: { tenantId, id: In(orderIds), status: Not(OrderStatus.STORNIERT) },
        select: ['id', 'gesamtpreis'],
      });
      for (const o of orders) brutto.set(o.id, Number(o.gesamtpreis ?? 0) || 0);
    }

    // Tages-Buckets 0-gefuellt ueber den GESAMTEN Zeitraum (deterministisch fuer den Chart).
    const buckets = new Map<string, UmsatzTag>();
    for (let i = 0; i < tageAnzahl; i++) {
      const d = new Date(vonD.getFullYear(), vonD.getMonth(), vonD.getDate() + i);
      const datum = tagKey(d);
      buckets.set(datum, { datum, summe: 0, anzahl: 0 });
    }

    const gezaehlteOrders = new Set<string>();
    for (const t of termine) {
      const bucket = buckets.get(tagKey(t.start));
      if (!bucket) continue; // defensiv (TZ-Randfall am Zeitraumrand)
      bucket.anzahl += 1;
      // Betrag nur EINMAL: beim fruehesten Termin des Auftrags (Liste ist ASC sortiert).
      if (t.orderId && !gezaehlteOrders.has(t.orderId)) {
        gezaehlteOrders.add(t.orderId);
        bucket.summe = round2(bucket.summe + (brutto.get(t.orderId) ?? 0));
      }
    }

    const tage = [...buckets.values()];
    const gesamt = round2(tage.reduce((s, t) => s + t.summe, 0));

    // Wochenziel NUR hier ausliefern (Leitungsrollen-Endpoint) - der rollen-offene
    // kalender-einstellungen-Endpoint strippt umsatzZielWoche bewusst.
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['id', 'settings'],
    });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const zielWoche = resolveKalender(settings.kalender).umsatzZielWoche;

    return { von: tagKey(vonD), bis: tagKey(bisD), tage, gesamt, zielWoche };
  }
}

const TAG_MS = 24 * 60 * 60 * 1000;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Termin-Erinnerung nach dem Verschieben zuruecksetzen: Wurde ein Termin, dessen
 * Erinnerung bereits versendet wurde (`erinnerungGesendetAm` gesetzt), auf einen
 * SPAETEREN Kalendertag (Betriebs-Lokalzeit) verschoben, soll der Kunde fuer den
 * echten Termin erneut erinnert werden -> Marker auf null, damit der Scheduler den
 * Termin wieder claimen kann.
 *
 * BEWUSST tag-granular: eine Verschiebung um Minuten/Stunden am SELBEN Tag loest
 * KEINE zweite Erinnerung aus (Belaestigungs-Schutz – der Kunde weiss bereits, dass
 * der Termin an diesem Tag ist), und eine Verschiebung nach frueher / in die
 * Vergangenheit ebenfalls nicht (der spaetere-Tag-Vergleich greift dann nicht).
 */
function resetErinnerungBeiVerschiebung(appt: Appointment, altStart: Date): void {
  if (!appt.erinnerungGesendetAm) return; // noch nie erinnert -> nichts zurueckzusetzen
  if (!(appt.start instanceof Date) || !(altStart instanceof Date)) return; // defensiv
  if (istSpaetererKalendertag(appt.start, altStart)) appt.erinnerungGesendetAm = null;
}

/** true, wenn `neu` auf einem SPAETEREN Kalendertag (Server-Lokalzeit) liegt als `alt`. */
function istSpaetererKalendertag(neu: Date, alt: Date): boolean {
  const tagNeu = new Date(neu.getFullYear(), neu.getMonth(), neu.getDate()).getTime();
  const tagAlt = new Date(alt.getFullYear(), alt.getMonth(), alt.getDate()).getTime();
  return tagNeu > tagAlt;
}

/**
 * Parst einen Kalendertag 'YYYY-MM-DD' als LOKALE Mitternacht (Betriebs-Zeitzone).
 * Bewusst strikt (kein freies `new Date(str)`): volle ISO-Strings waeren TZ-
 * mehrdeutig und wuerden die Tages-Keys verschieben. Fehlend/ungueltig -> 400.
 */
function parseTagLokal(wert: string | undefined, feld: 'von' | 'bis'): Date {
  if (!wert || !YYYY_MM_DD.test(wert)) {
    throw new BadRequestException(`\`${feld}\` ist Pflicht und muss das Format YYYY-MM-DD haben.`);
  }
  const [jahr, monat, tag] = wert.split('-').map(Number);
  const d = new Date(jahr, monat - 1, tag);
  // Kalender-Plausibilitaet: JS rollt '2026-02-31' still in den Maerz -> ablehnen.
  if (d.getFullYear() !== jahr || d.getMonth() !== monat - 1 || d.getDate() !== tag) {
    throw new BadRequestException(`\`${feld}\` ist kein gueltiges Datum.`);
  }
  return d;
}

/** Tages-Key 'YYYY-MM-DD' in Server-Lokalzeit (konsistent zu parseTagLokal). */
function tagKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
