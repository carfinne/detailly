import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MarketplaceService } from './marketplace.service';
import { OrderStatusDto, PortalProductDto, UpdatePortalProductDto } from './dto/marketplace.dto';

/**
 * AUTHENTIFIZIERTES Haendler-Portal (PR2): Zugang ueber ein echtes Login-Konto
 * (role=haendler, tenantId NULL, dealerId gesetzt) statt ueber den Geheim-Token.
 *
 * ISOLATION (kritisch): Ein Haendler-Prinzipal hat tenantId=null und kommt ueber
 * die Rollen-Schranke (@Roles(HAENDLER) + RolesGuard) an KEINEN Tenant-/Plattform-
 * Endpunkt. Umgekehrt scopet JEDE Query hier hart auf `req.user.dealerId` aus dem
 * JWT – NIEMALS auf einen Wert aus dem Client. Es werden dieselben
 * marketplace.service-Kernmethoden wie im Token-Portal genutzt (parametrisiert per
 * dealerId statt Token) – keine Logik-Duplikation.
 *
 * Bewusst OHNE SubscriptionGuard (Haendler haben kein Abo/keinen Tenant). Umfang
 * spiegelt das Token-Portal: Uebersicht, Produktpflege, Bestell-Status – KEINE
 * neuen Upload-Routen (die kommen in PR3).
 */
@ApiTags('haendler-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HAENDLER)
@Throttle({ default: { limit: 60, ttl: 60000 } })
@Controller('haendler-portal')
export class HaendlerPortalAuthController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Portal-Uebersicht (Profil + eigene Produkte + Bestellungen)' })
  overview(@CurrentUser() user: AuthUser) {
    return this.service.portalOverviewById(user.dealerId);
  }

  @Post('products')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Eigenes Produkt einstellen' })
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: PortalProductDto) {
    return this.service.portalCreateProductById(user.dealerId, dto);
  }

  @Patch('products/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Eigenes Produkt bearbeiten (inkl. aktiv/inaktiv)' })
  updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePortalProductDto,
  ) {
    return this.service.portalUpdateProductById(user.dealerId, id, dto);
  }

  @Patch('orders/:id/status')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Status einer eigenen Bestellung setzen (bestaetigt/versendet/storniert)' })
  setOrderStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: OrderStatusDto,
  ) {
    return this.service.portalSetOrderStatusById(user.dealerId, id, dto.status);
  }
}
