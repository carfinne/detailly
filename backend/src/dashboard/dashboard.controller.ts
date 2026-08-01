import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Dashboard-Kennzahlen (rollenabhaengig: Geld-Kennzahlen nur fuer Leitung/Rezeption)',
  })
  stats(@CurrentUser() user: AuthUser) {
    // Rolle mitgeben: der Service liefert Geld-Kennzahlen nur an Rollen mit
    // kaufmaennischer Verantwortung aus (Feld-Level-Gating im Service, nicht nur
    // im UI — sonst waeren die Zahlen ueber die API weiter abrufbar).
    return this.service.stats(user.tenantId, user.role);
  }
}
