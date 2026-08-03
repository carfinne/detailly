import { Controller, Get, Post, Param, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
// Paket 3: DSGVO-Endpunkte enger drosseln als die globalen 600/min. Klassen-
// Baseline 15/min (Vorschau/Loeschen/Anonymisieren sind seltene Leitungsaufgaben);
// der Export wird darunter zusaetzlich per Methoden-Decorator noch enger begrenzt.
@Throttle({ default: { limit: 15, ttl: 60000 } })
@Controller('customers')
export class GdprController {
  constructor(private readonly service: GdprService) {}

  // Teuerster Vorgang der App: laedt UND entschluesselt ALLE Daten eines Kunden.
  // Ein Mensch braucht das ein paar Mal im Jahr, nie 600/min. Sehr eng: 5/min
  // (Tippfehler/Retry bleiben moeglich) UND 30/Stunde (deckt selbst einen
  // ungewoehnlichen DSGVO-Anfragen-Stapel an einem Tag, blockt aber massenhaftes,
  // automatisiertes Abziehen entschluesselter Kundendaten).
  @Get(':id/export')
  @Throttle({ default: { limit: 5, ttl: 60000 }, gdprHour: { limit: 30, ttl: 3600000 } })
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
