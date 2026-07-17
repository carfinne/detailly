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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
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

  // --- Uploads (PR3): Spiegel der authentifizierten Routen, dealerId aus Token ---

  @Post(':token/products/:id/bilder')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('bilder', MAX_BILDER_PRO_PRODUKT, { limits: { fileSize: MAX_BILD_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Galerie-Bilder zum eigenen Produkt hochladen (JPEG/PNG/WebP)' })
  uploadBilder(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() dateien?: HochgeladenesDokument[],
  ) {
    return this.service.portalBilderUpload(token, id, dateien ?? []);
  }

  @Delete(':token/products/:id/bilder/:imageId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Galerie-Bild des eigenen Produkts loeschen' })
  deleteBild(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.service.portalBildLoeschen(token, id, imageId);
  }

  @Post(':token/products/:id/sdb')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('sdb', { limits: { fileSize: MAX_SDB_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sicherheitsdatenblatt (PDF) zum eigenen Produkt hochladen' })
  uploadSdb(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() datei?: HochgeladenesDokument,
  ) {
    return this.service.portalSdbUpload(token, id, datei);
  }

  @Get(':token/products/:id/bild/:imageId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Eigenes Galerie-Bild als Vorschau streamen' })
  async bild(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return streameBild(res, await this.service.portalBildAnzeigen(token, id, imageId));
  }

  @Get(':token/products/:id/sdb')
  @ApiOperation({ summary: 'Eigenes Sicherheitsdatenblatt entschluesselt herunterladen' })
  async sdb(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return streameSdb(res, await this.service.portalSdbAnzeigen(token, id));
  }
}
