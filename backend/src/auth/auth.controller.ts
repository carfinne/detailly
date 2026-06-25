import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequestPasswordResetDto, ConfirmPasswordResetDto } from './dto/password-reset.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

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
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benutzer anmelden' })
  @ApiResponse({ status: 200, description: 'Login erfolgreich' })
  @ApiResponse({ status: 401, description: 'Ungueltige Anmeldedaten' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aktuellen Benutzer abrufen' })
  me(@CurrentUser() user: AuthUser) {
    return user;
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
}
