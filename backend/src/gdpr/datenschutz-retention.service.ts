import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import { Tenant } from '../tenants/entities/tenant.entity';
import { resolveDatenschutz } from '../common/datenschutz';
import { DatenschutzCockpitService } from './datenschutz-cockpit.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;

/** Kennzahlen eines Job-Laufs (Rueckgabe fuer Ops/Tests, kein Loesch-Effekt). */
export interface RetentionErgebnis {
  /** Betriebe mit aktiver Aufbewahrungsfrist (> 0), die geprueft wurden. */
  tenants: number;
  /** Summe der faelligen Kunden ueber alle geprueften Betriebe. */
  faellig: number;
  /** Betriebe, deren Pruefung fehlschlug (uebersprungen, Lauf lief weiter). */
  fehler: number;
}

/**
 * DSGVO-Retention-Job (Art. 5 Abs. 1 lit. e – Speicherbegrenzung). Ein
 * dependency-freier Tages-Scheduler (IntervalScheduler, wie Auto-Mahn-/Booking-
 * Retention-Job) FINDET je Betrieb mit gesetzter Aufbewahrungsfrist die faelligen
 * inaktiven Kunden und protokolliert deren Anzahl.
 *
 * WICHTIG – KEIN Auto-Loeschen: Der Job loescht/anonymisiert NICHTS. Er befuellt
 * ausschliesslich die (live berechnete) Pruefliste des Datenschutz-Cockpits und
 * schreibt eine PII-freie Zaehl-Zusammenfassung ins Log. Die eigentliche,
 * unumkehrbare Loeschung bestaetigt der Betrieb manuell im Cockpit
 * (Review-before-send gilt analog fuer unumkehrbares Loeschen).
 *
 * Sicherheit/Robustheit:
 * - STRIKT tenant-scoped: die Pruefung laeuft je Betrieb ueber dessen `tenantId`
 *   (findFaelligeKunden filtert jede Query darauf).
 * - Frist 0 -> Betrieb wird uebersprungen (Automatik aus).
 * - Fehler je Betrieb werden gefangen; ein Fehler stoppt den Gesamtlauf nicht.
 */
@Injectable()
export class DatenschutzRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatenschutzRetentionService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    private readonly dataSource: DataSource,
    private readonly cockpit: DatenschutzCockpitService,
  ) {
    this.scheduler = new IntervalScheduler(
      'datenschutz-retention',
      async () => {
        await this.runDaily();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext KEIN Hintergrund-Timer (Jest setzt NODE_ENV=test).
    // DSGVO_RETENTION_DISABLED=1 erlaubt zusaetzlich ein bewusstes Abschalten.
    if (process.env.NODE_ENV === 'test' || process.env.DSGVO_RETENTION_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (DSGVO_RETENTION_INTERVAL_MS), Default 24h, mind. 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.DSGVO_RETENTION_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DAY_MS;
  }

  /**
   * Tages-Job: iteriert alle Betriebe mit Aufbewahrungsfrist > 0 und zaehlt deren
   * faellige Kunden. Direkt aufrufbar (Tests/Ops); `now` injizierbar fuer
   * deterministische Tests. Faengt Fehler ab und liefert eine Kennzahl-Summe.
   */
  async runDaily(now: Date = new Date()): Promise<RetentionErgebnis> {
    const ergebnis: RetentionErgebnis = { tenants: 0, faellig: 0, fehler: 0 };

    let tenants: Tenant[];
    try {
      tenants = await this.dataSource
        .getRepository(Tenant)
        .find({ select: { id: true, settings: true } });
    } catch (err) {
      this.logger.error(
        `Datenschutz-Retention: Betriebsliste konnte nicht geladen werden: ${(err as Error).message}`,
      );
      return ergebnis;
    }

    for (const tenant of tenants) {
      const cfg = resolveDatenschutz((tenant.settings as Record<string, unknown> | null)?.datenschutz);
      if (cfg.aufbewahrungInaktiveKundenJahre <= 0) continue; // Automatik aus

      ergebnis.tenants += 1;
      try {
        const res = await this.cockpit.findFaelligeKunden(tenant.id, now);
        ergebnis.faellig += res.anzahl;
      } catch (err) {
        ergebnis.fehler += 1;
        this.logger.warn(
          `Datenschutz-Retention: Pruefung fuer Betrieb ${tenant.id} fehlgeschlagen: ${(err as Error).message}`,
        );
      }
    }

    if (ergebnis.faellig > 0) {
      this.logger.log(
        `Datenschutz-Retention: ${ergebnis.faellig} faellige(r) Kunde(n) in ${ergebnis.tenants} Betrieb(en) ` +
          `zur Pruefung markiert (${ergebnis.fehler} Fehler). Keine automatische Loeschung.`,
      );
    }
    return ergebnis;
  }
}
