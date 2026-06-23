import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    // Customer ist nur fuer die tenant-Validierung verknuepfter IDs (Beleg) noetig.
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Order, Customer]),
    AuditModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
