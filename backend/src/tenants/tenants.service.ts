import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';

import { Tenant, TenantStatus } from './entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mailer/mail.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** Flache Stammdaten-Ansicht des eigenen Betriebs (fuer Formular/Anzeige). */
export interface TenantProfile {
  name: string;
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
    return {
      name: t.name ?? '',
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
    t.settings = s;

    await this.tenantRepo.save(t);
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
   * Self-Signup: legt Betrieb (Tenant) + ersten Inhaber (FRANCHISE_OWNER) +
   * Test-Abo atomar an und meldet den Inhaber direkt an (gibt ein JWT zurueck).
   *
   * Sicherheit:
   *  - Rolle ist IMMER FRANCHISE_OWNER, tenantId ist IMMER der frisch erzeugte
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
            role: UserRole.FRANCHISE_OWNER,
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
