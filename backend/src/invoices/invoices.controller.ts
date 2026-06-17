import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, ChangeInvoiceStatusDto } from './dto/invoice.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
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
  ) {
    return this.service.createFromOrder(user, orderId, art ?? InvoiceKind.RECHNUNG);
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
}
