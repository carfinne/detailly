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
} from './dto/shop.dto';

@ApiTags('shop')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Controller('shop')
export class ShopController {
  constructor(private readonly service: ShopService) {}

  // ---------- Produkte / Lager ----------

  @Get('products')
  @ApiOperation({ summary: 'Produkte/Lager auflisten' })
  findProducts(@CurrentUser() user: AuthUser, @Query('includeInactive') includeInactive?: string) {
    return this.service.findProducts(user.tenantId, includeInactive === 'true');
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
  findMovements(@CurrentUser() user: AuthUser, @Query('productId') productId?: string) {
    return this.service.findMovements(user.tenantId, productId);
  }

  // ---------- Bestellungen / Freigaben ----------

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Bestellungen auflisten' })
  findPurchaseOrders(@CurrentUser() user: AuthUser, @Query('status') status?: PurchaseOrderStatus) {
    return this.service.findPurchaseOrders(user.tenantId, status);
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
}
