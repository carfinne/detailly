import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvoicesService } from './invoices.service';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;

/** Kennzahlen eines Job-Laufs (Rueckgabe fuer Ops/Tests, kein DB-Effekt). */
export interface AngebotAblaufErgebnis {
  /** Betriebe, die abgearbeitet wurden. */
  tenants: number;
  /** Tatsaechlich frisch auf ABGELAUFEN gesetzte Angebote. */
  markiert: number;
  /** Betriebe, deren Markierung fehlschlug (uebersprungen, Lauf lief weiter). */
  fehler: number;
}

/**
 * Welle 2-B (Teil 1): Angebots-Ablauf-Job. `AngebotStatus.ABGELAUFEN` existierte im
 * Code, wurde aber NIE persistiert – es fehlte der Job, der abgelaufene Angebote
 * markiert. Ein dependency-freier Tages-Scheduler (siehe IntervalScheduler, Muster
 * mahn-automatik/termin-erinnerung) loest `runOnce()` aus und setzt je Betrieb die
 * ueberfaelligen (gueltigBis < jetzt) OFFENEN Angebote auf ABGELAUFEN.
 *
 * Sicherheit / Korrektheit:
 * - STRIKT tenant-scoped: markAbgelaufen laeuft je Betrieb mit `tenantId` in der
 *   WHERE-Klausel – nie ein globales Update ueber mehrere Betriebe.
 * - IDEMPOTENT: markiert nur aus dem Zustand offen/NULL; ein bereits abgelaufenes
 *   Angebot wird nie erneut angefasst (affected=0 im Folgelauf).
 * - KEIN MAILVERSAND: reiner Statuswechsel. Anders als termin-erinnerung/mahnwesen
 *   hat dieser Service KEINE Mail-Abhaengigkeit – es kann strukturell nichts an den
 *   Endkunden gehen (Review-before-send). Das Nachfassen loest der Betrieb selbst
 *   aus (In-App-Liste + Glocke, s. InvoicesService.nachfassListe).
 * - ROBUST: Fehler je Betrieb werden gefangen und geloggt; ein Fehler stoppt den
 *   restlichen Lauf nicht. Der Timer-Lauf wirft nie.
 */
@Injectable()
export class AngebotAblaufService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AngebotAblaufService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly invoices: InvoicesService,
  ) {
    this.scheduler = new IntervalScheduler(
      'angebot-ablauf',
      async () => {
        await this.runOnce();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext KEIN Hintergrund-Timer (Jest setzt NODE_ENV=test).
    // ANGEBOT_ABLAUF_DISABLED=1 erlaubt zusaetzlich ein bewusstes Abschalten.
    if (process.env.NODE_ENV === 'test' || process.env.ANGEBOT_ABLAUF_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (ANGEBOT_ABLAUF_INTERVAL_MS), Default 24h, mind. 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.ANGEBOT_ABLAUF_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DAY_MS;
  }

  /**
   * Ein Lauf: iteriert alle Betriebe und markiert deren abgelaufene Angebote.
   * Direkt aufrufbar (Tests/Ops); `now` injizierbar fuer deterministische Tests.
   * Faengt Lade-/Verarbeitungsfehler ab und gibt eine Kennzahl-Zusammenfassung zurueck.
   */
  async runOnce(now: Date = new Date()): Promise<AngebotAblaufErgebnis> {
    const ergebnis: AngebotAblaufErgebnis = { tenants: 0, markiert: 0, fehler: 0 };

    let tenants: Tenant[];
    try {
      tenants = await this.tenantRepo.find({ select: { id: true } });
    } catch (err) {
      this.logger.error(
        `Angebot-Ablauf: Betriebsliste konnte nicht geladen werden: ${(err as Error).message}`,
      );
      return ergebnis;
    }

    for (const tenant of tenants) {
      ergebnis.tenants += 1;
      try {
        ergebnis.markiert += await this.invoices.markAbgelaufen(tenant.id, now);
      } catch (err) {
        ergebnis.fehler += 1;
        this.logger.warn(
          `Angebot-Ablauf: Markierung fuer Betrieb ${tenant.id} fehlgeschlagen: ${(err as Error).message}`,
        );
      }
    }

    if (ergebnis.markiert > 0 || ergebnis.fehler > 0) {
      this.logger.log(
        `Angebot-Ablauf: ${ergebnis.markiert} Angebot(e) als abgelaufen markiert ` +
          `(${ergebnis.tenants} Betrieb(e), ${ergebnis.fehler} Fehler).`,
      );
    }
    return ergebnis;
  }
}
