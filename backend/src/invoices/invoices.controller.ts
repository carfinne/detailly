import {
  Controller,
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
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  ChangeInvoiceStatusDto,
  CreateAngebotsSetDto,
  CreateAnzahlungDto,
} from './dto/invoice.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { EinnahmenExportQueryDto } from './dto/einnahmen-export-query.dto';

// Rechnungen sind Kernmodul (alle Tarife) – daher KEIN Klassen-Gate. Nur die
// Mehrwert-Endpunkte Mahnwesen (mahnliste/mahnen) und Buchhaltungs-Export sind
// per @RequiresFeature auf Methoden-Ebene getarift; der PlanFeatureGuard laesst
// alle uebrigen Endpunkte ohne Metadata durch. Guard-Reihenfolge:
// Jwt -> Subscription -> PlanFeature -> Roles.
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Belege auflisten (Angebote + Rechnungen)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('art') art?: InvoiceKind,
    @Query('status') status?: InvoiceStatus,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      art,
      status,
      customerId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // WICHTIG: vor @Get(':id') deklarieren, sonst faengt der :id-Parameter
  // 'mahnliste' ab (Routing-Konflikt).
  @Get('mahnliste')
  @RequiresFeature('mahnwesen')
  @ApiOperation({ summary: 'Ueberfaellige offene Rechnungen (Mahnliste)' })
  mahnliste(@CurrentUser() user: AuthUser) {
    return this.service.mahnliste(user.tenantId);
  }

  // WICHTIG: vor @Get(':id') deklarieren, sonst faengt :id 'export' ab.
  @Get('export')
  @RequiresFeature('export')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Buchhaltungs-Export (CSV universell oder DATEV-Buchungsstapel)' })
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, contentType } = await this.service.buildExport(user.tenantId, {
      format: query.format ?? 'csv',
      von: query.von,
      bis: query.bis,
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  // WICHTIG: statische Route VOR @Get(':id') deklarieren (sonst faengt :id sie ab).
  // §19-Umsatzgrenzen-Waechter: KEIN @RequiresFeature (nur Steuerstatus, in jedem
  // Tarif), aber Leitung-only (enthaelt Betriebs-Umsatzzahlen).
  @Get('kleinunternehmer-status')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: '§19-Umsatzgrenzen-Status (laufendes Kalenderjahr vs. 100.000 EUR)' })
  kleinunternehmerStatus(@CurrentUser() user: AuthUser) {
    return this.service.kleinunternehmerStatus(user.tenantId);
  }

  // WICHTIG: vor @Get(':id') deklarieren, sonst faengt :id 'nachfass-liste' ab.
  // Welle 2-B (Teil 1): offene, nachfassreife Angebote (seit X Tagen offen, noch
  // nicht abgelaufen). NUR Verkauf/Leitung (Empfang/Manager/Owner) – Techniker
  // verkaufen nicht. Reine In-App-Vorschlagsliste, KEIN Auto-Versand.
  @Get('nachfass-liste')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Nachfass-Vorschlagsliste (offene Angebote seit X Tagen, nicht abgelaufen)' })
  nachfassListe(@CurrentUser() user: AuthUser) {
    return this.service.nachfassListe(user.tenantId);
  }

  // WICHTIG: vor @Get(':id') deklarieren. Einnahmenuebersicht (CSV) – wie der
  // Buchhaltungs-Export hinter @RequiresFeature('export') + Leitung.
  @Get('einnahmen-export')
  @RequiresFeature('export')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Einnahmenuebersicht (CSV) – bezahlte Rechnungen im Zeitraum' })
  async einnahmenExport(
    @CurrentUser() user: AuthUser,
    @Query() query: EinnahmenExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, contentType } = await this.service.buildEinnahmenExport(
      user.tenantId,
      { von: query.von, bis: query.bis },
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Beleg als PDF (Angebot/Rechnung) tenant-sicher streamen' })
  async getPdf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // KEIN @Roles -> roll-offen wie GET / und GET /:id (eigener Tenant via findOne).
    const { buffer, nummer } = await this.service.buildPdf(user.tenantId, id);
    res.setHeader('Content-Type', 'application/pdf');
    // Content-Disposition zwingend, sonst oeffnet der Browser inline statt Download.
    res.setHeader('Content-Disposition', `attachment; filename="${nummer}.pdf"`);
    return new StreamableFile(buffer);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.service.create(user, dto);
  }

  @Post('from-order/:orderId')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg aus Auftrag erzeugen (Angebot/Rechnung)' })
  createFromOrder(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Query('art') art?: InvoiceKind,
    @Query('mwstSatz') mwstSatz?: string,
  ) {
    return this.service.createFromOrder(
      user,
      orderId,
      art ?? InvoiceKind.RECHNUNG,
      mwstSatz != null ? Number(mwstSatz) : undefined,
    );
  }

  // --- Welle 1 (F1/F3): statische POST-Routen VOR :id-Sub-Routen ---
  @Post('angebots-set')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Angebots-Set aus 2-3 Varianten erzeugen (je eigene AN-Nummer)' })
  createAngebotsSet(@CurrentUser() user: AuthUser, @Body() dto: CreateAngebotsSetDto) {
    return this.service.createAngebotsSet(user, dto);
  }

  @Post('anzahlung')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Anzahlungsrechnung aus Auftrag/Rechnung erzeugen (Brutto-Betrag oder Prozent)' })
  createAnzahlung(@CurrentUser() user: AuthUser, @Body() dto: CreateAnzahlungDto) {
    return this.service.createAnzahlung(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/annehmen')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Angebot annehmen -> Auftrag erzeugen (idempotent, Geschwister ablehnen)' })
  acceptAngebot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.acceptAngebot(user, id);
  }

  @Post(':id/angebot-token')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Oeffentlichen Kunden-Freigabe-Link fuer die Angebots-Gruppe erzeugen/abrufen' })
  angebotToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOrCreateAngebotToken(user, id);
  }

  @Patch(':id/status')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg-Status setzen (entwurf/offen/bezahlt/storniert)' })
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeInvoiceStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto.status);
  }

  @Post(':id/bezahlt')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Rechnung als bezahlt markieren (setzt Zahldatum)' })
  markPaid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markPaid(user, id);
  }

  @Post(':id/stornorechnung')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({
    summary: 'Rechnungskorrektur: Stornorechnung (Vollstorno) zu einer festgesetzten Rechnung erzeugen',
  })
  stornorechnung(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.erstelleStornorechnung(user, id);
  }

  @Post(':id/senden')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg als PDF per E-Mail an den Kunden senden' })
  sendByEmail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.sendByEmail(user, id);
  }

  @Post(':id/mahnen')
  @RequiresFeature('mahnwesen')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Rechnung mahnen: Stufe erhoehen + Mahn-PDF per E-Mail senden' })
  mahnen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.mahnen(user, id);
  }

  @Post(':id/download-token')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Oeffentlichen Download-Link erzeugen/abrufen (nur offen/bezahlt)' })
  downloadToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOrCreateDownloadToken(user, id);
  }

  @Post(':id/download-token/regenerate')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Download-Link neu erzeugen (alter Link wird ungueltig)' })
  regenerateDownloadToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.regenerateDownloadToken(user, id);
  }
}
