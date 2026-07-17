import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceOrder } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';
import { MarketplaceCategory } from './entities/marketplace-category.entity';
import { MarketplaceReview } from './entities/marketplace-review.entity';
import { MarketplaceProductImage } from './entities/marketplace-product-image.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceService } from './marketplace.service';
import { KybService } from './kyb.service';
import { KybRetentionService } from './kyb-retention.service';
import { MarketplaceController } from './marketplace.controller';
import { PlatformMarketplaceController } from './platform-marketplace.controller';
import { HaendlerPortalController } from './haendler-portal.controller';
import { HaendlerPortalAuthController } from './haendler-portal-auth.controller';
import { PublicHaendlerBewerbungController } from './public-haendler-bewerbung.controller';

@Module({
  imports: [
    // User: fuer das Haendler-Login-Onboarding bei der Freigabe.
    TypeOrmModule.forFeature([
      MarketplaceDealer,
      MarketplaceProduct,
      MarketplaceClick,
      MarketplaceOrder,
      MarketplaceOrderItem,
      MarketplaceCategory,
      MarketplaceReview,
      MarketplaceProductImage,
      User,
    ]),
    // AuthModule (exportiert AuthService): Passwort-Hash + Passwort-setzen-
    // Einladung ueber den bestehenden Reset-Flow. Kein Zyklus (AuthModule kennt
    // den Marktplatz nicht).
    AuthModule,
  ],
  controllers: [
    MarketplaceController,
    PlatformMarketplaceController,
    HaendlerPortalController,
    HaendlerPortalAuthController,
    PublicHaendlerBewerbungController,
  ],
  providers: [MarketplaceService, KybService, KybRetentionService],
})
export class MarketplaceModule {}
