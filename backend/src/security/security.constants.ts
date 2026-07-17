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

/** Ereignis-Typ eines Security-Events (TEXT-Spalte + @IsIn-Validierung). */
export const SECURITY_EVENT_TYPES = ['login_fail', 'login_lockout', 'mfa_fail'] as const;
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
  /**
   * Reiner-IP-Schwellen: DEUTLICH hoeher (6x die Konto-Erststufe), damit
   * Shared-IP/NAT (ganzer Betrieb hinter einer IP) nicht kollektiv gesperrt
   * wird. Der Login ist zusaetzlich per @Throttle auf 5/min/IP gedrosselt ->
   * eine einzelne IP erzeugt in 30min hoechstens ~150 Fehlversuche; erst echtes
   * verteiltes/aggressives Stuffing erreicht diese Schwellen.
   */
  ip: {
    steps: [
      { fails: 150, lockMs: 30 * MIN },
      { fails: 100, lockMs: 15 * MIN },
      { fails: 60, lockMs: 5 * MIN },
      { fails: 30, lockMs: 1 * MIN },
    ] as readonly LockStep[],
  },
} as const;

/** Generische, enumerationssichere Meldung bei aktiver Sperre (429). */
export const LOGIN_LOCKED_MESSAGE = 'Zu viele Versuche. Bitte versuche es spaeter erneut.';
