import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MarketplaceService } from './marketplace.service';
import { OrderStatusDto, PortalProductDto, UpdatePortalProductDto } from './dto/marketplace.dto';
import { HochgeladenesDokument } from './kyb.service';
import {
  MAX_BILD_BYTES,
  MAX_BILDER_PRO_PRODUKT,
  MAX_SDB_BYTES,
} from './marketplace-upload.service';
import { streameBild, streameSdb } from './marketplace-stream.util';

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

  @Get('categories')
  @ApiOperation({
    summary: 'Aktive Kategorie-Taxonomie (Haupt- mit Unterkategorien) fuer die eigene Produktpflege',
  })
  categories() {
    // Plattform-weite, aktive Taxonomie – identisch zur Kunden-Sicht (categoryTree),
    // aber nur ueber die @Roles(HAENDLER)-Schranke dieses Controllers erreichbar. Der
    // Baum ist dealer-unabhaengig, deshalb kein dealerId-Argument.
    return this.service.categoryTree();
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

  // --- Uploads (PR3): Galerie-Bilder + SDB, hart auf eigenes Produkt gescoped ---

  @Post('products/:id/bilder')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('bilder', MAX_BILDER_PRO_PRODUKT, { limits: { fileSize: MAX_BILD_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Galerie-Bilder zum eigenen Produkt hochladen (JPEG/PNG/WebP)' })
  uploadBilder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() dateien?: HochgeladenesDokument[],
  ) {
    return this.service.portalBilderUploadById(user.dealerId, id, dateien ?? []);
  }

  @Delete('products/:id/bilder/:imageId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Galerie-Bild des eigenen Produkts loeschen' })
  deleteBild(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.service.portalBildLoeschenById(user.dealerId, id, imageId);
  }

  @Post('products/:id/sdb')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('sdb', { limits: { fileSize: MAX_SDB_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sicherheitsdatenblatt (PDF) zum eigenen Produkt hochladen' })
  uploadSdb(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() datei?: HochgeladenesDokument,
  ) {
    return this.service.portalSdbUploadById(user.dealerId, id, datei);
  }

  @Get('products/:id/bild/:imageId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Eigenes Galerie-Bild als Vorschau streamen' })
  async bild(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return streameBild(res, await this.service.portalBildAnzeigenById(user.dealerId, id, imageId));
  }

  @Get('products/:id/sdb')
  @ApiOperation({ summary: 'Eigenes Sicherheitsdatenblatt entschluesselt herunterladen' })
  async sdb(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return streameSdb(res, await this.service.portalSdbAnzeigenById(user.dealerId, id));
  }
}
