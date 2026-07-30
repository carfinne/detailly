import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import {
  User,
  UserRole,
  PLATTFORM_ROLLEN,
} from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { EmployeeInvitation, InvitationStatus } from './entities/employee-invitation.entity';
import { EmployeesService } from '../employees/employees.service';
import { MailService } from '../mailer/mail.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';

/** Gueltigkeitsdauer einer Einladung (7 Tage). */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Kuratierte Einladungs-Sicht fuer die Leitung (NIE der tokenHash). */
export interface InvitationView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  /** offen | abgelaufen (abgeleitet aus expiresAt); zurueckgezogen/eingeloest tauchen hier nicht auf. */
  status: 'offen' | 'abgelaufen';
  expiresAt: Date;
  createdAt: Date;
}

/** Oeffentliche Vorschau der Einladung (Einloese-Seite): Betrieb + Rolle. */
export interface InvitationInfo {
  betrieb: string;
  rolle: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Mitarbeiter-Einladung per E-Mail-Link.
 *
 * Sicherheits-Muster uebernommen von AuthService.issueResetToken / confirm:
 * Token erzeugen -> nur SHA-256-Hash speichern (nie Klartext) -> alte offene
 * Einladung derselben Adresse entwerten -> Mail mit Roh-Token versenden ->
 * beim Einloesen Ablauf/Single-Use atomar pruefen. Zusaetzlich:
 *  - Mitarbeiter-Limit (maxUsers) wird BEIM EINLADEN (offene Einladungen zaehlen
 *    mit -> kein Bypass ueber Vorrats-Einladungen) UND BEIM EINLOESEN (harter
 *    Gate gegen die aktiven Betriebs-Nutzer) geprueft – beide im selben per-
 *    Betrieb serialisierten Lock wie die Direkt-Anlage (EmployeesService.withSeatGuard).
 *  - Die Rolle stammt beim Einloesen AUSSCHLIESSLICH aus der Einladung.
 *  - Fehlermeldungen der oeffentlichen Endpunkte sind einheitlich und nicht
 *    verratend (kein Orakel, ob eine Adresse/Einladung existiert).
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  // Rollen-Hierarchie (kleinerer Rang = mehr Rechte). Quelle der Wahrheit ist
  // EmployeesService.ROLE_RANK; hier bewusst gespiegelt, damit die Einladungs-
  // Rang-Wache ohne Kopplung an interne Felder greift.
  private static readonly ROLE_RANK: Record<string, number> = {
    [UserRole.PLATFORM_ADMIN]: 0,
    [UserRole.PLATFORM_ANALYST]: 0,
    [UserRole.PLATFORM_SUPPORT]: 0,
    [UserRole.OWNER]: 1,
    [UserRole.MANAGER]: 2,
    [UserRole.TECHNICIAN]: 3,
    [UserRole.RECEPTIONIST]: 4,
  };

  constructor(
    @InjectRepository(EmployeeInvitation)
    private readonly invRepo: Repository<EmployeeInvitation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly employees: EmployeesService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Kleine Helfer (Muster AuthService)
  // ---------------------------------------------------------------------------

  /** SHA-256-Hex eines rohen Tokens. Gespeichert wird nur dieser Hash. */
  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Basis-URL fuer den Einladungs-Link (Mail). Fallback fuer lokale Entwicklung. */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private rank(role?: string): number {
    return role != null && role in InvitationsService.ROLE_RANK
      ? InvitationsService.ROLE_RANK[role]
      : Number.POSITIVE_INFINITY; // unbekannte Rolle = niedrigste Macht, kein Bypass
  }

  private istPlattformRolle(role?: string): boolean {
    return !!role && (PLATTFORM_ROLLEN as string[]).includes(role);
  }

  /**
   * Ebenen-Trennung + Rang-Wache fuer eine Ziel-Rolle (wie EmployeesService):
   * Ueber die (Kunden-)Einladung darf NIEMAND eine Plattform-Rolle vergeben, und
   * niemand darf jemanden mit MEHR Rechten einladen, als er selbst hat.
   */
  private assertRolleErlaubt(actor: AuthUser, zielRolle: string) {
    if (actor.role === UserRole.PLATFORM_ADMIN) return; // Detailly darf alles
    if (this.istPlattformRolle(zielRolle)) {
      throw new ForbiddenException('Plattform-Rollen können hier nicht vergeben werden.');
    }
    if (this.rank(zielRolle) < this.rank(actor.role)) {
      throw new ForbiddenException('Ziel-Rolle darf nicht hoeher als die eigene sein');
    }
  }

  /** Kuratierte Sicht (nie tokenHash). Leitet den Anzeige-Status aus dem Ablauf ab. */
  private toView(inv: EmployeeInvitation): InvitationView {
    const abgelaufen = new Date(inv.expiresAt).getTime() < Date.now();
    return {
      id: inv.id,
      email: inv.email,
      firstName: inv.firstName,
      lastName: inv.lastName,
      role: inv.role,
      status: abgelaufen ? 'abgelaufen' : 'offen',
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    };
  }

  /** Versendet den Einladungs-Link (transaktional; vom Aufrufer fire-and-forget). */
  private async sendInvitationMail(inv: EmployeeInvitation, rawToken: string, betrieb: string): Promise<void> {
    const link = `${this.appBaseUrl()}/einladung?token=${rawToken}`;
    await this.mail.send({
      // Kontoanlage-/Einladungsmail: bewusst ueber den Plattform-Default (kein
      // tenantId) – der Empfaenger hat noch KEIN Konto im Betrieb.
      to: inv.email,
      subject: `Einladung zu ${betrieb} auf Detailly`,
      text:
        `Hallo ${inv.firstName},\n\n` +
        `du wurdest eingeladen, dem Team von "${betrieb}" auf Detailly beizutreten.\n` +
        `Lege ueber diesen Link dein eigenes Passwort fest und aktiviere dein Konto ` +
        `(gueltig 7 Tage, nur einmal verwendbar):\n\n` +
        `${link}\n\n` +
        `Wenn du damit nichts anfangen kannst, ignoriere diese E-Mail einfach.`,
    });
  }

  /** Betriebsname fuer die Einladungsmail/-Vorschau (Fallback: generisch). */
  private async tenantName(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.name?.trim() || 'deinem Betrieb';
  }

  // ---------------------------------------------------------------------------
  // Leitung (OWNER/MANAGER): Einladen + Verwalten
  // ---------------------------------------------------------------------------

  /**
   * Offene Einladungen des Betriebs (tenant-scoped) fuer die Mitarbeiter-Ansicht.
   * Nur `status='offen'` (eingeloeste sind reguläre Mitarbeiter, zurueckgezogene
   * sind erledigt); abgelaufene bleiben sichtbar (Anzeige-Status 'abgelaufen')
   * und lassen sich per Erneut-Senden reaktivieren.
   */
  async list(tenantId: string): Promise<InvitationView[]> {
    const rows = await this.invRepo.find({
      where: { tenantId, status: 'offen' },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Einladung ausstellen. Erzeugt einen Token (nur Hash gespeichert), reserviert
   * einen Sitzplatz gegen maxUsers (offene Einladungen zaehlen mit) und versendet
   * die Einladungsmail. Alles im per-Betrieb serialisierten Lock (Race-Schutz),
   * damit zwei gleichzeitige Einladungen am letzten Platz das Limit nicht gemeinsam
   * ueberschreiten.
   */
  async invite(actor: AuthUser, dto: CreateInvitationDto): Promise<InvitationView> {
    this.assertRolleErlaubt(actor, dto.role);

    const email = this.normalizeEmail(dto.email);
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Vor- und Nachname sind erforderlich.');
    }

    const raw = crypto.randomBytes(32).toString('base64url'); // 256 Bit Entropie
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const betrieb = await this.tenantName(actor.tenantId);

    const saved = await this.employees.withSeatGuard(
      actor.tenantId,
      async ({ aktiveBetriebsUser, assertLimit }) => {
        // Bereits existierender Nutzer mit dieser E-Mail (GLOBAL, auch in einem
        // ANDEREN Tenant): sauber ablehnen. Ein fremdes Konto wird NIEMALS still
        // einem zweiten Betrieb zugeordnet.
        const existingUser = await this.userRepo.findOne({ where: { email } });
        if (existingUser) {
          throw new ConflictException('Diese E-Mail-Adresse gehoert bereits zu einem Konto.');
        }

        // Offene, noch gueltige Einladungen ANDERER Adressen belegen bereits je
        // einen reservierten Platz – die eigene (gleiche) Adresse wird direkt
        // darunter ersetzt und darf daher nicht doppelt zaehlen.
        const reservierteEinladungen = await this.invRepo.count({
          where: {
            tenantId: actor.tenantId,
            status: 'offen',
            usedAt: IsNull(),
            expiresAt: MoreThan(new Date()),
            email: Not(email),
          },
        });
        // Limit-Check: aktive Nutzer + reservierte Einladungen. Wirft 403
        // PLAN_LIMIT_REACHED, wenn kein Platz mehr frei ist.
        await assertLimit(aktiveBetriebsUser + reservierteEinladungen);

        // Doppelte Einladung an dieselbe Adresse: alte NICHT-eingeloeste Datensaetze
        // entfernen (Muster Reset-Token: keine Token-Ansammlung, immer nur ein
        // gueltiger Link je Adresse).
        await this.invRepo.delete({ tenantId: actor.tenantId, email, usedAt: IsNull() });

        return this.invRepo.save(
          this.invRepo.create({
            tenantId: actor.tenantId,
            email,
            firstName,
            lastName,
            role: dto.role,
            tokenHash,
            expiresAt,
            status: 'offen',
            invitedByUserId: actor.id,
          }),
        );
      },
    );

    // Fire-and-forget: die Antwort wartet NICHT auf den SMTP-Round-Trip.
    void this.sendInvitationMail(saved, raw, betrieb).catch((err) =>
      this.logger.warn(`Einladungs-Mail fehlgeschlagen: ${err?.message ?? err}`),
    );
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'invite_employee',
      entityType: 'EmployeeInvitation',
      entityId: saved.id,
      payload: { email, role: dto.role },
    });
    this.logger.log(`Einladung ausgestellt (tenant=${actor.tenantId}, id=${saved.id})`);
    return this.toView(saved);
  }

  /**
   * Einladung erneut senden: erzeugt ein FRISCHES Token (entwertet damit den alten
   * Link), verlaengert den Ablauf und versendet die Mail neu. Nur fuer offene
   * Einladungen. Kein zusaetzlicher Limit-Check (der Platz ist bereits reserviert).
   */
  async resend(actor: AuthUser, id: string): Promise<InvitationView> {
    const inv = await this.invRepo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!inv) throw new NotFoundException('Einladung nicht gefunden');
    this.assertRolleErlaubt(actor, inv.role);
    if (inv.status !== 'offen' || inv.usedAt) {
      throw new BadRequestException('Nur offene Einladungen koennen erneut gesendet werden.');
    }

    const raw = crypto.randomBytes(32).toString('base64url');
    inv.tokenHash = this.hashToken(raw);
    inv.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const saved = await this.invRepo.save(inv);
    const betrieb = await this.tenantName(actor.tenantId);

    void this.sendInvitationMail(saved, raw, betrieb).catch((err) =>
      this.logger.warn(`Einladungs-Mail (erneut) fehlgeschlagen: ${err?.message ?? err}`),
    );
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'invite_resend',
      entityType: 'EmployeeInvitation',
      entityId: saved.id,
    });
    return this.toView(saved);
  }

  /**
   * Einladung zurueckziehen: Status auf 'zurueckgezogen' + `usedAt` setzen -> der
   * Link ist tot (das Einloesen prueft status==='offen' && !usedAt). Gibt den
   * reservierten Platz sofort wieder frei. Eingeloeste Einladungen sind unantastbar.
   */
  async withdraw(actor: AuthUser, id: string): Promise<{ success: true }> {
    const inv = await this.invRepo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!inv) throw new NotFoundException('Einladung nicht gefunden');
    this.assertRolleErlaubt(actor, inv.role);
    if (inv.status === 'eingeloest') {
      throw new BadRequestException('Eingeloeste Einladungen koennen nicht zurueckgezogen werden.');
    }
    inv.status = 'zurueckgezogen' as InvitationStatus;
    inv.usedAt = inv.usedAt ?? new Date();
    await this.invRepo.save(inv);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'invite_withdraw',
      entityType: 'EmployeeInvitation',
      entityId: inv.id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Oeffentlich (ohne Login): Einloesen
  // ---------------------------------------------------------------------------

  /** Einheitliche, nicht-verratende Fehlermeldung fuer alle oeffentlichen Fehlerpfade. */
  private get ungueltig(): BadRequestException {
    return new BadRequestException(
      'Diese Einladung ist ungueltig, abgelaufen oder wurde bereits verwendet.',
    );
  }

  /** Sucht eine offene, gueltige Einladung per Roh-Token. Wirft sonst generisch (kein Orakel). */
  private async findValidByToken(rawToken: string): Promise<EmployeeInvitation> {
    if (!rawToken) throw this.ungueltig;
    const inv = await this.invRepo.findOne({ where: { tokenHash: this.hashToken(rawToken) } });
    const abgelaufen = inv ? new Date(inv.expiresAt).getTime() < Date.now() : true;
    if (!inv || inv.status !== 'offen' || inv.usedAt || abgelaufen) throw this.ungueltig;
    return inv;
  }

  /** Oeffentliche Vorschau fuer die Einloese-Seite: Betrieb + Rolle + Name. */
  async lookup(rawToken: string): Promise<InvitationInfo> {
    const inv = await this.findValidByToken(rawToken);
    const betrieb = await this.tenantName(inv.tenantId);
    return {
      betrieb,
      rolle: inv.role,
      email: inv.email,
      firstName: inv.firstName,
      lastName: inv.lastName,
    };
  }

  /**
   * Einladung einloesen (oeffentlich): der Nutzer setzt sein EIGENES Passwort; das
   * Konto wird im Tenant der Einladung angelegt und der Token einmalig verbraucht.
   *
   * SICHERHEIT:
   *  - Rolle & Tenant kommen AUSSCHLIESSLICH aus der Einladung (nie aus dem Body).
   *  - Harter maxUsers-Check im selben Lock wie die Direkt-Anlage (kein Bypass).
   *  - Single-Use: erst NACH erfolgreicher Nutzer-Anlage wird die Einladung per
   *    bedingtem UPDATE (usedAt IS NULL) geclaimt -> ein Fehlschlag (Limit,
   *    E-Mail-Kollision) verbrennt die Einladung NICHT.
   *  - E-Mail-Kollision (auch cross-tenant) fuehrt zur generischen Meldung.
   *
   * Liefert die Standard-Login-Antwort (Auto-Login, wie die Registrierung).
   */
  async accept(rawToken: string, dto: AcceptInvitationDto) {
    // Vorpruefung ausserhalb des Locks (spart bcrypt bei ungueltigem Token).
    const pre = await this.findValidByToken(rawToken);
    // bcrypt bewusst VOR dem Lock (CPU-lastig) – die Rolle wird hier NICHT beruehrt.
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const firstName = (dto.firstName?.trim() || pre.firstName).trim();
    const lastName = (dto.lastName?.trim() || pre.lastName).trim();

    const user = await this.employees.withSeatGuard(
      pre.tenantId,
      async ({ aktiveBetriebsUser, assertLimit }) => {
        // Frisch INNERHALB des Locks nachladen (Race: paralleles Einloesen/Zurueckziehen).
        const inv = await this.invRepo.findOne({ where: { id: pre.id } });
        const abgelaufen = inv ? new Date(inv.expiresAt).getTime() < Date.now() : true;
        if (!inv || inv.status !== 'offen' || inv.usedAt || abgelaufen) throw this.ungueltig;

        // HARTER Limit-Check beim Einloesen (gleiche Zaehlregel + Lock wie Direkt-Anlage).
        // Token bleibt bei 403 unverbraucht -> spaeteres Einloesen nach Platzfreigabe moeglich.
        await assertLimit(aktiveBetriebsUser);

        // E-Mail-Kollision (GLOBAL): zwischen Einladung und Einloesung koennte die
        // Adresse anderweitig registriert worden sein -> generisch ablehnen.
        const existingUser = await this.userRepo.findOne({ where: { email: inv.email } });
        if (existingUser) throw this.ungueltig;

        // Nutzer anlegen: Rolle & Tenant NUR aus der Einladung. E-Mail gilt durch
        // den Link-Klick als bestaetigt (emailVerifiedAt) – Kontrolle nachgewiesen.
        let created: User;
        try {
          created = await this.userRepo.save(
            this.userRepo.create({
              email: inv.email,
              passwordHash,
              firstName,
              lastName,
              role: inv.role as UserRole,
              tenantId: inv.tenantId,
              isActive: true,
              emailVerifiedAt: new Date(),
            }),
          );
        } catch {
          // Unique-E-Mail-Verletzung (Cross-Tenant-Race): nicht verratend, Einladung
          // NICHT verbrannt (usedAt noch NULL).
          throw this.ungueltig;
        }

        // Single-Use-Claim ERST nach erfolgreicher Anlage (atomar, bedingt).
        const claim = await this.invRepo.update(
          { id: inv.id, usedAt: IsNull() },
          { usedAt: new Date(), status: 'eingeloest' as InvitationStatus, acceptedUserId: created.id },
        );
        if (!claim.affected) {
          // Sollte im Lock nicht vorkommen (Token eindeutig, kein paralleler
          // Same-Tenant-Claim). Defensiv: als ungueltig behandeln.
          throw this.ungueltig;
        }
        return created;
      },
    );

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'invite_accept',
      entityType: 'User',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });
    this.logger.log(`Einladung eingeloest -> userId=${user.id} (tenant=${user.tenantId})`);
    // Auto-Login (wie die Registrierung): Standard-Login-Antwort.
    return this.auth.buildAuthResult(user);
  }
}
