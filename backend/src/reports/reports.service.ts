import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';

export interface ReportOverview {
  von: string;
  bis: string;
  auftragsvolumen: number;
  anzahlAuftraege: number;
  schnittAuftragswert: number;
  umsatzBezahlt: number;
  nachLeistungsart: { serviceType: string; summe: number; anzahl: number }[];
  topKunden: { name: string; summe: number; anzahl: number }[];
}

/**
 * Schlanke betriebswirtschaftliche Auswertung (Berichte). Alles als DB-Aggregat
 * (SUM/COUNT/GROUP BY), tenant-getrennt, auf einen Zeitraum gefenstert. Auftraege
 * nach createdAt, bezahlter Umsatz nach Rechnungsdatum.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
  ) {}

  async overview(tenantId: string, von?: string, bis?: string): Promise<ReportOverview> {
    const now = new Date();
    const vonD = von ? new Date(von) : new Date(now.getFullYear(), 0, 1); // Default: laufendes Jahr
    const bisD = bis ? new Date(bis) : new Date();
    bisD.setHours(23, 59, 59, 999);
    const p = { tenantId, von: vonD, bis: bisD };

    const [auftragAgg, umsatzRow, leistungRows, topRows] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.gesamtpreis), 0)', 'summe')
        .addSelect('COUNT(*)', 'anzahl')
        .where('o.tenantId = :tenantId AND o.createdAt BETWEEN :von AND :bis', p)
        .getRawOne<{ summe: string; anzahl: string }>(),
      this.invoiceRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.brutto), 0)', 'summe')
        .where(
          'i.tenantId = :tenantId AND i.art = :art AND i.status = :status AND i.datum BETWEEN :von AND :bis',
          { ...p, art: InvoiceKind.RECHNUNG, status: InvoiceStatus.BEZAHLT },
        )
        .getRawOne<{ summe: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.serviceType', 'serviceType')
        .addSelect('COALESCE(SUM(o.gesamtpreis), 0)', 'summe')
        .addSelect('COUNT(*)', 'anzahl')
        .where('o.tenantId = :tenantId AND o.createdAt BETWEEN :von AND :bis', p)
        .groupBy('o.serviceType')
        .orderBy('summe', 'DESC')
        .getRawMany<{ serviceType: string; summe: string; anzahl: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.customerId', 'customerId')
        .addSelect('COALESCE(SUM(o.gesamtpreis), 0)', 'summe')
        .addSelect('COUNT(*)', 'anzahl')
        .where('o.tenantId = :tenantId AND o.createdAt BETWEEN :von AND :bis', p)
        .groupBy('o.customerId')
        .orderBy('summe', 'DESC')
        .limit(5)
        .getRawMany<{ customerId: string; summe: string; anzahl: string }>(),
    ]);

    const anzahlAuftraege = Number(auftragAgg?.anzahl ?? 0);
    const auftragsvolumen = round2(Number(auftragAgg?.summe ?? 0));
    const schnittAuftragswert = anzahlAuftraege > 0 ? round2(auftragsvolumen / anzahlAuftraege) : 0;

    // Namen der Top-Kunden nachladen (tenant-scoped).
    const ids = topRows.map((r) => r.customerId).filter(Boolean);
    const kunden = ids.length
      ? await this.customerRepo.find({
          where: { id: In(ids), tenantId },
          select: ['id', 'type', 'firstName', 'lastName', 'companyName'],
        })
      : [];
    const nameById = new Map(kunden.map((c) => [c.id, kundenName(c)]));

    return {
      von: vonD.toISOString(),
      bis: bisD.toISOString(),
      auftragsvolumen,
      anzahlAuftraege,
      schnittAuftragswert,
      umsatzBezahlt: round2(Number(umsatzRow?.summe ?? 0)),
      nachLeistungsart: leistungRows.map((r) => ({
        serviceType: r.serviceType,
        summe: round2(Number(r.summe)),
        anzahl: Number(r.anzahl),
      })),
      topKunden: topRows.map((r) => ({
        name: nameById.get(r.customerId) ?? '—',
        summe: round2(Number(r.summe)),
        anzahl: Number(r.anzahl),
      })),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function kundenName(c: Customer): string {
  if (c.type === CustomerType.BUSINESS) return c.companyName || 'Kunde';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || 'Kunde';
}
