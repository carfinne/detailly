import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { OrderItem, OrderItemType } from '../orders/entities/order-item.entity';
import { ServiceType } from '../orders/entities/order.entity';
import { berechneMedian, runde2, signifikanteWoerter } from './preisvorschlag.util';

/** Antwortform des Preisvorschlags (bewusst datensparsam: nur aggregierte Zahlen). */
export interface PreisVorschlagErgebnis {
  /** Median-Einzelpreis der Treffer (null = kein Vorschlag). */
  median: number | null;
  /** Einzelpreis der juengsten passenden Position (null = kein Vorschlag). */
  letzterPreis: number | null;
  /** Anzahl der beruecksichtigten Treffer (0 = kein Vorschlag). */
  treffer: number;
}

const LEER: PreisVorschlagErgebnis = { median: null, letzterPreis: null, treffer: 0 };

/**
 * Ab wie vielen Treffern ueberhaupt ein Vorschlag geliefert wird. Ein einzelner
 * historischer Preis derselben Werkstatt ist bereits eine sinnvolle Orientierung
 * ("Zuletzt X"), daher 1. Weniger -> `anzahl: 0` (kein Vorschlag).
 */
const MIN_TREFFER = 1;

/**
 * Fenstergroesse: Median + juengster Preis werden aus den bis zu N juengsten
 * Treffern gebildet. Begrenzt Speicher/Datenmenge und haelt die Aussage aktuell.
 */
const MAX_TREFFER = 500;

/**
 * Liefert einen Preisvorschlag aus der EIGENEN Auftragshistorie des Betriebs.
 *
 * Strikt tenant-gescoped: die `tenantId` stammt ausschliesslich aus dem
 * authentifizierten Nutzer (Token), nie aus dem Client. `OrderItem` traegt selbst
 * keine `tenantId` -> der Mandantenfilter greift ueber den Join auf `orders`.
 *
 * Aehnlichkeit (bewusst einfach/robust, kein Fuzzy-Paket):
 * - nur Leistungspositionen (typ = leistung) mit Einzelpreis > 0;
 * - `serviceType` (Gewerk) ist ein OPTIONALER Zusatzfilter: nur wenn ein gueltiges
 *   Gewerk uebergeben wird, wird darauf eingeschraenkt (sonst gewerkeuebergreifend);
 * - die Beschreibung MUSS jedes signifikante Suchwort als Teilstring enthalten
 *   (normalisierte Wort-Uebereinstimmung via LOWER(...) LIKE '%wort%').
 *
 * Datensparsamkeit: es wird ausschliesslich `einzelpreis` der Treffer selektiert
 * (Projektion) – keine Kundendaten, kein Voll-Dump. Der Median wird in JS aus
 * dieser schlanken Preisliste gebildet (portabel fuer SQLite UND PostgreSQL,
 * statt DB-spezifischem PERCENTILE).
 */
@Injectable()
export class PreisvorschlagService {
  constructor(
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
  ) {}

  async ermittleVorschlag(
    user: AuthUser,
    beschreibung: string,
    serviceType: string,
  ): Promise<PreisVorschlagErgebnis> {
    const woerter = signifikanteWoerter(beschreibung);
    if (woerter.length === 0) return LEER;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'auftrag')
      // Mandantentrennung: NUR Positionen aus Auftraegen des eigenen Betriebs.
      .where('auftrag.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('item.typ = :typ', { typ: OrderItemType.LEISTUNG })
      .andWhere('item.einzelpreis > 0');

    // serviceType ist OPTIONAL: nur bei gueltigem Gewerk einschraenken.
    if (this.istServiceType(serviceType)) {
      qb.andWhere('auftrag.serviceType = :serviceType', { serviceType });
    }

    // Jedes signifikante Wort muss in der Beschreibung vorkommen (AND-Verkettung).
    woerter.forEach((wort, i) => {
      qb.andWhere(`LOWER(item.beschreibung) LIKE :w${i}`, { [`w${i}`]: `%${wort}%` });
    });

    // Projektion: nur der Preis. Reihenfolge nach Auftragsdatum (juengste zuerst),
    // damit der erste Treffer der "letzte" Preis ist.
    qb.select('item.einzelpreis', 'einzelpreis')
      .orderBy('auftrag.createdAt', 'DESC')
      .limit(MAX_TREFFER);

    const rows = await qb.getRawMany<{ einzelpreis: string | number }>();

    const preise = rows
      .map((r) => Number(r.einzelpreis))
      .filter((p) => Number.isFinite(p) && p > 0);

    const treffer = preise.length;
    if (treffer < MIN_TREFFER) return LEER;

    return {
      median: runde2(berechneMedian(preise)),
      letzterPreis: runde2(preise[0]),
      treffer,
    };
  }

  private istServiceType(wert: string): wert is ServiceType {
    return (Object.values(ServiceType) as string[]).includes(wert);
  }
}
