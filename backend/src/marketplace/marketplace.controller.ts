import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';

/**
 * Marktplatz (Kunden-Seite): Katalog ansehen + zum Haendler klicken. Jede
 * Rolle darf einkaufen; der Klick wird fuer die Affiliate-Auswertung gezaehlt.
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
}
