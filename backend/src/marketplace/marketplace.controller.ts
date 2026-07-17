import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TENANT_ROLLEN } from '../users/entities/user.entity';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import { CreateMarketplaceOrderDto } from './dto/marketplace.dto';
import { streameBild, streameSdb } from './marketplace-stream.util';

/**
 * Marktplatz (Kunden-Seite): Katalog ansehen, zum Haendler klicken (Affiliate)
 * oder direkt in der App bestellen. Jede BETRIEBS-Rolle darf einkaufen.
 *
 * ISOLATION: Ausdruecklich auf TENANT_ROLLEN beschraenkt (RolesGuard). Ein
 * Marktplatz-Haendler (role=haendler, tenantId=null) darf die Buy-Side NICHT
 * sehen/bedienen. Der SubscriptionGuard laesst tenantId=null bewusst durch
 * (dokumentiert) – die Rollen-Schranke ist hier die eigentliche Verteidigung.
 */
@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(...TENANT_ROLLEN)
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

  // --- Buy-Side-Auslieferung: Galerie-Bild + SDB aktiver Produkte ---
  // Jede eingeloggte BETRIEBS-Rolle (Klassen-@Roles) darf aktive Katalog-Produkte
  // sehen. Streams liefern nur Produkte aktiver, freigegebener Haendler (Service).

  @Get('products/:id/bild/:imageId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Galerie-Bild eines aktiven Produkts streamen (tenant-geschuetzt, cached)' })
  async bild(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return streameBild(res, await this.service.bildAnzeigenAktiv(id, imageId));
  }

  @Get('products/:id/sdb')
  @ApiOperation({ summary: 'Sicherheitsdatenblatt (PDF) eines aktiven Produkts herunterladen' })
  async sdb(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return streameSdb(res, await this.service.sdbAnzeigenAktiv(id));
  }
}
