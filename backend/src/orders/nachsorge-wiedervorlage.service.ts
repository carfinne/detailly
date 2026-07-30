import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;

/** Kennzahlen eines Job-Laufs (Rueckgabe fuer Ops/Tests, kein DB-Effekt). */
export interface NachsorgeErgebnis {
  /** Betriebe, die abgearbeitet wurden. */
  tenants: number;
  /** Faellige Wiedervorlagen im Fenster insgesamt geprueft. */
  geprueft: number;
  /** Tatsaechlich erzeugte Erinnerungen (geclaimt). */
  erinnert: number;
  /** Wiedervorlagen, deren Claim fehlschlug (uebersprungen, Lauf lief weiter). */
  fehler: number;
}

/**
 * Welle 2-B (Teil 2): Nachsorge-Wiedervorlage. Groesster Wiederkehr-Umsatzhebel im
 * Detailing – nach einer Versiegelung/Beschichtung ist eine Auffrischung/Kontrolle
 * nach z. B. 12 Monaten faellig. Ein dependency-freier Tages-Scheduler (Muster
 * termin-erinnerung) prueft faellige Wiedervorlagen und erzeugt je Auftrag GENAU
 * EINE In-App-Erinnerung.
 *
 * Ablauf je Lauf (STRIKT tenant-scoped):
 *  - Iteriert alle Betriebe (die Nachsorge ist Opt-in JE AUFTRAG, nicht je Betrieb –
 *    daher kein Betriebs-Gate). Je Betrieb: Auftraege mit `nachsorgeAm <= jetzt`,
 *    noch NICHT erinnert (`nachsorgeErinnertAm IS NULL`) und noch NICHT erledigt
 *    (`nachsorgeErledigtAm IS NULL`).
 *
 * Doppel-Erinnerung-Schutz (idempotent, "genau EINE Erinnerung"): der Job "claimt"
 * `nachsorgeErinnertAm` KONDITIONAL (WHERE ... IS NULL) – nur der Gewinner (affected=1)
 * zaehlt als Erinnerung. Zwei parallele Laeufe erzeugen nie zwei Erinnerungen; ein
 * Folgelauf findet den Auftrag nicht mehr (Anker gesetzt).
 *
 * Review-before-send: Dieser Service hat BEWUSST KEINE Mail-Abhaengigkeit – es kann
 * strukturell NICHTS automatisch an den Endkunden gehen. Die Erinnerung erscheint nur
 * in der App (Glocke + Nachsorge-Liste); Termin/Anfrage stoesst der Betrieb selbst an.
 *
 * Robust: Fehler je Auftrag/Betrieb werden gefangen und geloggt; ein Fehler stoppt
 * weder die restlichen Auftraege noch die restlichen Betriebe. Der Timer-Lauf wirft nie.
 */
@Injectable()
export class NachsorgeWiedervorlageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NachsorgeWiedervorlageService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {
    this.scheduler = new IntervalScheduler(
      'nachsorge-wiedervorlage',
      async () => {
        await this.runOnce();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext KEIN Hintergrund-Timer (Jest setzt NODE_ENV=test).
    // NACHSORGE_JOB_DISABLED=1 erlaubt zusaetzlich ein bewusstes Abschalten.
    if (process.env.NODE_ENV === 'test' || process.env.NACHSORGE_JOB_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (NACHSORGE_JOB_INTERVAL_MS), Default 24h, mind. 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.NACHSORGE_JOB_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DAY_MS;
  }

  /**
   * Ein Lauf: iteriert alle Betriebe und erinnert deren faellige Wiedervorlagen.
   * Direkt aufrufbar (Tests/Ops); `now` injizierbar fuer deterministische Tests.
   * Faengt Lade-/Verarbeitungsfehler ab und gibt eine Kennzahl-Zusammenfassung zurueck.
   */
  async runOnce(now: Date = new Date()): Promise<NachsorgeErgebnis> {
    const ergebnis: NachsorgeErgebnis = { tenants: 0, geprueft: 0, erinnert: 0, fehler: 0 };

    let tenants: Tenant[];
    try {
      tenants = await this.tenantRepo.find({ select: { id: true } });
    } catch (err) {
      this.logger.error(
        `Nachsorge: Betriebsliste konnte nicht geladen werden: ${(err as Error).message}`,
      );
      return ergebnis;
    }

    for (const tenant of tenants) {
      ergebnis.tenants += 1;
      await this.processTenant(tenant.id, now, ergebnis);
    }

    if (ergebnis.erinnert > 0 || ergebnis.fehler > 0) {
      this.logger.log(
        `Nachsorge: ${ergebnis.erinnert} Erinnerung(en) erzeugt ` +
          `(${ergebnis.tenants} Betrieb(e), ${ergebnis.geprueft} geprueft, ${ergebnis.fehler} Fehler).`,
      );
    }
    return ergebnis;
  }

  /**
   * Arbeitet die faelligen Wiedervorlagen EINES Betriebs ab. STRIKT auf `tenantId`
   * beschraenkt (Lade- UND Claim-Query tragen tenantId). Fehler je Auftrag werden
   * gefangen; der Lauf geht weiter.
   */
  private async processTenant(tenantId: string, now: Date, ergebnis: NachsorgeErgebnis): Promise<void> {
    let faellige: Order[];
    try {
      faellige = await this.orderRepo.find({
        where: {
          tenantId,
          nachsorgeAm: LessThanOrEqual(now),
          nachsorgeErinnertAm: IsNull(),
          nachsorgeErledigtAm: IsNull(),
        },
        select: ['id'],
        order: { nachsorgeAm: 'ASC' },
      });
    } catch (err) {
      ergebnis.fehler += 1;
      this.logger.warn(
        `Nachsorge: Liste fuer Betrieb ${tenantId} fehlgeschlagen: ${(err as Error).message}`,
      );
      return;
    }

    for (const order of faellige) {
      ergebnis.geprueft += 1;
      try {
        // Konditional claimen: nur wenn noch NICHT erinnert. Verliert der Claim
        // (affected=0), war ein paralleler Lauf schneller -> hier nichts tun.
        const claim = await this.orderRepo.update(
          { id: order.id, tenantId, nachsorgeErinnertAm: IsNull() },
          { nachsorgeErinnertAm: now },
        );
        if (claim.affected) ergebnis.erinnert += 1;
      } catch (err) {
        ergebnis.fehler += 1;
        this.logger.warn(
          `Nachsorge: Auftrag ${order.id} (Betrieb ${tenantId}) nicht erinnert: ${(err as Error).message}`,
        );
      }
    }
  }
}
