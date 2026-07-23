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
import { UserRole, TENANT_ROLLEN } from '../users/entities/user.entity';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, StarterImportDto } from './dto/service.dto';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Leistungen/Pakete auflisten' })
  findAll(@CurrentUser() user: AuthUser, @Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(user.tenantId, includeInactive === 'true');
  }

  // Starter-Katalog: statische Route VOR ':id' (unterschiedliche Segmentzahl,
  // aber der Klarheit halber gruppiert). Lesen: alle Betriebs-Rollen.
  @Get('starter/catalog')
  @Roles(...TENANT_ROLLEN)
  @ApiOperation({ summary: 'Starter-Leistungskatalog je Gewerk (Onboarding-Vorschau)' })
  starterCatalog() {
    return this.service.starterCatalog();
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Leistung anlegen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) {
    return this.service.create(user, dto);
  }

  @Post('starter/import')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Starter-Leistungen je Gewerk übernehmen (idempotent per Name)' })
  importStarter(@CurrentUser() user: AuthUser, @Body() dto: StarterImportDto) {
    return this.service.importStarter(user, dto.gewerke);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
