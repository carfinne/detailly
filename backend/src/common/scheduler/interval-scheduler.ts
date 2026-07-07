import { Logger } from '@nestjs/common';

/**
 * Dependency-freier Intervall-Scheduler (BEWUSST KEIN @nestjs/schedule).
 *
 * Hintergrund: `@nestjs/schedule` ist nicht installiert und darf nicht ergaenzt
 * werden, weil sich das package-lock in der CI nicht neu generieren laesst
 * (`npm ci` wuerde brechen). Dieser Scheduler nutzt ausschliesslich das native
 * `setInterval`/`clearInterval` von Node.
 *
 * Eigenschaften:
 * - `start()` ist idempotent (mehrfacher Aufruf legt kein zweites Intervall an).
 * - `unref()` auf dem Timer -> ein laufendes Intervall blockiert weder den
 *   sauberen Prozess-Shutdown noch den Jest-Prozess (Tests haengen nicht).
 * - Die Job-Mechanik (Timer) ist von der Job-Logik getrennt: `runOnce()` fuehrt
 *   die Aufgabe genau einmal aus und faengt ALLE Fehler ab, damit ein einzelner
 *   fehlgeschlagener Lauf das Intervall nicht beendet. So ist die Aufgabe in
 *   Tests direkt (ohne Timer) aufrufbar.
 */
export class IntervalScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly name: string,
    private readonly task: () => void | Promise<void>,
    private readonly intervalMs: number,
    private readonly logger: Logger = new Logger(IntervalScheduler.name),
  ) {}

  /**
   * Startet das periodische Intervall (idempotent). `unref()` sorgt dafuer, dass
   * der Timer den Event-Loop nicht am Beenden hindert (Shutdown/Tests).
   */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    // unref existiert im Node-Runtime-Timer; defensiv geprueft (Test-Fakes).
    if (typeof this.timer.unref === 'function') this.timer.unref();
    this.logger.log(`Scheduler "${this.name}" gestartet (Intervall ${this.intervalMs} ms).`);
  }

  /**
   * Fuehrt die Aufgabe GENAU EINMAL aus und faengt jeden Fehler ab. Direkt
   * aufrufbar (Tests/Ops), ohne auf das Intervall angewiesen zu sein.
   */
  async runOnce(): Promise<void> {
    try {
      await this.task();
    } catch (err) {
      this.logger.error(`Scheduler "${this.name}" Job-Fehler: ${(err as Error).message}`);
    }
  }

  /** Stoppt das Intervall (idempotent). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Ob aktuell ein Intervall laeuft (fuer Tests/Diagnose). */
  get running(): boolean {
    return this.timer !== null;
  }
}
