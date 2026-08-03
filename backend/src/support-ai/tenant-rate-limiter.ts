import { Injectable } from '@nestjs/common';

/**
 * Zusaetzlicher KOSTEN-Deckel je MANDANT fuer den KI-Assistenten.
 *
 * Der @Throttle am Controller begrenzt bereits pro NUTZER (20/min). Das schuetzt
 * aber nicht davor, dass ein einzelner Betrieb mit vielen Mitarbeitern das
 * LLM-Budget des Betreibers aufbraucht. Dieser Fixed-Window-Zaehler zieht deshalb
 * eine zweite, gröbere Grenze je Mandant.
 *
 * Bewusst NUR im Arbeitsspeicher (kein Schema/keine Tabelle): nach einem Neustart
 * ist der Zaehler zurueckgesetzt – fuer einen reinen Kostendeckel vertretbar
 * (anders als beim Anmeldeschutz, der Persistenz braucht). Ein echter Monats-
 * deckel mit dauerhafter Zaehlung ist ein Folge-Ticket (braucht eine Tabelle).
 *
 * SELBST-BEGRENZT: Die Map waechst nicht unbegrenzt. Abgelaufene Fenster werden
 * verworfen; als Notbremse verdraengt `enforceBound` die aeltesten Eintraege, so
 * dass nie mehr als MAX_KEYS Mandanten gleichzeitig gehalten werden (Schutz gegen
 * die Map-waechst-unbegrenzt-Falle).
 */

interface Fenster {
  count: number;
  /** Zeitpunkt (ms), ab dem das Fenster abgelaufen ist und neu startet. */
  reset: number;
}

@Injectable()
export class TenantAiRateLimiter {
  /** Max. Anfragen je Mandant und Fenster. */
  static readonly LIMIT = 100;
  /** Fensterbreite in ms. */
  static readonly WINDOW_MS = 60_000;
  /** Harte Obergrenze fuer die Anzahl gleichzeitig gehaltener Mandanten. */
  static readonly MAX_KEYS = 10_000;

  private readonly fenster = new Map<string, Fenster>();

  /**
   * Zaehlt eine Anfrage des Mandanten. Rueckgabe: `true` = erlaubt (gezaehlt),
   * `false` = Deckel fuer dieses Fenster erreicht (Aufrufer bricht ab, ruft das
   * teure LLM NICHT auf).
   */
  hit(tenantId: string): boolean {
    const now = Date.now();
    let f = this.fenster.get(tenantId);
    if (!f || f.reset <= now) {
      // Neues (oder abgelaufenes) Fenster: als juengsten Eintrag ans Map-Ende
      // setzen (delete+set erhaelt die Einfuege-Reihenfolge = LRU-Naeherung).
      this.fenster.delete(tenantId);
      f = { count: 0, reset: now + TenantAiRateLimiter.WINDOW_MS };
      this.fenster.set(tenantId, f);
      this.enforceBound(now);
    }
    if (f.count >= TenantAiRateLimiter.LIMIT) return false;
    f.count += 1;
    return true;
  }

  /** Aktuelle Anzahl gehaltener Mandanten (fuer Tests/Diagnose). */
  get trackedTenants(): number {
    return this.fenster.size;
  }

  /**
   * Haelt die Map klein: laeuft nur, wenn eine neue Key-Anlage die Obergrenze
   * ueberschreitet. Erst abgelaufene Fenster raeumen, dann – falls noetig – die
   * aeltesten (zuerst eingefuegten) Eintraege verdraengen.
   */
  private enforceBound(now: number): void {
    if (this.fenster.size <= TenantAiRateLimiter.MAX_KEYS) return;
    for (const [k, v] of this.fenster) {
      if (v.reset <= now) this.fenster.delete(k);
    }
    while (this.fenster.size > TenantAiRateLimiter.MAX_KEYS) {
      const oldest = this.fenster.keys().next().value;
      if (oldest === undefined) break;
      this.fenster.delete(oldest);
    }
  }
}
