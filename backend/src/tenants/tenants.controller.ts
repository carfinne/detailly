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
   * Tarif-Berechtigungen des eigenen Betriebs (planSlug/planName/features/limits)
   * fuer das Routen->Feature-Mapping (Nav-Filter) im Frontend. Bewusst OHNE
   * Rollen-/Abo-Guard – jede Rolle muss die verfuegbaren Module kennen, und auch
   * ein gesperrter Betrieb soll die Navigation korrekt rendern. Keine sensiblen
   * Daten (nur Tarif-Metadaten). `features: null` = Vollzugriff.
   */
  @Get('me/entitlements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tarif-Berechtigungen (features/limits) des eigenen Betriebs' })
  getEntitlements(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getEntitlements(user.tenantId);
  }

  /**
   * EUR/qm-Richtwerte der 3D-Sofortkalkulation fuer ALLE angemeldeten Rollen:
   * die Schadenserfassung (auch Mechaniker/Empfang) braucht die Saetze. Bewusst
   * OHNE RolesGuard (analog me/branding) – das owner-only Pflegen laeuft weiter
   * ueber GET/PATCH me. Keine sensiblen Daten. Liefert immer vollstaendig
   * `{ folierungProQm, ppfProQm, aufbereitungProQm }` (Defaults 60/130/25).
   */
  @Get('me/kalkulation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'EUR/qm-Kalkulationssaetze des eigenen Betriebs (alle Rollen)' })
  getKalkulation(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getKalkulation(user.tenantId);
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

  /**
   * Verschickt eine Test-Mail ueber die eigenen SMTP-Daten des Betriebs (an die
   * hinterlegte Absender-Adresse), damit der Betrieb seine Einstellungen pruefen
   * kann. Gedrosselt (5/min) gegen Missbrauch; gibt nur Status/Meldung zurueck,
   * nie das Passwort. OWNER + MANAGER duerfen testen.
   */
  @Post('me/mail/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eigenen Mail-Versand (SMTP) testen' })
  testMail(@CurrentUser() user: AuthUser) {
    return this.tenantsService.testMail(user.tenantId);
  }
}
