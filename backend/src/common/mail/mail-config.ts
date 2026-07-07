import { BadRequestException } from '@nestjs/common';

/**
 * Eigener Mail-Absender je Betrieb: SMTP-Konfiguration im verschluesselten JSON
 * `tenant.settings` unter dem Schluessel `mailConfig`. Das PASSWORT liegt bewusst
 * NICHT hier, sondern in der dedizierten, verschluesselten `select:false`-Spalte
 * `tenant.smtpPassword` (Vorbild: sevdeskApiToken) – es verlaesst das Backend nie
 * im Klartext.
 *
 * Semantik:
 *  - `enabled=false` (Default): der Betrieb nutzt den Plattform-Default-Versand
 *    (heutiges Verhalten). Keine weiteren Anforderungen an die Felder.
 *  - `enabled=true`: Kunden-Mails gehen ueber den betriebseigenen SMTP unter
 *    `fromName <fromEmail>` raus. Dann sind Host/Port/From Pflicht (Validierung).
 */
export interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
}

/** Default: eigener Versand AUS -> Plattform-Default (bisheriges Verhalten). */
export const MAIL_DEFAULTS: MailConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  fromEmail: '',
  fromName: '',
};

export const PORT_MIN = 1;
export const PORT_MAX = 65535;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isPlausibleEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

/** String normalisieren: trimmen + CR/LF entfernen (Header-Injection-Schutz). */
function str(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim() : '';
}

function toPort(v: unknown, def: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.min(PORT_MAX, Math.max(PORT_MIN, i));
}

/**
 * Liest die Mail-Konfiguration DEFENSIV aus dem Rohwert (tenant.settings.mailConfig).
 * Fehlende/ungueltige Keys fallen auf Defaults zurueck; wirft NIE (Lese-Pfad, auch
 * fuer Altbestand robust). `enabled`/`secure` gelten nur bei exakt `true` als aktiv.
 */
export function resolveMailConfig(raw: unknown): MailConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    enabled: o.enabled === true,
    host: str(o.host),
    port: toPort(o.port, MAIL_DEFAULTS.port),
    secure: o.secure === true,
    user: str(o.user),
    fromEmail: str(o.fromEmail),
    fromName: str(o.fromName),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional, ohne Passwort). */
export interface MailConfigPatch {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  fromEmail?: string;
  fromName?: string;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeMailConfig(base: MailConfig, patch: MailConfigPatch): MailConfig {
  const s = (v: unknown, def: string) =>
    typeof v === 'string' ? str(v) : def;
  return {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : base.enabled,
    host: s(patch.host, base.host),
    port:
      typeof patch.port === 'number' && Number.isFinite(patch.port)
        ? toPort(patch.port, base.port)
        : base.port,
    secure: typeof patch.secure === 'boolean' ? patch.secure : base.secure,
    user: s(patch.user, base.user),
    fromEmail: s(patch.fromEmail, base.fromEmail),
    fromName: s(patch.fromName, base.fromName),
  };
}

/**
 * Validiert die Konfiguration fuer den SCHREIB-Pfad (PATCH). Nur wenn der eigene
 * Versand AKTIV ist, sind Host/Port/From Pflicht (sonst waere ein aktiver, aber
 * unbrauchbarer Versand moeglich). Deaktiviert -> keine Anforderungen.
 * Wirft BadRequestException mit klarer Meldung.
 */
export function assertMailConfigValid(cfg: MailConfig): void {
  if (!cfg.enabled) return;
  if (!cfg.host) {
    throw new BadRequestException('Für den eigenen Mail-Versand ist ein SMTP-Host erforderlich.');
  }
  if (!Number.isInteger(cfg.port) || cfg.port < PORT_MIN || cfg.port > PORT_MAX) {
    throw new BadRequestException(`Der SMTP-Port muss zwischen ${PORT_MIN} und ${PORT_MAX} liegen.`);
  }
  if (!cfg.fromEmail || !isPlausibleEmail(cfg.fromEmail)) {
    throw new BadRequestException('Bitte eine gültige Absender-Adresse (From) angeben.');
  }
}

/**
 * Absender-Kopf `Name <mail>` (oder nur die Adresse ohne Namen). Beide Werte sind
 * bereits CR/LF-bereinigt (resolve/merge) -> keine Header-Injection.
 */
export function formatFrom(cfg: MailConfig): string {
  const email = cfg.fromEmail.trim();
  if (!email) return '';
  const name = cfg.fromName.trim();
  return name ? `${name} <${email}>` : email;
}
