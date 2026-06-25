import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from '../mailer/mail.service';

/** Gueltigkeitsdauer eines Reset-Tokens (1 Stunde). */
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Mindestabstand zwischen zwei Reset-Anforderungen pro Nutzer (2 min). Schuetzt
 * vor Mail-Bombing (IP-unabhaengig) und verhindert, dass ein noch gueltiger Link
 * eines Nutzers durch Fremd-Anfragen staendig entwertet wird (Denial-of-Reset).
 */
const RESET_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

/** Gueltigkeitsdauer eines E-Mail-Bestaetigungs-Tokens (48 Stunden). */
const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    // Gleiche Normalisierung wie bei der Registrierung, damit ein Login mit
    // abweichender Gross-/Kleinschreibung auch bei case-sensitiver DB-Collation
    // funktioniert.
    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase(), isActive: true },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Ungueltige Anmeldedaten');
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    return this.buildAuthResult(user);
  }

  /**
   * Baut die Standard-Login-Antwort (JWT + reduziertes User-Objekt) fuer einen
   * bereits verifizierten Benutzer. Einzige Quelle der Wahrheit fuer das
   * Token-Payload-Format; wird von login() und der Self-Registrierung genutzt.
   */
  buildAuthResult(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // ---------------------------------------------------------------------------
  // Passwort-Reset ("Passwort vergessen")
  // ---------------------------------------------------------------------------

  /** SHA-256-Hex eines rohen Tokens. Gespeichert wird nur dieser Hash. */
  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Basis-URL fuer den Reset-Link (Mail). Fallback fuer lokale Entwicklung. */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  /**
   * Schritt 1: Reset anfordern. ENUMERATION-SICHER – die Methode tut nach aussen
   * IMMER dasselbe (der Controller antwortet stets 204), egal ob die E-Mail
   * existiert. Nur wenn ein aktiver Nutzer existiert, wird ein Token erzeugt und
   * eine Mail versendet. Bestehende offene Tokens werden zuerst entwertet
   * (immer nur ein gueltiger Link gleichzeitig).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalized, isActive: true },
    });
    if (!user) return;

    const now = Date.now();

    // Cooldown: existiert ein noch gueltiges, kuerzlich erzeugtes Token, NICHTS
    // tun (kein neues Token, keine Mail, KEINE Entwertung) -> Mail-Bomb- und
    // Denial-of-Reset-Schutz, IP-unabhaengig. Nach aussen weiterhin 204.
    const offen = await this.resetRepo.findOne({
      where: { userId: user.id, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (
      offen &&
      new Date(offen.expiresAt).getTime() > now &&
      new Date(offen.createdAt).getTime() > now - RESET_REQUEST_COOLDOWN_MS
    ) {
      return;
    }

    // Aufraeumen: alte Tokens des Nutzers loeschen (Hygiene + nur ein gueltiges
    // Token). Erst HIER entwerten – nie auf dem Cooldown-No-op-Pfad.
    await this.resetRepo.delete({ userId: user.id });

    const raw = crypto.randomBytes(32).toString('base64url'); // 256 Bit Entropie
    const expiresAt = new Date(now + RESET_TTL_MS);
    await this.resetRepo.save(
      this.resetRepo.create({ userId: user.id, tokenHash: this.hashToken(raw), expiresAt }),
    );

    const link = `${this.appBaseUrl()}/passwort-zuruecksetzen?token=${raw}`;
    // Fire-and-forget: die 204-Antwort wartet NICHT auf den SMTP-Round-Trip
    // (sonst Timing-/Status-Enumeration: existierende E-Mail = langsamer/500).
    // Fehler werden nur serverseitig geloggt, nie nach aussen gereicht.
    void this.mail
      .send({
        to: user.email,
        subject: 'Passwort zuruecksetzen',
        text:
          `Hallo ${user.firstName},\n\n` +
          `du (oder jemand) hat das Zuruecksetzen deines Detailly-Passworts angefordert.\n` +
          `Setze es ueber diesen Link neu (gueltig 1 Stunde, nur einmal verwendbar):\n\n` +
          `${link}\n\n` +
          `Wenn du das nicht warst, ignoriere diese E-Mail – dein Passwort bleibt unveraendert.`,
      })
      .catch((err) => this.logger.warn(`Reset-Mail fehlgeschlagen: ${err?.message ?? err}`));
    this.logger.log(`Passwort-Reset angefordert fuer userId=${user.id}`);
  }

  /**
   * Schritt 2: Reset einloesen. Single-Use wird ATOMAR erzwungen: das Token wird
   * per bedingtem UPDATE (usedAt IS NULL) "geclaimt" – nur genau ein paralleler
   * Request gewinnt (affected===1), erst danach wird das Passwort gesetzt. So ist
   * Mehrfach-Einloesung (Race) auch auf Postgres ausgeschlossen. Setzt zusaetzlich
   * passwordChangedAt -> bestehende JWTs werden entwertet.
   */
  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const ungueltig = new BadRequestException('Der Link ist ungueltig oder abgelaufen.');

    const rec = await this.resetRepo.findOne({ where: { tokenHash: this.hashToken(rawToken) } });
    const abgelaufen = rec ? new Date(rec.expiresAt).getTime() < Date.now() : true;
    if (!rec || rec.usedAt || abgelaufen) throw ungueltig;

    // Atomarer Claim: nur EIN gleichzeitiger confirm setzt usedAt (affected===1).
    const claim = await this.resetRepo.update(
      { id: rec.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!claim.affected) throw ungueltig;

    // isActive erneut pruefen: das Passwort eines gesperrten/deaktivierten Kontos
    // darf ueber den oeffentlichen Endpoint nicht manipuliert werden.
    const user = await this.userRepository.findOne({ where: { id: rec.userId, isActive: true } });
    if (!user) throw ungueltig;

    const passwordHash = await this.hashPassword(newPassword);
    await this.userRepository.update(user.id, { passwordHash, passwordChangedAt: new Date() });

    // Restliche offene Tokens des Nutzers entwerten (Defense-in-Depth).
    await this.resetRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    this.logger.log(`Passwort zurueckgesetzt fuer userId=${user.id}`);
  }

  // ---------------------------------------------------------------------------
  // E-Mail-Bestaetigung (Double-Opt-in)
  // ---------------------------------------------------------------------------

  /** Erzeugt ein neues Bestaetigungs-Token (Rohwert + zu speichernder Hash + Ablauf). */
  buildEmailVerification(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    };
  }

  /** Versendet den Bestaetigungs-Link. Vom Aufrufer fire-and-forget genutzt. */
  async sendVerificationEmail(user: User, rawToken: string): Promise<void> {
    const link = `${this.appBaseUrl()}/email-bestaetigen?token=${rawToken}`;
    await this.mail.send({
      to: user.email,
      subject: 'Bitte bestaetige deine E-Mail-Adresse',
      text:
        `Hallo ${user.firstName},\n\n` +
        `willkommen bei Detailly! Bitte bestaetige deine E-Mail-Adresse ueber diesen Link ` +
        `(gueltig 48 Stunden):\n\n${link}\n\n` +
        `Wenn du dich nicht registriert hast, ignoriere diese E-Mail.`,
    });
  }

  /**
   * Loest einen Bestaetigungs-Link ein (oeffentlich). Sucht den Nutzer per
   * Token-Hash, prueft Ablauf, setzt emailVerifiedAt und entwertet das Token.
   * Idempotent: bereits bestaetigt -> ok. 400 bei ungueltig/abgelaufen.
   */
  async verifyEmail(rawToken: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationTokenHash: this.hashToken(rawToken) },
    });
    const abgelaufen =
      user?.emailVerificationExpiresAt
        ? new Date(user.emailVerificationExpiresAt).getTime() < Date.now()
        : true;
    if (!user || abgelaufen) {
      throw new BadRequestException('Der Bestaetigungslink ist ungueltig oder abgelaufen.');
    }
    await this.userRepository.update(user.id, {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });
    this.logger.log(`E-Mail bestaetigt fuer userId=${user.id}`);
  }

  /**
   * Stellt einen neuen Bestaetigungs-Link aus (fuer den angemeldeten Nutzer).
   * No-op, wenn bereits bestaetigt. Mail fire-and-forget.
   */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;
    const ev = this.buildEmailVerification();
    await this.userRepository.update(user.id, {
      emailVerificationTokenHash: ev.tokenHash,
      emailVerificationExpiresAt: ev.expiresAt,
    });
    void this.sendVerificationEmail(user, ev.rawToken).catch((err) =>
      this.logger.warn(`Bestaetigungs-Mail fehlgeschlagen: ${err?.message ?? err}`),
    );
  }
}
