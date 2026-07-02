import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceOrder } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { HaendlerPortalController } from './haendler-portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceDealer,
      MarketplaceProduct,
      MarketplaceClick,
      MarketplaceOrder,
      MarketplaceOrderItem,
    ]),
  ],
  controllers: [MarketplaceController, PlatformMarketplaceController, HaendlerPortalController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
