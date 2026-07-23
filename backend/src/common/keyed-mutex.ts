/**
 * Per-Key-Serialisierung asynchroner kritischer Abschnitte (In-Process).
 *
 * Aufrufe von `runExclusive` mit DEMSELBEN Key laufen strikt nacheinander
 * (FIFO); Aufrufe mit VERSCHIEDENEN Keys laufen unabhaengig parallel.
 *
 * Motivation (Mitarbeiter-Limit maxUsers): Das Anlegen/Reaktivieren eines
 * Mitarbeiters ist "zaehlen -> Limit pruefen -> speichern" und damit NICHT
 * atomar. Zwei gleichzeitige Anlagen desselben Betriebs koennten sonst beide
 * unter dem Limit zaehlen und es gemeinsam ueberschreiten (TOCTOU). Ein
 * per-Tenant-Lock macht diesen Abschnitt innerhalb des Prozesses atomar:
 * die zweite Anlage zaehlt erst NACH dem Speichern der ersten und sieht den
 * erhoehten Count -> genau eine gewinnt am Limit.
 *
 * Bewusst pragmatisch (kein npm-Paket, kein DB-Lock): schuetzt den
 * Single-Instance-Betrieb (aktueller Deploy). Bei horizontaler Skalierung
 * (mehrere Backend-Instanzen) braeuchte es zusaetzlich eine DB-seitige
 * Absicherung (z. B. SELECT ... FOR UPDATE bzw. konditionale Zaehl-Updates).
 */
export class KeyedMutex {
  /**
   * Letztes (bereits verrechnetes) Promise je Key. Der "Tail" schluckt Fehler
   * bewusst, damit ein Fehlschlag des Vorgaengers den naechsten Wartenden nie
   * indirekt scheitern laesst – jeder Abschnitt startet unabhaengig.
   */
  private readonly tails = new Map<string, Promise<unknown>>();

  runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    // Der eigentliche Abschnitt startet erst, wenn der Vorgaenger abgeschlossen
    // ist (dessen Ergebnis/Fehler ignorierend). `run` traegt das ECHTE Ergebnis
    // (bzw. den Fehler) zum Aufrufer zurueck.
    const run = prev.then(task, task);
    // Als Tail ein fehler-schluckendes Promise merken, an dem der naechste
    // Aufruf haengt. Nach Abschluss den Eintrag aufraeumen (kein Map-Wachstum),
    // aber nur, wenn seither kein neuer Tail gesetzt wurde.
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return run;
  }
}
