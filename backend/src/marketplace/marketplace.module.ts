import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceOrder } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';
import { MarketplaceSettlement } from './entities/marketplace-settlement.entity';
import { MarketplaceReview } from './entities/marketplace-review.entity';
import { Product } from '../shop/entities/product.entity';
import { StockMovement } from '../shop/entities/stock-movement.entity';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { HaendlerPortalController } from './haendler-portal.controller';
import { PublicMarketplaceController } from './public-marketplace.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceDealer,
      MarketplaceProduct,
      MarketplaceClick,
      MarketplaceOrder,
      MarketplaceOrderItem,
      MarketplaceSettlement,
      MarketplaceReview,
      // Einlagern bucht in das MANDANTEN-Lager (Shop-Modul).
      Product,
      StockMovement,
    ]),
  ],
  controllers: [
    MarketplaceController,
    PlatformMarketplaceController,
    HaendlerPortalController,
    PublicMarketplaceController,
  ],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
