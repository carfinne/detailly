import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CalendarService } from './calendar.service';

/**
 * Verwaltung des eigenen Kalender-Abos (nur Inhaber). BEWUSST OHNE
 * SubscriptionGuard – auch ein gesperrter Betrieb darf seinen Abo-Link sehen.
 * Liefert NUR das Token + den Pfad; die absolute URL baut das Frontend (kennt
 * seine eigene API-Basis je Hosting).
 */
@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FRANCHISE_OWNER)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'Kalender-Abo-Token des Betriebs (erzeugt es beim ersten Mal)' })
  async info(@CurrentUser() user: AuthUser) {
    const token = await this.calendar.getOrCreateToken(user.tenantId);
    return { token, path: `/public/calendar/${token}.ics` };
  }

  @Post('regenerate')
  @ApiOperation({ summary: 'Neues Token erzeugen (altes Abo wird ungültig)' })
  async regenerate(@CurrentUser() user: AuthUser) {
    const token = await this.calendar.regenerate(user.tenantId);
    return { token, path: `/public/calendar/${token}.ics` };
  }
}
