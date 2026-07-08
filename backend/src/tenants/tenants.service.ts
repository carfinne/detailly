import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';

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
  assertMailConfigValid,
  mergeMailConfig,
  resolveMailConfig,
} from '../common/mail/mail-config';
import {
  KalkulationConfig,
  mergeKalkulation,
  resolveKalkulation,
} from '../common/kalkulation/kalkulation-config';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TenantEntitlements } from '../subscriptions/plan-entitlements';

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
}

/** Flache Stammdaten-Ansicht des eigenen Betriebs (fuer Formular/Anzeige). */
export interface TenantProfile {
  name: string;
  betriebstyp: Betriebstyp;
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
  // Mahnwesen (C1-C): Auto-Mahnen, Fristen, Gebuehren (defensiv mit Defaults).
  mahnwesen: MahnwesenConfig;
  // 3D-Sofortkalkulation: EUR/qm-Richtwerte je Leistung (defensiv mit Defaults 60/130/25).
  kalkulation: KalkulationConfig;
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

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

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
      betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
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
      // Mahnwesen defensiv aufloesen: fehlende Keys -> Betreiber-Defaults.
      mahnwesen: resolveMahnwesenConfig(s.mahnwesen),
      // Kalkulation defensiv aufloesen: fehlende Keys -> Defaults 60/130/25.
      kalkulation: resolveKalkulation(s.kalkulation),
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

    // Betriebseigener Mail-Versand (feat/night-email): Nicht-secret-Felder ->
    // settings.mailConfig (Teil-Update ueber die bestehende Konfig, felduebergreifend
    // validiert). Das Passwort geht NIE in settings, sondern in die verschluesselte
    // select:false-Spalte smtpPassword (leerer String = loeschen, weglassen = unveraendert).
    if (dto.mailConfig !== undefined) {
      const { pass, ...rest } = dto.mailConfig;
      const merged = mergeMailConfig(resolveMailConfig(s.mailConfig), rest);
      assertMailConfigValid(merged);
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
   * Tarif-Berechtigungen des eigenen Betriebs fuer das Frontend-Nav-Mapping
   * (`GET /tenants/me/entitlements`). Delegiert an die Subscriptions-Domaene
   * (aktiver Tarif -> rohe features[] + normalisierte Limits). tenantId stammt
   * aus dem Token; kein aktiver Tarif -> alles `null` (= Vollzugriff).
   */
  getEntitlements(tenantId: string): Promise<TenantEntitlements> {
    return this.subscriptions.getEntitlements(tenantId);
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
