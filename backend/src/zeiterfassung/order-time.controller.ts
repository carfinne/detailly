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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrderTimeService } from './order-time.service';
import { CreateOrderTimeDto, UpdateOrderTimeDto } from './dto/order-time.dto';

// Nur Leitungsrollen duerfen fremde Eintraege aendern/loeschen (super_admin via RolesGuard).
const VERWALTUNG = [UserRole.FRANCHISE_OWNER, UserRole.MANAGER];

/**
 * Auftragszeiten (Job-Costing). Ansehen + eigene Zeit erfassen: jede Rolle.
 * Aendern/loeschen: nur Leitung (Schutz vor Arbeitszeitbetrug).
 */
@ApiTags('order-times')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('order-times')
export class OrderTimeController {
  constructor(private readonly service: OrderTimeService) {}

  @Get()
  @ApiOperation({ summary: 'Auftragszeiten eines Auftrags + Summe' })
  list(@CurrentUser() user: AuthUser, @Query('orderId') orderId: string) {
    return this.service.listForOrder(user, orderId);
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

  @Patch(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Auftragszeit korrigieren (Leitung)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderTimeDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...VERWALTUNG)
  @ApiOperation({ summary: 'Auftragszeit loeschen (Leitung)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
