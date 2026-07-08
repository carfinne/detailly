import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { EInvoiceService } from './e-invoice.service';
import { EInvoiceController } from './e-invoice.controller';

/**
 * E-Rechnung-Modul (XRechnung-XML-Export). Eigenstaendig: laedt Invoice/Customer/
 * Tenant tenant-scoped selbst. SubscriptionGuard/RolesGuard/JwtAuthGuard stehen
 * global bereit (SubscriptionsModule ist @Global, JWT-Strategy global registriert).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, Customer, Tenant])],
  controllers: [EInvoiceController],
  providers: [EInvoiceService],
})
export class EInvoiceModule {}
