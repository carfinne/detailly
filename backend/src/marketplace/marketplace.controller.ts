import { Body, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { CreateMarketplaceOrderDto } from './dto/marketplace.dto';

/**
 * Marktplatz (Kunden-Seite): Katalog ansehen, zum Haendler klicken (Affiliate)
 * oder direkt in der App bestellen. Jede Rolle darf einkaufen.
 */
@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Aktiver Katalog (Produkte + Haendler + Kategorien) in einem Aufruf' })
  catalog() {
    return this.service.catalog();
  }

  @Post('products/:id/klick')
  @ApiOperation({ summary: 'Klick zum Haendler zaehlen; liefert den Affiliate-Link' })
  klick(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.klick(user, id);
  }

  @Post('orders')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Warenkorb bestellen (wird je Haendler in Bestellungen aufgeteilt)' })
  createOrders(@CurrentUser() user: AuthUser, @Body() dto: CreateMarketplaceOrderDto) {
    return this.service.createOrders(user, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Eigene Marktplatz-Bestellungen des Betriebs' })
  myOrders(@CurrentUser() user: AuthUser) {
    return this.service.listOrdersForTenant(user.tenantId);
  }
}
