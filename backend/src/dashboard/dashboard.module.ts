import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Product } from '../shop/entities/product.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Appointment, Customer, Vehicle, Invoice, Product])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
