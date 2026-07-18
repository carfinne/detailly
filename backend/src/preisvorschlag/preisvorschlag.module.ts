import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { PreisvorschlagController } from './preisvorschlag.controller';
import { PreisvorschlagService } from './preisvorschlag.service';

/**
 * Schlankes, read-only-Modul fuer den Preisvorschlag aus der eigenen Historie.
 * Registriert nur die noetigen Repositories (OrderItem fuer die Abfrage, Order
 * fuer die Join-/Relations-Metadaten). SubscriptionGuard/JwtAuthGuard stammen aus
 * @Global-Modulen -> kein zusaetzlicher Import noetig.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OrderItem, Order])],
  controllers: [PreisvorschlagController],
  providers: [PreisvorschlagService],
})
export class PreisvorschlagModule {}
