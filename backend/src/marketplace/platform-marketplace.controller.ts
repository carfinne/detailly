import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { MarketplaceService } from './marketplace.service';
import { CreateDealerDto, UpdateDealerDto, CreateProductDto, UpdateProductDto } from './dto/marketplace.dto';

/**
 * Marktplatz-Pflege (Detailly-Team). Lesen: alle Plattform-Rollen; Pflegen:
 * Platform-Admin + -Support (Analyst read-only). Kunden-Rollen kommen ueber
 * den RolesGuard grundsaetzlich nicht rein.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT, UserRole.PLATFORM_ANALYST)
@Controller('platform/marketplace')
export class PlatformMarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  @Get('dealers')
  @ApiOperation({ summary: 'Alle Haendler (inkl. inaktive)' })
  listDealers() {
    return this.service.listDealers();
  }

  @Post('dealers')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Haendler anlegen' })
  createDealer(@Body() dto: CreateDealerDto) {
    return this.service.createDealer(dto);
  }

  @Patch('dealers/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Haendler bearbeiten (inkl. aktiv/inaktiv)' })
  updateDealer(@Param('id') id: string, @Body() dto: UpdateDealerDto) {
    return this.service.updateDealer(id, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Alle Produkte (inkl. inaktive)' })
  listProducts() {
    return this.service.listProducts();
  }

  @Post('products')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Produkt anlegen (mit Affiliate-Link)' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Patch('products/:id')
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.PLATFORM_SUPPORT)
  @ApiOperation({ summary: 'Produkt bearbeiten (inkl. aktiv/inaktiv)' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Affiliate-Statistik (Klicks gesamt/30 Tage, Top-Produkte/-Haendler)' })
  stats() {
    return this.service.stats();
  }
}
