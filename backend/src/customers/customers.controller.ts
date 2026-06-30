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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Kunden auflisten (Suche + Paginierung)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeInactive: includeInactive === 'true',
    });
  }

  // WICHTIG vor @Get(':id') deklarieren, sonst faengt :id "select" ab.
  @Get('select')
  @ApiOperation({ summary: 'Leichte Kundenliste (id + Name) fuer Auswahl-Dropdowns – ohne Cap' })
  selectList(@CurrentUser() user: AuthUser) {
    return this.service.selectList(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Kunden abrufen' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Kunden anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Kunden aktualisieren' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Kunden deaktivieren (Soft-Delete)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
