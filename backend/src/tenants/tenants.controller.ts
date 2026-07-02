import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TenantsService } from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Oeffentliche Selbst-Registrierung eines neuen Betriebs (kein Login noetig).
   * Bewusst streng gedrosselt (3/min pro IP), weil hier ohne Authentifizierung
   * Datensaetze (Tenant/User/Abo) entstehen -> Missbrauchs-/Spam-Schutz.
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neuen Betrieb registrieren (Self-Signup, Testphase)' })
  @ApiResponse({ status: 201, description: 'Betrieb angelegt, Inhaber angemeldet (JWT)' })
  @ApiResponse({ status: 409, description: 'E-Mail bereits registriert' })
  register(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.register(dto);
  }

  /**
   * Branding des eigenen Betriebs fuer ALLE angemeldeten Rollen: Name, Logo,
   * Betriebstyp (Branchen-Theming). Bewusst OHNE Rollen-/Abo-Guard - das Theme
   * muss auch fuer Techniker und bei gesperrtem Abo laden. Keine sensiblen Daten.
   */
  @Get('me/branding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Branding (Name/Logo/Betriebstyp) des eigenen Betriebs' })
  getBranding(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getBranding(user.tenantId);
  }

  /**
   * Stammdaten des EIGENEN Betriebs lesen (tenantId aus dem Token). Inhaber-Rolle,
   * da hier §14-Pflichtangaben (Steuernr/USt-IdNr) + Bankverbindung gepflegt werden.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stammdaten des eigenen Betriebs' })
  getOwn(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getOwnProfile(user.tenantId);
  }

  /** Stammdaten des eigenen Betriebs aktualisieren (nur Inhaber). */
  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stammdaten des eigenen Betriebs aktualisieren' })
  updateOwn(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantSettingsDto) {
    return this.tenantsService.updateOwnProfile(user, dto);
  }

  /**
   * Testet die sevDesk-Verbindung des eigenen Betriebs. Gedrosselt (5/min) gegen
   * Token-Probing; gibt nur einen Status zurueck, nie den Token.
   */
  @Post('me/sevdesk/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'sevDesk-Verbindung testen' })
  testSevdesk(@CurrentUser() user: AuthUser) {
    return this.tenantsService.testSevdesk(user.tenantId);
  }
}
