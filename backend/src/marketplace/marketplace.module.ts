import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { PlatformMarketplaceController } from './platform-marketplace.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MarketplaceDealer, MarketplaceProduct, MarketplaceClick])],
  controllers: [MarketplaceController, PlatformMarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
