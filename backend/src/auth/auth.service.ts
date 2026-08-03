import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, PLATTFORM_ROLLEN } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from '../mailer/mail.service';
import { AuditService } from '../audit/audit.service';
import { LOGIN_FAILED_ACTION } from '../incidents/incident.constants';
import { LoginGuardService } from '../security/login-guard.service';
import { SecurityEventService } from '../security/security-event.service';
import { LOGIN_LOCKED_MESSAGE, type SecurityEventType } from '../security/security.constants';
import {
  BenachrichtigungenPatch,
  mergeBenachrichtigungen,
  resolveBenachrichtigungen,
} from '../common/benachrichtigungen';
import { istMfaEinrichtungErzwungen } from './mfa-policy';
import {
  AccountSecurityEvent,
  buildAccountSecurityMail,
  buildEmailChangedMail,
} from './account-security-mails';

/** Gueltigkeitsdauer eines Reset-Tokens (1 Stunde). */
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Konstanter, gueltiger bcrypt-Hash (Cost 12 – wie hashPassword) fuer die
 * Timing-Haertung: bei UNBEKANNTER/inaktiver E-Mail wird gegen diesen Dummy
 * verglichen, damit "Konto existiert" nicht am Antwortzeit-Unterschied (bcrypt
 * laeuft vs. laeuft nicht) ablesbar ist (User-Enumeration ueber Timing).
 */
const DUMMY_BCRYPT_HASH = '$2a$12$cRGQsNRvKlaiy3OfAkPqtOHMceAPVxfC8j1xrfpWC63mD8D5wH7ai';

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
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    // @Optional: bestehende Unit-Tests konstruieren AuthService mit 6 Positions-
    // args (ohne Audit). In der App wird der (globale) AuditService injiziert.
    @Optional() private readonly audit?: AuditService,
    // Sentinel Teil 1: In-Memory-Fehlversuchs-Sperre + Security-Event-Log.
    // Ebenfalls @Optional (Rueckwaerts-Kompat der Positions-Konstruktion in Tests);
    // in der App liefert die DI beide aus dem SecurityModule.
    @Optional() private readonly loginGuard?: LoginGuardService,
    @Optional() private readonly securityEvents?: SecurityEventService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const { user, valid } = await this.verifyCredentials(email, password);
    return valid ? user : null;
  }

  /**
   * EIN einziger Nutzer-Lookup (per E-Mail, OHNE isActive im WHERE – isActive wird
   * im Code geprueft). Liefert den gefundenen Nutzer (auch bei falschem Passwort/
   * deaktiviert) UND das Gueltig-Flag. So gibt es KEINEN zweiten, isActive-
   * abhaengigen Lookup mehr (der ein Timing-/Existenz-Orakel fuer deaktivierte
   * Konten waere) und der Login-Pfad kennt fuer das Erkennungssignal ohnehin den
   * tenantId des versuchten Kontos.
   */
  private async verifyCredentials(
    email: string,
    password: string,
  ): Promise<{ user: User | null; valid: boolean }> {
    // Gleiche Normalisierung wie bei der Registrierung, damit ein Login mit
    // abweichender Gross-/Kleinschreibung auch bei case-sensitiver DB-Collation
    // funktioniert.
    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !user.isActive) {
      // Timing-Haertung (Enumeration): auch ohne Konto einen bcrypt-Vergleich
      // gegen einen KONSTANTEN Hash ausfuehren, damit bekannte vs. unbekannte/
      // inaktive E-Mail nicht an der Antwortzeit unterscheidbar sind.
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return { user: user ?? null, valid: false };
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    return { user, valid };
  }

  async login(email: string, password: string, ip?: string, socketIp?: string) {
    // Sentinel Teil 1: Sperre VOR dem bcrypt-Vergleich pruefen (spart CPU bei
    // laufendem Angriff). Gesperrt -> generische 429 (kein Lockout-/Enumeration-
    // Leak: verraet NICHT, ob das Konto existiert oder speziell gesperrt ist).
    // socketIp (echter TCP-Peer) steuert die haertungssichere Loopback-Ausnahme.
    if (this.loginGuard?.isBlocked(ip, email, { socketIp }).blocked) {
      throw new HttpException(LOGIN_LOCKED_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }

    const { user, valid } = await this.verifyCredentials(email, password);
    if (!valid || !user) {
      // Datenpannen-Erkennung (Signal 2): fehlgeschlagenen Login best-effort
      // protokollieren – fire-and-forget, blockiert den Login-Fluss nie. Der
      // tenantId stammt aus DEMSELBEN Lookup (kein zweiter DB-Read).
      this.emitLoginFailed(email, user?.tenantId ?? null);
      // Sentinel Teil 1: Fehlversuch auf Konto- + IP-Zaehler registrieren und als
      // Security-Event protokollieren (fire-and-forget, emailHash statt Klartext).
      this.registerLoginFailure(ip, email, user, 'login_fail', socketIp);
      throw new UnauthorizedException('Ungueltige Anmeldedaten');
    }

    // Zweistufig: ist 2FA aktiv, gibt es KEIN Voll-JWT und KEIN lastLoginAt –
    // nur ein kurzlebiges mfaPending-Token fuer POST /auth/mfa/verify. Die
    // Konto-Sperre wird hier BEWUSST NICHT zurueckgesetzt: der 2FA-Schritt ist
    // noch offen, damit begrenzt die Sperre auch das 2FA-Brute-Forcing (Reset
    // erst nach vollstaendigem Abschluss in MfaService.finishLogin).
    if (user.totpEnabled) {
      return this.buildMfaPendingResult(user);
    }

    // Vollstaendig authentifiziert (kein 2FA) -> Konto-Sperre zuruecksetzen +
    // IP-Zaehler entlasten (NAT-Freischaltung).
    this.loginGuard?.registerSuccess(ip, email, { socketIp });

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    const flags = await this.mfaPolicyFlags(user);
    const auth = this.buildAuthResult(user);
    // mfaPflicht MIT in das user-Objekt der Login-Antwort legen (nicht nur als
    // Top-Level-Flag): das Frontend uebernimmt res.user DIREKT als aktuellen
    // Nutzer (auth.tsx: `res.user ?? /auth/me`) und wertet damit die 2FA-Gate-
    // Bedingung (user.mfaPflicht && !user.mfaEnabled) ohne Reload/zweiten /auth/me-
    // Roundtrip aus. Ohne dieses Feld liefe ein erzwungener Nutzer nach dem Login
    // (Soft-Nav, kein AuthProvider-Remount) am Gate vorbei ins Dashboard.
    return {
      ...auth,
      user: { ...auth.user, mfaPflicht: !!flags.mfaSetupPflicht },
      ...flags,
    };
  }

  /**
   * Best-effort-Signal fuer die Datenpannen-Erkennung: ein fehlgeschlagener Login
   * wird – sofern die E-Mail einem Betrieb zuordenbar ist – im Audit-Stream
   * vermerkt (der periodische Auswerter erkennt daraus Brute-Force). Die E-Mail
   * wird NUR als SHA-256-Hash abgelegt (kein Klartext). Ohne zuordenbaren Betrieb
   * (tenantId null) wird NICHTS geschrieben (kein Datensubjekt betroffen).
   *
   * Fire-and-forget (KEIN await): `audit.log` ist best-effort und wirft nie – der
   * Login darf hierdurch weder verzoegert noch gestoert werden.
   */
  private emitLoginFailed(email: string, tenantId: string | null): void {
    if (!this.audit || !tenantId) return;
    const emailHash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    void this.audit.log({
      tenantId,
      action: LOGIN_FAILED_ACTION,
      entityType: 'Auth',
      payload: { emailHash },
    });
  }

  /**
   * Sentinel: ist die (IP, E-Mail)-Kombination bzw. die IP aktuell gesperrt?
   * Von MfaService.verify genutzt, damit 2FA-Fehlversuche derselben Sperre
   * unterliegen wie Passwort-Fehlversuche. `socketIp` (echter TCP-Peer) steuert
   * die haertungssichere Loopback-Ausnahme.
   */
  isLoginBlocked(ip: string | undefined, email: string, socketIp?: string): boolean {
    return this.loginGuard?.isBlocked(ip, email, { socketIp }).blocked ?? false;
  }

  /**
   * Sentinel: erfolgreicher Auth-Abschluss -> Konto-Sperre zuruecksetzen +
   * reinen IP-Zaehler entlasten (NAT-Freischaltung).
   */
  registerLoginSuccess(ip: string | undefined, email: string, socketIp?: string): void {
    this.loginGuard?.registerSuccess(ip, email, { socketIp });
  }

  /**
   * Registriert einen fehlgeschlagenen Auth-Versuch (Login ODER 2FA) auf dem
   * In-Memory-Guard und protokolliert ihn als Security-Event. Vollstaendig
   * fire-and-forget: der Guard ist synchron/in-memory, `record()` wirft nie ->
   * der Auth-Fluss wird nie blockiert oder gestoert. Von MfaService.verify
   * mitgenutzt (2FA-Fehlversuche zaehlen auf denselben Zaehler ein).
   *
   * Die E-Mail wird an `record()` nur zur internen Hash-Bildung uebergeben
   * (emailHash) – NIE als Klartext gespeichert.
   */
  registerLoginFailure(
    ip: string | undefined,
    email: string,
    user: User | null,
    type: SecurityEventType,
    socketIp?: string,
  ): void {
    // Defense-in-Depth: die gesamte Abwehr-Buchung ist best-effort. Selbst ein
    // unerwartet werfender Collaborator (Guard/Event-Log) darf den Auth-Fluss NIE
    // ersetzen/blockieren – der Aufrufer wirft danach seine eigene 401.
    try {
      const res = this.loginGuard?.registerFailure(ip, email, { socketIp });
      const base = {
        ip: ip ?? null,
        email,
        userId: user?.id ?? null,
        tenantId: user?.tenantId ?? null,
      };
      // Basis-Ereignis (Fehlversuch) – Zaehlerstaende als nicht-sensibler Kontext.
      this.securityEvents?.record({
        ...base,
        type,
        severity: 'info',
        details: res ? { accountCount: res.accountCount, ipCount: res.ipCount } : null,
      });
      // Genau bei ERREICHEN einer neuen Sperr-Stufe ein zusaetzliches Lockout-
      // Ereignis (nicht bei jedem Folgeversuch -> kein Spam). Reine-IP-Sperre gilt
      // als kritischer (verteiltes Stuffing).
      if (res && (res.accountNewTier || res.ipNewTier)) {
        this.securityEvents?.record({
          ...base,
          type: 'login_lockout',
          severity: res.ipNewTier ? 'critical' : 'warn',
          details: {
            scope: res.ipNewTier ? 'ip' : 'account',
            accountCount: res.accountCount,
            ipCount: res.ipCount,
            lockMs: res.lockMs,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Login-Abwehr-Buchung fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  /**
   * Login-Stufe 1 bei aktivem 2FA: kurzlebiges (2 min) Zwischentoken mit Claim
   * `mfa:true`. Es oeffnet ausschliesslich POST /auth/mfa/verify (die JwtStrategy
   * lehnt `mfa:true` an geschuetzten Routen ab).
   */
  buildMfaPendingResult(user: User) {
    const mfaToken = this.jwtService.sign({ sub: user.id, mfa: true }, { expiresIn: '2m' });
    return { mfaErforderlich: true, mfaToken };
  }

  /**
   * Rollout-Flags fuer die Login-/Profil-Antwort (nur relevant, solange 2FA NICHT
   * aktiv ist). Seit der Pilot-Haertung ist 2FA fuer die betroffenen Nutzer
   * SERVERSEITIG erzwungen (JwtAuthGuard, siehe istMfaEinrichtungErzwungen) – die
   * Flags spiegeln daher genau diese Pflicht:
   *   - Plattform-Rollen -> mfaSetupPflicht (hart, unabhaengig vom Tenant),
   *   - Betriebs-Rollen unter Tenant-`mfaPflicht` -> mfaSetupPflicht.
   * `mfaSetupEmpfohlen` bleibt aus Rueckwaerts-Kompatibilitaet im Typ, wird aber
   * nicht mehr gesetzt (die frueher „nur empfohlene" Plattform-2FA ist jetzt
   * Pflicht). Das Frontend lenkt bei Pflicht auf die Einrichtung.
   */
  async mfaPolicyFlags(
    user: User,
  ): Promise<{ mfaSetupPflicht?: boolean; mfaSetupEmpfohlen?: boolean }> {
    if (user.totpEnabled) return {};
    if (await istMfaEinrichtungErzwungen(user, this.tenantRepo)) {
      return { mfaSetupPflicht: true };
    }
    return {};
  }

  /**
   * Baut die Standard-Login-Antwort (JWT + reduziertes User-Objekt) fuer einen
   * bereits verifizierten Benutzer. Einzige Quelle der Wahrheit fuer das
   * Token-Payload-Format; wird von login() und der Self-Registrierung genutzt.
   */
  buildAuthResult(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      // Marktplatz-Haendler-Bindung (nur bei role=haendler gesetzt, sonst null).
      dealerId: user.dealerId ?? null,
      // JWT-Revocation: aktueller Stand des Session-Zaehlers (s. JwtStrategy).
      tv: user.tokenVersion ?? 0,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        // Frontend-Routing (Haendler -> eigenes Portal statt Betriebs-Dashboard).
        dealerId: user.dealerId ?? null,
        emailVerified: !!user.emailVerifiedAt,
        mfaEnabled: !!user.totpEnabled,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // ---------------------------------------------------------------------------
  // Eigenes Profil (Self-Service fuer alle Rollen)
  // ---------------------------------------------------------------------------

  /** Kuratierte Profil-Sicht (nie passwordHash/stundenlohn/totpSecret). */
  private toOwnProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      role: user.role,
      tenantId: user.tenantId,
      emailVerified: !!user.emailVerifiedAt,
      mfaEnabled: !!user.totpEnabled,
      // Benachrichtigungs-Praeferenzen (Welle 3-A): immer vollstaendig aufgeloest
      // (fehlend/Altbestand -> alle Kategorien AN). Speist die Glocke im Frontend.
      benachrichtigungen: resolveBenachrichtigungen(user.benachrichtigungen),
    };
  }

  /**
   * Eigenes Profil lesen (Quelle: DB, nicht nur das JWT). Reichert die 2FA-
   * Rollout-Flags an: `mfaPflicht` (Betriebs-Rolle unter Tenant-Pflicht) bzw.
   * `mfaEmpfohlen` (Plattform-Rolle) – Grundlage fuer Banner/Erzwingung im Frontend.
   */
  async getOwnProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    const flags = await this.mfaPolicyFlags(user);
    return {
      ...this.toOwnProfile(user),
      mfaPflicht: !!flags.mfaSetupPflicht,
      mfaEmpfohlen: !!flags.mfaSetupEmpfohlen,
    };
  }

  /**
   * Eigenes Profil aktualisieren: nur Name/Telefon. Namen werden nie geleert
   * (Pflichtangaben auf Belegen/Auswertungen), Telefon darf entfernt werden.
   */
  async updateOwnProfile(userId: string, dto: { firstName?: string; lastName?: string; phone?: string }) {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    if (dto.firstName !== undefined) user.firstName = dto.firstName.trim() || user.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName.trim() || user.lastName;
    if (dto.phone !== undefined) user.phone = (dto.phone.trim() || null) as unknown as string;
    await this.userRepository.save(user);
    return this.toOwnProfile(user);
  }

  /**
   * Benachrichtigungs-Praeferenzen des eigenen Nutzers pflegen (Welle 3-A, alle
   * Rollen). Teil-Update ueber die bestehende (aufgeloeste) Konfiguration; nicht
   * angegebene Kategorien bleiben unveraendert. Default bleibt AN – nur ein
   * explizites false schaltet eine Kategorie ab.
   */
  async updateBenachrichtigungen(userId: string, patch: BenachrichtigungenPatch) {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    const base = resolveBenachrichtigungen(user.benachrichtigungen);
    user.benachrichtigungen = mergeBenachrichtigungen(base, patch);
    await this.userRepository.save(user);
    return this.getOwnProfile(userId);
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

    // Ab hier ist die Token-Ausstellung fuer den oeffentlichen wie den Betreiber-
    // Pfad identisch (der EINE sichere Reset-Mechanismus).
    await this.issueResetToken(user);
    this.logger.log(`Passwort-Reset angefordert fuer userId=${user.id}`);
  }

  /**
   * Stellt ein frisches Reset-Token aus und versendet den Link. Kern des sicheren
   * Reset-Mechanismus, geteilt von der oeffentlichen Anforderung
   * (`requestPasswordReset`) und der Betreiber-Ausloesung
   * (`adminInitiatePasswordReset`): alte Tokens des Nutzers werden zuerst geloescht
   * (nur ein gueltiges Token gleichzeitig), gespeichert wird NUR der SHA-256-Hash
   * (nie der Rohwert), der Rohwert steckt einzig im Mail-Link. KEIN Klartext-
   * Passwort wird gesetzt oder zurueckgegeben.
   */
  private async issueResetToken(user: User): Promise<void> {
    // Aufraeumen: alte Tokens des Nutzers loeschen (Hygiene + nur ein gueltiges
    // Token). Erst HIER entwerten – nie auf dem Cooldown-No-op-Pfad.
    await this.resetRepo.delete({ userId: user.id });

    const raw = crypto.randomBytes(32).toString('base64url'); // 256 Bit Entropie
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.resetRepo.save(
      this.resetRepo.create({ userId: user.id, tokenHash: this.hashToken(raw), expiresAt }),
    );

    const link = `${this.appBaseUrl()}/passwort-zuruecksetzen?token=${raw}`;
    // Fire-and-forget: der Aufrufer wartet NICHT auf den SMTP-Round-Trip
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
  }

  /**
   * Betreiber-ausgeloester Passwort-Reset (Cockpit, nur PLATFORM_*). Triggert den
   * BESTEHENDEN sicheren Reset-Mechanismus fuer einen konkreten (aktiven) Nutzer:
   * es wird ein Reset-Token generiert und die Reset-Mail versendet. Es wird NIEMALS
   * ein Klartext-Passwort gesetzt oder zurueckgegeben. Anders als der oeffentliche
   * Pfad OHNE Enumeration-Tarnung/Cooldown – der Betreiber kennt den Nutzer bereits
   * und loest bewusst aus; ein unbekannter/inaktiver Nutzer -> 404 (klare Rueckmeldung).
   *
   * BESCHRAENKUNG: NUR fuer Tenant-Nutzer (Nicht-Plattform-Rolle). Ein Betreiber
   * darf keinen Reset fuer einen ANDEREN Plattform-Account ausloesen (das wuerde
   * dessen aktiven Reset-Link entwerten und entspraeche nicht der dokumentierten
   * „nur Tenant-Nutzer"-Grenze). Plattform-Ziel -> 404 (wie „nicht gefunden").
   */
  async adminInitiatePasswordReset(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user || PLATTFORM_ROLLEN.includes(user.role)) {
      throw new NotFoundException('Nutzer nicht gefunden oder inaktiv');
    }
    await this.issueResetToken(user);
    this.logger.log(`Passwort-Reset durch Betreiber ausgeloest fuer userId=${user.id}`);
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
    // JWT-Revocation zusaetzlich zum passwordChangedAt-Zeitvergleich: der atomare
    // Increment (SET tokenVersion = tokenVersion + 1) entwertet alle frueher
    // ausgestellten Voll-JWTs auch unabhaengig von der iat-Sekundengranularitaet.
    await this.userRepository.increment({ id: user.id }, 'tokenVersion', 1);

    // Restliche offene Tokens des Nutzers entwerten (Defense-in-Depth).
    await this.resetRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    this.logger.log(`Passwort zurueckgesetzt fuer userId=${user.id}`);

    // Paket 1: Sicherheits-Benachrichtigung an den Nutzer. Deckt BEIDE Wege ab,
    // denn „Passwort aendern" im Frontend loest denselben Reset-Fluss aus
    // (Einstellungen -> POST /auth/password-reset/request). Fire-and-forget:
    // ein Mail-/SMTP-Problem darf den erfolgreichen Reset NIE nachtraeglich kippen.
    this.notifyAccountSecurityEvent(user, 'passwort_geaendert');
  }

  // ---------------------------------------------------------------------------
  // Paket 1/2: Sicherheits-Benachrichtigung + "Auf allen Geraeten abmelden"
  // ---------------------------------------------------------------------------

  /**
   * Verschickt die Sicherheits-Benachrichtigung an den betroffenen Nutzer und
   * protokolliert das Ereignis im (tenant-gebundenen) Audit-Trail. IMMER
   * fire-and-forget: der ausloesende Vorgang (Passwort-Reset, 2FA-An/Aus,
   * „ueberall abmelden") darf durch fehlenden SMTP oder einen Mailfehler NIE
   * scheitern (Muster: orders.sendStatusMail / issueResetToken). KEIN Link in der
   * Mail (Anti-Phishing). Kein Konto-Verrat: die Methode wird nur mit einem real
   * existierenden, geladenen Nutzer aufgerufen – sie loest selbst KEINEN Lookup
   * ueber eine (evtl. nicht existierende) Fremdadresse aus.
   */
  notifyAccountSecurityEvent(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'tenantId'>,
    event: AccountSecurityEvent,
  ): void {
    const { subject, text } = buildAccountSecurityMail(event, {
      firstName: user.firstName,
      when: new Date(),
    });
    // Konto-/Plattform-Mail -> bewusst OHNE tenantId (Plattform-Absender), damit
    // ein Sicherheitshinweis nie ueber den betriebseigenen SMTP des womoeglich
    // uebernommenen Kontos laeuft.
    void this.mail
      .send({ to: user.email, subject, text })
      .catch((err) =>
        this.logger.warn(`Sicherheits-Benachrichtigung fehlgeschlagen: ${err?.message ?? err}`),
      );
    this.auditAccountSecurity(user, event);
  }

  /**
   * Sicherheits-Benachrichtigung bei E-Mail-Aenderung an BEIDE Adressen (alt +
   * neu): so bemerkt ein Opfer die Uebernahme auch dann, wenn der Angreifer die
   * Adresse bereits umgestellt hat. Ebenfalls strikt fire-and-forget.
   *
   * HINWEIS: Es existiert derzeit KEIN Self-Service zur E-Mail-Aenderung (das
   * Profil-Update aendert nur Name/Telefon; die Adresse ist im Frontend read-only).
   * Diese Methode ist der fertige, getestete Einhaengepunkt fuer eine kuenftige
   * E-Mail-Aenderung – s. Bericht (eine bestaetigte Aenderung braeuchte eine
   * pendingEmail-Spalte = Schema-Aenderung, die gerade einem anderen Agenten gehoert).
   */
  notifyEmailChanged(
    user: Pick<User, 'id' | 'firstName' | 'tenantId'>,
    altEmail: string,
    neuEmail: string,
  ): void {
    const when = new Date();
    for (const ziel of ['alt', 'neu'] as const) {
      const to = ziel === 'alt' ? altEmail : neuEmail;
      const { subject, text } = buildEmailChangedMail({
        firstName: user.firstName,
        when,
        altEmail,
        neuEmail,
        ziel,
      });
      void this.mail
        .send({ to, subject, text })
        .catch((err) =>
          this.logger.warn(`E-Mail-Aenderungs-Hinweis fehlgeschlagen: ${err?.message ?? err}`),
        );
    }
    this.auditAccountSecurity({ id: user.id, tenantId: user.tenantId }, 'email_geaendert');
  }

  /**
   * Protokolliert das Konto-Sicherheitsereignis im tenant-gebundenen Audit-Trail
   * (sichtbar im „Audit"-Tab der Einstellungen). Bewusst der Audit-Trail statt des
   * plattformweiten security_events-Logs: Letzteres kennt nur Brute-Force-/Scan-
   * Typen (geschlossene Union, Datei gehoert der parallelen Login-Guard-Arbeit) –
   * s. Bericht. Fire-and-forget: audit.log faengt Fehler selbst ab und wirft nie.
   */
  private auditAccountSecurity(
    user: { id: string; tenantId: string | null },
    event: AccountSecurityEvent | 'email_geaendert',
  ): void {
    // TypeORM-0.3-Falle vermeiden: ohne tenantId NICHT schreiben (kein
    // where/save mit tenantId=undefined/null als „Treffer alle").
    if (!this.audit || !user.tenantId) return;
    void this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: `security_${event}`,
      entityType: 'Auth',
      entityId: user.id,
    });
  }

  /**
   * Paket 2: „Auf allen Geraeten abmelden". Erhoeht atomar die tokenVersion des
   * eigenen Nutzers -> die JwtStrategy lehnt danach ALLE frueher ausgestellten
   * Voll-JWTs ab (inkl. der aktuellen Session). Zusaetzlich Sicherheits-
   * Benachrichtigung + Audit. Nur fuer den eigenen (aktiven) Nutzer aufrufbar.
   */
  async logoutEverywhere(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    await this.userRepository.increment({ id: user.id }, 'tokenVersion', 1);
    this.logger.log(`Alle Sessions beendet (ueberall abmelden) fuer userId=${user.id}`);
    this.notifyAccountSecurityEvent(user, 'ueberall_abgemeldet');
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
