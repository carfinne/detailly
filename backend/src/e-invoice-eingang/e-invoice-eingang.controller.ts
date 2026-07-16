import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  EInvoiceEingangService,
  HochgeladeneEingangsDatei,
  MAX_EINGANG_BYTES,
} from './e-invoice-eingang.service';

/**
 * E-Rechnungs-Eingang (Empfang + Lesen). Eigener Controller unter `invoices/
 * eingang` – die 2-Segment-Routen kollidieren nicht mit den `:id`-Routen der
 * InvoicesController/EInvoiceController.
 *
 * KERN (kein Feature-Gate): Upload/Empfang, Liste, Detail, Roh-Download der
 * archivierten Originale – das ist die gesetzliche §14-Empfangs-/Lese-Pflicht
 * und gilt fuer ALLE Tarife. Komfort-Endpunkte (Stapel-Import, Buchhaltungs-
 * Uebergabe) waeren method-gegated (@RequiresFeature('erechnungEingang'), Pro) –
 * folgen in Welle 2.
 *
 * Rollen: nur Leitung/Buchhaltung (OWNER/MANAGER) – Eingangsrechnungen sind
 * fiskalische Dokumente mit Lieferanten-Bankdaten. Tenant-Scope erzwingt der
 * Service (frisches Laden je tenantId, sonst 404).
 */
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.OWNER)
@Controller('invoices/eingang')
export class EInvoiceEingangController {
  constructor(private readonly service: EInvoiceEingangService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('datei', { limits: { fileSize: MAX_EINGANG_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'E-Rechnung empfangen (XML oder hybrides PDF hochladen)' })
  upload(@CurrentUser() user: AuthUser, @UploadedFile() datei?: HochgeladeneEingangsDatei) {
    return this.service.verarbeiteUpload(user.tenantId, user.id, datei);
  }

  @Get()
  @ApiOperation({ summary: 'Eingegangene E-Rechnungen auflisten (paginiert)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Eingangsrechnung im Detail (strukturierte Felder)' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Get(':id/original')
  @ApiOperation({ summary: 'Archiviertes Original (XML/PDF) herunterladen' })
  async original(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, mime, filename } = await this.service.ladeOriginal(user.tenantId, id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }
}
