import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Product } from '../shop/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';

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
 * Rollen, die die UMSATZ-Hinweise sehen (Welle 1-A F3 "Angebot online angenommen"
 * + Welle 2-B "Angebot nachfassen"/"Nachsorge faellig"): Empfang/Leitung – identisch
 * zum Buchungsanfrage-Badge. Techniker verkaufen nicht und bekommen die Hinweise
 * daher nicht (serverseitiges Gate, nicht nur UI).
 */
const ANGEBOT_ROLLEN: string[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST];

/**
 * Sammelt die wenigen, wirklich handlungsrelevanten Hinweise fuer die Glocke in
 * der Topbar: ueberfaellige Rechnungen, heutige Termine, knappes Material und –
 * fuer Empfang/Leitung – online angenommene Angebote. Alles als DB-COUNT (kein
 * Laden ganzer Tabellen), strikt tenant-getrennt.
 */
@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    // Nachfass-Zaehler ueber den geteilten InvoicesService (nachfassCount), damit
    // Glocken-Zaehler und Nachfass-Liste NIE divergieren.
    private readonly invoices: InvoicesService,
  ) {}

  async list(tenantId: string, role?: string): Promise<Reminders> {
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

    // Online angenommene Angebote (Welle 1-A, F3): der "heisse Umsatzmoment".
    // NUR fuer Empfang/Leitung (role-gate) – Techniker sehen ihn nicht. Zaehlt
    // Auftraege mit gesetztem Online-Annahme-Marker, die noch NICHT weitergeschoben
    // wurden (Status = bestaetigt); sobald der Betrieb reagiert, faellt der Zaehler.
    // Ganz vorne einsortiert (unshift), weil es der handlungsrelevanteste Hinweis ist.
    if (role && ANGEBOT_ROLLEN.includes(role)) {
      const [angenommen, nachfass, nachsorge] = await Promise.all([
        this.orderRepo
          .createQueryBuilder('o')
          .where(
            'o.tenantId = :t AND o.angebotOnlineAngenommenAm IS NOT NULL AND o.status = :s',
            { t: tenantId, s: OrderStatus.BESTAETIGT },
          )
          .getCount(),
        // Welle 2-B (Teil 1): nachfassreife offene Angebote (seit X Tagen offen,
        // nicht abgelaufen). Geteilte Logik mit der Nachfass-Liste (kein Divergenz).
        this.invoices.nachfassCount(tenantId, now),
        // Welle 2-B (Teil 2): faellige Nachsorge-Wiedervorlagen (geclaimt, offen).
        this.orderRepo
          .createQueryBuilder('o')
          .where(
            'o.tenantId = :t AND o.nachsorgeErinnertAm IS NOT NULL AND o.nachsorgeErledigtAm IS NULL',
            { t: tenantId },
          )
          .getCount(),
      ]);
      if (angenommen > 0) {
        items.unshift({
          key: 'angebote',
          anzahl: angenommen,
          label: `${angenommen} online ${angenommen === 1 ? 'angenommenes Angebot' : 'angenommene Angebote'}`,
          href: '/auftraege',
          severity: 'info',
        });
      }
      // Nachfassen: der Betrieb jagt hier noch nicht gewonnenes Geld. In-App-
      // Vorschlag (kein Auto-Versand); Link fuehrt in die Nachfass-Ansicht.
      if (nachfass > 0) {
        items.push({
          key: 'nachfass',
          anzahl: nachfass,
          label: `${nachfass} ${nachfass === 1 ? 'Angebot' : 'Angebote'} nachfassen`,
          href: '/rechnungen?nachfass=1',
          severity: 'info',
        });
      }
      // Nachsorge: faellige Wiedervorlage (Auffrischung/Kontrolle). In-App-
      // Erinnerung (kein Auto-Versand); Link fuehrt in die Nachsorge-Liste.
      if (nachsorge > 0) {
        items.push({
          key: 'nachsorge',
          anzahl: nachsorge,
          label: `${nachsorge} ${nachsorge === 1 ? 'Nachsorge faellig' : 'Nachsorgen faellig'}`,
          href: '/auftraege?nachsorge=1',
          severity: 'info',
        });
      }
    }

    return { total: items.reduce((s, i) => s + i.anzahl, 0), items };
  }
}
