import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { AccountingExportService } from './accounting-export.service';
import { InvoicesController } from './invoices.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    // Customer ist nur fuer die tenant-Validierung verknuepfter IDs (Beleg) noetig.
    // Tenant wird fuer den PDF-Briefkopf (Absender) geladen.
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Order, Customer, Tenant]),
    AuditModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, AccountingExportService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
