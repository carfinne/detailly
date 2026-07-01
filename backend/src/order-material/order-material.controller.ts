import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrderMaterialService } from './order-material.service';
import { CreateOrderMaterialDto } from './dto/order-material.dto';

// Loeschen bucht Bestand zurueck -> nur Leitung (Schutz vor Bestands-Manipulation).
const VERWALTUNG = [UserRole.OWNER, UserRole.MANAGER];

/**
 * Materialverbrauch je Auftrag. Ansehen + erfassen: jede Rolle (Techniker bucht
 * sein verbrauchtes Material). Loeschen (Bestands-Rueckbuchung): nur Leitung.
 */
@ApiTags('order-materials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('order-materials')
export class OrderMaterialController {
  constructor(private readonly service: OrderMaterialService) {}

  @Get()
  @ApiOperation({ summary: 'Materialverbrauch eines Auftrags' })
  list(@CurrentUser() user: AuthUser, @Query('orderId') orderId: string) {
    return this.service.listForOrder(user.tenantId, orderId);
  }

  @Post()
  @ApiOperation({ summary: 'Material auf einen Auftrag buchen (senkt den Bestand)' })
  add(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderMaterialDto) {
    return this.service.add(user, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Materialverbrauch loeschen (bucht den Bestand zurueck, nur Leitung)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
