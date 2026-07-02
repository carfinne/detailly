import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
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
  ProduktBildDto,
  ProvisionQueryDto,
  CreateSettlementDto,
  SettlementStatusDto,
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

  @Post('products/:id/bild')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Produktbild hochladen (Data-URL, max. 5 MB)' })
  uploadProduktbild(@Param('id') id: string, @Body() dto: ProduktBildDto) {
    return this.service.adminUploadProduktbild(id, dto.bild);
  }

  @Delete('reviews/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bewertung entfernen (Moderation); Aggregate werden neu berechnet' })
  deleteReview(@Param('id') id: string) {
    return this.service.adminDeleteReview(id);
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

  @Get('orders')
  @ApiOperation({ summary: 'Alle Marktplatz-Bestellungen (optional nach Status)' })
  listOrders(@Query('status') status?: MarketplaceOrderStatus) {
    return this.service.listAllOrders(status);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bestellstatus setzen (Betreiber-Override)' })
  setOrderStatus(@Param('id') id: string, @Body() dto: OrderStatusDto) {
    return this.service.adminSetOrderStatus(id, dto.status, {
      trackingNummer: dto.trackingNummer,
      trackingUrl: dto.trackingUrl,
    });
  }

  @Post('orders/:id/benachrichtigung')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bestell-Mail an den Haendler erneut senden (nach Zustellfehler)' })
  resendBenachrichtigung(@Param('id') id: string) {
    return this.service.resendHaendlerBenachrichtigung(id);
  }

  @Get('provisionen')
  @ApiOperation({ summary: 'Margen-Report je Haendler (Bestellungen/Umsatz/Provision/Klicks), optional Zeitraum' })
  provisionen(@Query() query: ProvisionQueryDto) {
    return this.service.provisionReport(query.von, query.bis);
  }

  @Get('provisionen/export')
  @ApiOperation({ summary: 'Provisions-Export als CSV (je Bestellung, mit Haendler-Zwischensummen)' })
  async provisionenExport(
    @Query() query: ProvisionQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.provisionExport(query.von, query.bis);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Post('abrechnungen')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Provisionsabrechnung erstellen (erfasst versendete, unabgerechnete Bestellungen)' })
  createAbrechnung(@Body() dto: CreateSettlementDto) {
    return this.service.createSettlement(dto);
  }

  @Get('abrechnungen')
  @ApiOperation({ summary: 'Alle Provisionsabrechnungen' })
  listAbrechnungen() {
    return this.service.listSettlements();
  }

  @Patch('abrechnungen/:id/status')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Abrechnungsstatus schalten (offen -> gestellt -> bezahlt)' })
  setAbrechnungStatus(@Param('id') id: string, @Body() dto: SettlementStatusDto) {
    return this.service.setSettlementStatus(id, dto.status);
  }

  @Get('abrechnungen/:id/export')
  @ApiOperation({ summary: 'Einzelabrechnung als CSV' })
  async abrechnungExport(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.settlementExport(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }
}
