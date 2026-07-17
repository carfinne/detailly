import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { MfaVerifyDto, MfaDeaktivierenDto } from './dto/mfa.dto';
import { generateTotpSecret, verifyTotp, buildOtpauthUrl } from './totp';
import { isSqlite } from '../common/database.types';
import { LOGIN_LOCKED_MESSAGE } from '../security/security.constants';

/** Anzahl der bei Aktivierung ausgestellten Einmal-Wiederherstellungscodes. */
const RECOVERY_CODE_COUNT = 10;

/**
 * 2FA-/TOTP-Logik: Enrollment, Aktivierung, zweite Login-Stufe (verify) und
 * Deaktivierung. Trennt die auth-kritische MFA-Mechanik sauber vom uebrigen
 * AuthService; nutzt fuer das finale Voll-JWT dessen buildAuthResult().
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  /** Einheitliches 401 fuer alle Verify-/Deaktivieren-Fehler (kein Oracle). */
  private get ungueltig(): UnauthorizedException {
    return new UnauthorizedException('Ungueltiger Code');
  }

  /** Laedt einen aktiven Nutzer inkl. der select:false-Spalten (Secret/Recovery). */
  private async loadWithSecrets(userId: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('u')
      .addSelect(['u.totpSecret', 'u.recoveryCodes', 'u.passwordHash'])
      .where('u.id = :id', { id: userId })
      .andWhere('u.isActive = :active', { active: true })
      .getOne();
  }

  /** Normalisiert einen Recovery-Code (Trennzeichen/Whitespace weg, klein). */
  private normalizeRecovery(code: string): string {
    return (code ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }

  /** SHA-256-Hex des normalisierten Recovery-Codes (nur der Hash wird gespeichert). */
  private hashRecovery(code: string): string {
    return crypto.createHash('sha256').update(this.normalizeRecovery(code)).digest('hex');
  }

  /** Konstantzeit-Vergleich zweier Hex-Strings gleicher Laenge. */
  private timingSafeHexEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  }

  /** Erzeugt Klartext-Recovery-Codes im Format `xxxxx-xxxxx` (10 Hex-Zeichen). */
  private generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = crypto.randomBytes(5).toString('hex'); // 10 Hex-Zeichen
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return codes;
  }

  // ---------------------------------------------------------------------------
  // Enrollment
  // ---------------------------------------------------------------------------

  /**
   * Stufe 1 des Enrollments: erzeugt ein neues Secret (noch NICHT aktiv) und
   * liefert otpauth-URL (QR) + Base32-Secret zum manuellen Eintippen. Ein bereits
   * aktives 2FA wird nicht ueberschrieben (erst deaktivieren).
   */
  async setup(userId: string): Promise<{ otpauthUrl: string; secretBase32: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) {
      throw new BadRequestException('Die Zwei-Faktor-Authentifizierung ist bereits aktiv.');
    }
    const secretBase32 = generateTotpSecret();
    await this.userRepository.update(user.id, { totpSecret: secretBase32 });
    return { otpauthUrl: buildOtpauthUrl(user.email, secretBase32), secretBase32 };
  }

  /**
   * Stufe 2 des Enrollments: verifiziert den ersten TOTP-Code gegen das im Setup
   * erzeugte Secret. Bei Erfolg wird 2FA aktiviert und es werden einmalig
   * Recovery-Codes im Klartext zurueckgegeben (danach nur noch als Hash gespeichert).
   *
   * Nebenwirkung (bewusst): tokenVersion wird inkrementiert -> die JwtStrategy
   * lehnt alle FRUEHER ausgestellten Voll-JWTs ab. So werden beim Aktivieren von
   * 2FA bestehende Fremd-Sessions entwertet ("2FA an = andere Geraete abgemeldet").
   * Das schliesst die aktivierende Session selbst ein -> Response-Flag
   * `neuAnmeldenErforderlich` signalisiert dem Frontend die noetige Neuanmeldung.
   * (passwordChangedAt bleibt bewusst unberuehrt -> rein Passwort-Semantik.)
   */
  async aktivieren(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[]; neuAnmeldenErforderlich: true }> {
    const user = await this.loadWithSecrets(userId);
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) {
      throw new BadRequestException('Die Zwei-Faktor-Authentifizierung ist bereits aktiv.');
    }
    if (!user.totpSecret) {
      throw new BadRequestException('Bitte zuerst die Einrichtung starten.');
    }
    if (!verifyTotp(user.totpSecret, code)) {
      throw this.ungueltig;
    }
    const plain = this.generateRecoveryCodes();
    const hashes = plain.map((c) => this.hashRecovery(c));
    await this.userRepository.update(user.id, { totpEnabled: true, recoveryCodes: hashes });
    // Entwertet bestehende Voll-JWTs (inkl. dieser Session) via JwtStrategy-Check.
    await this.userRepository.increment({ id: user.id }, 'tokenVersion', 1);
    this.logger.log(`2FA aktiviert fuer userId=${user.id}`);
    return { recoveryCodes: plain, neuAnmeldenErforderlich: true };
  }

  // ---------------------------------------------------------------------------
  // Zweite Login-Stufe
  // ---------------------------------------------------------------------------

  /**
   * Loest das kurzlebige mfaPending-Token gegen einen TOTP- ODER Recovery-Code
   * ein und liefert bei Erfolg das echte Voll-JWT. Alle Fehler enden einheitlich
   * in 401 (kein Hinweis, ob ein Secret existiert, ob 2FA aktiv ist etc.).
   * Ein benutzter Recovery-Code wird sofort invalidiert (single-use).
   */
  async verify(userId: string, dto: MfaVerifyDto, ip?: string) {
    const user = await this.loadWithSecrets(userId);
    if (!user || !user.totpEnabled || !user.totpSecret) throw this.ungueltig;

    // Sentinel Teil 1: 2FA-Fehlversuche zaehlen auf DIESELBE Sperre wie
    // Passwort-Fehlversuche. Gesperrt -> generische 429 (kein Oracle).
    if (this.authService.isLoginBlocked?.(ip, user.email)) {
      throw new HttpException(LOGIN_LOCKED_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }

    // TOTP-Code
    if (dto.code) {
      if (!verifyTotp(user.totpSecret, dto.code)) {
        this.authService.registerLoginFailure?.(ip, user.email, user, 'mfa_fail');
        throw this.ungueltig;
      }
      return this.finishLogin(user, ip);
    }

    // Recovery-Code (single-use) – ATOMAR gegen Lost-Update.
    if (dto.recoveryCode) {
      const inputHash = this.hashRecovery(dto.recoveryCode);
      // Der Verbrauch (Match finden + entfernen + schreiben) laeuft in EINER
      // Transaktion mit frischem Re-Read. Ein read-modify-write ohne Lock wuerde
      // sonst bei zwei parallelen Verifies mit VERSCHIEDENEN Codes eine Entfernung
      // ueberschreiben (Lost-Update -> ein verbrauchter Code bliebe gueltig) bzw.
      // denselben Code zweimal gelten lassen. Postgres: Zeilen-Lock
      // (pessimistic_write) serialisiert konkurrierende Verifies; SQLite kann kein
      // Lock-API und serialisiert Schreib-Transaktionen ohnehin global (gleiches
      // Muster wie invoices.acceptAngebot).
      const verbraucht = await this.userRepository.manager.transaction(async (mgr) => {
        const repo = mgr.getRepository(User);
        const qb = repo
          .createQueryBuilder('u')
          .addSelect(['u.recoveryCodes'])
          .where('u.id = :id', { id: user.id })
          .andWhere('u.isActive = :active', { active: true });
        if (!isSqlite()) qb.setLock('pessimistic_write');
        const fresh = await qb.getOne();
        if (!fresh) return false;
        const stored = Array.isArray(fresh.recoveryCodes) ? fresh.recoveryCodes : [];
        // Alle Eintraege konstantzeit vergleichen (kein Early-Return -> keine
        // Laufzeit-Abhaengigkeit davon, WELCHER Code passt).
        let matchIndex = -1;
        for (let i = 0; i < stored.length; i++) {
          if (this.timingSafeHexEqual(stored[i], inputHash)) matchIndex = i;
        }
        if (matchIndex === -1) return false;
        const rest = stored.filter((_, i) => i !== matchIndex);
        await repo.update(fresh.id, { recoveryCodes: rest });
        return true;
      });
      if (!verbraucht) {
        this.authService.registerLoginFailure?.(ip, user.email, user, 'mfa_fail');
        throw this.ungueltig;
      }
      this.logger.log(`2FA-Recovery-Code eingeloest fuer userId=${user.id}`);
      return this.finishLogin(user, ip);
    }

    // Weder Code noch Recovery-Code -> gleiches 401 (zaehlt als Fehlversuch).
    this.authService.registerLoginFailure?.(ip, user.email, user, 'mfa_fail');
    throw this.ungueltig;
  }

  /** Setzt lastLoginAt und baut das echte Voll-JWT (Quelle: AuthService). */
  private async finishLogin(user: User, ip?: string) {
    // Erfolg -> Konto-Sperre zuruecksetzen (Zaehler loeschen).
    this.authService.registerLoginSuccess?.(ip, user.email);
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    return this.authService.buildAuthResult(user);
  }

  // ---------------------------------------------------------------------------
  // Deaktivierung
  // ---------------------------------------------------------------------------

  /**
   * Deaktiviert 2FA per aktuellem TOTP-Code ODER Konto-Passwort. Loescht Secret,
   * Recovery-Codes und das Flag. Fehler enden einheitlich in 401 (kein Oracle,
   * ob ein Secret hinterlegt ist). Der tokenVersion-Increment entwertet dabei
   * bestehende Voll-JWTs (Sicherheitszustand geaendert -> Sessions neu aufbauen).
   */
  async deaktivieren(userId: string, dto: MfaDeaktivierenDto): Promise<{ success: true }> {
    const user = await this.loadWithSecrets(userId);
    if (!user) throw this.ungueltig;

    const perCode = !!dto.code && !!user.totpSecret && verifyTotp(user.totpSecret, dto.code);
    const perPasswort =
      !!dto.passwort && (await bcrypt.compare(dto.passwort, user.passwordHash));
    if (!perCode && !perPasswort) throw this.ungueltig;

    await this.userRepository.update(user.id, {
      totpEnabled: false,
      totpSecret: null,
      recoveryCodes: null,
    });
    await this.userRepository.increment({ id: user.id }, 'tokenVersion', 1);
    this.logger.log(`2FA deaktiviert fuer userId=${user.id}`);
    return { success: true };
  }
}
