import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  LOGIN_GUARD,
  buildIpLockSteps,
  lockMsForCount,
  resolveIpFirstTier,
  type LockStep,
} from './security.constants';
import { LoginAttemptStore } from './login-attempt.store';

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
 * Neustart-feste Fehlversuchs-Sperre (Sentinel Teil 1).
 *
 * Der Hot-Path bleibt SYNCHRON und in-memory (zwei beschraenkte Maps mit LRU-
 * Deckel) – so aendert sich weder das Verhalten noch das (synchrone) API. Die
 * WAHRHEIT der Zaehler liegt jedoch in der DB (`login_attempts`, via
 * LoginAttemptStore): beim Start hydratisiert `onModuleInit` die Maps aus der DB,
 * bei jedem Fehlversuch/Erfolg wird best-effort atomar durchgeschrieben. Damit
 * ueberlebt der Zaehler einen Deploy/Absturz – ein Angreifer bei 4/5 Versuchen
 * steht nach einem Neustart NICHT wieder bei 0. Der Store ist @Optional: ohne ihn
 * (reine Unit-Tests) arbeitet der Guard exakt wie zuvor rein im Speicher.
 *
 * Die Map-Schluessel sind SHA-256-Hashes (kein Klartext) – so enthaelt weder der
 * Speicher noch die DB eine lesbare Liste der Anmelde-Mailadressen. Das ist rein
 * intern; Zaehlerstaende, Sperrstufen und Rueckgabewerte sind unveraendert.
 * Details/Begruendung der Schwellen: security.constants.ts.
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
export class LoginGuardService implements OnModuleInit {
  private readonly logger = new Logger(LoginGuardService.name);
  private readonly accountMap = new Map<string, Bucket>();
  private readonly ipMap = new Map<string, Bucket>();
  /** IP-Sperrstufen – ENV-konfigurierbar (LOGIN_GUARD_IP_THRESHOLD), 1x beim Start aufgeloest. */
  private readonly ipSteps: readonly LockStep[];
  /** Serialisierte, best-effort Persistenz-Kette (Durchschreiben ohne den Hot-Path zu blockieren). */
  private persistChain: Promise<unknown> = Promise.resolve();

  constructor(@Optional() private readonly store?: LoginAttemptStore) {
    this.ipSteps = buildIpLockSteps(resolveIpFirstTier());
  }

  /**
   * Start-Hydration: laedt die noch relevanten Zaehler aus der DB in die Maps,
   * damit ein Neustart die bisherigen Fehlversuche/Sperren NICHT vergisst. Ohne
   * Store (Unit-Tests) und bei DB-Fehlern ein sicheres No-Op (fail-open; der
   * Guard schuetzt danach ab dem naechsten Versuch weiter).
   */
  async onModuleInit(nowMs: number = Date.now()): Promise<void> {
    if (!this.store) return;
    try {
      const rows = await this.store.loadActive(nowMs);
      for (const r of rows) {
        const bucket: Bucket = {
          count: r.attempts,
          lastFailAt: new Date(r.lastFailAt).getTime(),
          lockedUntil: r.lockedUntil ? new Date(r.lockedUntil).getTime() : 0,
        };
        if (r.scope === 'ip') this.ipMap.set(r.keyHash, bucket);
        else this.accountMap.set(r.keyHash, bucket);
      }
      this.evict(this.accountMap);
      this.evict(this.ipMap);
      if (rows.length > 0) {
        this.logger.log(`Login-Guard aus DB hydratisiert: ${rows.length} aktive Zaehler.`);
      }
    } catch (err) {
      this.logger.warn(`Login-Guard-Hydration fehlgeschlagen (fail-open): ${(err as Error).message}`);
    }
  }

  /** Wartet, bis alle angestossenen Persistenz-Schreibungen abgeschlossen sind (Tests/Ops/Shutdown). */
  async whenPersisted(): Promise<void> {
    await this.persistChain;
  }

  /** Ist die IP+Konto-Kombination ODER die IP aktuell gesperrt? */
  isBlocked(clientIp: string | undefined | null, email: string, ctx: GuardContext = {}): BlockResult {
    if (this.shouldSkip(clientIp, ctx.socketIp)) return { blocked: false };
    const now = ctx.now ?? Date.now();
    const ip = this.normalizeIp(clientIp as string);
    const acc = this.accountMap.get(this.accountKey(ip, email));
    const ipb = this.ipMap.get(this.ipKey(ip));
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
    const accKey = this.accountKey(ip, email);
    const ipKey = this.ipKey(ip);
    const acc = this.bump(this.accountMap, accKey, LOGIN_GUARD.account.steps, now);
    const ipRes = this.bump(this.ipMap, ipKey, this.ipSteps, now);
    // Neustart-Festigkeit: denselben Fehlversuch dauerhaft (atomar) durchschreiben.
    // Best-effort/fire-and-forget – der synchrone Rueckgabewert bleibt der des
    // In-Memory-Caches (unveraendertes Verhalten); die DB traegt ueber den Neustart.
    this.enqueuePersist(() => this.store!.persistFailure('account', accKey, now));
    this.enqueuePersist(() => this.store!.persistFailure('ip', ipKey, now));
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
    const accKey = this.accountKey(ip, email);
    const ipKey = this.ipKey(ip);
    this.accountMap.delete(accKey);
    const b = this.ipMap.get(ipKey);
    if (b) {
      b.count = Math.max(0, b.count - 1);
      if (b.count === 0) {
        this.ipMap.delete(ipKey);
      } else {
        this.ipMap.delete(ipKey);
        this.ipMap.set(ipKey, b); // LRU-Recency erhalten
      }
    }
    // Durchschreiben: Konto-Zeile loeschen, IP-Zaehler dekrementieren (wie im Cache).
    this.enqueuePersist(() => this.store!.registerSuccessAccount(accKey));
    this.enqueuePersist(() => this.store!.registerSuccessIp(ipKey));
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
    const lockMs = lockMsForCount(b.count, steps, LOGIN_GUARD.maxLockMs);
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

  /** Verdraengt die aeltesten Eintraege, bis der Deckel eingehalten ist (Speicher-DoS-Schutz). */
  private evict(map: Map<string, Bucket>): void {
    while (map.size > LOGIN_GUARD.maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  /**
   * Konto-Schluessel = SHA-256 von (normalisierte IP + normalisierte E-Mail).
   * Gehasht statt Klartext: der Schluessel dient nur der Wiedererkennung, darf aber
   * (im Speicher wie in der DB) keine lesbare Mailadresse preisgeben.
   */
  private accountKey(ip: string, email: string): string {
    return this.hash(`account|${ip}|${(email ?? '').trim().toLowerCase()}`);
  }

  /** Reiner-IP-Schluessel = SHA-256 der normalisierten IP (opake Wiedererkennung). */
  private ipKey(ip: string): string {
    return this.hash(`ip|${ip}`);
  }

  /** SHA-256-Hex (wie security_events.emailHash) – keine lesbare Kennung im Store. */
  private hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Reiht eine best-effort Persistenz-Schreibung in die serialisierte Kette ein
   * (nur wenn ein Store injiziert ist). Fehler werden verschluckt: die Persistenz
   * darf den (synchronen) Auth-Fluss NIE blockieren oder brechen.
   */
  private enqueuePersist(task: () => Promise<unknown>): void {
    if (!this.store) return;
    this.persistChain = this.persistChain.then(() => task()).catch(() => undefined);
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
