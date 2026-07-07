import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvoicesService } from './invoices.service';
import { IntervalScheduler } from '../common/scheduler/interval-scheduler';
import {
  MahnwesenConfig,
  faelligeStufe,
  resolveMahnwesenConfig,
} from '../common/mahnwesen/mahnwesen-config';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Untergrenze fuer das Job-Intervall (schuetzt vor versehentlichem Dauerlauf per ENV). */
const MIN_INTERVAL_MS = 60 * 1000;

/** Kennzahlen eines Job-Laufs (Rueckgabe fuer Ops/Tests, kein DB-Effekt). */
export interface MahnAutomatikErgebnis {
  /** Betriebe mit autoMahnen=true, die abgearbeitet wurden. */
  tenants: number;
  /** Ueberfaellige Rechnungen insgesamt geprueft. */
  geprueft: number;
  /** Tatsaechlich versendete Mahnungen/Erinnerungen. */
  gemahnt: number;
  /** Rechnungen, deren Mahnung fehlschlug (uebersprungen, Lauf lief weiter). */
  fehler: number;
}

/**
 * C1-B Auto-Mahn-Job. Ein dependency-freier Tages-Scheduler (siehe
 * IntervalScheduler) loest `runDaily()` aus. Der Job geht je Betrieb MIT
 * `autoMahnen=true` ueber die ueberfaellige Mahnliste, bestimmt anhand der
 * Ueberfaelligkeit + der Betriebs-Fristen die faellige Stufe und eskaliert
 * Rechnungen, deren faellige Stufe ueber der aktuellen Mahnstufe liegt – ueber
 * die bestehende, geteilte Mahn-Logik (`InvoicesService.sendMahnung`).
 *
 * Sicherheit / Korrektheit:
 * - STRIKT tenant-scoped: jede Query laeuft ueber `tenantId` (mahnliste +
 *   sendMahnung laden ausschliesslich tenant-eigene Rechnungen).
 * - NIEMALS falsche Rechnungen: die Mahnliste liefert nur OFFENE Rechnungen
 *   (RECHNUNG, ueberfaellig); `sendMahnung` prueft den Status zusaetzlich FRISCH
 *   erneut (bezahlt/storniert/Angebot/Entwurf -> Abbruch pro Rechnung).
 * - IDEMPOTENT: (a) es wird nur eskaliert, wenn faellige Stufe > aktueller
 *   Mahnstufe (dieselbe Stufe nie doppelt); (b) eine Rechnung, deren letzter
 *   Versand HEUTE war, wird uebersprungen (kein zweiter Lauf am selben Tag).
 * - Eskalation um EINE Stufe pro Lauf: sehr alte Rechnungen laufen Erinnerung ->
 *   1. Mahnung -> 2. Mahnung ueber mehrere Tage hoch (kein Mahn-Schwall).
 * - ROBUST: Fehler je Rechnung/Betrieb werden gefangen und geloggt; ein Fehler
 *   stoppt weder die restlichen Rechnungen noch die restlichen Betriebe.
 */
@Injectable()
export class MahnAutomatikService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MahnAutomatikService.name);
  private readonly scheduler: IntervalScheduler;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly invoices: InvoicesService,
  ) {
    this.scheduler = new IntervalScheduler(
      'mahn-automatik',
      async () => {
        await this.runDaily();
      },
      this.resolveIntervalMs(),
      this.logger,
    );
  }

  onModuleInit(): void {
    // Im Test-/CI-Kontext KEIN Hintergrund-Timer (Jest setzt NODE_ENV=test).
    // MAHN_JOB_DISABLED=1 erlaubt zusaetzlich ein bewusstes Abschalten im Betrieb.
    if (process.env.NODE_ENV === 'test' || process.env.MAHN_JOB_DISABLED === '1') return;
    this.scheduler.start();
  }

  onModuleDestroy(): void {
    this.scheduler.stop();
  }

  /** Job-Intervall aus ENV (MAHN_JOB_INTERVAL_MS), Default 24h, mind. 60s. */
  private resolveIntervalMs(): number {
    const raw = Number(process.env.MAHN_JOB_INTERVAL_MS);
    if (Number.isFinite(raw) && raw >= MIN_INTERVAL_MS) return raw;
    return DAY_MS;
  }

  /**
   * Tages-Job: iteriert alle Betriebe mit `autoMahnen=true` und mahnt deren
   * faellige Rechnungen. Direkt aufrufbar (Tests/Ops); `now` injizierbar fuer
   * deterministische Tests. Faengt Lade-/Verarbeitungsfehler ab und gibt eine
   * Kennzahl-Zusammenfassung zurueck.
   */
  async runDaily(now: Date = new Date()): Promise<MahnAutomatikErgebnis> {
    const ergebnis: MahnAutomatikErgebnis = { tenants: 0, geprueft: 0, gemahnt: 0, fehler: 0 };

    let tenants: Tenant[];
    try {
      // Nur id + settings laden; settings (verschluesselt) wird ueber den
      // Transformer entschluesselt -> mahnwesen-Konfiguration lesbar.
      tenants = await this.tenantRepo.find({ select: { id: true, settings: true } });
    } catch (err) {
      this.logger.error(
        `Mahn-Automatik: Betriebsliste konnte nicht geladen werden: ${(err as Error).message}`,
      );
      return ergebnis;
    }

    for (const tenant of tenants) {
      const cfg = resolveMahnwesenConfig((tenant.settings as Record<string, unknown> | null)?.mahnwesen);
      if (!cfg.autoMahnen) continue; // Auto-Mahnen aus -> Betrieb ueberspringen
      ergebnis.tenants += 1;
      await this.processTenant(tenant.id, cfg, now, ergebnis);
    }

    if (ergebnis.tenants > 0) {
      this.logger.log(
        `Mahn-Automatik: ${ergebnis.gemahnt} Mahnung(en) versendet ` +
          `(${ergebnis.tenants} Betrieb(e), ${ergebnis.geprueft} geprueft, ${ergebnis.fehler} Fehler).`,
      );
    }
    return ergebnis;
  }

  /**
   * Arbeitet die ueberfaellige Mahnliste EINES Betriebs ab. Strikt auf `tenantId`
   * beschraenkt. Fehler je Rechnung werden gefangen; der Lauf geht weiter.
   */
  private async processTenant(
    tenantId: string,
    cfg: MahnwesenConfig,
    now: Date,
    ergebnis: MahnAutomatikErgebnis,
  ): Promise<void> {
    let liste: Array<{ id: string; tageUeberfaellig: number; mahnstufe?: number; versendetAm?: Date | null }>;
    try {
      liste = await this.invoices.mahnliste(tenantId);
    } catch (err) {
      ergebnis.fehler += 1;
      this.logger.warn(
        `Mahn-Automatik: Mahnliste fuer Betrieb ${tenantId} fehlgeschlagen: ${(err as Error).message}`,
      );
      return;
    }

    for (const inv of liste) {
      ergebnis.geprueft += 1;
      try {
        const faellig = faelligeStufe(inv.tageUeberfaellig, cfg.fristen);
        const aktuell = inv.mahnstufe ?? 0;
        // (a) Dieselbe Stufe nie doppelt: nur eskalieren, wenn faellig > aktuell.
        if (faellig <= aktuell) continue;
        // (b) Tages-Idempotenz: heute bereits versendet -> nicht erneut.
        if (inv.versendetAm && this.sameDay(new Date(inv.versendetAm), now)) continue;

        // Eskaliert um EINE Stufe; sendMahnung prueft den Status FRISCH erneut.
        await this.invoices.sendMahnung(tenantId, inv.id);
        ergebnis.gemahnt += 1;
      } catch (err) {
        ergebnis.fehler += 1;
        this.logger.warn(
          `Mahn-Automatik: Rechnung ${inv.id} (Betrieb ${tenantId}) nicht gemahnt: ${(err as Error).message}`,
        );
      }
    }
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
