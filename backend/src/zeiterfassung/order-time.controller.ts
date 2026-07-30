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
import { OrderTimeService } from './order-time.service';
import { CreateOrderTimeDto, UpdateOrderTimeDto } from './dto/order-time.dto';

// Nur Leitungsrollen duerfen fremde Eintraege aendern/loeschen (platform_admin via RolesGuard).
const VERWALTUNG = [UserRole.OWNER, UserRole.MANAGER];

/**
 * Auftragszeiten (Job-Costing). Ansehen + eigene Zeit erfassen: jede Rolle.
 * Aendern/loeschen: nur Leitung (Schutz vor Arbeitszeitbetrug).
 *
 * Ganzer Controller hinter dem Tarif-Feature 'zeiterfassung' (Pro-Modul) – wie
 * die Schwester `ZeiterfassungController`: Tarife ohne den Key erhalten 403
 * PLAN_FEATURE_MISSING (gezielter Upgrade-Hinweis), inkl. der Lohn-CSV
 * `GET /order-times/export`. Guard-Reihenfolge: Jwt -> Subscription ->
 * PlanFeature -> Roles.
 */
@ApiTags('order-times')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature('zeiterfassung')
@Controller('order-times')
export class OrderTimeController {
  constructor(private readonly service: OrderTimeService) {}

  @Get()
  @ApiOperation({ summary: 'Auftragszeiten eines Auftrags + Summe, Soll und Abweichung' })
  list(@CurrentUser() user: AuthUser, @Query('orderId') orderId: string) {
    return this.service.listForOrder(user, orderId);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Buchbare (offene/laufende) Auftraege fuer die Projektzeit-Auswahl' })
  bookableOrders(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    return this.service.bookableOrders(user, search);
  }

  @Get('uebersicht')
  @ApiOperation({ summary: 'Soll/Ist-Uebersicht ueber mehrere Auftraege (Zeitraum/Mitarbeiter)' })
  uebersicht(
    @CurrentUser() user: AuthUser,
    @Query('von') von?: string,
    @Query('bis') bis?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.uebersicht(user, { von, bis, userId });
  }

  @Get('export')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Arbeitszeiten als CSV exportieren (Lohnbuero, nur Leitung)' })
  async export(
    @CurrentUser() user: AuthUser,
    @Query('von') von: string | undefined,
    @Query('bis') bis: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, contentType } = await this.service.buildPayrollCsv(user.tenantId, von, bis);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Post()
  @ApiOperation({ summary: 'Arbeitszeit auf einen Auftrag buchen (eigene Zeit; Leitung auch fuer andere)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderTimeDto) {
    return this.service.create(user, dto);
  }

  // Aendern/loeschen: kein @Roles-Gate mehr – der Service erzwingt die Regel
  // (Leitung darf alle, Mitarbeiter nur EIGENE Buchungen), und beide sind
  // gesperrt, sobald der Auftrag abgerechnet/storniert ist.
  @Patch(':id')
  @ApiOperation({ summary: 'Auftragszeit korrigieren (Leitung: alle, Mitarbeiter: eigene)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderTimeDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Auftragszeit loeschen (Leitung: alle, Mitarbeiter: eigene)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
