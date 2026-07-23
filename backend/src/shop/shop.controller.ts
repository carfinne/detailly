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
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FEATURE_FOLIERUNG_PPF } from '../subscriptions/plan-catalog';
import { ShopService } from './shop.service';
import { PurchaseOrderStatus } from './entities/purchase-order.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  StockMovementDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  CreateRentalDto,
  ChangePurchaseOrderStatusDto,
  ChangeRentalStatusDto,
} from './dto/shop.dto';

// Ganzer Controller hinter dem Tarif-Feature 'shop' (Pro-Modul): Starter-Tarife
// ohne den Key erhalten 403 PLAN_FEATURE_MISSING (gezielter Upgrade-Hinweis).
@ApiTags('shop')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)
@RequiresFeature('shop')
@Controller('shop')
export class ShopController {
  constructor(private readonly service: ShopService) {}

  // ---------- Produkte / Lager ----------

  @Get('products')
  @ApiOperation({ summary: 'Produkte/Lager auflisten (opt-in Paginierung via page/limit)' })
  findProducts(
    @CurrentUser() user: AuthUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('kategorie') kategorie?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findProducts(user.tenantId, {
      includeInactive: includeInactive === 'true',
      kategorie: kategorie || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('products/low-stock')
  @ApiOperation({ summary: 'Produkte unter Mindestbestand' })
  lowStock(@CurrentUser() user: AuthUser) {
    return this.service.lowStock(user.tenantId);
  }

  @Get('products/:id')
  findProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findProduct(user.tenantId, id);
  }

  @Post('products')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.service.createProduct(user, dto);
  }

  @Post('products/folien-vorlagen')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  // Folien-Bibliothek (Folierer/PPF): hinter dem à-la-carte Add-on 'folierung_ppf'.
  // Methoden-Gate ueberschreibt das Klassen-'shop' -> ohne Add-on 403 (Trial offen);
  // 'shop' ist ohnehin KERN in jedem Tarif, geht dem Betrieb also nicht verloren.
  @RequiresFeature(FEATURE_FOLIERUNG_PPF)
  @ApiOperation({
    summary: 'Kuratierten Folien-Vorlagenkatalog als Produkte importieren (idempotent, Add-on Folierung/PPF)',
  })
  importFolienVorlagen(@CurrentUser() user: AuthUser) {
    return this.service.importFolienVorlagen(user);
  }

  @Patch('products/:id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  updateProduct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(user, id, dto);
  }

  @Delete('products/:id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  removeProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeProduct(user, id);
  }

  @Post('products/:id/movements')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Lagerbewegung erfassen (Zugang/Abgang/Inventur)' })
  recordMovement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StockMovementDto) {
    return this.service.recordMovement(user, id, dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Lagerbewegungen auflisten (opt-in Paginierung via page/limit)' })
  findMovements(
    @CurrentUser() user: AuthUser,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findMovements(user.tenantId, {
      productId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ---------- Bestellungen / Freigaben ----------

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Bestellungen auflisten (opt-in Paginierung via page/limit)' })
  findPurchaseOrders(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findPurchaseOrders(user.tenantId, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('purchase-orders/:id')
  findPurchaseOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findPurchaseOrder(user.tenantId, id);
  }

  @Post('purchase-orders')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.TECHNICIAN, UserRole.RECEPTIONIST)
  createPurchaseOrder(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.service.createPurchaseOrder(user, dto);
  }

  @Patch('purchase-orders/:id')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.TECHNICIAN, UserRole.RECEPTIONIST)
  updatePurchaseOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.service.updatePurchaseOrder(user, id, dto);
  }

  @Patch('purchase-orders/:id/status')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Bestellstatus aendern / freigeben (nur Manager/Owner)' })
  changePurchaseOrderStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangePurchaseOrderStatusDto,
  ) {
    return this.service.changePurchaseOrderStatus(user, id, dto.status);
  }

  // ---------- Vermietung ----------

  @Get('rentals')
  @ApiOperation({ summary: 'Vermietungen auflisten' })
  findRentals(@CurrentUser() user: AuthUser) {
    return this.service.findRentals(user.tenantId);
  }

  @Post('rentals')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  createRental(@CurrentUser() user: AuthUser, @Body() dto: CreateRentalDto) {
    return this.service.createRental(user, dto);
  }

  @Patch('rentals/:id/status')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Vermietungsstatus aendern (Uebergabe/Rueckgabe)' })
  changeRentalStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeRentalStatusDto,
  ) {
    return this.service.updateRentalStatus(user, id, dto.status);
  }
}
