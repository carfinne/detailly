import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MarketplaceService } from './marketplace.service';
import {
  CreateDealerDto,
  UpdateDealerDto,
  CreateProductDto,
  UpdateProductDto,
  OrderStatusDto,
  DealerFreigabeDto,
} from './dto/marketplace.dto';
import { MarketplaceOrderStatus } from './entities/marketplace-order.entity';

/**
 * Marktplatz-Pflege (Detailly-Team). Lesen: alle Plattform-Rollen; Pflegen:
 * Platform-Admin + -Support (Analyst read-only). Kunden-Rollen kommen ueber
 * den RolesGuard grundsaetzlich nicht rein.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST)
@Controller('platform/marketplace')
export class PlatformMarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('dealers')
  @ApiOperation({ summary: 'Alle Haendler (inkl. inaktive)' })
  listDealers() {
    return this.service.listDealers();
  }

  @Post('dealers')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Haendler anlegen' })
  createDealer(@Body() dto: CreateDealerDto) {
    return this.service.createDealer(dto);
  }

  @Patch('dealers/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Haendler bearbeiten (inkl. aktiv/inaktiv)' })
  updateDealer(@Param('id') id: string, @Body() dto: UpdateDealerDto) {
    return this.service.updateDealer(id, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Alle Produkte (inkl. inaktive)' })
  listProducts() {
    return this.service.listProducts();
  }

  @Post('products')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Produkt anlegen (mit Affiliate-Link)' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Patch('products/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Produkt bearbeiten (inkl. aktiv/inaktiv)' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Affiliate-Statistik (Klicks gesamt/30 Tage, Top-Produkte/-Haendler)' })
  stats() {
    return this.service.stats();
  }

  @Post('dealers/:id/portal-token')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Haendler-Portal-Link (neu) ausstellen - alter Token wird ungueltig' })
  issuePortalToken(@Param('id') id: string) {
    return this.service.issueUploadToken(id);
  }

  // --- Grosshaendler-Bewerbungen (Welle 3): Review nur durch den Betreiber ---

  @Post('dealers/:id/freigeben')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bewerbung freigeben (Provision anpassbar, stellt Portal-Token aus)' })
  freigeben(@Param('id') id: string, @Body() dto: DealerFreigabeDto) {
    return this.service.freigeben(id, dto.provisionSatz);
  }

  @Post('dealers/:id/ablehnen')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bewerbung ablehnen (nullt nachricht/adresse - PII-Sparsamkeit)' })
  ablehnen(@Param('id') id: string) {
    return this.service.ablehnen(id);
  }

  @Post('dealers/:id/portal-mail')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Portal-Link per Mail senden (bestaetigte Betreiber-Aktion)' })
  portalMail(@Param('id') id: string) {
    return this.service.sendPortalLinkMail(id);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Alle Marktplatz-Bestellungen (optional nach Status)' })
  listOrders(@Query('status') status?: MarketplaceOrderStatus) {
    return this.service.listAllOrders(status);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bestellstatus setzen (Betreiber-Override)' })
  setOrderStatus(@Param('id') id: string, @Body() dto: OrderStatusDto) {
    return this.service.adminSetOrderStatus(id, dto.status);
  }

  @Get('provisionen')
  @ApiOperation({ summary: 'Margen-Report je Haendler (Bestellungen/Umsatz/Provision/Klicks)' })
  provisionen() {
    return this.service.provisionReport();
  }
}
