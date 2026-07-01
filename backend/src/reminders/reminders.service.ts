import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Product } from '../shop/entities/product.entity';

export interface ReminderItem {
  key: string;
  anzahl: number;
  label: string;
  href: string;
  severity: 'danger' | 'caution' | 'info';
}
export interface Reminders {
  total: number;
  items: ReminderItem[];
}

/**
 * Sammelt die wenigen, wirklich handlungsrelevanten Hinweise fuer die Glocke in
 * der Topbar: ueberfaellige Rechnungen, heutige Termine, knappes Material.
 * Alles als DB-COUNT (kein Laden ganzer Tabellen), strikt tenant-getrennt.
 */
@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async list(tenantId: string): Promise<Reminders> {
    const now = new Date();
    const heuteStart = new Date(now);
    heuteStart.setHours(0, 0, 0, 0);
    const heuteEnde = new Date(now);
    heuteEnde.setHours(23, 59, 59, 999);

    const [ueberfaellig, termineHeute, materialKnapp] = await Promise.all([
      this.invoiceRepo
        .createQueryBuilder('i')
        .where(
          'i.tenantId = :t AND i.art = :art AND i.status = :s AND i.faelligkeitsdatum IS NOT NULL AND i.faelligkeitsdatum < :now',
          { t: tenantId, art: InvoiceKind.RECHNUNG, s: InvoiceStatus.OFFEN, now },
        )
        .getCount(),
      this.apptRepo
        .createQueryBuilder('a')
        .where('a.tenantId = :t AND a.start BETWEEN :von AND :bis', { t: tenantId, von: heuteStart, bis: heuteEnde })
        .andWhere('a.status NOT IN (:...erledigt)', { erledigt: ['abgesagt', 'abgeschlossen'] })
        .getCount(),
      this.productRepo
        .createQueryBuilder('p')
        .where(
          'p.tenantId = :t AND p.aktiv = :a AND p.mindestbestand > 0 AND p.bestand <= p.mindestbestand',
          { t: tenantId, a: true },
        )
        .getCount(),
    ]);

    const items: ReminderItem[] = [];
    if (ueberfaellig > 0) {
      items.push({
        key: 'rechnungen',
        anzahl: ueberfaellig,
        label: `${ueberfaellig} überfällige ${ueberfaellig === 1 ? 'Rechnung' : 'Rechnungen'}`,
        href: '/rechnungen',
        severity: 'danger',
      });
    }
    if (termineHeute > 0) {
      items.push({
        key: 'termine',
        anzahl: termineHeute,
        label: `${termineHeute} ${termineHeute === 1 ? 'Termin' : 'Termine'} heute`,
        href: '/plantafel',
        severity: 'info',
      });
    }
    if (materialKnapp > 0) {
      items.push({
        key: 'material',
        anzahl: materialKnapp,
        label: `${materialKnapp} ${materialKnapp === 1 ? 'Produkt' : 'Produkte'} unter Mindestbestand`,
        href: '/shop',
        severity: 'caution',
      });
    }

    return { total: items.reduce((s, i) => s + i.anzahl, 0), items };
  }
}
