import { Injectable } from '@nestjs/common';
import { LOGIN_GUARD, type LockStep } from './security.constants';

/** Ein Zaehler-Eintrag (pro Konto-Schluessel bzw. pro IP). */
interface Bucket {
  count: number;
  /** Zeitpunkt des letzten gezaehlten Fehlversuchs (Basis fuers gleitende Fenster). */
  lastFailAt: number;
  /** Sperre gilt bis zu diesem Zeitpunkt (0 = keine). */
  lockedUntil: number;
}

/** Ergebnis einer Sperr-Pruefung. */
export interface BlockResult {
  blocked: boolean;
  /** Verbleibende Sperrzeit in Sekunden (nur wenn blocked). */
  retryAfterSec?: number;
}

/** Ergebnis der Registrierung eines Fehlversuchs. */
export interface FailureResult {
  /** Ob der Versuch ueberhaupt gezaehlt wurde (Loopback/leer -> false). */
  counted: boolean;
  accountCount: number;
  ipCount: number;
  /** Ob DIESER Fehlversuch eine NEUE Sperr-Stufe erreicht hat (Konto). */
  accountNewTier: boolean;
  /** Ob DIESER Fehlversuch eine NEUE Sperr-Stufe erreicht hat (IP). */
  ipNewTier: boolean;
  /** Groesste durch diesen Fehlversuch gesetzte Sperrdauer (ms; 0 = keine). */
  lockMs: number;
}

/** Ergebnis eines `bump()` auf einen einzelnen Bucket. */
interface BumpResult {
  count: number;
  lockMs: number;
  newTier: boolean;
}

/**
 * In-Memory-Fehlversuchs-Sperre (Sentinel Teil 1).
 *
 * KEINE DB-Schreibung pro Versuch (Hot-Path): zwei beschraenkte Maps (LRU-Deckel)
 * halten die Zaehler. Details/Begruendung der Schwellen: security.constants.ts.
 *
 * Zwei Zaehler:
 *  - Konto = IP + E-Mail (verhindert Lockout-DoS gegen fremde Konten),
 *  - reine IP (faengt Credential-Stuffing; deutlich hoehere Schwelle -> Shared-IP
 *    /NAT wird nicht kollektiv gesperrt).
 *
 * Loopback (127.0.0.1/::1) wird NIE gezaehlt/gesperrt.
 *
 * Alle oeffentlichen Methoden akzeptieren einen optionalen `now` (ms) – so ist
 * das gleitende Fenster deterministisch testbar (kein echter Timer).
 */
@Injectable()
export class LoginGuardService {
  private readonly accountMap = new Map<string, Bucket>();
  private readonly ipMap = new Map<string, Bucket>();

  /** Ist die IP+Konto-Kombination ODER die IP aktuell gesperrt? */
  isBlocked(ip: string | undefined | null, email: string, now: number = Date.now()): BlockResult {
    if (!ip || this.isLoopback(ip)) return { blocked: false };
    const acc = this.accountMap.get(this.accountKey(ip, email));
    const ipb = this.ipMap.get(this.normalizeIp(ip));
    const lockedUntil = Math.max(acc?.lockedUntil ?? 0, ipb?.lockedUntil ?? 0);
    if (lockedUntil > now) {
      return { blocked: true, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
    }
    return { blocked: false };
  }

  /**
   * Registriert einen Fehlversuch auf BEIDEN Zaehlern (Konto + IP). Loopback/leer
   * wird ignoriert (counted=false). Gibt Zaehlerstaende + neu erreichte Sperr-
   * Stufen zurueck, damit der Aufrufer das passende Security-Event emittieren kann.
   */
  registerFailure(
    ip: string | undefined | null,
    email: string,
    now: number = Date.now(),
  ): FailureResult {
    if (!ip || this.isLoopback(ip)) {
      return {
        counted: false,
        accountCount: 0,
        ipCount: 0,
        accountNewTier: false,
        ipNewTier: false,
        lockMs: 0,
      };
    }
    const acc = this.bump(this.accountMap, this.accountKey(ip, email), LOGIN_GUARD.account.steps, now);
    const ipRes = this.bump(this.ipMap, this.normalizeIp(ip), LOGIN_GUARD.ip.steps, now);
    return {
      counted: true,
      accountCount: acc.count,
      ipCount: ipRes.count,
      accountNewTier: acc.newTier,
      ipNewTier: ipRes.newTier,
      lockMs: Math.max(acc.lockMs, ipRes.lockMs),
    };
  }

  /**
   * Erfolgreicher Login: Konto-Schluessel loeschen (Reset). Der reine IP-Zaehler
   * wird BEWUSST nicht zurueckgesetzt – sonst koennte ein Angreifer per einzelnem
   * gueltigem Login zwischendurch den Stuffing-Zaehler leeren. Er verfaellt
   * ohnehin ueber das gleitende Fenster.
   */
  registerSuccess(ip: string | undefined | null, email: string): void {
    if (!ip || this.isLoopback(ip)) return;
    this.accountMap.delete(this.accountKey(ip, email));
  }

  /** Nur fuer Tests/Diagnose: leert beide Maps. */
  reset(): void {
    this.accountMap.clear();
    this.ipMap.clear();
  }

  // ---------------------------------------------------------------------------
  // intern
  // ---------------------------------------------------------------------------

  /**
   * Erhoeht den Zaehler eines Buckets (gleitendes, idle-basiertes Fenster) und
   * setzt ggf. eine Sperre. Bewegt den Schluessel ans Map-Ende (LRU-Recency) und
   * verdraengt bei Ueberschreiten des Deckels den aeltesten Eintrag.
   */
  private bump(map: Map<string, Bucket>, key: string, steps: readonly LockStep[], now: number): BumpResult {
    let b = map.get(key);
    // Reset, wenn seit dem letzten Fehlversuch mehr als das Fenster vergangen ist.
    if (!b || now - b.lastFailAt > LOGIN_GUARD.windowMs) {
      b = { count: 0, lastFailAt: now, lockedUntil: 0 };
    }
    b.count += 1;
    b.lastFailAt = now;
    const lockMs = this.lockMsForCount(b.count, steps);
    if (lockMs > 0) b.lockedUntil = now + lockMs;

    // LRU-Recency: neu einsortieren (ans Ende) + Deckel durchsetzen.
    map.delete(key);
    map.set(key, b);
    this.evict(map);

    // "Neue Stufe": der Zaehler trifft EXAKT eine Schwelle (bei Schrittweite 1
    // passiert das an jeder Stufe genau einmal) -> genau ein Lockout-Event/Stufe.
    const newTier = steps.some((s) => s.fails === b!.count);
    return { count: b.count, lockMs, newTier };
  }

  /** Sperrdauer fuer einen Zaehlerstand (erste passende, absteigend sortierte Stufe). */
  private lockMsForCount(count: number, steps: readonly LockStep[]): number {
    for (const step of steps) {
      if (count >= step.fails) return Math.min(step.lockMs, LOGIN_GUARD.maxLockMs);
    }
    return 0;
  }

  /** Verdraengt die aeltesten Eintraege, bis der Deckel eingehalten ist (Speicher-DoS-Schutz). */
  private evict(map: Map<string, Bucket>): void {
    while (map.size > LOGIN_GUARD.maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  /** Konto-Schluessel = normalisierte IP + normalisierte E-Mail. */
  private accountKey(ip: string, email: string): string {
    return `${this.normalizeIp(ip)}|${(email ?? '').trim().toLowerCase()}`;
  }

  /** Leert IPv4-mapped-IPv6-Praefix + normalisiert. */
  private normalizeIp(ip: string): string {
    let s = (ip ?? '').trim().toLowerCase();
    if (s.startsWith('::ffff:')) s = s.slice(7);
    return s;
  }

  /** Loopback? (127.0.0.0/8, ::1, localhost) – wird nie gezaehlt/gesperrt. */
  private isLoopback(ip: string): boolean {
    const s = this.normalizeIp(ip);
    return s === '::1' || s === 'localhost' || s.startsWith('127.');
  }
}
