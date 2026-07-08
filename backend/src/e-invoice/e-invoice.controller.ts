import { Controller, Get, Param, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EInvoiceService } from './e-invoice.service';

/**
 * E-Rechnung (XRechnung-XML-Export). Eigener Controller unter dem gleichen
 * Pfad-Praefix `invoices` – die 2-Segment-Route `:id/xrechnung` kollidiert nicht
 * mit den bestehenden `:id`/`:id/pdf`-Routen der InvoicesController.
 *
 * Rollen: nur Leitung/Buchhaltung (OWNER/MANAGER) – analog zum Buchhaltungs-
 * Export (fiskalisches Dokument mit §14-/Bankdaten). Tenant-Scope erzwingt der
 * Service (frisches Laden je tenantId, sonst 404).
 */
@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('invoices')
export class EInvoiceController {
  constructor(private readonly service: EInvoiceService) {}

  @Get(':id/xrechnung')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Rechnung als XRechnung 3.0 (UBL-XML) exportieren' })
  async getXRechnung(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { xml, nummer } = await this.service.buildXRechnung(user.tenantId, id);
    // Dateinamen defensiv saeubern (Belegnummer koennte Sonderzeichen enthalten).
    const safe = (nummer || 'rechnung').replace(/[^A-Za-z0-9._-]+/g, '-');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="xrechnung-${safe}.xml"`);
    return new StreamableFile(Buffer.from(xml, 'utf-8'));
  }
}
