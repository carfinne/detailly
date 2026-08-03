import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Order } from '../orders/entities/order.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { berlinMonatsGrenzen, berlinWallToUtc, berlinYMDvonInstant } from '../kassenbuch/kassenbuch-zeit';

/** Einzelposten der Zahlungs-/Bindungs-Listen. Bewusst NUR Betriebs-/Abo-Ebene –
 *  niemals Endkundendaten (keine Kunden, Fahrzeuge, Kennzeichen). */
export interface ZahlungsproblemZeile {
  name: string;
  status: string;
  /** Faelligkeits-/Referenzzeitpunkt (currentPeriodEnd, sonst canceledAt) als ISO. */
  seit: string | null;
}
export interface TestAuslaufZeile {
  name: string;
  ablauf: string | null;
  /** Berliner Kalendertage bis zum Ablauf (0 = heute, 1 = morgen …). */
  tageUebrig: number;
}
export interface TestAbgelaufenZeile {
  name: string;
  ablauf: string | null;
}
export interface KuendigungZeile {
  name: string;
  /** Laufzeitende (bei „zum Laufzeitende") bzw. Kuendigungszeitpunkt (bei „diesen Monat"). */
  datum: string | null;
}
/** Ein vom Betrieb bei der Selbstkuendigung hinterlassener (freiwilliger) Grund. */
export interface KuendigungGrundZeile {
  name: string;
  /** Grobe Kategorie (KUENDIGUNG_GRUND_KATEGORIEN) oder null, wenn nur Freitext. */
  kategorie: string | null;
  /** Freitext-Verbesserungsvorschlag oder null. */
  text: string | null;
  /** Kuendigungszeitpunkt (canceledAt) als ISO. */
  datum: string | null;
}
/** Aggregat: wie oft welche Kuendigungsgrund-Kategorie vorkam. */
export interface KuendigungGrundKategorieZeile {
  kategorie: string;
  anzahl: number;
}

export interface PlatformOverview {
  abos: {
    aktiv: number;
    testphase: number;
    gekuendigt: number;
    pilot: number;
    pastDue: number;
    suspended: number;
    mrr: number;
    tarife: { name: string; anzahl: number }[];
  };
  wachstum: { betriebeGesamt: number; neuDiesenMonat: number; trend: { label: string; anzahl: number }[] };
  nutzung: { auftraege: number; rechnungen: number; umsatzGesamt: number };
  aktivitaet: { topBetriebe: { name: string; auftraege: number }[]; inaktivAnzahl: number; inaktivBetriebe: { name: string }[] };
  /**
   * Zahlungs- & Bindungssicht (Betreiber): wer sollte zahlen und tut es nicht,
   * welcher Test laeuft aus, welcher ist ungewandelt abgelaufen, wer kuendigt.
   * Baut AUSSCHLIESSLICH auf den echten Abo-Statusfeldern auf – solange Stripe
   * noch nicht scharf ist, gibt es KEINE transaktionsgenaue Zahlungshistorie
   * (einzelne Abbuchungen/Fehlschlaege). Die Status werden im Pilot manuell
   * gepflegt bzw. spaeter von Stripe gesetzt.
   */
  zahlungen: {
    zahlungsprobleme: { anzahl: number; betriebe: ZahlungsproblemZeile[] };
    testsLaufenAus: { anzahl: number; betriebe: TestAuslaufZeile[] };
    testsAbgelaufen: { anzahl: number; betriebe: TestAbgelaufenZeile[] };
    kuendigungenZumEnde: { anzahl: number; betriebe: KuendigungZeile[] };
    kuendigungenDiesenMonat: { anzahl: number; betriebe: KuendigungZeile[] };
    /**
     * Freiwillige Kuendigungsgruende der Betriebe (Selbstkuendigung): eine Liste
     * der juengsten Gruende + ein Aggregat nach Kategorie. Der eigentliche Wert:
     * der Betreiber erfaehrt systematisch, WORAN es hakt.
     */
    kuendigungsgruende: {
      anzahl: number;
      betriebe: KuendigungGrundZeile[];
      nachKategorie: KuendigungGrundKategorieZeile[];
    };
  };
}

/** Obergrenze fuer alle Betriebs-Listen (kein Laden aller Abos in den Speicher). */
const LISTEN_LIMIT = 50;

/**
 * BETRIEBSUEBERGREIFENDE Plattform-Auswertung fuer Detailly. BEWUSST die EINZIGE
 * Stelle ohne Mandantenfilter – der Controller ist strikt auf Plattform-Rollen
 * begrenzt. Liefert nur Aggregate/Zahlen + Betriebs-/Abo-Felder, KEINE
 * Kundeninhalte.
 */
@Injectable()
export class PlatformAnalyticsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async overview(): Promise<PlatformOverview> {
    // kuendigungsgruende() ist BEWUSST eine eigene, parallel laufende Abfrage (nicht
    // in zahlungenUndBindung() gefaltet): so bleibt die bestehende Zahlungs-/Bindungs-
    // Logik (und ihre Tests) unberuehrt und der Grund-Block ist separat testbar.
    const [abos, wachstum, nutzung, aktivitaet, zahlungen, kuendigungsgruende] = await Promise.all([
      this.aboUebersicht(),
      this.wachstum(),
      this.nutzung(),
      this.betriebsAktivitaet(),
      this.zahlungenUndBindung(),
      this.kuendigungsgruende(),
    ]);
    return { abos, wachstum, nutzung, aktivitaet, zahlungen: { ...zahlungen, kuendigungsgruende } };
  }

  /** Abos & MRR (monatlich wiederkehrender Umsatz aus aktiven Abos). Zeigt ALLE Status. */
  async aboUebersicht() {
    const [aktiv, testphase, gekuendigt, pilot, pastDue, suspended, mrrRow, tarifeRows] = await Promise.all([
      this.subRepo.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.TRIAL } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.CANCELED } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.PILOT } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.SUSPENDED } }),
      this.subRepo
        .createQueryBuilder('s')
        .innerJoin(Plan, 'p', 'p.id = s.planId')
        .select('COALESCE(SUM(p.preisMonatlich), 0)', 'mrr')
        .where('s.status = :st', { st: SubscriptionStatus.ACTIVE })
        .getRawOne<{ mrr: string }>(),
      this.subRepo
        .createQueryBuilder('s')
        .innerJoin(Plan, 'p', 'p.id = s.planId')
        .select('p.name', 'name')
        .addSelect('COUNT(*)', 'anzahl')
        .where('s.status = :st', { st: SubscriptionStatus.ACTIVE })
        .groupBy('p.name')
        .orderBy('anzahl', 'DESC')
        .getRawMany<{ name: string; anzahl: string }>(),
    ]);
    return {
      aktiv,
      testphase,
      gekuendigt,
      pilot,
      pastDue,
      suspended,
      mrr: round2(Number(mrrRow?.mrr ?? 0)),
      tarife: tarifeRows.map((t) => ({ name: t.name ?? '—', anzahl: Number(t.anzahl) })),
    };
  }

  /** Wachstum: Betriebe gesamt, neu diesen Monat, 6-Monats-Trend. */
  async wachstum() {
    const now = new Date();
    const monatStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monate: { label: string; start: Date; ende: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ende = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      monate.push({ label: start.toLocaleDateString('de-DE', { month: 'short' }), start, ende });
    }
    const [betriebeGesamt, neuDiesenMonat, ...trendCounts] = await Promise.all([
      this.tenantRepo.count(),
      this.tenantRepo.count({ where: { createdAt: MoreThanOrEqual(monatStart) } }),
      ...monate.map((m) => this.tenantRepo.count({ where: { createdAt: Between(m.start, m.ende) } })),
    ]);
    return {
      betriebeGesamt,
      neuDiesenMonat,
      trend: monate.map((m, i) => ({ label: m.label, anzahl: trendCounts[i] ?? 0 })),
    };
  }

  /** Nutzung gesamt ueber alle Betriebe. */
  async nutzung() {
    const [auftraege, rechnungen, umsatzRow] = await Promise.all([
      this.orderRepo.count(),
      this.invoiceRepo.count(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.brutto), 0)', 'summe')
        .where('i.art = :art AND i.status = :s', { art: InvoiceKind.RECHNUNG, s: InvoiceStatus.BEZAHLT })
        .getRawOne<{ summe: string }>(),
    ]);
    return { auftraege, rechnungen, umsatzGesamt: round2(Number(umsatzRow?.summe ?? 0)) };
  }

  /** Aktivste Betriebe (nach Auftragszahl) + inaktive (keine Auftraege in 30 Tagen). */
  async betriebsAktivitaet() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const topRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'anzahl')
      .groupBy('o.tenantId')
      .orderBy('anzahl', 'DESC')
      .limit(5)
      .getRawMany<{ tenantId: string; anzahl: string }>();

    // Betriebe MIT Auftrag in den letzten 30 Tagen (aktiv).
    const aktiveRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.tenantId', 'tenantId')
      .where('o.createdAt >= :cutoff', { cutoff })
      .getRawMany<{ tenantId: string }>();
    const aktivIds = new Set(aktiveRows.map((r) => r.tenantId));

    const alleBetriebe = await this.tenantRepo.find({ select: ['id', 'name'] });
    const nameById = new Map(alleBetriebe.map((t) => [t.id, t.name]));
    const inaktiv = alleBetriebe.filter((t) => !aktivIds.has(t.id));

    return {
      topBetriebe: topRows.map((r) => ({ name: nameById.get(r.tenantId) ?? '—', auftraege: Number(r.anzahl) })),
      inaktivAnzahl: inaktiv.length,
      inaktivBetriebe: inaktiv.slice(0, 6).map((t) => ({ name: t.name })),
    };
  }

  /**
   * Zahlungs- & Bindungssicht. Zaehler als COUNT (echte WHERE-Bedingungen),
   * Listen mit Obergrenze + Firmenname per Join (kein N+1, kein Laden aller
   * Abos). Datumsgrenzen (naechste 7 Tage, „dieser Monat", „in der
   * Vergangenheit") in Europe/Berlin (Kassenbuch-Zeitzonen-Helfer).
   */
  async zahlungenUndBindung() {
    const jetzt = new Date();
    const heute = berlinYMDvonInstant(jetzt);
    const monat = berlinMonatsGrenzen(heute);
    const auslaufGrenze = trialAuslaufGrenze(jetzt);

    const [
      zahlungsproblemAnzahl,
      zahlungsproblemBetriebe,
      testsAusAnzahl,
      testsAusBetriebe,
      testsAbAnzahl,
      testsAbBetriebe,
      zumEndeAnzahl,
      zumEndeBetriebe,
      diesenMonatAnzahl,
      diesenMonatBetriebe,
    ] = await Promise.all([
      // 1) Zahlungsprobleme: PAST_DUE oder SUSPENDED.
      this.subRepo.count({ where: { status: In([SubscriptionStatus.PAST_DUE, SubscriptionStatus.SUSPENDED]) } }),
      this.listeZahlungsprobleme(),
      // 2) Tests laufen bald aus: TRIAL mit trialEndsAt in [jetzt, +7 Tage].
      this.subRepo.count({
        where: { status: SubscriptionStatus.TRIAL, trialEndsAt: Between(jetzt, auslaufGrenze) },
      }),
      this.listeTestsLaufenAus(jetzt, auslaufGrenze),
      // 3) Tests abgelaufen (ungewandelt): TRIAL mit trialEndsAt in der Vergangenheit.
      this.subRepo.count({ where: { status: SubscriptionStatus.TRIAL, trialEndsAt: LessThan(jetzt) } }),
      this.listeTestsAbgelaufen(jetzt),
      // 4a) Kuendigung zum Laufzeitende: cancelAtPeriodEnd=true, noch nicht endgueltig gekuendigt.
      this.subRepo.count({ where: { cancelAtPeriodEnd: true, status: Not(SubscriptionStatus.CANCELED) } }),
      this.listeKuendigungZumEnde(),
      // 4b) Diesen Monat gekuendigt: CANCELED mit canceledAt im laufenden Monat.
      this.subRepo.count({
        where: { status: SubscriptionStatus.CANCELED, canceledAt: Between(monat.von, monat.bis) },
      }),
      this.listeKuendigungDiesenMonat(monat.von, monat.bis),
    ]);

    return {
      zahlungsprobleme: { anzahl: zahlungsproblemAnzahl, betriebe: zahlungsproblemBetriebe },
      testsLaufenAus: { anzahl: testsAusAnzahl, betriebe: testsAusBetriebe },
      testsAbgelaufen: { anzahl: testsAbAnzahl, betriebe: testsAbBetriebe },
      kuendigungenZumEnde: { anzahl: zumEndeAnzahl, betriebe: zumEndeBetriebe },
      kuendigungenDiesenMonat: { anzahl: diesenMonatAnzahl, betriebe: diesenMonatBetriebe },
    };
  }

  /** PAST_DUE/SUSPENDED mit Firmenname; „seit" = currentPeriodEnd, sonst canceledAt. */
  private async listeZahlungsprobleme(): Promise<ZahlungsproblemZeile[]> {
    const rows = await this.subRepo
      .createQueryBuilder('s')
      .innerJoin(Tenant, 't', 't.id = s.tenantId')
      .select('t.name', 'name')
      .addSelect('s.status', 'status')
      .addSelect('s.currentPeriodEnd', 'currentPeriodEnd')
      .addSelect('s.canceledAt', 'canceledAt')
      .where('s.status IN (:...st)', { st: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.SUSPENDED] })
      .orderBy('s.currentPeriodEnd', 'ASC')
      .limit(LISTEN_LIMIT)
      .getRawMany<{ name: string | null; status: string; currentPeriodEnd: Date | string | null; canceledAt: Date | string | null }>();
    return rows.map((r) => ({
      name: r.name ?? '—',
      status: r.status,
      seit: toIso(r.currentPeriodEnd ?? r.canceledAt),
    }));
  }

  /** TRIAL, trialEndsAt in [jetzt, +7 Tage]; dringendste zuerst (aufsteigend). */
  private async listeTestsLaufenAus(jetzt: Date, grenze: Date): Promise<TestAuslaufZeile[]> {
    const rows = await this.subRepo
      .createQueryBuilder('s')
      .innerJoin(Tenant, 't', 't.id = s.tenantId')
      .select('t.name', 'name')
      .addSelect('s.trialEndsAt', 'trialEndsAt')
      .where('s.status = :st', { st: SubscriptionStatus.TRIAL })
      .andWhere('s.trialEndsAt BETWEEN :von AND :bis', { von: jetzt, bis: grenze })
      .orderBy('s.trialEndsAt', 'ASC')
      .limit(LISTEN_LIMIT)
      .getRawMany<{ name: string | null; trialEndsAt: Date | string | null }>();
    return rows.map((r) => ({
      name: r.name ?? '—',
      ablauf: toIso(r.trialEndsAt),
      tageUebrig: r.trialEndsAt ? berlinTageBisAblauf(new Date(r.trialEndsAt), jetzt) : 0,
    }));
  }

  /** TRIAL, trialEndsAt in der Vergangenheit; zuletzt abgelaufene zuerst. */
  private async listeTestsAbgelaufen(jetzt: Date): Promise<TestAbgelaufenZeile[]> {
    const rows = await this.subRepo
      .createQueryBuilder('s')
      .innerJoin(Tenant, 't', 't.id = s.tenantId')
      .select('t.name', 'name')
      .addSelect('s.trialEndsAt', 'trialEndsAt')
      .where('s.status = :st', { st: SubscriptionStatus.TRIAL })
      .andWhere('s.trialEndsAt < :jetzt', { jetzt })
      .orderBy('s.trialEndsAt', 'DESC')
      .limit(LISTEN_LIMIT)
      .getRawMany<{ name: string | null; trialEndsAt: Date | string | null }>();
    return rows.map((r) => ({ name: r.name ?? '—', ablauf: toIso(r.trialEndsAt) }));
  }

  /** cancelAtPeriodEnd=true, noch nicht endgueltig gekuendigt; „datum" = currentPeriodEnd. */
  private async listeKuendigungZumEnde(): Promise<KuendigungZeile[]> {
    const rows = await this.subRepo
      .createQueryBuilder('s')
      .innerJoin(Tenant, 't', 't.id = s.tenantId')
      .select('t.name', 'name')
      .addSelect('s.currentPeriodEnd', 'currentPeriodEnd')
      .where('s.cancelAtPeriodEnd = :flag', { flag: true })
      .andWhere('s.status != :canceled', { canceled: SubscriptionStatus.CANCELED })
      .orderBy('s.currentPeriodEnd', 'ASC')
      .limit(LISTEN_LIMIT)
      .getRawMany<{ name: string | null; currentPeriodEnd: Date | string | null }>();
    return rows.map((r) => ({ name: r.name ?? '—', datum: toIso(r.currentPeriodEnd) }));
  }

  /** CANCELED mit canceledAt im laufenden Monat; „datum" = canceledAt. */
  private async listeKuendigungDiesenMonat(von: Date, bis: Date): Promise<KuendigungZeile[]> {
    const rows = await this.subRepo
      .createQueryBuilder('s')
      .innerJoin(Tenant, 't', 't.id = s.tenantId')
      .select('t.name', 'name')
      .addSelect('s.canceledAt', 'canceledAt')
      .where('s.status = :st', { st: SubscriptionStatus.CANCELED })
      .andWhere('s.canceledAt BETWEEN :von AND :bis', { von, bis })
      .orderBy('s.canceledAt', 'DESC')
      .limit(LISTEN_LIMIT)
      .getRawMany<{ name: string | null; canceledAt: Date | string | null }>();
    return rows.map((r) => ({ name: r.name ?? '—', datum: toIso(r.canceledAt) }));
  }

  /**
   * Freiwillige Kuendigungsgruende der Betriebe (Selbstkuendigung). Population:
   * Abos, die aktuell kuendigen/gekuendigt sind (cancelAtPeriodEnd=true ODER
   * status=CANCELED) UND einen Grund hinterlassen haben. Liefert die juengsten
   * Gruende als Liste PLUS ein Aggregat nach Kategorie – der eigentliche Wert fuer
   * den Betreiber. Zaehler als COUNT, Liste mit Obergrenze + Firmenname per Join
   * (kein N+1). Betriebs-/Abo-Ebene, KEINE Endkundendaten.
   */
  async kuendigungsgruende() {
    const grundFilter = '(s.cancelAtPeriodEnd = :flag OR s.status = :canceled)';
    const grundParams = { flag: true, canceled: SubscriptionStatus.CANCELED };

    const [anzahlRow, betriebeRows, kategorieRows] = await Promise.all([
      this.subRepo
        .createQueryBuilder('s')
        .select('COUNT(*)', 'anzahl')
        .where(grundFilter, grundParams)
        .andWhere('(s.kuendigungGrundKategorie IS NOT NULL OR s.kuendigungGrundText IS NOT NULL)')
        .getRawOne<{ anzahl: string }>(),
      this.subRepo
        .createQueryBuilder('s')
        .innerJoin(Tenant, 't', 't.id = s.tenantId')
        .select('t.name', 'name')
        .addSelect('s.kuendigungGrundKategorie', 'kategorie')
        .addSelect('s.kuendigungGrundText', 'text')
        .addSelect('s.canceledAt', 'canceledAt')
        .where(grundFilter, grundParams)
        .andWhere('(s.kuendigungGrundKategorie IS NOT NULL OR s.kuendigungGrundText IS NOT NULL)')
        .orderBy('s.canceledAt', 'DESC')
        .limit(LISTEN_LIMIT)
        .getRawMany<{ name: string | null; kategorie: string | null; text: string | null; canceledAt: Date | string | null }>(),
      this.subRepo
        .createQueryBuilder('s')
        .select('s.kuendigungGrundKategorie', 'kategorie')
        .addSelect('COUNT(*)', 'anzahl')
        .where(grundFilter, grundParams)
        .andWhere('s.kuendigungGrundKategorie IS NOT NULL')
        .groupBy('s.kuendigungGrundKategorie')
        .orderBy('anzahl', 'DESC')
        .getRawMany<{ kategorie: string | null; anzahl: string }>(),
    ]);

    return {
      anzahl: Number(anzahlRow?.anzahl ?? 0),
      betriebe: betriebeRows.map((r) => ({
        name: r.name ?? '—',
        kategorie: r.kategorie ?? null,
        text: r.text ?? null,
        datum: toIso(r.canceledAt),
      })),
      nachKategorie: kategorieRows
        .filter((r) => r.kategorie)
        .map((r) => ({ kategorie: r.kategorie as string, anzahl: Number(r.anzahl) })),
    };
  }
}

/**
 * Obere Fenstergrenze fuer „Test laeuft bald aus": Ende des Berliner Kalendertags
 * in 7 Tagen. Date.UTC normalisiert den Tagesueberlauf ueber Monatsgrenzen hinweg.
 */
export function trialAuslaufGrenze(jetzt: Date): Date {
  const h = berlinYMDvonInstant(jetzt);
  return berlinWallToUtc(h.y, h.m, h.day + 7, 23, 59, 59, 999);
}

/** Berliner Kalendertage bis zum Ablauf (0 = heute, 1 = morgen, negativ = vergangen). */
export function berlinTageBisAblauf(ablauf: Date, jetzt: Date): number {
  const a = berlinYMDvonInstant(ablauf);
  const b = berlinYMDvonInstant(jetzt);
  const tagNr = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return tagNr(a.y, a.m, a.day) - tagNr(b.y, b.m, b.day);
}

/** Faellt `ablauf` ins „laeuft bald aus"-Fenster [jetzt, +7 Tage]? (Spiegelt den DB-Filter.) */
export function istTrialAuslaufend(ablauf: Date, jetzt: Date): boolean {
  return ablauf.getTime() >= jetzt.getTime() && ablauf.getTime() <= trialAuslaufGrenze(jetzt).getTime();
}

/** Liegt `ablauf` in der Vergangenheit (= Test abgelaufen)? (Spiegelt den DB-Filter.) */
export function istTrialAbgelaufen(ablauf: Date, jetzt: Date): boolean {
  return ablauf.getTime() < jetzt.getTime();
}

/** Normalisiert DB-Datumswerte (Date bei pg, String bei sqlite) auf ISO oder null. */
function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
