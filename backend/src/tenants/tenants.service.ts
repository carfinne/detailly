import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { Tenant, TenantStatus } from './entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mailer/mail.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

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
    private readonly authService: AuthService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

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

    this.mail
      .send({
        to: created.user.email,
        subject: 'Willkommen bei Detailly',
        text:
          `Hallo ${created.user.firstName},\n\n` +
          `Ihr Betrieb "${created.tenant.name}" wurde angelegt. ` +
          `Die kostenlose Testphase laeuft ${TRIAL_DAYS} Tage.\n\n` +
          `Sie koennen sich jederzeit mit Ihrer E-Mail anmelden.\n\n` +
          `Viele Gruesse\nIhr Detailly-Team`,
      })
      .catch((err) => this.logger.warn(`Willkommens-Mail fehlgeschlagen: ${err?.message ?? err}`));

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
