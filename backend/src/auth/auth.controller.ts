import { Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MfaJwtGuard } from './mfa-jwt.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequestPasswordResetDto, ConfirmPasswordResetDto } from './dto/password-reset.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateBenachrichtigungenDto } from './dto/update-benachrichtigungen.dto';
import { MfaAktivierenDto, MfaVerifyDto, MfaDeaktivierenDto } from './dto/mfa.dto';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
  ) {}

  /**
   * Client-IP hinter dem Reverse-Proxy. `req.ip` respektiert `trust proxy`
   * (main.ts) -> korrekte Client-IP statt Proxy-IP; Socket-Adresse als Fallback.
   */
  private clientIp(req: Request): string {
    return (req.ip || req.socket?.remoteAddress || '').toString();
  }

  /**
   * ECHTE TCP-Peer-Adresse (nicht ueber X-Forwarded-For faelschbar). Steuert im
   * LoginGuard ALLEIN die Loopback-Ausnahme, damit ein gespooftes
   * `X-Forwarded-For: 127.0.0.1` bei nicht-loopback-Socket die Sperre nicht umgeht.
   */
  private socketIp(req: Request): string {
    return (req.socket?.remoteAddress || '').toString();
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benutzer anmelden' })
  @ApiResponse({ status: 200, description: 'Login erfolgreich' })
  @ApiResponse({ status: 401, description: 'Ungueltige Anmeldedaten' })
  @ApiResponse({ status: 429, description: 'Zu viele Versuche (temporaer gesperrt)' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      loginDto.email,
      loginDto.password,
      this.clientIp(req),
      this.socketIp(req),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aktuellen Benutzer abrufen' })
  me(@CurrentUser() user: AuthUser) {
    // Voll aus der DB geladen (inkl. Name/Telefon) - das JWT traegt nur die Kern-Claims.
    return this.authService.getOwnProfile(user.id);
  }

  /** Eigenes Profil pflegen (Name/Telefon) - fuer alle Rollen. */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eigenes Profil aktualisieren (Name/Telefon)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.authService.updateOwnProfile(user.id, dto);
  }

  /**
   * Benachrichtigungs-Praeferenzen pflegen (Welle 3-A) – welche In-App-Hinweise
   * (Glocke) der Nutzer sehen will. Fuer alle Rollen; Teil-Update. Antwort: das
   * aktualisierte eigene Profil (inkl. benachrichtigungen).
   */
  @Patch('me/benachrichtigungen')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Benachrichtigungs-Praeferenzen aktualisieren' })
  updateBenachrichtigungen(@CurrentUser() user: AuthUser, @Body() dto: UpdateBenachrichtigungenDto) {
    return this.authService.updateBenachrichtigungen(user.id, dto);
  }

  /**
   * Passwort-Reset anfordern. Antwortet IMMER mit 204 (auch bei unbekannter
   * E-Mail) -> keine Account-Enumeration. Streng gedrosselt (3/min pro IP).
   */
  @Post('password-reset/request')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Passwort-Reset per E-Mail anfordern' })
  @ApiResponse({ status: 204, description: 'Sofern ein Konto existiert, wurde eine E-Mail versendet' })
  async requestReset(@Body() dto: RequestPasswordResetDto): Promise<void> {
    await this.authService.requestPasswordReset(dto.email);
  }

  /**
   * Reset einloesen (Token aus dem Mail-Link + neues Passwort). 400 bei
   * ungueltigem/abgelaufenem Token. Gedrosselt (5/min) gegen Token-Bruteforce.
   */
  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Neues Passwort per Reset-Token setzen' })
  @ApiResponse({ status: 204, description: 'Passwort geaendert' })
  @ApiResponse({ status: 400, description: 'Token ungueltig oder abgelaufen' })
  async confirmReset(@Body() dto: ConfirmPasswordResetDto): Promise<void> {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }

  /** E-Mail-Adresse bestaetigen (Token aus dem Link). Oeffentlich, gedrosselt. */
  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'E-Mail-Adresse per Token bestaetigen' })
  @ApiResponse({ status: 204, description: 'E-Mail bestaetigt' })
  @ApiResponse({ status: 400, description: 'Token ungueltig oder abgelaufen' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(dto.token);
  }

  /** Neuen Bestaetigungs-Link anfordern (angemeldet). Gedrosselt. */
  @Post('verify-email/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bestaetigungs-E-Mail erneut senden' })
  async resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    await this.authService.resendVerification(user.id);
  }

  // ---------------------------------------------------------------------------
  // Zwei-Faktor-Authentifizierung (TOTP)
  // ---------------------------------------------------------------------------

  /**
   * Enrollment Stufe 1: Secret erzeugen (noch nicht aktiv). Liefert otpauth-URL
   * (fuer QR) + Base32-Secret zum manuellen Eintippen.
   */
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA einrichten (Secret + QR erzeugen)' })
  async mfaSetup(@CurrentUser() user: AuthUser) {
    return this.mfaService.setup(user.id);
  }

  /**
   * Enrollment Stufe 2: ersten TOTP-Code bestaetigen -> 2FA aktiv, Recovery-Codes
   * werden EINMALIG zurueckgegeben.
   */
  @Post('mfa/aktivieren')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA aktivieren (Code bestaetigen)' })
  @ApiResponse({ status: 401, description: 'Code ungueltig' })
  async mfaAktivieren(@CurrentUser() user: AuthUser, @Body() dto: MfaAktivierenDto) {
    return this.mfaService.aktivieren(user.id, dto.code);
  }

  /**
   * Zweite Login-Stufe: mfaPending-Token (Header) + TOTP- ODER Recovery-Code ->
   * echtes Voll-JWT. Eng gedrosselt (5/min); der MfaJwtGuard laesst NUR das
   * mfaPending-Token durch.
   */
  @Post('mfa/verify')
  @UseGuards(MfaJwtGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA-Login abschliessen (Code oder Recovery-Code)' })
  @ApiResponse({ status: 200, description: 'Login erfolgreich' })
  @ApiResponse({ status: 401, description: 'Code ungueltig oder Token abgelaufen' })
  @ApiResponse({ status: 429, description: 'Zu viele Versuche (temporaer gesperrt)' })
  async mfaVerify(@CurrentUser() user: AuthUser, @Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.mfaService.verify(user.id, dto, this.clientIp(req), this.socketIp(req));
  }

  /** 2FA deaktivieren: per aktuellem TOTP-Code ODER Konto-Passwort. */
  @Post('mfa/deaktivieren')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA deaktivieren (Code oder Passwort)' })
  @ApiResponse({ status: 401, description: 'Code/Passwort ungueltig' })
  async mfaDeaktivieren(@CurrentUser() user: AuthUser, @Body() dto: MfaDeaktivierenDto) {
    return this.mfaService.deaktivieren(user.id, dto);
  }
}
