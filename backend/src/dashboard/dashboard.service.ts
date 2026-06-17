import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async stats(tenantId: string) {
    const offeneStatus = [
      OrderStatus.ANGEFRAGT,
      OrderStatus.KALKULIERT,
      OrderStatus.BESTAETIGT,
      OrderStatus.IN_ARBEIT,
      OrderStatus.QUALITAETSKONTROLLE,
    ];

    const heuteStart = new Date();
    heuteStart.setHours(0, 0, 0, 0);
    const heuteEnde = new Date();
    heuteEnde.setHours(23, 59, 59, 999);

    const [offeneAuftraege, termineHeute, kundenGesamt, offeneAuftragsListe, bezahlteRechnungen] =
      await Promise.all([
        this.orderRepo.count({ where: { tenantId, status: In(offeneStatus) } }),
        this.apptRepo.count({ where: { tenantId, start: Between(heuteStart, heuteEnde) } }),
        this.customerRepo.count({ where: { tenantId, isActive: true } }),
        this.orderRepo.find({
          where: { tenantId, status: In(offeneStatus) },
          relations: ['items'],
          order: { createdAt: 'DESC' },
          take: 10,
        }),
        this.invoiceRepo.find({
          where: { tenantId, art: InvoiceKind.RECHNUNG, status: InvoiceStatus.BEZAHLT },
        }),
      ]);

    const umsatzBezahlt = bezahlteRechnungen.reduce((sum, r) => sum + Number(r.brutto), 0);

    return {
      offeneAuftraege,
      termineHeute,
      kundenGesamt,
      umsatzBezahlt: Math.round(umsatzBezahlt * 100) / 100,
      offeneAuftragsListe,
    };
  }
}
