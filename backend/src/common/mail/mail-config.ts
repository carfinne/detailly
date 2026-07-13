import { BadRequestException } from '@nestjs/common';
import type { CheckStatus } from './mail-domain-check';

/**
 * Eigener Mail-Absender je Betrieb: SMTP-Konfiguration im verschluesselten JSON
 * `tenant.settings` unter dem Schluessel `mailConfig`. Das PASSWORT liegt bewusst
 * NICHT hier, sondern in der dedizierten, verschluesselten `select:false`-Spalte
 * `tenant.smtpPassword` (Vorbild: sevdeskApiToken) – es verlaesst das Backend nie
 * im Klartext. Analog liegt der private DKIM-Schluessel in `tenant.dkimPrivateKey`;
 * NUR der oeffentliche DKIM-Key (`dkim.publicKey`) steht hier (unbedenklich).
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
  /**
   * Eigene Mail-Domain (Zustellbarkeit). Ist sie gesetzt, MUSS `fromEmail` auf
   * dieser Domain liegen (SPF/DKIM-Ausrichtung). Leer = Domain-Feature ungenutzt.
   */
  domain: string;
  /** DKIM: Selector + OEFFENTLICHER Schluessel (kein Geheimnis). */
  dkim: MailDkim;
  /** Letztes Ergebnis der Domain-Verifikation (SPF/DKIM/MX). */
  domainCheck: MailDomainCheck;
}

/** DKIM-Metadaten: Selector + oeffentlicher Schluessel (base64 SPKI-DER). */
export interface MailDkim {
  selector: string;
  publicKey: string;
}

/**
 * Persistierter Stand der Domain-Verifikation. `dkim==='gruen'` ist das GATE fuer
 * die tatsaechliche DKIM-Signierung ausgehender Mails (unpublizierte Signatur
 * wuerde beim Empfaenger fehlschlagen -> nur signieren, wenn nachweislich veroeffentlicht).
 */
export interface MailDomainCheck {
  verifiziert: boolean;
  geprueftAm: string;
  spf: CheckStatus;
  dkim: CheckStatus;
  mx: CheckStatus;
}

/** Nie-geprueft-Default fuer die Domain-Verifikation. */
export const MAIL_DOMAIN_CHECK_DEFAULT: MailDomainCheck = {
  verifiziert: false,
  geprueftAm: '',
  spf: 'ungeprueft',
  dkim: 'ungeprueft',
  mx: 'ungeprueft',
};

/** Default: eigener Versand AUS -> Plattform-Default (bisheriges Verhalten). */
export const MAIL_DEFAULTS: MailConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  fromEmail: '',
  fromName: '',
  domain: '',
  dkim: { selector: '', publicKey: '' },
  domainCheck: { ...MAIL_DOMAIN_CHECK_DEFAULT },
};

export const PORT_MIN = 1;
export const PORT_MAX = 65535;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isPlausibleEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

/** Plausible Domain (mind. eine Sub-Ebene, nur a-z0-9 und Bindestriche). */
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
export function isPlausibleDomain(s: string): boolean {
  return DOMAIN_RE.test(s);
}

/** Normalisiert eine Domain: trimmen, Kleinschreibung, fuehrendes @/. entfernen. */
export function normalizeDomain(v: unknown): string {
  const s = typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim().toLowerCase() : '';
  return s.replace(/^[@.]+/, '').replace(/\.+$/, '');
}

/** Ampel-Status defensiv aus Rohwert lesen (nur bekannte Werte, sonst ungeprueft). */
function toStatus(v: unknown): CheckStatus {
  return v === 'gruen' || v === 'gelb' || v === 'rot' || v === 'ungeprueft' ? v : 'ungeprueft';
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
  const dkimRaw = o.dkim && typeof o.dkim === 'object' ? (o.dkim as Record<string, unknown>) : {};
  const checkRaw =
    o.domainCheck && typeof o.domainCheck === 'object'
      ? (o.domainCheck as Record<string, unknown>)
      : {};
  return {
    enabled: o.enabled === true,
    host: str(o.host),
    port: toPort(o.port, MAIL_DEFAULTS.port),
    secure: o.secure === true,
    user: str(o.user),
    fromEmail: str(o.fromEmail),
    fromName: str(o.fromName),
    domain: normalizeDomain(o.domain),
    dkim: { selector: str(dkimRaw.selector), publicKey: str(dkimRaw.publicKey) },
    domainCheck: {
      verifiziert: checkRaw.verifiziert === true,
      geprueftAm: str(checkRaw.geprueftAm),
      spf: toStatus(checkRaw.spf),
      dkim: toStatus(checkRaw.dkim),
      mx: toStatus(checkRaw.mx),
    },
  };
}

/**
 * Form des eingehenden PATCH-Teilobjekts (alle Felder optional, ohne Passwort).
 * `dkim`/`domainCheck` sind bewusst NICHT Teil des PATCH – sie werden vom Service
 * (Schluessel-Erzeugung/Verifikation) verwaltet und ueber merge unveraendert
 * durchgereicht.
 */
export interface MailConfigPatch {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  fromEmail?: string;
  fromName?: string;
  domain?: string;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update. `dkim` und
 * `domainCheck` werden IMMER unveraendert aus `base` uebernommen (Service-verwaltet).
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
    domain: typeof patch.domain === 'string' ? normalizeDomain(patch.domain) : base.domain,
    dkim: { selector: base.dkim.selector, publicKey: base.dkim.publicKey },
    domainCheck: { ...base.domainCheck },
  };
}

/**
 * Validiert die Konfiguration fuer den SCHREIB-Pfad (PATCH). Nur wenn der eigene
 * Versand AKTIV ist, sind Host/Port/From Pflicht (sonst waere ein aktiver, aber
 * unbrauchbarer Versand moeglich). Deaktiviert -> keine Anforderungen.
 * Wirft BadRequestException mit klarer Meldung.
 */
export function assertMailConfigValid(cfg: MailConfig): void {
  // Domain-Format prueft der Schreibpfad unabhaengig vom aktiven Versand: eine
  // ungueltige Domain soll gar nicht erst gespeichert werden. Leer = kein Zwang.
  if (cfg.domain && !isPlausibleDomain(cfg.domain)) {
    throw new BadRequestException('Bitte eine gültige Domain angeben (z. B. dein-betrieb.de).');
  }
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
  // Nur bei GESETZTER Domain erzwingen wir die Ausrichtung: die Absenderadresse
  // muss auf der Domain liegen (sonst greifen SPF/DKIM nicht). Ohne Domain bleibt
  // das bestehende Verhalten unveraendert (kein Bruch fuer Alt-Configs).
  if (cfg.domain) {
    const fromDomain = cfg.fromEmail.split('@')[1]?.toLowerCase() ?? '';
    if (fromDomain !== cfg.domain) {
      throw new BadRequestException(
        `Die Absender-Adresse muss auf der Domain „${cfg.domain}“ liegen (z. B. info@${cfg.domain}).`,
      );
    }
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
