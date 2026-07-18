import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MarketplaceService } from './marketplace.service';
import {
  CreateDealerDto,
  UpdateDealerDto,
  CreateProductDto,
  UpdateProductDto,
  OrderStatusDto,
  DealerFreigabeDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  HighlightDto,
  ReviewModerationDto,
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
  freigeben(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DealerFreigabeDto,
  ) {
    return this.service.freigeben(id, dto.provisionSatz, user.id);
  }

  @Post('dealers/:id/ablehnen')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bewerbung ablehnen (nullt nachricht/adresse - PII-Sparsamkeit)' })
  ablehnen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.ablehnen(id, user.id);
  }

  /**
   * KYB-Dokument-Vorschau (Welle 5): entschluesselt die Gewerbeanmeldung und
   * streamt sie inline. NUR Admin/Support (kein Analyst) - sensibles Dokument.
   * nosniff + no-store; die Datei liegt verschluesselt at rest und ist nie
   * oeffentlich-statisch abrufbar.
   */
  @Get('dealers/:id/dokument')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Gewerbeanmeldung (KYB) entschluesselt streamen (nur Admin/Support)' })
  async dokument(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, mime, filename } = await this.service.dokumentAnzeigen(id);
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff'); // kein MIME-Sniffing
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(buffer);
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

  // --- Betreiber-Admin (PR7): Kategorien / Highlights / Moderation / Logins ---

  @Get('categories')
  @ApiOperation({ summary: 'Kategorie-Baum inkl. inaktiver (Betreiber-Pflege)' })
  listCategories() {
    return this.service.categoryTreeAdmin();
  }

  @Post('categories')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Kategorie anlegen (Haupt-/Unterkategorie, eindeutiger Slug)' })
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto, user.id);
  }

  @Patch('categories/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Kategorie bearbeiten (name/sortIndex/aktiv/sdbPflicht/parentId)' })
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.updateCategory(id, dto, user.id);
  }

  @Delete('categories/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Kategorie deaktivieren (aktiv=false; Produkte behalten categoryId)' })
  deactivateCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deactivateCategory(id, user.id);
  }

  @Patch('products/:id/highlight')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Produkt als Highlight setzen/entfernen' })
  setHighlight(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: HighlightDto,
  ) {
    return this.service.setHighlight(id, dto.istHighlight, user.id);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Alle Bewertungen (auch inaktive) mit Produktbezug (Moderation)' })
  listReviews() {
    return this.service.listAllReviews();
  }

  @Patch('reviews/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Bewertung aus-/einblenden (danach Aggregat neu berechnen)' })
  moderateReview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewModerationDto,
  ) {
    return this.service.moderateReview(id, dto.aktiv, user.id);
  }

  @Post('dealers/:id/haendler-einladung')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Passwort-setzen-Einladung an das Haendler-Konto (erneut) senden' })
  reinviteHaendler(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.reinviteHaendler(id, user.id);
  }

  @Post('dealers/:id/haendler-deaktivieren')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Haendler-Login deaktivieren (aktive Sessions werden ungueltig)' })
  deactivateHaendler(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deactivateHaendler(id, user.id);
  }
}
