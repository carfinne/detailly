import { Injectable } from '@nestjs/common';
import { LOGIN_GUARD, buildIpLockSteps, resolveIpFirstTier, type LockStep } from './security.constants';

/** Ein Zaehler-Eintrag (pro Konto-Schluessel bzw. pro IP). */
interface Bucket {
  count: number;
  /** Zeitpunkt des letzten gezaehlten Fehlversuchs (Basis fuers gleitende Fenster). */
  lastFailAt: number;
  /** Sperre gilt bis zu diesem Zeitpunkt (0 = keine). */
  lockedUntil: number;
}

/**
 * Aufruf-Kontext. `socketIp` ist die ECHTE TCP-Peer-Adresse
 * (req.socket.remoteAddress) – NICHT ueber X-Forwarded-For faelschbar. Sie
 * entscheidet ALLEIN ueber die Loopback-Ausnahme (s. isExempt). `now` erlaubt
 * deterministische Tests (kein echter Timer).
 */
export interface GuardContext {
  socketIp?: string | null;
  now?: number;
}

/** Ergebnis einer Sperr-Pruefung. */
export interface BlockResult {
  blocked: boolean;
  /** Verbleibende Sperrzeit in Sekunden (nur wenn blocked). */
  retryAfterSec?: number;
}

/** Ergebnis der Registrierung eines Fehlversuchs. */
export interface FailureResult {
  /** Ob der Versuch ueberhaupt gezaehlt wurde (Ausnahme/leer -> false). */
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
 *  - reine IP (faengt Credential-Stuffing; deutlich hoehere, ENV-konfigurierbare
 *    Schwelle -> Shared-IP/NAT wird nicht kollektiv gesperrt).
 *
 * LOOPBACK-AUSNAHME (haertungsrelevant): NUR wenn der ECHTE Socket-Peer
 * (GuardContext.socketIp = req.socket.remoteAddress) loopback ist, wird die
 * Anfrage ausgenommen – und selbst dann nur, wenn AUCH die gezaehlte Client-IP
 * loopback ist. Die gezaehlte Client-IP (req.ip) ist bei falscher Proxy-Hop-Zahl
 * ueber X-Forwarded-For faelschbar; sie darf die Ausnahme daher NIE allein
 * ausloesen. Folge: ein gespooftes `X-Forwarded-For: 127.0.0.1` bei nicht-
 * loopback-Socket wird normal gezaehlt/gesperrt (kein Bypass). Zugleich bleibt
 * der Guard hinter einem Same-Host-Reverse-Proxy (Socket=127.0.0.1) fuer echte
 * Remote-Clients (Client-IP != loopback) aktiv.
 */
@Injectable()
export class LoginGuardService {
  private readonly accountMap = new Map<string, Bucket>();
  private readonly ipMap = new Map<string, Bucket>();
  /** IP-Sperrstufen – ENV-konfigurierbar (LOGIN_GUARD_IP_THRESHOLD), 1x beim Start aufgeloest. */
  private readonly ipSteps: readonly LockStep[];

  constructor() {
    this.ipSteps = buildIpLockSteps(resolveIpFirstTier());
  }

  /** Ist die IP+Konto-Kombination ODER die IP aktuell gesperrt? */
  isBlocked(clientIp: string | undefined | null, email: string, ctx: GuardContext = {}): BlockResult {
    if (this.shouldSkip(clientIp, ctx.socketIp)) return { blocked: false };
    const now = ctx.now ?? Date.now();
    const ip = this.normalizeIp(clientIp as string);
    const acc = this.accountMap.get(this.accountKey(ip, email));
    const ipb = this.ipMap.get(ip);
    const lockedUntil = Math.max(acc?.lockedUntil ?? 0, ipb?.lockedUntil ?? 0);
    if (lockedUntil > now) {
      return { blocked: true, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
    }
    return { blocked: false };
  }

  /**
   * Registriert einen Fehlversuch auf BEIDEN Zaehlern (Konto + IP). Ausgenommene/
   * leere Anfragen werden ignoriert (counted=false). Gibt Zaehlerstaende + neu
   * erreichte Sperr-Stufen zurueck, damit der Aufrufer das passende Security-Event
   * emittieren kann.
   */
  registerFailure(
    clientIp: string | undefined | null,
    email: string,
    ctx: GuardContext = {},
  ): FailureResult {
    if (this.shouldSkip(clientIp, ctx.socketIp)) {
      return {
        counted: false,
        accountCount: 0,
        ipCount: 0,
        accountNewTier: false,
        ipNewTier: false,
        lockMs: 0,
      };
    }
    const now = ctx.now ?? Date.now();
    const ip = this.normalizeIp(clientIp as string);
    const acc = this.bump(this.accountMap, this.accountKey(ip, email), LOGIN_GUARD.account.steps, now);
    const ipRes = this.bump(this.ipMap, ip, this.ipSteps, now);
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
   * Erfolgreicher Login:
   *  - Konto-Schluessel loeschen (Reset -> der naechste Fehlversuch startet bei 1).
   *  - reinen IP-Zaehler DEKREMENTIEREN (nicht auf 0): so entlastet aktive legitime
   *    Nutzung eines Shared-/CGNAT-Betriebs den kollektiven IP-Zaehler, ohne den
   *    Stuffing-Schutz zu leeren (ein einzelner gueltiger Login setzt den Zaehler
   *    nicht komplett zurueck).
   */
  registerSuccess(clientIp: string | undefined | null, email: string, ctx: GuardContext = {}): void {
    if (this.shouldSkip(clientIp, ctx.socketIp)) return;
    const ip = this.normalizeIp(clientIp as string);
    this.accountMap.delete(this.accountKey(ip, email));
    const b = this.ipMap.get(ip);
    if (b) {
      b.count = Math.max(0, b.count - 1);
      if (b.count === 0) {
        this.ipMap.delete(ip);
      } else {
        this.ipMap.delete(ip);
        this.ipMap.set(ip, b); // LRU-Recency erhalten
      }
    }
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
   * Anfrage ueberspringen? Ja, wenn keine Client-IP vorliegt ODER die (haertungs-
   * sichere) Loopback-Ausnahme greift.
   */
  private shouldSkip(clientIp: string | undefined | null, socketIp: string | undefined | null): boolean {
    if (!clientIp) return true;
    return this.isExempt(clientIp, socketIp);
  }

  /**
   * Loopback-Ausnahme: NUR wenn der ECHTE Socket-Peer loopback ist (nicht XFF-
   * faelschbar) UND die gezaehlte Client-IP ebenfalls loopback ist. Ein gespoofter
   * `X-Forwarded-For: 127.0.0.1` bei nicht-loopback-Socket faellt damit nie in die
   * Ausnahme; ein Same-Host-Proxy (Socket loopback) nimmt echte Remote-Clients
   * (Client-IP != loopback) nicht aus.
   */
  private isExempt(clientIp: string, socketIp: string | undefined | null): boolean {
    return !!socketIp && this.isLoopback(socketIp) && this.isLoopback(clientIp);
  }

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
    return `${ip}|${(email ?? '').trim().toLowerCase()}`;
  }

  /** Leert IPv4-mapped-IPv6-Praefix + normalisiert. */
  private normalizeIp(ip: string): string {
    let s = (ip ?? '').trim().toLowerCase();
    if (s.startsWith('::ffff:')) s = s.slice(7);
    return s;
  }

  /** Loopback? (127.0.0.0/8, ::1, localhost). */
  private isLoopback(ip: string | undefined | null): boolean {
    const s = this.normalizeIp((ip ?? '') as string);
    return s === '::1' || s === 'localhost' || s.startsWith('127.');
  }
}
