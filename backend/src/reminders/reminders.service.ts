import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Product } from '../shop/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderFeedback } from '../orders/entities/order-feedback.entity';
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
 * Rollen, die den "Angebot online angenommen"-Hinweis sehen (Welle 1-A, F3):
 * Empfang/Leitung – identisch zum Buchungsanfrage-Badge. Techniker verkaufen
 * nicht und bekommen den Umsatz-Hinweis daher nicht.
 */
const ANGEBOT_ROLLEN: string[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST];

/**
 * Rollen, die den "Neues Kunden-Feedback"-Hinweis sehen (Welle 2-C): Empfang/
 * Leitung – Kundenbeziehung/Reputation ist Rezeptions-/Leitungssache. Techniker
 * bekommen ihn nicht (gleiche Wahl wie beim Angebots-Hinweis).
 */
const FEEDBACK_ROLLEN: string[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST];

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
    // Optional (Welle 2-C): ungelesenes Kunden-Feedback. @Optional, damit bestehende
    // Unit-Tests, die den Service positionsweise mit 4 Repos instanziieren,
    // unveraendert bleiben; im echten Modul wird das Repo ueber forFeature injiziert.
    @Optional()
    @InjectRepository(OrderFeedback)
    private readonly feedbackRepo?: Repository<OrderFeedback>,
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
      const angenommen = await this.orderRepo
        .createQueryBuilder('o')
        .where(
          'o.tenantId = :t AND o.angebotOnlineAngenommenAm IS NOT NULL AND o.status = :s',
          { t: tenantId, s: OrderStatus.BESTAETIGT },
        )
        .getCount();
      if (angenommen > 0) {
        items.unshift({
          key: 'angebote',
          anzahl: angenommen,
          label: `${angenommen} online ${angenommen === 1 ? 'angenommenes Angebot' : 'angenommene Angebote'}`,
          href: '/auftraege',
          severity: 'info',
        });
      }
    }

    // Neues Kunden-Feedback (Welle 2-C): ungelesene Rueckmeldungen aus der Mappe.
    // NUR fuer Empfang/Leitung (role-gate) und nur wenn das Repo vorhanden ist
    // (Abwaertskompatibilitaet der Unit-Tests). Der Zaehler sinkt beim Lesen.
    if (this.feedbackRepo && role && FEEDBACK_ROLLEN.includes(role)) {
      const feedbackNeu = await this.feedbackRepo.count({
        where: { tenantId, gelesen: false },
      });
      if (feedbackNeu > 0) {
        items.push({
          key: 'feedback',
          anzahl: feedbackNeu,
          label: `${feedbackNeu} ${feedbackNeu === 1 ? 'neues Kunden-Feedback' : 'neue Kunden-Feedbacks'}`,
          href: '/feedback',
          severity: 'info',
        });
      }
    }

    return { total: items.reduce((s, i) => s + i.anzahl, 0), items };
  }
}
