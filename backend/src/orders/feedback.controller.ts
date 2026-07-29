import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrdersService } from './orders.service';

/**
 * Betreiber-Sicht des PRIVATEN Kunden-Feedbacks zur Uebergabe-Mappe (Welle 2-C).
 * Tenant-scoped (tenantId aus dem Token, nie aus dem Request). Empfang/Leitung –
 * NICHT Techniker (Kundenbeziehung/Reputation ist Rezeptions-/Leitungssache; gleiche
 * Rollenwahl wie der "Angebot online angenommen"-Hinweis). BEWUSST KEIN Tarif-Gate
 * auf dem Lese-Pfad: ein spaeter herabgestufter Betrieb kann bereits eingegangenes
 * Feedback weiter einsehen (der Nav-Eintrag ist im Frontend feature-gegatet).
 */
@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Privates Kunden-Feedback des eigenen Betriebs auflisten' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.listFeedback(user.tenantId);
  }

  @Patch(':id/gelesen')
  @ApiOperation({ summary: 'Feedback als gelesen markieren (tenant-sicher)' })
  markGelesen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markFeedbackGelesen(user, id);
  }
}
