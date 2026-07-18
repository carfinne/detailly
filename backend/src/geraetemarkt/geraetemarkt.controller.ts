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
  StreamableFile,
  ParseUUIDPipe,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GeraetemarktService } from './geraetemarkt.service';
import {
  GeraeteInseratUploadService,
  HochgeladenesBild,
  MAX_BILD_BYTES,
  MAX_BILDER_PRO_INSERAT,
} from './geraete-inserat-upload.service';
import {
  CreateInseratDto,
  UpdateInseratDto,
  UpdateInseratStatusDto,
  BrowseInseratDto,
} from './dto/inserat.dto';

// Inserate anlegen/pflegen ist Leitungssache (Anschaffung/Verkauf von Ausruestung).
const VERWALTUNG = [UserRole.OWNER, UserRole.MANAGER];

/**
 * Geraete-Gebrauchtmarkt (PR1 – Fundament). Browse/Detail sehen ALLE
 * eingeloggten Betriebe (cross-tenant, kontaktfrei projiziert); Mutationen sind
 * strikt auf den eigenen Betrieb gescoped und nur der Leitung (OWNER/MANAGER)
 * erlaubt. `tenantId`/`userId` stammen IMMER aus dem JWT, nie aus dem Body.
 *
 * Guards: JwtAuthGuard (eingeloggt) + RolesGuard (@Roles nur an Mutationen).
 * KEIN SubscriptionGuard – auch ein gesperrter Betrieb darf stoebern.
 */
@ApiTags('geraetemarkt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('geraetemarkt')
export class GeraetemarktController {
  constructor(
    private readonly service: GeraetemarktService,
    private readonly uploads: GeraeteInseratUploadService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Gebrauchtmarkt durchsuchen (cross-tenant, paginiert, kontaktfrei)' })
  browse(@Query() query: BrowseInseratDto) {
    return this.service.browse(query);
  }

  @Get('meine')
  @ApiOperation({ summary: 'Eigene Inserate des Betriebs' })
  meine(@CurrentUser() user: AuthUser) {
    return this.service.findMine(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Inserat-Detail (eigenes voll, fremdes nur sichtbar + kontaktfrei)' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOnePublic(user, id);
  }

  @Post()
  @Roles(...VERWALTUNG)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Inserat anlegen (nur Leitung; gewerbliche Bestaetigung Pflicht)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInseratDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eigenes Inserat bearbeiten' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInseratDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Status des eigenen Inserats setzen (reserviert/verkauft/entfernt/aktiv)' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInseratStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Eigenes Inserat loeschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  // ---------------------------------------------------------------------------
  // Bilder (PR2). Upload/Loeschen strikt am EIGENEN Inserat (Leitung); der
  // Bild-Stream ist fuer jeden eingeloggten Tenant lesbar, aber nur bei
  // sichtbarem Inserat (bzw. dem eigenen). tenantId stammt IMMER aus dem JWT.
  // ---------------------------------------------------------------------------

  @Post('inserate/:id/bilder')
  @Roles(...VERWALTUNG)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('bilder', MAX_BILDER_PRO_INSERAT, { limits: { fileSize: MAX_BILD_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Galerie-Bilder zum eigenen Inserat hochladen (JPEG/PNG/WebP)' })
  uploadBilder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() dateien?: HochgeladenesBild[],
  ) {
    return this.uploads.bilderHochladen(user.tenantId, id, dateien ?? []);
  }

  @Delete('inserate/:id/bilder/:bildId')
  @Roles(...VERWALTUNG)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Galerie-Bild des eigenen Inserats loeschen' })
  deleteBild(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bildId', ParseUUIDPipe) bildId: string,
  ) {
    return this.uploads.bildLoeschen(user.tenantId, id, bildId);
  }

  @Get('inserate/:id/bilder/:bildId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Galerie-Bild eines sichtbaren Inserats streamen' })
  async bild(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bildId', ParseUUIDPipe) bildId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mime } = await this.uploads.bildStreamen(user.tenantId, id, bildId);
    // Bilder liegen unverschluesselt, sind aber NIE oeffentlich gemountet – die
    // Zugriffskontrolle sitzt in der Route. `private` erlaubt Browser-Caching pro
    // Nutzer (Galerie-Performance) ohne geteilte Caches; `nosniff` verhindert
    // MIME-Sniffing (SVG/HTML ist bereits per Magic-Byte ausgeschlossen).
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(stream);
  }
}
