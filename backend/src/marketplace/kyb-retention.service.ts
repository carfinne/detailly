import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { KybService } from './kyb.service';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Aufbewahrung der Gewerbeanmeldung nach ABLEHNUNG (DSGVO-Datensparsamkeit). */
export const KYB_RETENTION_DAYS = 90;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;

/**
 * Welle 5 (DSGVO-Datensparsamkeit): periodischer Retention-Job fuer abgelehnte
 * KYB-Dokumente. Eine abgelehnte Bewerbung begruendet keine Geschaeftsbeziehung -
 * die hochgeladene Gewerbeanmeldung (sensibles Dokument) wird 90 Tage nach der
 * Ablehnung geloescht: Datei entfernt + gewerbeanmeldungDatei/dokumentHash/
 * kybErgebnis genullt. Der Dealer-Datensatz selbst BLEIBT (Name/E-Mail dienen dem
 * Doppel-Bewerbungs-Kontext des Betreibers, s. #182-Ablehn-Flow).
 *
 * Laeuft wie der Booking-Retention-Job ueber den dependency-freien
 * IntervalScheduler taeglich (kein @nestjs/schedule). Im Test-/CI-Kontext AUS.
 */
@Injectable()
export class KybRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KybRetentionService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(MarketplaceDealer) private readonly dealerRepo: Repository<MarketplaceDealer>,
    private readonly kyb: KybService,
  ) {
    this.scheduler = new IntervalScheduler(
      'kyb-retention',
      async () => {
        await this.runRetention();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Kein Hintergrund-Timer in Tests/CI (Jest setzt NODE_ENV=test); zusaetzlich
    // per KYB_RETENTION_DISABLED=1 bewusst abschaltbar.
    if (process.env.NODE_ENV === 'test' || process.env.KYB_RETENTION_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (KYB_RETENTION_INTERVAL_MS), Default 24h, mind. 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.KYB_RETENTION_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DAY_MS;
  }

  /**
   * Loescht die Dokumente aller abgelehnten Bewerbungen, deren Ablehnung laenger
   * als KYB_RETENTION_DAYS zurueckliegt und die noch eine Datei haben. Direkt
   * aufrufbar (Tests/Ops); `now` injizierbar. Faengt Fehler ab und gibt die Anzahl
   * bereinigter Datensaetze zurueck (der Timer-Lauf darf nie brechen).
   */
  async runRetention(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - KYB_RETENTION_DAYS * DAY_MS);
    try {
      const faellige = await this.dealerRepo.find({
        where: {
          status: 'abgelehnt',
          abgelehntAm: LessThan(cutoff),
          gewerbeanmeldungDatei: Not(null as unknown as string),
        },
      });
      let bereinigt = 0;
      for (const dealer of faellige) {
        await this.kyb.loescheDokument(dealer.gewerbeanmeldungDatei);
        await this.dealerRepo.update(dealer.id, {
          gewerbeanmeldungDatei: null,
          dokumentHash: null,
          kybErgebnis: null,
        });
        bereinigt += 1;
      }
      if (bereinigt > 0) {
        this.logger.log(`KYB-Retention: ${bereinigt} abgelehnte Dokument(e) geloescht.`);
      }
      return bereinigt;
    } catch (err) {
      this.logger.warn(`KYB-Retention fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }
}
