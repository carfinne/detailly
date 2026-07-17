import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TenantsService, HochgeladenesLogo, MAX_LOGO_BYTES } from './tenants.service';
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
   * OHNE RolesGuard (analog me/branding) – das owner-only Pflegen der Saetze laeuft
   * weiter ueber GET/PATCH me (Konfiguration bleibt ungegatet). Der READ ist ab
   * V3 (2026-07-12) tarif-gegatet: `kalkulation` steckt in Basic/Pro, nicht in
   * Starter -> 403 PLAN_FEATURE_MISSING. Bestand/Trial ohne Tarif bzw. mit
   * `features == null` behalten Vollzugriff (PlanFeatureGuard laesst durch).
   * Liefert immer vollstaendig `{ folierungProQm, ppfProQm, aufbereitungProQm }`.
   */
  @Get('me/kalkulation')
  @UseGuards(JwtAuthGuard, PlanFeatureGuard)
  @RequiresFeature('kalkulation')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'EUR/qm-Kalkulationssaetze des eigenen Betriebs (alle Rollen, Tarif Basic+)' })
  getKalkulation(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getKalkulation(user.tenantId);
  }

  /**
   * Aufgeloeste Kalender-/Darstellungs-Einstellungen des eigenen Betriebs fuer
   * ALLE angemeldeten Rollen: die Plantafel wird von jedem Mitarbeiter genutzt und
   * braucht Arbeitszeiten/Konfliktverhalten/Slot-/Darstellungswerte. Bewusst OHNE
   * RolesGuard (analog me/branding, me/kalkulation) – das Pflegen bleibt owner-only
   * ueber GET/PATCH me. Keine sensiblen Daten (nur Kalender-Metadaten).
   */
  @Get('me/kalender-einstellungen')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kalender-/Darstellungs-Einstellungen des eigenen Betriebs (alle Rollen)' })
  getKalenderEinstellungen(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getKalenderEinstellungen(user.tenantId);
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
   * Logo des eigenen Betriebs hochladen ("Dein Look"). Nur Inhaber (gleiche
   * Guard-Kette wie GET/PATCH me). Multipart (Feld `logo`), memoryStorage – der
   * Service prueft Magic-Bytes (nur Raster PNG/JPEG/WebP, KEIN SVG) + Groesse
   * (<= 512 KB) und legt das Bild als data:-URL in tenant.logoUrl ab. tenantId aus
   * dem Token. Gedrosselt (10/min) gegen Upload-Spam. Antwort: das kuratierte
   * Betriebs-Profil (wie /tenants/me, ohne Secrets).
   */
  @Post('me/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAX_LOGO_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logo des eigenen Betriebs hochladen (PNG/JPEG/WebP, max. 512 KB)' })
  setLogo(@CurrentUser() user: AuthUser, @UploadedFile() logo?: HochgeladenesLogo) {
    return this.tenantsService.setLogo(user, logo);
  }

  /** Logo des eigenen Betriebs entfernen (setzt logoUrl auf null; nur Inhaber). */
  @Delete('me/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logo des eigenen Betriebs entfernen' })
  removeLogo(@CurrentUser() user: AuthUser) {
    return this.tenantsService.removeLogo(user);
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

  /**
   * Verifiziert die Zustellbarkeit der eigenen Mail-Domain (SPF/DKIM/MX) des
   * eigenen Betriebs (tenantId aus dem Token). Nur der Inhaber – hier wird ggf.
   * ein DKIM-Schluessel erzeugt und der Signier-Status geschaltet. Gedrosselt
   * (5/min) gegen DNS-Probing; gibt Ampel-Status + die einzutragenden DNS-Eintraege
   * zurueck, nie den privaten Schluessel.
   */
  @Post('me/mail-domain/verifizieren')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eigene Mail-Domain verifizieren (SPF/DKIM/MX)' })
  verifyMailDomain(@CurrentUser() user: AuthUser) {
    return this.tenantsService.verifyMailDomain(user.tenantId);
  }
}
