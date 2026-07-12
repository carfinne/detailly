import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderMaterial } from './entities/order-material.entity';

/** Ampel-Bewertung nach den Discovery-Schwellen (Ziel < 5 %, ab > 10 % Verlust). */
export type VerschnittBewertung = 'gut' | 'warnung' | 'kritisch';

/** Kern-Kennzahlen des Verschnitts (geplant vs. verbraucht in Laufmetern). */
export interface VerschnittWerte {
  /** Geplante lfm (aus dem lfm-Rechner); null = keine Planzahl vorhanden. */
  geplantLfm: number | null;
  /** Tatsaechlich verbrauchte lfm (gebuchtes Folien-Material). */
  verbrauchtLfm: number;
  /** verbraucht - geplant; null ohne Planzahl. */
  verschnittLfm: number | null;
  /** Verschnitt in Prozent des Plans; null ohne (positiven) Plan. */
  verschnittProzent: number | null;
  bewertung: VerschnittBewertung | null;
}

export interface VerschnittKpi extends VerschnittWerte {
  orderId: string;
}

export interface VerschnittProdukt extends VerschnittWerte {
  productId: string | null;
  produktName: string;
  /** Anzahl Auftraege, die dieses Produkt im Zeitraum verbraucht haben. */
  auftraege: number;
}

export interface VerschnittAggregat extends VerschnittWerte {
  von: string;
  bis: string;
  proProdukt: VerschnittProdukt[];
}

/**
 * Verschnitt-KPI: geplanter (lfm-Rechner, Feld `geplantLfm` an OrderMaterial) vs.
 * tatsaechlich verbrauchter Folien-Verbrauch (`menge`). Als "Folien-Zeile" zaehlt,
 * was eine Planzahl traegt ODER von einer Restrolle gebucht wurde - so mischt die
 * lfm-KPI keinen Stueck-Verbrauch (Einheiten-Sauberkeit). Tenant-getrennt.
 */
@Injectable()
export class VerschnittService {
  constructor(
    @InjectRepository(OrderMaterial) private readonly materialRepo: Repository<OrderMaterial>,
  ) {}

  /** Verschnitt eines einzelnen Auftrags (frei, kein Tarif-Gate). */
  async forOrder(tenantId: string, orderId: string): Promise<VerschnittKpi> {
    const zeilen = await this.materialRepo.find({
      where: { tenantId, orderId },
      select: ['menge', 'geplantLfm', 'folienRolleId'],
    });
    const folien = zeilen.filter((z) => z.geplantLfm != null || z.folienRolleId != null);
    const verbrauchtLfm = round2(folien.reduce((s, z) => s + Number(z.menge), 0));
    const planZeilen = folien.filter((z) => z.geplantLfm != null);
    const geplantLfm = planZeilen.length
      ? round2(planZeilen.reduce((s, z) => s + Number(z.geplantLfm), 0))
      : null;
    return { orderId, ...kpiFrom(geplantLfm, verbrauchtLfm) };
  }

  /**
   * Zeitraum-Aggregat je Tenant (BASIC+, hinter 'auswertungen'). DB-Aggregation
   * (SUM + GROUP BY je Produkt, Number()-Cast fuer pg-String/SQLite-Zahl) nach
   * dem locations/reports-Muster; die Produktzeilen summiert JS zum Tenant-Total.
   */
  async aggregat(tenantId: string, von?: string, bis?: string): Promise<VerschnittAggregat> {
    const now = new Date();
    const vonD = von ? new Date(von) : new Date(now.getFullYear(), 0, 1); // Default: laufendes Jahr
    const bisD = bis ? new Date(bis) : new Date();
    bisD.setHours(23, 59, 59, 999);

    const rows = await this.materialRepo
      .createQueryBuilder('om')
      .select('om.productId', 'productId')
      .addSelect('MAX(om.produktName)', 'produktName')
      .addSelect('COALESCE(SUM(om.menge), 0)', 'verbraucht')
      .addSelect('SUM(om.geplantLfm)', 'geplant')
      .addSelect('COUNT(DISTINCT om.orderId)', 'auftraege')
      .where('om.tenantId = :tenantId', { tenantId })
      // Nur Folien-Zeilen (Plan gesetzt ODER von einer Rolle gebucht).
      .andWhere('(om.geplantLfm IS NOT NULL OR om.folienRolleId IS NOT NULL)')
      .andWhere('om.createdAt BETWEEN :von AND :bis', { von: vonD, bis: bisD })
      .groupBy('om.productId')
      .getRawMany<{
        productId: string | null;
        produktName: string | null;
        verbraucht: string | number;
        geplant: string | number | null;
        auftraege: string | number;
      }>();

    const proProdukt: VerschnittProdukt[] = rows
      .map((r) => {
        const verbrauchtLfm = round2(Number(r.verbraucht ?? 0));
        const geplantLfm = r.geplant == null ? null : round2(Number(r.geplant));
        return {
          productId: r.productId ?? null,
          produktName: r.produktName ?? '—',
          auftraege: Number(r.auftraege ?? 0),
          ...kpiFrom(geplantLfm, verbrauchtLfm),
        };
      })
      // Schlimmster Verschnitt zuerst (Zeilen ohne Planzahl ans Ende).
      .sort((a, b) => (b.verschnittProzent ?? -Infinity) - (a.verschnittProzent ?? -Infinity));

    const verbrauchtGesamt = round2(proProdukt.reduce((s, p) => s + p.verbrauchtLfm, 0));
    const planVorhanden = proProdukt.some((p) => p.geplantLfm != null);
    const geplantGesamt = planVorhanden
      ? round2(proProdukt.reduce((s, p) => s + (p.geplantLfm ?? 0), 0))
      : null;

    return {
      von: vonD.toISOString(),
      bis: bisD.toISOString(),
      ...kpiFrom(geplantGesamt, verbrauchtGesamt),
      proProdukt,
    };
  }
}

/** Zentrale KPI-Ableitung: eine Quelle fuer Formel UND Bewertungsschwellen. */
function kpiFrom(geplantLfm: number | null, verbrauchtLfm: number): VerschnittWerte {
  if (geplantLfm == null) {
    return {
      geplantLfm: null,
      verbrauchtLfm,
      verschnittLfm: null,
      verschnittProzent: null,
      bewertung: null,
    };
  }
  const diff = verbrauchtLfm - geplantLfm;
  const verschnittProzent = geplantLfm > 0 ? Math.round((diff / geplantLfm) * 1000) / 10 : null;
  return {
    geplantLfm,
    verbrauchtLfm,
    verschnittLfm: round2(diff),
    verschnittProzent,
    bewertung: bewerten(verschnittProzent),
  };
}

/** Discovery-Schwellen zentral: Ziel < 5 %, 5-10 % Warnung, > 10 % Verlust. */
function bewerten(prozent: number | null): VerschnittBewertung | null {
  if (prozent == null) return null;
  if (prozent < 5) return 'gut';
  if (prozent <= 10) return 'warnung';
  return 'kritisch';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
