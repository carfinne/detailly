import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Product } from '../shop/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { InvoicesModule } from '../invoices/invoices.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';

@Module({
  // InvoicesModule fuer den geteilten InvoicesService (nachfassCount) – kein Zyklus
  // (InvoicesModule importiert RemindersModule nicht).
  imports: [TypeOrmModule.forFeature([Invoice, Appointment, Product, Order]), InvoicesModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
