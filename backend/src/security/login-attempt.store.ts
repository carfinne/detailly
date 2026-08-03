import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { LoginAttempt } from './entities/login-attempt.entity';
import { withUniqueRetry } from '../common/unique-retry';
import {
  LOGIN_GUARD,
  buildIpLockSteps,
  lockMsForCount,
  resolveIpFirstTier,
  type LockStep,
} from './security.constants';

/** Zaehler-Art (identisch zur Guard-Semantik). */
export type LoginAttemptScope = 'account' | 'ip';

/**
 * Neustart-feste Persistenz der Login-Fehlversuchs-Zaehler (Sentinel Teil 1).
 *
 * Die WAHRHEIT der Zaehler liegt hier (DB); der LoginGuardService haelt nur einen
 * schnellen In-Memory-Cache davor (Hot-Path). Dieser Store kapselt alle
 * Schreib-/Lese-Zugriffe auf `login_attempts`:
 *  - `persistFailure`      : atomares Hochzaehlen (UPDATE ... = attempts + 1) mit
 *                            gleitendem Fenster; der Erst-Insert ist gegen den
 *                            Wettlauf zweier gleichzeitiger Erstversuche
 *                            abgesichert (Unique-Constraint + withUniqueRetry ->
 *                            der Verlierer wird zum Increment, NIE "beide 1").
 *  - `registerSuccess*`    : Reset (Konto) bzw. Dekrement (IP), wie im Guard.
 *  - `loadActive`          : Hydration beim Start (nur noch relevante Zeilen).
 *  - `purgeExpired`        : Aufraeumen abgelaufener Zeilen (haengt am bestehenden
 *                            ThreatDetection-Lauf – KEIN zweiter Timer).
 *
 * Die Sperrstufen werden – wie im Guard – EINMAL beim Start aus der Umgebung
 * aufgeloest (`LOGIN_GUARD_IP_THRESHOLD`), damit Cache und DB dieselbe Konfiguration
 * verwenden. Der Store hasht NICHT selbst: er erhaelt den fertigen `keyHash` vom
 * Guard (einzige Hash-Stelle) und behandelt ihn als opake Kennung.
 */
@Injectable()
export class LoginAttemptStore {
  private readonly logger = new Logger(LoginAttemptStore.name);
  private readonly ipSteps: readonly LockStep[];

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly repo: Repository<LoginAttempt>,
  ) {
    this.ipSteps = buildIpLockSteps(resolveIpFirstTier());
  }

  private stepsFor(scope: LoginAttemptScope): readonly LockStep[] {
    return scope === 'ip' ? this.ipSteps : LOGIN_GUARD.account.steps;
  }

  /**
   * Registriert einen Fehlversuch dauerhaft. Best-effort: faengt DB-Fehler ab und
   * blockiert den Auth-Fluss NIE (der In-Memory-Guard schuetzt ohnehin waehrend
   * des laufenden Prozesses; die DB traegt nur ueber den Neustart).
   */
  async persistFailure(
    scope: LoginAttemptScope,
    keyHash: string,
    nowMs: number,
  ): Promise<void> {
    try {
      await withUniqueRetry(
        async () => {
          const existing = await this.repo.findOne({ where: { scope, keyHash } });
          if (existing) {
            await this.applyBump(existing, scope, keyHash, nowMs);
            return;
          }
          // Frischer Schluessel -> erster Fehlversuch. Der Unique-Index
          // (scope,keyHash) macht den gleichzeitigen Zweit-Insert zur Kollision;
          // withUniqueRetry laeuft dann erneut und trifft oben den Increment-Pfad.
          const lockMs = lockMsForCount(1, this.stepsFor(scope));
          await this.repo.insert(this.buildRow(scope, keyHash, 1, nowMs, lockMs));
        },
        { retries: 3 },
      );
    } catch (err) {
      this.logger.warn(
        `login_attempts persistFailure (${scope}) fehlgeschlagen (fail-open): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Gleitendes Fenster + atomares Hochzaehlen fuer einen bereits existierenden
   * Zaehler. Ausserhalb des Fensters (Inaktivitaet > windowMs) wird auf 1
   * zurueckgesetzt; innerhalb via `attempts = attempts + 1` (atomar, kein
   * Lesen-dann-Schreiben auf den Zaehler).
   */
  private async applyBump(
    existing: LoginAttempt,
    scope: LoginAttemptScope,
    keyHash: string,
    nowMs: number,
  ): Promise<void> {
    const lastMs = new Date(existing.lastFailAt).getTime();
    const windowExpired = nowMs - lastMs > LOGIN_GUARD.windowMs;
    if (windowExpired) {
      // Fenster abgelaufen -> Zaehler auf 1 zuruecksetzen (absoluter Wert ok).
      const lockMs = lockMsForCount(1, this.stepsFor(scope));
      await this.repo.update({ scope, keyHash }, { attempts: 1, ...this.buildTiming(nowMs, lockMs) });
      return;
    }
    // Innerhalb des Fensters: ATOMAR hochzaehlen (SET attempts = attempts + 1) ...
    await this.repo.increment({ scope, keyHash }, 'attempts', 1);
    // ... dann den frischen Stand lesen und NUR Sperre/Ablauf/Zeit nachziehen –
    // BEWUSST ohne `attempts` (der atomare Increment darf nicht durch einen
    // absoluten, evtl. veralteten Wert ueberschrieben werden -> kein Lost-Update).
    const fresh = await this.repo.findOne({ where: { scope, keyHash } });
    const count = fresh?.attempts ?? existing.attempts + 1;
    const lockMs = lockMsForCount(count, this.stepsFor(scope));
    await this.repo.update({ scope, keyHash }, this.buildTiming(nowMs, lockMs));
  }

  /** Erfolgreicher Login -> Konto-Zaehler loeschen (naechster Fehlversuch startet bei 1). */
  async registerSuccessAccount(keyHash: string): Promise<void> {
    try {
      await this.repo.delete({ scope: 'account', keyHash });
    } catch (err) {
      this.logger.warn(`login_attempts success(account) fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  /**
   * Erfolgreicher Login -> reinen IP-Zaehler DEKREMENTIEREN (nicht leeren), Zeile
   * bei 0 loeschen. Spiegelt die NAT-Entlastung des Guards.
   */
  async registerSuccessIp(keyHash: string): Promise<void> {
    try {
      await this.repo.decrement({ scope: 'ip', keyHash, attempts: MoreThan(0) }, 'attempts', 1);
      await this.repo.delete({ scope: 'ip', keyHash, attempts: LessThanOrEqual(0) });
    } catch (err) {
      this.logger.warn(`login_attempts success(ip) fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  /**
   * Laedt die noch relevanten Zaehler (expiresAt > now) fuer die Start-Hydration.
   * Absteigend nach letztem Fehlversuch + hart gedeckelt, damit eine geflutete
   * Tabelle den Start nicht ausbremst (die juengsten/aktivsten zuerst).
   */
  async loadActive(nowMs: number, limit: number = LOGIN_GUARD.maxEntries): Promise<LoginAttempt[]> {
    return this.repo.find({
      where: { expiresAt: MoreThan(new Date(nowMs)) },
      order: { lastFailAt: 'DESC' },
      take: Math.max(1, limit),
    });
  }

  /**
   * Loescht abgelaufene Zeilen (expiresAt <= now). Vom periodischen
   * ThreatDetection-Lauf (kein eigener Timer) und direkt (Tests/Ops) aufrufbar.
   * Gibt die Anzahl geloeschter Zeilen zurueck; faengt Fehler ab (Lauf bricht nie).
   */
  async purgeExpired(nowMs: number = Date.now()): Promise<number> {
    try {
      const res = await this.repo.delete({ expiresAt: LessThanOrEqual(new Date(nowMs)) });
      return res.affected ?? 0;
    } catch (err) {
      this.logger.warn(`login_attempts Purge fehlgeschlagen: ${(err as Error).message}`);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  /** Vollzeile fuer den Erst-Insert (attempts = 1). */
  private buildRow(
    scope: LoginAttemptScope,
    keyHash: string,
    attempts: number,
    nowMs: number,
    lockMs: number,
  ): Partial<LoginAttempt> {
    return { scope, keyHash, attempts, ...this.buildTiming(nowMs, lockMs) };
  }

  /**
   * Zeit-Felder (OHNE `attempts`) aus Zeitpunkt + Sperrdauer. `expiresAt` = das
   * spaetere aus Fenster-Ablauf (now+windowMs) und Sperr-Ablauf (now+lockMs) – so
   * faellt eine noch aktive Sperre nie vorzeitig dem Purge zum Opfer.
   */
  private buildTiming(
    nowMs: number,
    lockMs: number,
  ): Pick<LoginAttempt, 'lastFailAt' | 'lockedUntil' | 'expiresAt'> {
    const lockedUntilMs = lockMs > 0 ? nowMs + lockMs : 0;
    const expiresAtMs = Math.max(nowMs + LOGIN_GUARD.windowMs, lockedUntilMs);
    return {
      lastFailAt: new Date(nowMs),
      lockedUntil: lockedUntilMs > 0 ? new Date(lockedUntilMs) : null,
      expiresAt: new Date(expiresAtMs),
    };
  }
}
