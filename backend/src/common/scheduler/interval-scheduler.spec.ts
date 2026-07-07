import { IntervalScheduler } from './interval-scheduler';

/**
 * Tests fuer den dependency-freien Intervall-Scheduler. Timer separat von der
 * Job-Logik: runOnce() ist direkt aufrufbar; start()/stop() steuern nur den Timer.
 */
describe('IntervalScheduler', () => {
  // Stummer Logger, damit die Tests keine Konsole vollschreiben.
  const silentLogger = { log: () => undefined, error: () => undefined, warn: () => undefined } as any;

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runOnce ruft die Aufgabe auf', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    const s = new IntervalScheduler('t', task, 1000, silentLogger);
    await s.runOnce();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('runOnce faengt Fehler der Aufgabe ab (kein Throw) und loggt sie', async () => {
    const err = jest.fn();
    const task = jest.fn().mockRejectedValue(new Error('boom'));
    const s = new IntervalScheduler('t', task, 1000, { ...silentLogger, error: err } as any);
    await expect(s.runOnce()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('start legt ein Intervall an und ist idempotent (kein zweiter Timer)', () => {
    jest.useFakeTimers();
    const setSpy = jest.spyOn(global, 'setInterval');
    const task = jest.fn();
    const s = new IntervalScheduler('t', task, 1000, silentLogger);
    s.start();
    s.start(); // zweiter Aufruf darf keinen weiteren Timer anlegen
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(s.running).toBe(true);
    s.stop();
    expect(s.running).toBe(false);
  });

  it('feuert die Aufgabe periodisch und stop() beendet sie', () => {
    jest.useFakeTimers();
    const task = jest.fn();
    const s = new IntervalScheduler('t', task, 1000, silentLogger);
    s.start();
    jest.advanceTimersByTime(3000);
    expect(task).toHaveBeenCalledTimes(3);
    s.stop();
    jest.advanceTimersByTime(5000);
    expect(task).toHaveBeenCalledTimes(3); // nach stop() kein weiterer Aufruf
  });

  it('ruft unref() auf dem Timer (blockiert Shutdown/Tests nicht)', () => {
    jest.useFakeTimers();
    const unref = jest.fn();
    // setInterval-Rueckgabe faken, um unref zu beobachten.
    const setSpy = jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as any);
    const s = new IntervalScheduler('t', jest.fn(), 1000, silentLogger);
    s.start();
    expect(unref).toHaveBeenCalledTimes(1);
    setSpy.mockRestore();
  });
});
