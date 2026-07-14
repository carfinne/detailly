import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GamificationService } from './gamification.service';

/**
 * Gamification / Erfolge (Welle 1, strikt BETRIEBSINTERN). KERN-Modul: nur
 * Jwt + Subscription, KEIN Tarif-Gate – Badges/Wrapped sollen auf jeder Stufe
 * motivieren (der Wrapped-Teaser traegt zudem die Marke nach aussen).
 *
 * Ausnahme Bestenliste: enthaelt pro-Mitarbeiter Umsatz/Leistung (Fuehrungsdaten)
 * -> zusaetzlich rollen-gegatet auf OWNER/MANAGER (wie die Auswertungen).
 */
@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly service: GamificationService) {}

  @Get('achievements')
  @ApiOperation({ summary: 'Meilenstein-Badges + Leistung des Monats (betriebsintern)' })
  achievements(@CurrentUser() user: AuthUser) {
    return this.service.achievements(user.tenantId);
  }

  @Get('wrapped')
  @ApiOperation({ summary: 'Detailly Wrapped – Jahres-Zusammenfassung aus eigenen Daten' })
  wrapped(@CurrentUser() user: AuthUser, @Query('jahr') jahr?: string) {
    const parsed = jahr ? parseInt(jahr, 10) : NaN;
    const jahrZahl = Number.isFinite(parsed) ? parsed : new Date().getFullYear();
    return this.service.wrapped(user.tenantId, jahrZahl);
  }

  @Get('leaderboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mitarbeiter-Bestenliste (nur Leitung)' })
  leaderboard(@CurrentUser() user: AuthUser, @Query('zeitraum') zeitraum?: string) {
    return this.service.leaderboard(user.tenantId, zeitraum);
  }
}
