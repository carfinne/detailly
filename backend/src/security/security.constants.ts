/**
 * Sentinel (Teil 1) – Konstanten, Typen und Schwellwerte der aktiven
 * Login-Abwehr (Fehlversuchs-Sperre + Sicherheits-Ereignis-Protokoll).
 *
 * Wie beim Datenpannen-Register (incident.constants.ts) sind Typ/Schweregrad
 * bewusst const-Arrays + Union-Typen und in der DB TEXT-Spalten (nicht Postgres-
 * `enum`): das spaetere Aendern eines Enum-WERTS ist bei Postgres teuer/heikel
 * (vgl. Reseed-Lektion), waehrend TEXT + `@IsIn(...)` genauso strikt ist und
 * schmerzfrei erweiterbar bleibt.
 */

/**
 * Ereignis-Typ eines Security-Events (TEXT-Spalte + @IsIn-Validierung).
 *
 * Teil 2 ergaenzt:
 *  - `scan_4xx`   : eine 401/403/404-Antwort (Probing/Scan-Signal je IP; wird vom
 *                   AllExceptionsFilter fire-and-forget emittiert, ohne Body-Daten).
 *  - `ip_block`   : eine IP-Sperre wurde gesetzt (system-automatisch ODER manuell).
 *  - `ip_unblock` : eine IP-Sperre wurde (manuell) aufgehoben.
 *  - `honeypot`   : ein verstecktes Honeypot-Feld eines oeffentlichen Formulars
 *                   (Buchung/Newsletter/Haendler-Bewerbung/Registrierung) wurde
 *                   gefuellt -> Bot-Signal (s. common/security/honeypot.ts). Rein
 *                   additiver Wert: `type` ist eine TEXT-Spalte (kein Postgres-
 *                   `enum`, kein CHECK), daher OHNE Migration erweiterbar.
 */
export const SECURITY_EVENT_TYPES = [
  'login_fail',
  'login_lockout',
  'mfa_fail',
  'scan_4xx',
  'ip_block',
  'ip_unblock',
  'honeypot',
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/** Schweregrad eines Security-Events. */
export const SECURITY_EVENT_SEVERITY = ['info', 'warn', 'critical'] as const;
export type SecurityEventSeverity = (typeof SECURITY_EVENT_SEVERITY)[number];

// ---------------------------------------------------------------------------
// Aufbewahrung (DSGVO): die IP ist personenbezogen. Rechtsgrundlage fuer die
// Speicherung ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
// System-/IT-Sicherheit; Abwehr von Brute-Force/Credential-Stuffing). Zur
// Datenminimierung werden Events nach `SECURITY_EVENT_TTL_DAYS` automatisch
// geloescht (Auto-Purge, s. SecurityEventService).
// ---------------------------------------------------------------------------

/** Default-Aufbewahrung der Security-Events in Tagen (ENV: SECURITY_EVENT_TTL_DAYS). */
export const SECURITY_EVENT_TTL_DAYS_DEFAULT = 60;

/** Purge-Intervall (ENV: SECURITY_EVENT_PURGE_INTERVAL_MS), Default 6h, min 1h. */
export const SECURITY_EVENT_PURGE_INTERVAL_MS_DEFAULT = 6 * 60 * 60 * 1000;
export const SECURITY_EVENT_PURGE_INTERVAL_MS_MIN = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Login-Guard (IN-MEMORY, bounded). Progressiv, gleitendes (idle-basiertes)
// Fenster: solange Fehlversuche innerhalb von `windowMs` aufeinander folgen,
// akkumuliert der Zaehler (noetig fuer die ESKALATION); eine laengere Pause als
// `windowMs` setzt ihn zurueck. Reset auch bei Erfolg (Konto-Schluessel).
//
// ZWEI getrennte Zaehler:
//  - Konto-Schluessel = IP + Konto (E-Mail): verhindert Lockout-DoS gegen ein
//    FREMDES Konto (ein Angreifer von einer IP sperrt nur seine eigene IP-Konto-
//    Kombination, nicht das Konto pauschal fuer alle).
//  - reiner IP-Zaehler: faengt Credential-Stuffing (viele Konten von EINER IP).
//    Schwelle DEUTLICH hoeher, damit ein ganzer Betrieb hinter einer Buero-IP
//    (NAT) nicht kollektiv gesperrt wird.
//
// Loopback (127.0.0.1/::1) wird NIE gezaehlt/gesperrt (Selbst-Aussperrung ueber
// den Reverse-Proxy vermeiden).
// ---------------------------------------------------------------------------

export interface LockStep {
  /** Ab dieser Fehlversuchszahl gilt die Sperre. */
  readonly fails: number;
  /** Sperrdauer in Millisekunden. */
  readonly lockMs: number;
}

const MIN = 60 * 1000;

export const LOGIN_GUARD = {
  /** Gleitendes Fenster: Inaktivitaet laenger als dies setzt den Zaehler zurueck. */
  windowMs: 30 * MIN,
  /** Deckel der Sperrdauer. */
  maxLockMs: 30 * MIN,
  /** LRU-Deckel je Map (bounded – Schutz vor Speicher-DoS ueber IP-Rotation). */
  maxEntries: 50_000,
  /**
   * Konto-Schwellen (IP+Konto): 5->1min, 8->5min, 12->15min, >=15->30min.
   * Absteigend nach `fails` (erste passende Stufe gewinnt).
   */
  account: {
    steps: [
      { fails: 15, lockMs: 30 * MIN },
      { fails: 12, lockMs: 15 * MIN },
      { fails: 8, lockMs: 5 * MIN },
      { fails: 5, lockMs: 1 * MIN },
    ] as readonly LockStep[],
  },
} as const;

/**
 * Reiner-IP-Erststufe (Fehlversuche fuer die erste, kuerzeste IP-Sperre).
 * DEUTLICH hoeher als die Konto-Erststufe (5), damit Shared-IP/NAT/CGNAT (ganzer
 * Betrieb bzw. viele Mobilfunk-Nutzer hinter EINER IP) nicht kollektiv gesperrt
 * wird. Der Login ist zusaetzlich per @Throttle auf 5/min/IP gedrosselt -> eine
 * einzelne IP erzeugt in 30min hoechstens ~150 Fehlversuche; erst echtes
 * verteiltes/aggressives Stuffing erreicht die hoeheren Stufen.
 *
 * ENV `LOGIN_GUARD_IP_THRESHOLD` hebt/senkt diese Erststufe fuer grosse
 * Deployments (viele Nutzer hinter einer Firmen-/CGNAT-IP). Default 50.
 */
export const LOGIN_GUARD_IP_THRESHOLD_DEFAULT = 50;
/** Untergrenze: nie unter die Konto-Erststufe*2 (sonst kein echter "deutlich hoeher"-Abstand). */
export const LOGIN_GUARD_IP_THRESHOLD_MIN = 10;

/** Loest die IP-Erststufe aus der Umgebung auf (Default 50, min 10). */
export function resolveIpFirstTier(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.LOGIN_GUARD_IP_THRESHOLD);
  if (Number.isInteger(raw) && raw >= LOGIN_GUARD_IP_THRESHOLD_MIN) return raw;
  return LOGIN_GUARD_IP_THRESHOLD_DEFAULT;
}

/**
 * Baut die vier IP-Sperrstufen (absteigend) aus der Erststufe `b`:
 * b->1min, 2b->5min, 3b->15min, 5b->30min. So skaliert die Konfiguration
 * konsistent mit `LOGIN_GUARD_IP_THRESHOLD`.
 */
export function buildIpLockSteps(firstTier: number): readonly LockStep[] {
  const b = Math.max(LOGIN_GUARD_IP_THRESHOLD_MIN, Math.floor(firstTier));
  return [
    { fails: b * 5, lockMs: 30 * MIN },
    { fails: b * 3, lockMs: 15 * MIN },
    { fails: b * 2, lockMs: 5 * MIN },
    { fails: b, lockMs: 1 * MIN },
  ];
}

/** Generische, enumerationssichere Meldung bei aktiver Sperre (429). */
export const LOGIN_LOCKED_MESSAGE = 'Zu viele Versuche. Bitte versuche es spaeter erneut.';

// ===========================================================================
// Sentinel Teil 2 – Auto-IP-Sperre + Erkennungs-Regeln
// ===========================================================================

/** Schweregrad einer IP-Sperre (TEXT + @IsIn – wie SECURITY_EVENT_SEVERITY). */
export const IP_BLOCK_SEVERITY = ['info', 'warn', 'critical'] as const;
export type IpBlockSeverity = (typeof IP_BLOCK_SEVERITY)[number];

/**
 * Generische, enumerationssichere Meldung fuer eine geblockte IP (429). Verraet
 * NICHT den Grund/die Dauer der Sperre (kein Recon-Vorteil fuer den Angreifer).
 */
export const IP_BLOCKED_MESSAGE = 'Zugriff voruebergehend gesperrt. Bitte spaeter erneut versuchen.';

/**
 * In-Memory-Cache-Fenster des IpBlockService (ENV: IP_BLOCK_CACHE_TTL_MS).
 * Innerhalb des Fensters wird die Liste aktiver Sperren NICHT erneut aus der DB
 * gelesen -> eine DB-Query pro Fenster statt pro Request (Hot-Path-Schutz).
 * Default 30s, min 1s. Ablauf einzelner Sperren (expiresAt) wird trotzdem
 * sekundengenau geprueft, weil der Cache je IP die Ablaufzeit mitfuehrt.
 */
export const IP_BLOCK_CACHE_TTL_MS_DEFAULT = 30_000;
export const IP_BLOCK_CACHE_TTL_MS_MIN = 1_000;

/** Loest das Cache-Fenster aus der Umgebung auf (Default 30s, min 1s). */
export function resolveIpBlockCacheTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.IP_BLOCK_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw >= IP_BLOCK_CACHE_TTL_MS_MIN) return raw;
  return IP_BLOCK_CACHE_TTL_MS_DEFAULT;
}

/**
 * HTTP-Stati, die als Scan/Probing-Signal (`scan_4xx`) gezaehlt werden. Bewusst
 * NUR 401 + 404 – und selbst die NUR fuer UNAUTHENTIFIZIERTE Requests (s.
 * shouldCountScan). Wichtige Ausschluesse (Review-Gate PR #218, FIX A):
 *  - 403 KOMPLETT raus: regulaere RBAC-Rollen-Denials (RolesGuard) und Tarif-403s
 *    (SUBSCRIPTION_INACTIVE / PLAN_FEATURE_MISSING / PLAN_LIMIT_REACHED) sind
 *    NORMALBETRIEB eingeloggter Kunden – nie ein Scan.
 *  - 401/404 nur unauthentifiziert: ein eingeloggter Nutzer (gueltiges JWT) ist
 *    per Definition kein Scanner (abgelaufene Session -> Frontend loggt aus und
 *    leitet zum Login; geloeschter Auftrag/veralteter Bookmark -> authentifiziert).
 *  - 400/429 ohnehin aussen vor (Validierungsfehler bzw. bereits gedrosselt).
 */
export const SCAN_4XX_STATUSES: readonly number[] = [401, 404];

/**
 * Routen-Praefixe, deren 4xx NICHT als scan_4xx zaehlt: der Auth-Bereich hat sein
 * EIGENES Signal (login_fail/mfa_fail über den LoginGuard) – sonst wuerde ein
 * Fehl-Login DOPPELT zaehlen (login_fail UND scan_4xx). Praefix inkl. globalem
 * API-Prefix (api/v1).
 */
export const SCAN_EXEMPT_ROUTE_PREFIXES: readonly string[] = ['/api/v1/auth/'];

/**
 * Entscheidet, ob eine 4xx-Antwort als Scan/Probing-Signal (`scan_4xx`) zaehlt.
 * Rein (ohne I/O) -> direkt testbar. Kernregel (FIX A): nur UNAUTHENTIFIZIERTE
 * 401/404 ausserhalb des Auth-Bereichs. Ein authentifizierter Principal
 * (info.authenticated) schliesst die Zaehlung IMMER aus -> ein normaler Betrieb
 * (hinter Buero-NAT) loest NIE eine Auto-Sperre aus; nur echtes unauth. Probing.
 *
 * BEWUSSTER REST (kein Bug, bewusst konservativ Richtung Erkennung):
 *  - Ein AUTHENTIFIZIERTER Nutzer auf einer NICHT existierenden /api-Route: dort
 *    laeuft kein Guard, also ist `req.user` leer -> `authenticated=false` -> es
 *    zaehlt. Ebenso ein 401 bei ABGELAUFENER Session (Token nicht mehr gueltig).
 *  - Beide werden erst ab der konservativen Schwelle (100 unauth-4xx/10min/IP)
 *    wirksam und sind praktisch nur durch eine FEHLERHAFTE Frontend-Schleife
 *    erreichbar, nicht durch normale Bedienung. Bewusst so belassen (lieber ein
 *    Grenzfall zu viel erkannt als ein Scanner uebersehen); eine Auto-Sperre
 *    heilt zudem selbst (TTL) und ist im Betreiber-Bereich sofort aufhebbar.
 */
export function shouldCountScan(info: {
  status: number;
  authenticated: boolean;
  path?: string | null;
}): boolean {
  if (info.authenticated) return false;
  if (!SCAN_4XX_STATUSES.includes(info.status)) return false;
  const path = info.path ?? '';
  if (SCAN_EXEMPT_ROUTE_PREFIXES.some((p) => path.startsWith(p))) return false;
  return true;
}

/**
 * Schwellwerte + Zeitfenster der automatischen IP-Sperre. BEWUSST KONSERVATIV,
 * damit legitime Nutzung (auch hinter Buero-/CGNAT-IPs) nicht kollektiv gesperrt
 * wird. Alle Werte sind ueber ENV uebersteuerbar (resolveThreatConfig).
 *
 * DSGVO/Verhaeltnismaessigkeit: Auto-Sperren sind IMMER befristet (blockTtlMs);
 * eine dauerhafte Sperre setzt nur ein PLATFORM_ADMIN manuell (Art. 6 Abs. 1
 * lit. f – Abwehr von Brute-Force/Scans; mildestes Mittel = temporaer).
 */
export const THREAT_DETECTION_DEFAULT = {
  /** Scan-Intervall des ThreatDetectionService (min 15s). */
  intervalMs: 60 * 1000,
  intervalMsMin: 15 * 1000,
  /** Fehl-Login-/2FA-Serie je IP: >= schwelle im Fenster -> Sperre. */
  loginFail: { windowMs: 10 * 60 * 1000, schwelle: 30 },
  /**
   * UNAUTHENTIFIZIERTE 401/404-Scan-Serie je IP: >= schwelle im Fenster -> Sperre.
   * KONSERVATIV (100/10min): scan_4xx zaehlt nur unauth. Probing (s. shouldCountScan),
   * daher ist die NAT-/Shared-IP-Realitaet entschaerft – hinter einer Buero-IP sind
   * die Mitarbeiter EINGELOGGT (authentifiziert -> zaehlt nie). Nur echtes
   * unauthentifiziertes Route-Fuzzing (das der globale Throttler bei bekannten
   * Routen ohnehin auf 600/min/IP begrenzt) erreicht diese Schwelle.
   */
  scan4xx: { windowMs: 10 * 60 * 1000, schwelle: 100 },
  /** Dauer der automatischen Sperre (TTL ueber expiresAt). */
  blockTtlMs: 60 * 60 * 1000,
} as const;

/** Aufgeloeste Schwellwert-Konfiguration (Defaults + ENV-Overrides). */
export interface ThreatConfig {
  intervalMs: number;
  loginFail: { windowMs: number; schwelle: number };
  scan4xx: { windowMs: number; schwelle: number };
  blockTtlMs: number;
}

/** Positive ganze Zahl aus ENV lesen (sonst Fallback). */
function envPosInt(raw: string | undefined, fallback: number, min = 1): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

/**
 * Loest die Erkennungs-Schwellen aus der Umgebung auf. ENV-Schluessel:
 *  - SENTINEL_THREAT_INTERVAL_MS       (Scan-Intervall, min 15s)
 *  - SENTINEL_LOGINFAIL_THRESHOLD      (Fehl-Login-Schwelle je IP)
 *  - SENTINEL_LOGINFAIL_WINDOW_MS      (Fehl-Login-Fenster)
 *  - SENTINEL_SCAN4XX_THRESHOLD        (4xx-Scan-Schwelle je IP)
 *  - SENTINEL_SCAN4XX_WINDOW_MS        (4xx-Scan-Fenster)
 *  - SENTINEL_AUTOBLOCK_TTL_MS         (Dauer der Auto-Sperre)
 */
export function resolveThreatConfig(env: NodeJS.ProcessEnv = process.env): ThreatConfig {
  const d = THREAT_DETECTION_DEFAULT;
  return {
    intervalMs: Math.max(
      d.intervalMsMin,
      envPosInt(env.SENTINEL_THREAT_INTERVAL_MS, d.intervalMs, d.intervalMsMin),
    ),
    loginFail: {
      windowMs: envPosInt(env.SENTINEL_LOGINFAIL_WINDOW_MS, d.loginFail.windowMs, 1000),
      schwelle: envPosInt(env.SENTINEL_LOGINFAIL_THRESHOLD, d.loginFail.schwelle, 2),
    },
    scan4xx: {
      windowMs: envPosInt(env.SENTINEL_SCAN4XX_WINDOW_MS, d.scan4xx.windowMs, 1000),
      schwelle: envPosInt(env.SENTINEL_SCAN4XX_THRESHOLD, d.scan4xx.schwelle, 2),
    },
    blockTtlMs: envPosInt(env.SENTINEL_AUTOBLOCK_TTL_MS, d.blockTtlMs, 60_000),
  };
}

/** Sperr-Grund-Kennungen (interner Kontext; keine PII). */
export const IP_BLOCK_REASON = {
  loginFlood: 'auto:login_fail_flood',
  scanFlood: 'auto:scan_4xx_flood',
} as const;
