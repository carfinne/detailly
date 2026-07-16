import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncomingInvoice } from './entities/incoming-invoice.entity';
import { EInvoiceEingangService } from './e-invoice-eingang.service';
import { EInvoiceEingangController } from './e-invoice-eingang.controller';

/**
 * E-Rechnungs-Eingang-Modul (Empfang + Lesen strukturierter Rechnungen).
 * Eigenstaendig und getrennt vom Sende-Pfad (e-invoice/): laedt die
 * IncomingInvoice tenant-scoped selbst. Guards stehen global bereit
 * (SubscriptionsModule @Global, JWT-Strategy global registriert).
 */
@Module({
  imports: [TypeOrmModule.forFeature([IncomingInvoice])],
  controllers: [EInvoiceEingangController],
  providers: [EInvoiceEingangService],
})
export class EInvoiceEingangModule {}
