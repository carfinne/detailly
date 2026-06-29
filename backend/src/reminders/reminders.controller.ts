import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RemindersService } from './reminders.service';

/**
 * Hinweise (Glocke in der Topbar). Jede Rolle – nur Zaehler/Links, keine
 * sensiblen Inhalte; die Zielseiten regeln die eigenen Berechtigungen.
 */
@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  @Get()
  @ApiOperation({ summary: 'Aktuelle Hinweise (ueberfaellige Rechnungen, Termine heute, knappes Material)' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.tenantId);
  }
}
