import { KeyedMutex } from './keyed-mutex';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('KeyedMutex', () => {
  it('serialisiert Abschnitte mit demselben Key (kein Ueberlappen)', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];

    const section = (name: string) =>
      mutex.runExclusive('k', async () => {
        events.push(`start:${name}`);
        await tick(10);
        events.push(`end:${name}`);
      });

    // Beide "gleichzeitig" starten – der zweite darf erst nach dem ersten laufen.
    await Promise.all([section('A'), section('B')]);

    expect(events).toEqual(['start:A', 'end:A', 'start:B', 'end:B']);
  });

  it('laesst verschiedene Keys unabhaengig (parallel) laufen', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];

    const p1 = mutex.runExclusive('a', async () => {
      events.push('start:a');
      await tick(20);
      events.push('end:a');
    });
    const p2 = mutex.runExclusive('b', async () => {
      events.push('start:b');
      await tick(5);
      events.push('end:b');
    });

    await Promise.all([p1, p2]);
    // b (kuerzer) endet vor a, obwohl a zuerst gestartet wurde -> echte Parallelitaet.
    expect(events).toEqual(['start:a', 'start:b', 'end:b', 'end:a']);
  });

  it('reicht Ergebnis + Fehler des Abschnitts an den Aufrufer durch', async () => {
    const mutex = new KeyedMutex();
    await expect(mutex.runExclusive('k', async () => 42)).resolves.toBe(42);
    await expect(
      mutex.runExclusive('k', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('ein Fehler im Vorgaenger blockiert den Nachfolger NICHT', async () => {
    const mutex = new KeyedMutex();
    const failing = mutex
      .runExclusive('k', async () => {
        throw new Error('erster faellt');
      })
      .catch(() => 'gefangen');
    const following = mutex.runExclusive('k', async () => 'zweiter laeuft');

    expect(await failing).toBe('gefangen');
    expect(await following).toBe('zweiter laeuft');
  });

  it('raeumt den Key nach Abschluss auf (kein unbegrenztes Map-Wachstum)', async () => {
    const mutex = new KeyedMutex();
    await mutex.runExclusive('k', async () => undefined);
    await tick(0); // Cleanup-Microtask abwarten
    // @ts-expect-error – Zugriff auf privates Feld nur fuer den Test.
    expect(mutex.tails.size).toBe(0);
  });
});
