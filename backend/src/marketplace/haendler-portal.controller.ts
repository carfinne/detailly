import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MarketplaceService } from './marketplace.service';
import { OrderStatusDto, PortalProductDto, UpdatePortalProductDto } from './dto/marketplace.dto';

/**
 * OEFFENTLICHES Haendler-Portal. Zugang ausschliesslich ueber den geheimen
 * Portal-Token in der URL (Capability-Link, 192 Bit, von Plattform-Admins
 * ausgestellt/rotierbar) - bewusst OHNE eigenes Login-System.
 *
 * Sicherheit: Format-Check vor DB-Zugriff, 404 ohne Existenz-Orakel, enge
 * Drosselung gegen Token-Raten. Jeder Zugriff ist hart auf die Daten DES
 * Token-Haendlers begrenzt (dealerId kommt NIE vom Client).
 */
@ApiTags('haendler-portal')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('public/haendler')
export class HaendlerPortalController {
  constructor(private readonly service: MarketplaceService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Portal-Uebersicht (Profil + eigene Produkte + Bestellungen)' })
  overview(@Param('token') token: string) {
    return this.service.portalOverview(token);
  }

  @Post(':token/products')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Eigenes Produkt einstellen' })
  createProduct(@Param('token') token: string, @Body() dto: PortalProductDto) {
    return this.service.portalCreateProduct(token, dto);
  }

  @Patch(':token/products/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Eigenes Produkt bearbeiten (inkl. aktiv/inaktiv)' })
  updateProduct(
    @Param('token') token: string,
    @Param('id') id: string,
    @Body() dto: UpdatePortalProductDto,
  ) {
    return this.service.portalUpdateProduct(token, id, dto);
  }

  @Patch(':token/orders/:id/status')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Status einer eigenen Bestellung setzen (bestaetigt/versendet/storniert)' })
  setOrderStatus(
    @Param('token') token: string,
    @Param('id') id: string,
    @Body() dto: OrderStatusDto,
  ) {
    return this.service.portalSetOrderStatus(token, id, dto.status);
  }
}
