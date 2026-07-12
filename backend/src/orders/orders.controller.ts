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
import { OrdersService } from './orders.service';
import { OrdersPdfService } from './orders-pdf.service';
import { buildUebergabeDocDef } from './uebergabe-pdf';
import { OrderStatus } from './entities/order.entity';
import { CreateOrderDto, UpdateOrderDto, ChangeStatusDto, UploadFotosDto } from './dto/order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly pdf: OrdersPdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Auftraege auflisten (optional nach Status/Kunde/Suche)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: OrderStatus,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      status,
      customerId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Auftrag abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Get(':id/uebergabe-pdf')
  @ApiOperation({ summary: 'Übergabe-/Garantiedokument als PDF (Download, tenant-sicher)' })
  async uebergabePdf(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { order, customer, vehicle, tenant } = await this.service.getUebergabeContext(
      user.tenantId,
      id,
    );
    const buffer = await this.pdf.render(
      buildUebergabeDocDef(order as any, customer as any, vehicle as any, tenant as any),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Uebergabe_${order.auftragsnummer}.pdf"`);
    return new StreamableFile(buffer);
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
