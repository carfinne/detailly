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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, ChangeInvoiceStatusDto } from './dto/invoice.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Belege auflisten (Angebote + Rechnungen)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('art') art?: InvoiceKind,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.service.findAll(user.tenantId, { art, status });
  }

  // WICHTIG: vor @Get(':id') deklarieren, sonst faengt der :id-Parameter
  // 'mahnliste' ab (Routing-Konflikt).
  @Get('mahnliste')
  @ApiOperation({ summary: 'Ueberfaellige offene Rechnungen (Mahnliste)' })
  mahnliste(@CurrentUser() user: AuthUser) {
    return this.service.mahnliste(user.tenantId);
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
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.service.create(user, dto);
  }

  @Post('from-order/:orderId')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
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

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg-Status setzen (entwurf/offen/bezahlt/storniert)' })
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeInvoiceStatusDto,
  ) {
    return this.service.changeStatus(user, id, dto.status);
  }

  @Post(':id/bezahlt')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Rechnung als bezahlt markieren (setzt Zahldatum)' })
  markPaid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markPaid(user, id);
  }

  @Post(':id/senden')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Beleg als PDF per E-Mail an den Kunden senden' })
  sendByEmail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.sendByEmail(user, id);
  }

  @Post(':id/mahnen')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Mahnstufe erhoehen (Zaehler, kein Mahnbrief/Versand)' })
  raiseMahnstufe(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.raiseMahnstufe(user, id);
  }
}
