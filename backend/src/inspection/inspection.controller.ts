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
import { InspectionService } from './inspection.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { CreateDamageItemDto } from './dto/create-damage-item.dto';
import { UpdateDamageItemDto } from './dto/update-damage-item.dto';
import { CreateDamagePhotoDto } from './dto/create-damage-photo.dto';
import { LinkPhotosDto } from './dto/link-photos.dto';

/**
 * 3D-Schadensinspektionen (Phase 0). Endpunkte gemaess Konzept §5.2.
 * Alle geschuetzt durch JwtAuthGuard + SubscriptionGuard + RolesGuard;
 * tenantId NIE aus dem Body, FKs ueber assertRefInTenant im Service.
 *
 * KEINE Foto-Datei-Pipeline und KEIN calculate/report in Phase 0.
 */
@ApiTags('inspektionen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller()
export class InspectionController {
  constructor(private readonly service: InspectionService) {}

  // --- Inspektionen ---

  @Post('inspections')
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Inspektion anlegen (Carry-over bei typ=ausgang)' })
  createInspection(@CurrentUser() user: AuthUser, @Body() dto: CreateInspectionDto) {
    return this.service.createInspection(user, dto);
  }

  @Get('inspections')
  @ApiOperation({ summary: 'Inspektionen auflisten (Filter: orderId, vehicleId, typ, status)' })
  findAllInspections(
    @CurrentUser() user: AuthUser,
    @Query('orderId') orderId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('typ') typ?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAllInspections(user, { orderId, vehicleId, typ, status });
  }

  @Get('inspections/:id')
  @ApiOperation({ summary: 'Inspektion inkl. Schaeden + Fotos abrufen' })
  findOneInspection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOneInspection(user, id);
  }

  @Patch('inspections/:id')
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Inspektion aktualisieren (kmStand, status ...)' })
  updateInspection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
  ) {
    return this.service.updateInspection(user, id, dto);
  }

  // --- Schaeden (DamageItem) ---

  @Post('inspections/:id/items')
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Schaden an einer Inspektion anlegen (optional photoIds[])' })
  createItem(
    @CurrentUser() user: AuthUser,
    @Param('id') inspectionId: string,
    @Body() dto: CreateDamageItemDto,
  ) {
    return this.service.createItem(user, inspectionId, dto);
  }

  @Get('inspections/:id/items')
  @ApiOperation({ summary: 'Schaeden einer Inspektion auflisten (Filter: origin)' })
  findItems(
    @CurrentUser() user: AuthUser,
    @Param('id') inspectionId: string,
    @Query('origin') origin?: string,
  ) {
    return this.service.findItems(user, inspectionId, origin);
  }

  @Patch('items/:id')
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Schaden aktualisieren (art, schweregrad, status ...)' })
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDamageItemDto,
  ) {
    return this.service.updateItem(user, id, dto);
  }

  @Delete('items/:id')
  @Roles(UserRole.MANAGER, UserRole.FRANCHISE_OWNER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Schaden loeschen' })
  deleteItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteItem(user, id);
  }

  // --- Fotos (Metadaten) + n:m-Zuordnung ---

  @Post('inspections/:id/photos')
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Foto-Metadaten anlegen (Phase 0: nur pfad, keine Datei-Pipeline)' })
  createPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') inspectionId: string,
    @Body() dto: CreateDamagePhotoDto,
  ) {
    return this.service.createPhoto(user, inspectionId, dto);
  }

  @Post('items/:id/photos')
  @Roles(
    UserRole.MANAGER,
    UserRole.FRANCHISE_OWNER,
    UserRole.RECEPTIONIST,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Fotos n:m einem Schaden zuordnen' })
  linkPhotos(
    @CurrentUser() user: AuthUser,
    @Param('id') damageItemId: string,
    @Body() dto: LinkPhotosDto,
  ) {
    return this.service.linkPhotos(user, damageItemId, dto);
  }
}
