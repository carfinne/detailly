import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { BillingService } from './billing.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateCheckoutDto } from './dto/checkout.dto';

/**
 * Self-Service-Billing fuer den Betriebsinhaber.
 *
 * WICHTIG: BEWUSST OHNE `SubscriptionGuard`. Ein bereits gesperrter Betrieb
 * (Trial abgelaufen) MUSS bezahlen koennen, um sich zu entsperren – mit dem
 * SubscriptionGuard liefe er in eine 403-/Sperrseiten-Schleife.
 * Nur Inhaber (super_admin wird vom RolesGuard automatisch zugelassen).
 */
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FRANCHISE_OWNER)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Post('checkout')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Stripe-Checkout fuer einen Tarif starten' })
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user, dto.planId, dto.interval ?? 'month');
  }

  @Post('portal')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Stripe-Customer-Portal oeffnen (verwalten/kuendigen)' })
  portal(@CurrentUser() user: AuthUser) {
    return this.billing.createPortal(user);
  }

  @Post('sync')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Abo-Stand aktiv von Stripe nachziehen' })
  async sync(@CurrentUser() user: AuthUser) {
    await this.billing.syncFromStripe(user.tenantId);
    return this.subscriptions.getMyView(user.tenantId);
  }
}
