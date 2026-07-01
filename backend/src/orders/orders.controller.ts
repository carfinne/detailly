import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';
import { CreateOrderDto, UpdateOrderDto, ChangeStatusDto, UploadFotosDto } from './dto/order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Auftraege auflisten (optional nach Status/Kunde)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: OrderStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.findAll(user.tenantId, { status, customerId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Auftrag abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Auftrag anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Auftrag aktualisieren (inkl. Positionen/Kalkulation)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Status wechseln (Workflow-geprueft)' })
  changeStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.service.changeStatus(user, id, dto.status);
  }

  @Post(':id/tracking-token')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Tracking-Link erzeugen/abrufen (Kunde verfolgt den Auftrag)' })
  trackingToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOrCreateTrackingToken(user, id);
  }

  @Post(':id/tracking-token/regenerate')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Tracking-Link neu erzeugen (alter Link wird ungueltig)' })
  regenerateTrackingToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.regenerateTrackingToken(user, id);
  }

  @Post(':id/fotos')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Vorher-/Nachher-Fotos zu einem Auftrag hochladen' })
  uploadFotos(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadFotosDto,
  ) {
    return this.service.uploadFotos(user, id, dto.phase, dto.bilder);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Auftrag loeschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
