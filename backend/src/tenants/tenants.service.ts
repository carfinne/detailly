import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { resolveTxt, resolveMx } from 'dns/promises';

import { Betriebstyp, Tenant, TenantStatus } from './entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mailer/mail.service';
import { SevdeskService } from '../sevdesk/sevdesk.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  MahnwesenConfig,
  assertMahnwesenValid,
  mergeMahnwesen,
  resolveMahnwesenConfig,
} from '../common/mahnwesen/mahnwesen-config';
import {
  MailConfig,
  MailDomainCheck,
  assertMailConfigValid,
  mergeMailConfig,
  resolveMailConfig,
} from '../common/mail/mail-config';
import {
  DKIM_SELECTOR,
  DnsRecords,
  DnsResolver,
  buildDnsRecords,
  checkMailDomain,
  generateDkimKeyPair,
  type CheckStatus,
  type DomainCheckResult,
} from '../common/mail/mail-domain-check';
import {
  KalkulationConfig,
  mergeKalkulation,
  resolveKalkulation,
} from '../common/kalkulation/kalkulation-config';
import {
  KalenderConfig,
  mergeKalender,
  resolveKalender,
} from '../common/kalender/kalender-config';
import {
  BuchungConfig,
  mergeBuchung,
  resolveBuchung,
} from '../common/kalender/buchung-config';
import {
  DarstellungConfig,
  mergeDarstellung,
  resolveDarstellung,
} from '../common/darstellung/darstellung-config';
import { SteuerConfig, mergeSteuer, resolveSteuer } from '../common/steuer';
import { ImpressumConfig, mergeImpressum, resolveImpressum } from '../common/impressum';
import {
  MitgliedProfilConfig,
  mergeMitgliedProfil,
  resolveMitgliedProfil,
} from '../common/mitglied-profil';
import { ZieleConfig, mergeZiele, resolveZiele } from '../common/ziele';
import {
  BewertungConfig,
  KundenkommunikationConfig,
  mergeBewertung,
  mergeKundenkommunikation,
  resolveBewertung,
  resolveKundenkommunikation,
} from '../common/kundenkommunikation';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TenantEntitlements } from '../subscriptions/plan-entitlements';

/**
 * Entitlements-Sicht des Frontends inkl. `betriebstyp`. Erweitert die reinen
 * Tarif-Berechtigungen (`TenantEntitlements`) um den Betriebstyp aus dem Tenant –
 * der V3-Empfehlungs-Layer (2026-07-12) braucht ihn rollen-offen, um passende
 * Gewerke-Bundles vorzuschlagen. Tarif-Felder bleiben unveraendert durchgereicht.
 */
export interface TenantEntitlementsView extends TenantEntitlements {
  betriebstyp: Betriebstyp;
  /**
   * Steuer-Kurzinfo fuer ALLE Rollen (Welle 1, §19 UStG): Kalkulation/
   * Schadenserfassung/Auftrags-Detail muessen wissen, ob 0 % (Kleinunternehmer)
   * bzw. welcher Standardsatz fuer neue Belege vorbelegt wird. Bewusst NUR die
   * beiden unkritischen Felder (stehen ohnehin auf jedem Beleg) – Hinweistext/
   * Registerangaben bleiben Owner-only im Settings-GET.
   */
  steuer: { kleinunternehmer: boolean; standardMwstSatz: number };
}

/**
 * Betriebseigener Mail-Absender – Lese-Sicht fuers Formular. Enthaelt bewusst
 * NICHT das Passwort: `passSet` zeigt nur, OB eines hinterlegt ist, `passHint`
 * ist eine reine Maske (analog sevdeskTokenHint).
 */
export interface MailConfigView {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  passSet: boolean;
  passHint: string;
  // Eigene Domain (Zustellbarkeit). NIE der private DKIM-Schluessel – nur der
  // oeffentliche Key + der abgeleitete Verifikations-Status.
  domain: string;
  dkim: { selector: string; publicKey: string; configured: boolean };
  domainCheck: MailDomainCheck;
  // Die einzutragenden DNS-Eintraege (SPF-Vorlage + exakter DKIM-Eintrag), sobald
  // Domain + oeffentlicher Schluessel existieren – sonst null.
  dnsRecords: DnsRecords | null;
}

/** Antwort der Domain-Verifikation (frische Checks inkl. Klartext-Hinweisen). */
export interface MailDomainVerifyResult {
  overall: CheckStatus;
  spf: DomainCheckResult;
  dkim: DomainCheckResult;
  mx: DomainCheckResult;
  geprueftAm: string;
  dnsRecords: DnsRecords;
}

/** Flache Stammdaten-Ansicht des eigenen Betriebs (fuer Formular/Anzeige). */
export interface TenantProfile {
  name: string;
  /** Oeffentlicher Slug des Betriebs (read-only) – fuer "Öffentliche Ansicht"-Links
   *  (Impressum/Buchung). Wird im PATCH ignoriert (kein Feld im Update-DTO). */
  slug: string;
  betriebstyp: Betriebstyp;
  // Selbst hinterlegtes Logo ("Dein Look") als data:-URL bzw. null. Wird in den
  // Kundenansichten (Auftrags-Tracking, Uebergabe-Mappe) gezeigt. NIE im PATCH
  // gesendet – gepflegt ueber POST/DELETE /tenants/me/logo.
  logoUrl: string | null;
  // Eigene Akzentfarbe ("Dein Look") als 3-/6-stelliges Hex mit fuehrendem `#`;
  // leer = Branchen-Standard (resolveTenantAkzent faellt dann auf den Betriebstyp).
  akzentfarbe: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  steuernummer: string;
  ustId: string;
  iban: string;
  bic: string;
  bankname: string;
  // DATEV-Buchhaltungsexport (Stammdaten je Betrieb).
  datevBeraterNr: string;
  datevMandantNr: string;
  datevSkr: string;
  datevErloeskonto19: string;
  datevErloeskonto7: string;
  datevErloeskonto0: string;
  datevDebitorSammelkonto: string;
  // Rechnungsstellung (Standardwerte fuer neue Rechnungen).
  rechnungZahlungszielTage: string;
  rechnungFusstext: string;
  // Eigener Online-Zahlungslink fuer die oeffentliche Belegseite (T-006).
  rechnungPaymentLink: string;
  // Automatische Kunden-Mails (T-003): '1' = an (Default), '0' = aus.
  kundenmailStatus: string;
  kundenmailTerminbestaetigung: string;
  // 2FA-Pflicht fuer Betriebs-Rollen: '1' = an, sonst aus (Default). Erzwingt
  // die 2FA-Einrichtung fuer Mitarbeiter dieses Betriebs (Frontend-seitig).
  mfaPflicht: string;
  // Mahnwesen (C1-C): Auto-Mahnen, Fristen, Gebuehren (defensiv mit Defaults).
  mahnwesen: MahnwesenConfig;
  // 3D-Sofortkalkulation: EUR/qm-Richtwerte je Leistung (defensiv mit Defaults 60/130/25).
  kalkulation: KalkulationConfig;
  // Kalender-/Plantafel-Einstellungen (defensiv mit Defaults: Mo–Fr 08–18, warnen, ...).
  kalender: KalenderConfig;
  // Buchungsportal (W2): Vorlauf min/max fuer den Slot-Picker (Defaults 24 h / 60 Tage).
  buchung: BuchungConfig;
  // Darstellungs-Einstellungen der Plantafel (defensiv mit Defaults: Montag, 24h, 7–19).
  darstellung: DarstellungConfig;
  // Steuer-Einstellungen (Welle 1): §19-Kleinunternehmer, Standardsatz, Rechtsform.
  steuer: SteuerConfig;
  // Impressum-Zusatzblock (optional/sekundaer): Berufshaftpflicht + Aufsichtsbehoerde.
  // Pflichtangaben stammen aus name/anschrift/phone/email/steuer/ustId (nicht gedoppelt).
  impressum: ImpressumConfig;
  // Oeffentliches Mitglieds-Profil (Opt-in fuer die Mitgliederliste auf detailly.de):
  // zeigen + optional Stadt/Kurzbeschreibung/Webseite. Default zeigen=false.
  mitgliedProfil: MitgliedProfilConfig;
  // Ziele & Erinnerungen (Welle 1): Auslastungsziel, §19-Warnungs-Schalter,
  // selbst gepflegte Steuer-Termine. Default: alles aus (resolveZiele-Defaults).
  ziele: ZieleConfig;
  // Kundenkommunikation (Feature 1): Termin-Erinnerung an den Endkunden (Opt-in,
  // Default AUS) + Vorlaufzeit. Default: aus (resolveKundenkommunikation-Defaults).
  kundenkommunikation: KundenkommunikationConfig;
  // Bewertungs-Bitte (Feature 2): aktiv + Google-URL + optionaler Text. Wird an die
  // Abschluss-Statusmail angehaengt. Default: aus (resolveBewertung-Defaults).
  bewertung: BewertungConfig;
  // sevDesk-Integration: nur abgeleiteter Status, NIE der Token selbst.
  sevdeskConfigured: boolean;
  sevdeskTokenHint: string;
  // Betriebseigener Mail-Versand (SMTP): nie das Passwort, nur passSet/passHint.
  mailConfig: MailConfigView;
}

/** Laenge der kostenlosen Testphase fuer neu registrierte Betriebe (Tage). */
const TRIAL_DAYS = 14;

/**
 * Wandelt einen Anzeigenamen in einen URL-tauglichen, stabilen slug:
 * Umlaute ausgeschrieben, alles andere auf [a-z0-9-] reduziert. Faellt auf
 * "betrieb" zurueck, falls nichts Brauchbares uebrig bleibt.
 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'betrieb';
}

/**
 * Erkennt eine UNIQUE-Constraint-Verletzung DB-uebergreifend
 * (Postgres SQLSTATE 23505 bzw. SQLite "UNIQUE constraint failed"). Dient als
 * Backstop, falls zwei gleichzeitige Registrierungen die E-Mail-Vorpruefung
 * passieren und erst beim Insert kollidieren -> sauberer 409 statt 500.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code = (err as unknown as { code?: string }).code;
  if (code === '23505') return true; // Postgres
  return /unique/i.test(err.message); // SQLite / generisch
}

/** Hochgeladenes Logo (Multer, memoryStorage) - nur die genutzten Felder. */
export interface HochgeladenesLogo {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

/**
 * Maximale Logo-Groesse (512 KB). Das Logo wird als data:-URL in tenant.logoUrl
 * abgelegt und mit dem Betriebs-Branding ausgeliefert -> bewusst klein gehalten.
 */
export const MAX_LOGO_BYTES = 512 * 1024;

/**
 * Magic-Byte-Pruefung fuer Logo-Uploads: die dekodierten Bytes muessen wirklich
 * ein Raster-Bild sein (Schutz vor Content-Type-Spoofing / Sniff-XSS). BEWUSST
 * NUR PNG/JPEG/WebP – KEIN SVG (wird als inline data:-URL gerendert -> XSS-faehig)
 * und KEIN GIF. Liefert die MIME-Subtype fuer die data:-URL, sonst null.
 */
export function erkenneLogoTyp(b: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (b.length < 12) return null;
  // PNG-Signatur (89 50 4E 47 0D 0A 1A 0A)
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return 'png';
  }
  // JPEG (FF D8 FF)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  /**
   * DNS-Resolver fuer die Domain-Verifikation. Standard = Node `dns/promises`;
   * ueberschreibbar fuer Tests (keine echten DNS-Calls). resolveTxt/resolveMx sind
   * freistehende Funktionen (kein `this`-Binding noetig).
   */
  private dnsResolver: DnsResolver = { resolveTxt, resolveMx };

  /** Nur fuer Tests: injiziert einen gemockten DNS-Resolver. */
  setDnsResolver(resolver: DnsResolver): void {
    this.dnsResolver = resolver;
  }

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly sevdesk: SevdeskService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Stammdaten des eigenen Betriebs (Self-Service, §14)
  // ---------------------------------------------------------------------------

  /** Liest die Stammdaten des eigenen Betriebs als flaches Profil. */
  async getOwnProfile(tenantId: string): Promise<TenantProfile> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Betrieb nicht gefunden');
    const s = (t.settings ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    // Token nur zur Status-/Hint-Ableitung laden – verlaesst das Backend NIE.
    const sevToken = await this.sevdesk.loadToken(tenantId);
    // SMTP-Passwort nur zur Status-/Hint-Ableitung laden – nie im Klartext zurueck.
    const smtpPass = await this.mail.loadSmtpPassword(tenantId);
    const mailCfg = resolveMailConfig(s.mailConfig);
    return {
      name: t.name ?? '',
      slug: t.slug ?? '',
      betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
      logoUrl: t.logoUrl ?? null,
      akzentfarbe: str(s.akzentfarbe),
      email: t.email ?? '',
      phone: t.phone ?? '',
      street: t.street ?? '',
      postalCode: t.postalCode ?? '',
      city: t.city ?? '',
      country: t.country ?? 'DE',
      steuernummer: str(s.steuernummer),
      ustId: str(s.ustId),
      iban: str(s.iban),
      bic: str(s.bic),
      bankname: str(s.bankname),
      // Berater-/Mandantennummer ohne Default (muessen gepflegt werden);
      // Konten/SKR mit SKR03-Defaults vorbelegt, damit das Formular sinnvoll ist.
      datevBeraterNr: str(s.datevBeraterNr),
      datevMandantNr: str(s.datevMandantNr),
      datevSkr: str(s.datevSkr) || '03',
      datevErloeskonto19: str(s.datevErloeskonto19) || '8400',
      datevErloeskonto7: str(s.datevErloeskonto7) || '8300',
      datevErloeskonto0: str(s.datevErloeskonto0) || '8195',
      datevDebitorSammelkonto: str(s.datevDebitorSammelkonto) || '1400',
      rechnungZahlungszielTage: str(s.rechnungZahlungszielTage),
      rechnungFusstext: str(s.rechnungFusstext),
      rechnungPaymentLink: str(s.rechnungPaymentLink),
      // Default AN: ungesetzt = '1' (Versand aktiv, auch ohne UI korrekt).
      kundenmailStatus: str(s.kundenmailStatus) || '1',
      kundenmailTerminbestaetigung: str(s.kundenmailTerminbestaetigung) || '1',
      // 2FA-Pflicht: Default aus ('0'), bis der Inhaber sie aktiviert.
      mfaPflicht: str(s.mfaPflicht) || '0',
      // Mahnwesen defensiv aufloesen: fehlende Keys -> Betreiber-Defaults.
      mahnwesen: resolveMahnwesenConfig(s.mahnwesen),
      // Kalkulation defensiv aufloesen: fehlende Keys -> Defaults 60/130/25.
      kalkulation: resolveKalkulation(s.kalkulation),
      // Kalender/Darstellung defensiv aufloesen: fehlende Keys -> Defaults. WICHTIG:
      // muessen im GET mitkommen, sonst schlaegt der Round-Trip-PATCH mit
      // forbidNonWhitelisted (400) fehl, wenn das Formular sie zuruecksendet.
      kalender: resolveKalender(s.kalender),
      buchung: resolveBuchung(s.buchung),
      darstellung: resolveDarstellung(s.darstellung),
      // Steuer defensiv aufloesen: fehlender Block -> Defaults (Regelbesteuerung,
      // 19 %). Muss im GET mitkommen (forbidNonWhitelisted-Round-Trip, s. o.).
      steuer: resolveSteuer(s.steuer),
      // Impressum-Zusatzblock defensiv aufloesen: fehlender Block -> leere Defaults.
      // Muss im GET mitkommen (forbidNonWhitelisted-Round-Trip, s. o.).
      impressum: resolveImpressum(s.impressum),
      // Mitglieds-Profil defensiv aufloesen: fehlender Block -> zeigen=false.
      // Muss im GET mitkommen (forbidNonWhitelisted-Round-Trip, s. o.).
      mitgliedProfil: resolveMitgliedProfil(s.mitgliedProfil),
      // Ziele & Erinnerungen defensiv aufloesen: fehlender Block -> alles aus.
      // Muss im GET mitkommen (forbidNonWhitelisted-Round-Trip, s. o.).
      ziele: resolveZiele(s.ziele),
      // Kundenkommunikation/Bewertung defensiv aufloesen: fehlender Block -> aus.
      // Muss im GET mitkommen (forbidNonWhitelisted-Round-Trip, s. o.).
      kundenkommunikation: resolveKundenkommunikation(s.kundenkommunikation),
      bewertung: resolveBewertung(s.bewertung),
      sevdeskConfigured: Boolean(sevToken),
      sevdeskTokenHint: sevToken ? SevdeskService.maskToken(sevToken) : '',
      mailConfig: {
        enabled: mailCfg.enabled,
        host: mailCfg.host,
        port: mailCfg.port,
        secure: mailCfg.secure,
        user: mailCfg.user,
        fromEmail: mailCfg.fromEmail,
        fromName: mailCfg.fromName,
        passSet: Boolean(smtpPass),
        passHint: MailService.maskPassword(smtpPass),
        domain: mailCfg.domain,
        dkim: {
          selector: mailCfg.dkim.selector,
          publicKey: mailCfg.dkim.publicKey,
          configured: Boolean(mailCfg.dkim.publicKey),
        },
        domainCheck: mailCfg.domainCheck,
        dnsRecords:
          mailCfg.domain && mailCfg.dkim.publicKey
            ? buildDnsRecords(
                mailCfg.domain,
                mailCfg.dkim.selector || DKIM_SELECTOR,
                mailCfg.dkim.publicKey,
              )
            : null,
      },
    };
  }

  /**
   * Aktualisiert die Stammdaten des EIGENEN Betriebs (tenantId aus dem Token,
   * nie aus dem Request). Adress-/Kontaktfelder -> Spalten; Steuer-/Bankfelder
   * -> settings (genau die Keys, die das Rechnungs-PDF ausliest). Leerer String
   * loescht das jeweilige settings-Feld; andere settings-Keys bleiben erhalten.
   */
  async updateOwnProfile(user: AuthUser, dto: UpdateTenantSettingsDto): Promise<TenantProfile> {
    const t = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    if (!t) throw new NotFoundException('Betrieb nicht gefunden');

    if (dto.name !== undefined) t.name = dto.name.trim() || t.name; // Name nie leeren
    if (dto.betriebstyp !== undefined) t.betriebstyp = dto.betriebstyp;
    if (dto.email !== undefined) t.email = dto.email.trim() || null;
    if (dto.phone !== undefined) t.phone = dto.phone.trim() || null;
    if (dto.street !== undefined) t.street = dto.street.trim() || null;
    if (dto.postalCode !== undefined) t.postalCode = dto.postalCode.trim() || null;
    if (dto.city !== undefined) t.city = dto.city.trim() || null;
    if (dto.country !== undefined) t.country = dto.country.trim() || 'DE';

    const s: Record<string, unknown> = { ...((t.settings as Record<string, unknown>) ?? {}) };
    const setOrDelete = (key: string, val: string | undefined) => {
      if (val === undefined) return;
      const v = val.trim();
      if (v) s[key] = v;
      else delete s[key];
    };
    setOrDelete('steuernummer', dto.steuernummer);
    setOrDelete('ustId', dto.ustId);
    setOrDelete('iban', dto.iban);
    setOrDelete('bic', dto.bic);
    setOrDelete('bankname', dto.bankname);
    setOrDelete('datevBeraterNr', dto.datevBeraterNr);
    setOrDelete('datevMandantNr', dto.datevMandantNr);
    setOrDelete('datevSkr', dto.datevSkr);
    setOrDelete('datevErloeskonto19', dto.datevErloeskonto19);
    setOrDelete('datevErloeskonto7', dto.datevErloeskonto7);
    setOrDelete('datevErloeskonto0', dto.datevErloeskonto0);
    setOrDelete('datevDebitorSammelkonto', dto.datevDebitorSammelkonto);
    setOrDelete('rechnungZahlungszielTage', dto.rechnungZahlungszielTage);
    setOrDelete('rechnungFusstext', dto.rechnungFusstext);
    setOrDelete('rechnungPaymentLink', dto.rechnungPaymentLink);
    setOrDelete('kundenmailStatus', dto.kundenmailStatus);
    setOrDelete('kundenmailTerminbestaetigung', dto.kundenmailTerminbestaetigung);
    setOrDelete('mfaPflicht', dto.mfaPflicht);

    // Akzentfarbe ("Dein Look"): fuehrendes `#` erzwingen (der Lesepfad
    // resolveTenantAkzent verlangt es), leerer Wert loescht den Key -> zurueck auf
    // den Betriebstyp-Standard. Nicht ueber setOrDelete, weil hier normalisiert wird.
    if (dto.akzentfarbe !== undefined) {
      const hex = dto.akzentfarbe.trim();
      if (hex) s.akzentfarbe = hex.startsWith('#') ? hex : `#${hex}`;
      else delete s.akzentfarbe;
    }

    // Mahnwesen (C1-C): Teil-Update ueber die bestehende (aufgeloeste) Konfig legen,
    // felduebergreifend validieren (Fristen > 0, aufsteigend; Gebuehren >= 0) und
    // als vollstaendig normalisiertes Objekt speichern.
    if (dto.mahnwesen !== undefined) {
      const base = resolveMahnwesenConfig(s.mahnwesen);
      const merged = mergeMahnwesen(base, dto.mahnwesen);
      assertMahnwesenValid(merged);
      s.mahnwesen = merged;
    }

    // Kalkulation (3D-Sofortpreis): Teil-Update ueber die bestehende (aufgeloeste)
    // Konfig legen und als normalisiertes Objekt speichern (Cent-Rundung, >=0).
    if (dto.kalkulation !== undefined) {
      s.kalkulation = mergeKalkulation(resolveKalkulation(s.kalkulation), dto.kalkulation);
    }

    // Kalender-/Darstellungs-Einstellungen (Kalender 2.0): Teil-Update ueber die
    // bestehende (aufgeloeste) Konfig, als vollstaendig normalisiertes Objekt
    // speichern (Zeiten/Bereiche geklammert, Endstunde > Startstunde erzwungen).
    if (dto.kalender !== undefined) {
      s.kalender = mergeKalender(resolveKalender(s.kalender), dto.kalender);
    }
    // Buchungsportal (W2): gleiche Merge-Semantik. WICHTIG: erst das Speichern
    // von `kalender` (Arbeitszeiten) schaltet den Slot-Modus des Portals frei
    // (istSlotModusAktiv prueft auf gepflegte arbeitszeiten).
    if (dto.buchung !== undefined) {
      s.buchung = mergeBuchung(resolveBuchung(s.buchung), dto.buchung);
    }
    if (dto.darstellung !== undefined) {
      s.darstellung = mergeDarstellung(resolveDarstellung(s.darstellung), dto.darstellung);
    }

    // Steuer (Welle 1, §19 UStG): Teil-Update ueber die bestehende (aufgeloeste)
    // Konfig legen und als vollstaendig normalisiertes Objekt speichern.
    if (dto.steuer !== undefined) {
      s.steuer = mergeSteuer(resolveSteuer(s.steuer), dto.steuer);
    }

    // Impressum-Zusatzblock (Tenant-Impressum-Generator): Teil-Update ueber die
    // bestehende (aufgeloeste) Konfig; nur die optionalen Zusatzfelder. Die
    // Pflichtangaben werden ueber die bestehenden Felder (Adresse/steuer/ustId)
    // gepflegt – hier wird NICHTS gedoppelt.
    if (dto.impressum !== undefined) {
      s.impressum = mergeImpressum(resolveImpressum(s.impressum), dto.impressum);
    }

    // Mitglieds-Profil (Opt-in fuer die oeffentliche Mitgliederliste): Teil-Update
    // ueber die bestehende (aufgeloeste) Konfig; als normalisiertes Objekt speichern
    // (Laengen gekappt, Webseite auf sicheres http/https-Schema geprueft).
    if (dto.mitgliedProfil !== undefined) {
      s.mitgliedProfil = mergeMitgliedProfil(resolveMitgliedProfil(s.mitgliedProfil), dto.mitgliedProfil);
    }

    // Ziele & Erinnerungen (Welle 1): Teil-Update ueber die bestehende (aufgeloeste)
    // Konfig; als normalisiertes Objekt speichern (Prozent geklammert, Termin-Liste
    // auf 12 gekappt, leere Eintraege verworfen). Additiv – andere settings-Teile
    // (steuer/impressum/…) bleiben unberuehrt.
    if (dto.ziele !== undefined) {
      s.ziele = mergeZiele(resolveZiele(s.ziele), dto.ziele);
    }

    // Kundenkommunikation (Feature 1, Termin-Erinnerung): Teil-Update ueber die
    // bestehende (aufgeloeste) Konfig; als normalisiertes Objekt speichern
    // (Vorlauf geklammert). Additiv – andere settings-Teile bleiben unberuehrt.
    if (dto.kundenkommunikation !== undefined) {
      s.kundenkommunikation = mergeKundenkommunikation(
        resolveKundenkommunikation(s.kundenkommunikation),
        dto.kundenkommunikation,
      );
    }

    // Bewertungs-Bitte (Feature 2): Teil-Update ueber die bestehende (aufgeloeste)
    // Konfig; als normalisiertes Objekt speichern (URL auf sicheres https geprueft,
    // Text-Laenge gekappt). Additiv.
    if (dto.bewertung !== undefined) {
      s.bewertung = mergeBewertung(resolveBewertung(s.bewertung), dto.bewertung);
    }

    // Betriebseigener Mail-Versand (feat/night-email): Nicht-secret-Felder ->
    // settings.mailConfig (Teil-Update ueber die bestehende Konfig, felduebergreifend
    // validiert). Das Passwort geht NIE in settings, sondern in die verschluesselte
    // select:false-Spalte smtpPassword (leerer String = loeschen, weglassen = unveraendert).
    if (dto.mailConfig !== undefined) {
      const { pass, dkimRotate, ...rest } = dto.mailConfig;
      const base = resolveMailConfig(s.mailConfig);
      const merged = mergeMailConfig(base, rest);
      assertMailConfigValid(merged);
      // Domain gewechselt -> alter Verifikations-Stand ist ungueltig (das DKIM-
      // Schluesselpaar bleibt, es ist domain-unabhaengig). Zuruecksetzen, damit
      // nicht faelschlich weiter signiert wird.
      if (merged.domain !== base.domain) {
        merged.domainCheck = { verifiziert: false, geprueftAm: '', spf: 'ungeprueft', dkim: 'ungeprueft', mx: 'ungeprueft' };
      }
      // DKIM-Schluessel lazy erzeugen: sobald eine Domain gesetzt ist und noch
      // kein Key existiert (oder Rotation angefordert wurde). Neuer Key ⇒ altes
      // DNS passt nicht mehr ⇒ DKIM-Check zuruecksetzen.
      if (merged.domain && (!merged.dkim.publicKey || dkimRotate === true)) {
        const kp = generateDkimKeyPair();
        merged.dkim = { selector: DKIM_SELECTOR, publicKey: kp.publicKeyBase64 };
        t.dkimPrivateKey = kp.privateKeyPem as unknown as string;
        merged.domainCheck = { ...merged.domainCheck, verifiziert: false, dkim: 'ungeprueft' };
      }
      s.mailConfig = merged;
      if (pass !== undefined) {
        t.smtpPassword = (pass.trim() || null) as unknown as string;
      }
    }
    t.settings = s;

    // sevDesk-Token: eigene verschluesselte Spalte (nicht settings). Leer = loeschen.
    if (dto.sevdeskApiToken !== undefined) {
      t.sevdeskApiToken = (dto.sevdeskApiToken.trim() || null) as unknown as string;
    }

    await this.tenantRepo.save(t);
    // Nach Konfig-Aenderung den gecachten Betriebs-Transporter verwerfen, damit
    // der naechste Versand die neuen SMTP-Daten nutzt (Fingerprint faengt es zwar
    // auch, aber so wird ein veralteter Transporter sofort geschlossen).
    if (dto.mailConfig !== undefined) {
      this.mail.invalidateTenant(user.tenantId);
    }
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'tenant.update_profile',
      entityType: 'Tenant',
      entityId: t.id,
      // Nur die geaenderten Feldnamen protokollieren (keine Werte wie IBAN).
      payload: { fields: Object.keys(dto) },
    });
    return this.getOwnProfile(user.tenantId);
  }

  /**
   * Leichtgewichtige Branding-Sicht fuer ALLE Rollen (Theming/Anzeige):
   * Name, Logo, Betriebstyp - bewusst OHNE §14-/Bank-/Steuerdaten, deshalb
   * nicht Owner-beschraenkt. Plattform-Rollen (kein tenantId) -> Defaults.
   */
  async getBranding(
    tenantId: string | null | undefined,
  ): Promise<{ name: string; logoUrl: string | null; betriebstyp: Betriebstyp }> {
    if (!tenantId) return { name: 'Detailly', logoUrl: null, betriebstyp: Betriebstyp.KOMPLETT };
    const t = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['id', 'name', 'logoUrl', 'betriebstyp'],
    });
    if (!t) return { name: 'Detailly', logoUrl: null, betriebstyp: Betriebstyp.KOMPLETT };
    return {
      name: t.name,
      logoUrl: t.logoUrl ?? null,
      betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
    };
  }

  /**
   * Hinterlegt das Betriebs-Logo ("Dein Look"). Nimmt eine hochgeladene Datei
   * (Multer memoryStorage) entgegen, prueft Groesse (<= 512 KB) und Magic-Bytes
   * (NUR Raster PNG/JPEG/WebP – KEIN SVG, das inline als data:-URL XSS-faehig
   * waere), normalisiert sie zu einer data:-URL und speichert sie in
   * tenant.logoUrl. tenantId stammt aus dem Token (nie aus dem Request). Antwort:
   * das kuratierte Betriebs-Profil (wie /tenants/me, ohne Secrets).
   */
  async setLogo(user: AuthUser, datei?: HochgeladenesLogo): Promise<TenantProfile> {
    const buffer = datei?.buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Bitte ein Logo als PNG, JPEG oder WebP hochladen.');
    }
    if (buffer.length > MAX_LOGO_BYTES) {
      throw new BadRequestException('Das Logo ist zu groß (max. 512 KB).');
    }
    const typ = erkenneLogoTyp(buffer);
    if (!typ) {
      throw new BadRequestException('Nur PNG, JPEG oder WebP sind als Logo erlaubt.');
    }
    const t = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    if (!t) throw new NotFoundException('Betrieb nicht gefunden');
    t.logoUrl = `data:image/${typ};base64,${buffer.toString('base64')}`;
    await this.tenantRepo.save(t);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'tenant.set_logo',
      entityType: 'Tenant',
      entityId: t.id,
      // Nur Typ + Groesse protokollieren (nie die Bytes/die data:-URL).
      payload: { typ, bytes: buffer.length },
    });
    return this.getOwnProfile(user.tenantId);
  }

  /**
   * Entfernt das Betriebs-Logo (setzt tenant.logoUrl auf null). tenantId aus dem
   * Token. Antwort: das kuratierte Betriebs-Profil (wie /tenants/me).
   */
  async removeLogo(user: AuthUser): Promise<TenantProfile> {
    const t = await this.tenantRepo.findOne({ where: { id: user.tenantId } });
    if (!t) throw new NotFoundException('Betrieb nicht gefunden');
    t.logoUrl = null as unknown as string;
    await this.tenantRepo.save(t);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'tenant.remove_logo',
      entityType: 'Tenant',
      entityId: t.id,
    });
    return this.getOwnProfile(user.tenantId);
  }

  /**
   * Tarif-Berechtigungen des eigenen Betriebs fuer das Frontend-Nav-Mapping
   * (`GET /tenants/me/entitlements`). Delegiert an die Subscriptions-Domaene
   * (aktiver Tarif -> rohe features[] + normalisierte Limits) und ergaenzt den
   * `betriebstyp` aus dem Tenant fuer den V3-Empfehlungs-Layer. tenantId stammt
   * aus dem Token; kein aktiver Tarif -> Tarif-Felder `null` (= Vollzugriff),
   * `betriebstyp` faellt defensiv auf KOMPLETT zurueck.
   */
  async getEntitlements(tenantId: string): Promise<TenantEntitlementsView> {
    const [entitlements, tenant] = await Promise.all([
      this.subscriptions.getEntitlements(tenantId),
      this.tenantRepo.findOne({
        where: { id: tenantId },
        select: ['id', 'betriebstyp', 'settings'],
      }),
    ]);
    // Steuer-Kurzinfo (Welle 1, §19): nur kleinunternehmer + standardMwstSatz –
    // rollen-offen unkritisch (steht auf jedem Beleg), Rest bleibt Owner-only.
    const steuer = resolveSteuer(((tenant?.settings ?? {}) as Record<string, unknown>).steuer);
    return {
      ...entitlements,
      betriebstyp: tenant?.betriebstyp ?? Betriebstyp.KOMPLETT,
      steuer: {
        kleinunternehmer: steuer.kleinunternehmer,
        standardMwstSatz: steuer.standardMwstSatz,
      },
    };
  }

  /**
   * EUR/qm-Richtwerte der 3D-Sofortkalkulation als flaches Objekt fuer ALLE
   * Rollen (`GET /tenants/me/kalkulation`): Die Schadenserfassung (auch
   * Mechaniker/Empfang) braucht die Saetze; das Pflegen bleibt Owner-only
   * (Settings-Formular via getOwnProfile/PATCH). Defensiv aufgeloest -> immer
   * vollstaendig (fehlende Keys = Defaults 60/130/25). Tenant-scoped ueber die
   * tenantId aus dem Token.
   */
  async getKalkulation(tenantId: string): Promise<KalkulationConfig> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'settings'] });
    const s = (t?.settings ?? {}) as Record<string, unknown>;
    return resolveKalkulation(s.kalkulation);
  }

  /**
   * Aufgeloeste Kalender-/Darstellungs-Einstellungen fuer ALLE Rollen
   * (`GET /tenants/me/kalender-einstellungen`): Die Plantafel wird von jedem
   * Mitarbeiter (auch Technician/Empfang) genutzt und braucht Arbeitszeiten,
   * Konfliktverhalten, Slot-/Puffer- und Darstellungswerte. Das Pflegen bleibt
   * Owner-only (Settings-Formular via getOwnProfile/PATCH me). Defensiv aufgeloest
   * -> immer vollstaendig (fehlende Keys = Defaults). Tenant-scoped ueber die id.
   *
   * VERTRAULICH: `umsatzZielWoche` (Wochen-Umsatzziel des Chef-Layers) wird hier
   * bewusst GESTRIPPT - dieser Endpoint ist rollen-offen, das Umsatzziel ist eine
   * Leitungs-Information. Leitungsrollen bekommen es als `zielWoche` ueber den
   * gesicherten `GET /appointments/umsatz` (MANAGER/OWNER + Feature 'auswertungen').
   */
  async getKalenderEinstellungen(
    tenantId: string,
  ): Promise<{ kalender: Omit<KalenderConfig, 'umsatzZielWoche'>; darstellung: DarstellungConfig }> {
    const t = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'settings'] });
    const s = (t?.settings ?? {}) as Record<string, unknown>;
    const { umsatzZielWoche: _leitungOnly, ...kalenderOffen } = resolveKalender(s.kalender);
    return { kalender: kalenderOffen, darstellung: resolveDarstellung(s.darstellung) };
  }

  /**
   * Testet die sevDesk-Verbindung des eigenen Betriebs (tenantId aus dem Token).
   * Gibt NUR einen Status zurueck – niemals den Token oder Detailfehler.
   */
  async testSevdesk(
    tenantId: string,
  ): Promise<{ ok: boolean; message: string; companyName?: string }> {
    const token = await this.sevdesk.loadToken(tenantId);
    if (!token) return { ok: false, message: 'Kein sevDesk-Token hinterlegt.' };
    try {
      const r = await this.sevdesk.testConnection(token);
      return {
        ok: r.ok,
        message: r.ok ? 'Verbindung erfolgreich.' : 'Token ungueltig oder kein Zugriff.',
        companyName: r.companyName,
      };
    } catch {
      return { ok: false, message: 'Verbindung fehlgeschlagen.' };
    }
  }

  /**
   * Verschickt eine Test-Mail ueber die eigenen SMTP-Daten des Betriebs
   * (tenantId aus dem Token). Delegiert an den MailService, der nie das Passwort
   * preisgibt und Fehler in eine knappe, sichere Meldung uebersetzt.
   */
  async testMail(tenantId: string): Promise<{ ok: boolean; message: string }> {
    return this.mail.sendTestMail(tenantId);
  }

  /**
   * Verifiziert die Zustellbarkeit der eigenen Domain (SPF/DKIM/MX) des eigenen
   * Betriebs (tenantId aus dem Token, nie aus dem Request). Fehlt noch ein
   * DKIM-Schluessel, wird er hier erzeugt (self-healing). Das Ergebnis wird in
   * settings.mailConfig.domainCheck persistiert; `dkim==='gruen'` schaltet die
   * DKIM-Signierung ausgehender Mails frei. Der private Schluessel verlaesst das
   * Backend nie – die Antwort enthaelt nur den oeffentlichen DNS-Eintrag.
   */
  async verifyMailDomain(tenantId: string): Promise<MailDomainVerifyResult> {
    // dkimPrivateKey (select:false) laden, um festzustellen, ob schon ein Key da ist.
    const t = await this.tenantRepo
      .createQueryBuilder('t')
      .addSelect('t.dkimPrivateKey')
      .where('t.id = :id', { id: tenantId })
      .getOne();
    if (!t) throw new NotFoundException('Betrieb nicht gefunden');

    const s: Record<string, unknown> = { ...((t.settings as Record<string, unknown>) ?? {}) };
    let cfg: MailConfig = resolveMailConfig(s.mailConfig);
    if (!cfg.domain) {
      throw new BadRequestException('Bitte zuerst eine Domain hinterlegen und speichern.');
    }

    // Self-healing: fehlt der oeffentliche oder private Schluessel, jetzt erzeugen.
    if (!cfg.dkim.publicKey || !t.dkimPrivateKey) {
      const kp = generateDkimKeyPair();
      cfg = { ...cfg, dkim: { selector: DKIM_SELECTOR, publicKey: kp.publicKeyBase64 } };
      t.dkimPrivateKey = kp.privateKeyPem as unknown as string;
    }
    const selector = cfg.dkim.selector || DKIM_SELECTOR;

    const result = await checkMailDomain(cfg.domain, selector, cfg.dkim.publicKey, this.dnsResolver);
    const domainCheck: MailDomainCheck = {
      verifiziert: result.spf.status === 'gruen' && result.dkim.status === 'gruen',
      geprueftAm: result.geprueftAm,
      spf: result.spf.status,
      dkim: result.dkim.status,
      mx: result.mx.status,
    };
    s.mailConfig = { ...cfg, dkim: { selector, publicKey: cfg.dkim.publicKey }, domainCheck };
    t.settings = s;
    await this.tenantRepo.save(t);
    // Cache verwerfen -> der naechste Versand nutzt den frischen Signier-Status.
    this.mail.invalidateTenant(tenantId);

    await this.audit.log({
      tenantId,
      action: 'tenant.verify_mail_domain',
      entityType: 'Tenant',
      entityId: t.id,
      // Nur die Domain + Ampel-Ergebnisse protokollieren (keine Schluessel).
      payload: { domain: cfg.domain, spf: result.spf.status, dkim: result.dkim.status, mx: result.mx.status },
    });

    return {
      overall: result.overall,
      spf: result.spf,
      dkim: result.dkim,
      mx: result.mx,
      geprueftAm: result.geprueftAm,
      dnsRecords: buildDnsRecords(cfg.domain, selector, cfg.dkim.publicKey),
    };
  }

  /**
   * Self-Signup: legt Betrieb (Tenant) + ersten Inhaber (OWNER) +
   * Test-Abo atomar an und meldet den Inhaber direkt an (gibt ein JWT zurueck).
   *
   * Sicherheit:
   *  - Rolle ist IMMER OWNER, tenantId ist IMMER der frisch erzeugte
   *    Betrieb – nie aus dem Request uebernommen.
   *  - E-Mail global eindeutig (users.email UNIQUE): Vorpruefung fuer eine
   *    saubere 409-Meldung, DB-Constraint als harter Backstop.
   *  - Alles in EINER Transaktion: schlaegt ein Schritt fehl, bleibt keine
   *    halbe Registrierung (verwaister Tenant ohne User o. ae.) zurueck.
   */
  async register(dto: RegisterTenantDto) {
    const email = dto.email.trim().toLowerCase();

    // bcrypt (~200ms) bewusst VOR der Transaktion: haelt keine DB-Verbindung
    // waehrend des Hashings offen. Ein verschwendeter Hash im seltenen
    // Duplikat-Fall ist vernachlaessigbar.
    const passwordHash = await this.authService.hashPassword(dto.password);

    // E-Mail-Bestaetigungs-Token vorab erzeugen (nur der Hash wird gespeichert).
    const ev = this.authService.buildEmailVerification();

    const created = await this.dataSource.transaction(async (manager) => {
      // Vorpruefung INNERHALB der Transaktion -> schmales Race-Fenster; der
      // UNIQUE-Constraint auf users.email ist der eigentliche harte Schutz.
      const existing = await manager.findOne(User, { where: { email } });
      if (existing) {
        throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
      }

      const now = new Date();
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

      const slug = await this.generateUniqueSlug(manager, dto.firmenname);

      const tenant = await manager.save(
        manager.create(Tenant, {
          name: dto.firmenname.trim(),
          slug,
          email,
          phone: dto.phone?.trim() || null,
          betriebstyp: dto.betriebstyp ?? Betriebstyp.KOMPLETT,
          status: TenantStatus.TRIAL,
          trialEndsAt,
        }),
      );

      let user: User;
      try {
        user = await manager.save(
          manager.create(User, {
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role: UserRole.OWNER,
            tenantId: tenant.id,
            isActive: true,
            emailVerifiedAt: null,
            emailVerificationTokenHash: ev.tokenHash,
            emailVerificationExpiresAt: ev.expiresAt,
          }),
        );
      } catch (err) {
        // Race-Backstop: paralleler Signup gleicher E-Mail -> sauberer 409.
        // Wirft innerhalb der Transaktion -> alles (Tenant/Slug) rollt zurueck.
        if (isUniqueViolation(err)) {
          throw new ConflictException('Diese E-Mail-Adresse ist bereits registriert.');
        }
        throw err;
      }

      // Test-Abo ohne Tarif (planId bleibt offen): evaluateSubscription wertet
      // TRIAL + trialEndsAt in der Zukunft als Vollzugriff bis Ablauf.
      await manager.save(
        manager.create(Subscription, {
          tenantId: tenant.id,
          planId: null,
          status: SubscriptionStatus.TRIAL,
          trialEndsAt,
        }),
      );

      return { tenant, user };
    });

    // Nebenwirkungen NACH erfolgreichem Commit (duerfen die Registrierung nicht
    // scheitern lassen): Audit + Willkommens-Mail (best effort, Stub ohne SMTP).
    try {
      await this.audit.log({
        tenantId: created.tenant.id,
        userId: created.user.id,
        action: 'tenant.register',
        entityType: 'Tenant',
        entityId: created.tenant.id,
        payload: { slug: created.tenant.slug, email: created.user.email },
      });
    } catch (err) {
      this.logger.warn(`Audit-Log fuer Registrierung fehlgeschlagen: ${(err as Error).message}`);
    }

    // Willkommen + E-Mail-Bestaetigung (Double-Opt-in) in einem; fire-and-forget
    // (Stub ohne SMTP), darf die Registrierung nicht scheitern lassen.
    void this.authService
      .sendVerificationEmail(created.user, ev.rawToken)
      .catch((err) => this.logger.warn(`Bestaetigungs-Mail fehlgeschlagen: ${err?.message ?? err}`));

    // Direkt anmelden: dasselbe Token-/Antwortformat wie /auth/login.
    return this.authService.buildAuthResult(created.user);
  }

  /**
   * Erzeugt einen bzgl. tenants.slug eindeutigen slug. Bei Kollision wird ein
   * Zaehlersuffix angehaengt (firma, firma-2, firma-3, ...).
   */
  private async generateUniqueSlug(manager: EntityManager, name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let n = 1;
    // Obergrenze als Schutz vor Endlosschleife; in der Praxis nie erreicht.
    while (n < 1000 && (await manager.findOne(Tenant, { where: { slug } }))) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }
}
