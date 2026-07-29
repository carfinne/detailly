/**
 * Boot-Zeit-Preflight fuer PRODUKTION (reine process.env-Pruefung).
 *
 * Wird GANZ ZU BEGINN von bootstrap() aufgerufen (main.ts) – vor
 * NestFactory.create – damit ein fehlkonfigurierter Prod-Start SOFORT mit einer
 * gesammelten, klaren Meldung abbricht, statt spaeter mit einem rohen
 * getOrThrow/Connect-Fehler tief im Modulbaum zu sterben.
 *
 * BEWUSST OHNE riskante Imports (kein NestJS-DI, kein CJS-Default-Import, kein
 * Datenbank-Treiber): die Pruefung ist eine reine Funktion ueber die uebergebene
 * Umgebung + einen bereits berechneten synchronize-Flag. Dadurch ist sie voll
 * unit-testbar und kann den Boot nicht durch einen Import-Nebeneffekt kippen.
 *
 * DEV-SICHER: Ausserhalb NODE_ENV=production ist die Pruefung ein kompletter
 * No-op (leere errors/warnings). In Dev aendert sich also NICHTS.
 *
 * Zweite Verteidigungslinie: env.validation.ts (ConfigModule.validate) prueft
 * einen Teil dieser Regeln nochmals waehrend der Modul-Initialisierung. Der
 * Preflight ist die frueheste, gesammelte Instanz und ergaenzt die hier
 * geforderten Prod-Haertungen (DB_TYPE=postgres, synchronize aus).
 */

// Import BEWUSST direkt aus dem storage-config-Modul (nur `path`, keine
// Seiteneffekte) statt aus dem Storage-Barrel – der Preflight bleibt importarm
// und boot-sicher (kein DI, kein fs-/DB-Treiber).
import { isPathInsideAppDir } from '../common/storage/storage-config';

export interface PreflightResult {
  /** Harte Fehler -> Boot-Abbruch in Produktion. */
  errors: string[];
  /** Hinweise (empfohlene ENVs) -> KEIN Abbruch, nur Log-Warnung. */
  warnings: string[];
}

/**
 * Bekannte Dev-/Beispiel-Secrets, die in Produktion verboten sind.
 * Spiegelt bewusst die Liste in env.validation.ts (dort UNSAFE_SECRETS) –
 * lokal gehalten, um den Preflight importfrei/boot-sicher zu lassen.
 */
const UNSAFE_SECRETS: readonly string[] = [
  'detailly-dev-secret-change-in-production',
  'local-dev-secret-not-for-production',
  'your-super-secret-jwt-key-change-in-production',
  'changeme',
  'secret',
];

/** Mindestlaenge JWT_SECRET in Produktion (empfohlen 64 Hex-Zeichen). */
const MIN_JWT_SECRET_LENGTH = 16;
/** Mindestlaenge DATA_ENC_KEY (>= 32; ideal 64 Hex-Zeichen = 32 Byte). */
const MIN_ENC_KEY_LENGTH = 32;

/**
 * Reine Preflight-Pruefung. Gibt gesammelte Fehler + Warnungen zurueck, wirft NIE
 * und schreibt NIE ins Log -> direkt testbar.
 *
 * @param env         Umgebung (i. d. R. process.env).
 * @param opts.synchronize  Der bereits AUS der echten DataSource-Konfiguration
 *   berechnete synchronize-Flag (buildDataSourceOptions(env).synchronize).
 *   Wird explizit uebergeben, damit der Preflight keinen DB-/Entity-Import zieht
 *   und der Test den Fall gezielt setzen kann.
 */
export function checkProductionEnv(
  env: NodeJS.ProcessEnv,
  opts: { synchronize: boolean },
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Dev/Test: kompletter No-op (keine Aenderung am Verhalten ausserhalb Prod).
  if (env.NODE_ENV !== 'production') {
    return { errors, warnings };
  }

  // --------------------------------------------------------------------------
  // Harte Abbrueche (fail-closed): ohne diese darf Produktion nicht starten.
  // --------------------------------------------------------------------------

  // JWT_SECRET: Pflicht, kein bekannter Dev-Default, ausreichend lang.
  const jwt = env.JWT_SECRET ?? '';
  if (!jwt) {
    errors.push(
      'JWT_SECRET fehlt. Ein starkes, zufaelliges Secret ist Pflicht (z. B. `openssl rand -hex 32`).',
    );
  } else if (UNSAFE_SECRETS.includes(jwt)) {
    errors.push(
      'JWT_SECRET ist ein bekannter Dev-/Beispiel-Wert (z. B. "local-dev-secret-not-for-production"). ' +
        'In Produktion verboten – Sessions waeren faelschbar.',
    );
  } else if (jwt.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET ist zu kurz (< ${MIN_JWT_SECRET_LENGTH} Zeichen). ` +
        'Mindestens 16, empfohlen 64 Hex-Zeichen.',
    );
  }

  // DB_TYPE MUSS in Produktion postgres sein (SQLite ist Dev-only: kein
  // Migrations-/Backup-/Nebenlaeufigkeits-Konzept fuer den Mehrbetrieb).
  const dbType = (env.DB_TYPE ?? 'sqlite').toLowerCase();
  if (dbType !== 'postgres') {
    errors.push(
      `DB_TYPE="${dbType}" ist in Produktion nicht erlaubt. Nur "postgres" zulaessig ` +
        '(SQLite ist ausschliesslich fuer die Entwicklung).',
    );
  }

  // synchronize MUSS in Produktion aus sein: sonst wuerde TypeORM das Schema
  // ungeprueft aus den Entities bauen/veraendern -> Datenverlust-Risiko.
  if (opts.synchronize) {
    errors.push(
      'TypeORM synchronize ist aktiv. In Produktion darf das Schema NUR ueber ' +
        'committete Migrationen entstehen (npm run migration:run) – nie per synchronize.',
    );
  }

  // Postgres-Verbindungs-Pflichtfelder (Prod erzwingt ohnehin postgres).
  if (dbType === 'postgres') {
    for (const key of ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'] as const) {
      if (!env[key]) {
        errors.push(`${key} fehlt (fuer die PostgreSQL-Verbindung erforderlich).`);
      }
    }
    if (env.DB_PASS === 'detailly') {
      errors.push('DB_PASS ist der unsichere Default "detailly". In Produktion verboten.');
    }
  }

  // DATA_ENC_KEY: Pflicht fuer die Feld-Verschluesselung (Kundendaten/Rechnungen).
  const encKey = env.DATA_ENC_KEY ?? '';
  if (!encKey || encKey.length < MIN_ENC_KEY_LENGTH) {
    errors.push(
      `DATA_ENC_KEY fehlt oder ist zu kurz (< ${MIN_ENC_KEY_LENGTH} Zeichen). ` +
        'Pflicht fuer die Feld-Verschluesselung. Schluesselverlust = Datenverlust! ' +
        '(z. B. `openssl rand -hex 32` = 64 Hex-Zeichen).',
    );
  }

  // --------------------------------------------------------------------------
  // Warnungen (kein Abbruch): empfohlene, aber optionale ENVs.
  // --------------------------------------------------------------------------

  if (!env.FRONTEND_URL) {
    warnings.push(
      'FRONTEND_URL nicht gesetzt: CORS erlaubt in Produktion dann nur die eigene ' +
        'Origin (origin:false). Nur setzen, wenn ein getrennt gehostetes Frontend zugreift.',
    );
  }
  if (!env.SMTP_HOST) {
    warnings.push(
      'SMTP_HOST nicht gesetzt: Plattform-Mailversand ist deaktiviert (Betriebe koennen ' +
        'weiterhin eigene SMTP-Daten hinterlegen). Fuer System-Mails ' +
        'SMTP_HOST/SMTP_USER/SMTP_PASS/MAIL_FROM setzen.',
    );
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    warnings.push(
      'STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET nicht vollstaendig gesetzt: ' +
        'Self-Service-Abo/Billing ist deaktiviert.',
    );
  }
  if (!env.SEED_ADMIN_PASSWORD) {
    warnings.push(
      'SEED_ADMIN_PASSWORD nicht gesetzt: In Produktion wird KEIN Demo-Konto angelegt; ' +
        'der erste Admin muss separat (Seed-Skript mit SEED_ADMIN_PASSWORD) erstellt werden.',
    );
  }
  if (!env.TRUST_PROXY_HOPS) {
    warnings.push(
      'TRUST_PROXY_HOPS nicht gesetzt (Default 1): muss der Anzahl vorgelagerter Proxies ' +
        '(CDN/LB/Ingress) entsprechen – sonst IP-Spoofing (zu hoch) bzw. kollektive Sperren (zu niedrig).',
    );
  }
  if (!env.SECURITY_ALERT_EMAIL) {
    warnings.push(
      'SECURITY_ALERT_EMAIL nicht gesetzt: Sicherheits-Warnmails (Sentinel) werden nicht versendet.',
    );
  }

  // Dateispeicher (nur Treiber 'local'): liegt der Ablage-Pfad IM App-/Container-
  // Verzeichnis, gehen Fotos + aufbewahrungspflichtige Belege (Eingangsrechnungen,
  // KYB) bei Redeploy/Neustart VERLOREN (ephemeres Container-FS) -> GoBD-/
  // Aufbewahrungs- + Datenverlust-Risiko. Warnung (kein Abbruch) in ZWEI Faellen:
  //  (a) STORAGE_LOCAL_PATH NICHT gesetzt/leer -> Default = App-Verzeichnis
  //      (der WAHRSCHEINLICHSTE Fehler beim ersten Prod-Deploy!),
  //  (b) STORAGE_LOCAL_PATH gesetzt, aber innerhalb des App-Verzeichnisses.
  // Genau hier muss der Preflight laut sein statt zu schweigen.
  const storageDriver = (env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (storageDriver === 'local') {
    const storageLocalPath = env.STORAGE_LOCAL_PATH?.trim();
    if (!storageLocalPath) {
      warnings.push(
        'STORAGE_LOCAL_PATH nicht gesetzt: Uploads liegen im App-/Container-Verzeichnis ' +
          'und gehen beim naechsten Redeploy/Neustart VERLOREN (Fotos, Eingangsrechnungen, ' +
          'KYB-Belege). STORAGE_LOCAL_PATH auf ein PERSISTENTES Volume ausserhalb des ' +
          'App-Verzeichnisses setzen (docs/RUNBOOK_PRODUKTION.md, Abschnitt „Dateispeicher").',
      );
    } else if (isPathInsideAppDir(storageLocalPath)) {
      warnings.push(
        `STORAGE_LOCAL_PATH ("${storageLocalPath}") liegt im App-/Container-Verzeichnis: ` +
          'Uploads (Fotos, Eingangsrechnungen, KYB-Belege) gehen bei Redeploy/Neustart verloren. ' +
          'Auf ein PERSISTENTES Volume ausserhalb des App-Verzeichnisses legen ' +
          '(docs/RUNBOOK_PRODUKTION.md, Abschnitt „Dateispeicher").',
      );
    }
  }

  return { errors, warnings };
}

/**
 * Duennes Boot-Wrapper: prueft, loggt Warnungen und BRICHT bei Fehlern ab.
 *
 * @param env          i. d. R. process.env.
 * @param synchronize  Ergebnis von buildDataSourceOptions(env).synchronize
 *   (vom Aufrufer berechnet, s. checkProductionEnv-Doku).
 * @param logger       injizierbar fuer Tests (Default: console).
 * @throws Error mit gesammelter Meldung, wenn in Produktion Fehler vorliegen.
 */
export function assertProductionBoot(
  env: NodeJS.ProcessEnv,
  synchronize: boolean,
  logger: Pick<Console, 'warn' | 'log'> = console,
): void {
  const { errors, warnings } = checkProductionEnv(env, { synchronize });

  for (const w of warnings) {
    logger.warn(`[preflight] WARNUNG: ${w}`);
  }

  if (errors.length) {
    throw new Error(
      '[preflight] Produktions-Start abgebrochen – bitte folgende Punkte beheben:\n' +
        errors.map((e) => `  - ${e}`).join('\n'),
    );
  }

  if (env.NODE_ENV === 'production') {
    logger.log('[preflight] Produktions-ENV-Pruefung bestanden.');
  }
}
