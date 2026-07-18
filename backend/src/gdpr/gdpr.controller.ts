import { Controller, Get, Post, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GdprService } from './gdpr.service';

/**
 * DSGVO-Endpunkte je Kunde, gemountet unter /customers, damit sie konsistent zum
 * Kunden-Ressourcenpfad liegen. Rolle: OWNER + MANAGER (Leitung), da die Kunden-
 * Auskunft/-Loeschung eine Leitungsaufgabe ist (PLATFORM_ADMIN umgeht den
 * RolesGuard ohnehin, bleibt aber tenant-gebunden).
 *
 * Die Route-Reihenfolge ist unkritisch, weil :id/export bzw. :id/gdpr-delete
 * spezifischer als die :id-Routen des CustomersController sind und in einem
 * EIGENEN Controller liegen (kein Konflikt mit @Get(':id')).
 */
@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('customers')
export class GdprController {
  constructor(private readonly service: GdprService) {}

  @Get(':id/export')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'DSGVO Art. 15/20: Kundendaten als JSON exportieren' })
  async export(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const data = await this.service.exportCustomerData(user, id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kunde-${id}.json"`);
    return data;
  }

  @Get(':id/gdpr-preview')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'DSGVO Art. 17: Vorschau (loeschen vs. anonymisieren)' })
  preview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.previewCustomerDeletion(user, id);
  }

  @Post(':id/gdpr-delete')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'DSGVO Art. 17: Kunde loeschen (Automatik: anonymisieren/loeschen)' })
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteCustomer(user, id);
  }

  /**
   * LEGACY (Backward-Compat): erzwungene Anonymisierung ohne Entscheidungslogik.
   * Neuer Weg ist /gdpr-delete (waehlt automatisch loeschen vs. anonymisieren).
   */
  @Post(':id/anonymize')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'DSGVO Art. 17 (Legacy): Kundendaten anonymisieren' })
  anonymize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.anonymizeCustomer(user, id);
  }
}
