import { Injectable } from '@nestjs/common';
import { DataSource, EntityTarget, IsNull, LessThan, ObjectLiteral } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { Customer } from '../customers/entities/customer.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Invoice, InvoiceKind } from '../invoices/entities/invoice.entity';
import { Rental } from '../shop/entities/rental.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { LayerMeasurement } from '../schichtdicke/entities/layer-measurement.entity';
import { DellenKalkulation } from '../dellenkalkulation/entities/dellen-kalkulation.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { resolveDatenschutz } from '../common/datenschutz';
import type { LoeschModus } from './gdpr.service';

/** Ein faelliger Kunde in der Datenschutz-Pruefliste. PII-arm (nur Anzeigename). */
export interface FaelligerKunde {
  id: string;
  name: string;
  letzterKontakt: string | null;
  modus: LoeschModus;
  belege: {
    rechnungen: number;
    angebote: number;
    abgerechneteAuftraege: number;
    signierteProtokolle: number;
  };
}

/** Antwort der Pruefliste. `aktiv=false` -> Automatik ausgeschaltet (frist=0). */
export interface FaelligeKundenResult {
  aktiv: boolean;
  fristJahre: number;
  cutoff: string | null;
  anzahl: number;
  /** true, falls die Liste am Cap gekappt wurde (weitere Faellige existieren). */
  gekappt: boolean;
  kunden: FaelligerKunde[];
}

/** Ein Verlaufs-Eintrag (PII-frei) fuer das Cockpit. */
export interface VerlaufEintrag {
  id: string;
  action: string;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

/** Obergrenze der Pruefliste (Memory-/UI-Schutz). */
const FAELLIGE_CAP = 500;
/** Obergrenze der Kandidaten-Vorauswahl (Backstop gegen sehr grosse Betriebe). */
const KANDIDATEN_CAP = 2000;

/**
 * Datenschutz-Cockpit: berechnet die Pruefliste faelliger (inaktiver) Kunden LIVE
 * und liefert den PII-freien Loesch-/Anonymisierungs-Verlauf. Es wird NICHTS
 * geloescht (das macht ausschliesslich der bestaetigte Aufruf ueber den
 * GdprService). Strikt tenant-scoped ueber `tenantId`.
 *
 * "Letzter Kontakt" = Maximum aus `customers.updatedAt` und dem juengsten
 * verknuepften Vorgang (Auftrag/Termin/Rechnung/Vermietung). Zweistufig: erst die
 * guenstige Vorauswahl (updatedAt < cutoff), dann die verknuepfte Aktivitaet je
 * Kandidat batch-weise – so bleibt die Abfrage auch bei vielen Kunden schlank.
 */
@Injectable()
export class DatenschutzCockpitService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Liest die (defensiv aufgeloeste) Aufbewahrungsfrist des Betriebs in Jahren. */
  async getFristJahre(tenantId: string): Promise<number> {
    const t = await this.dataSource
      .getRepository(Tenant)
      .findOne({ where: { id: tenantId }, select: ['id', 'settings'] });
    const s = (t?.settings ?? {}) as Record<string, unknown>;
    return resolveDatenschutz(s.datenschutz).aufbewahrungInaktiveKundenJahre;
  }

  /**
   * Ermittelt die faelligen Kunden tenant-scoped zum Stichtag `now`. Automatik aus
   * (frist=0) -> leere Liste mit `aktiv=false`.
   */
  async findFaelligeKunden(tenantId: string, now: Date = new Date()): Promise<FaelligeKundenResult> {
    const fristJahre = await this.getFristJahre(tenantId);
    if (fristJahre <= 0) {
      return { aktiv: false, fristJahre: 0, cutoff: null, anzahl: 0, gekappt: false, kunden: [] };
    }

    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - fristJahre);

    // Stufe 1: guenstige Vorauswahl – nicht anonymisiert, Stammzeile lange unberuehrt.
    const kandidaten = await this.dataSource.getRepository(Customer).find({
      where: { tenantId, anonymisiertAm: IsNull(), updatedAt: LessThan(cutoff) },
      order: { updatedAt: 'ASC' },
      take: KANDIDATEN_CAP,
    });
    if (!kandidaten.length) {
      return {
        aktiv: true,
        fristJahre,
        cutoff: cutoff.toISOString(),
        anzahl: 0,
        gekappt: false,
        kunden: [],
      };
    }

    const ids = kandidaten.map((k) => k.id);

    // Stufe 2: juengste verknuepfte Aktivitaet je Kandidat (batch, grouped MAX).
    // Erfasst ALLE PII-tragenden Vorgangsarten (auch Schichtdicke/Dellen), damit
    // ein Kunde mit z. B. nur einer juengeren Lackdicken-Messung nicht faelschlich
    // als "faellig" markiert wird.
    const [maxOrder, maxAppt, maxInvoice, maxRental, maxMessung, maxDelle] = await Promise.all([
      this.latestByCustomer(tenantId, ids, Order, 'createdAt'),
      this.latestByCustomer(tenantId, ids, Appointment, 'start'),
      this.latestByCustomer(tenantId, ids, Invoice, 'createdAt'),
      this.latestByCustomer(tenantId, ids, Rental, 'createdAt'),
      this.latestByCustomer(tenantId, ids, LayerMeasurement, 'createdAt'),
      this.latestByCustomer(tenantId, ids, DellenKalkulation, 'createdAt'),
    ]);

    // Belege je Kandidat (batch, grouped COUNT) fuer die Modus-Anzeige.
    const [numRechnungen, numAngebote, numAbgerechnet, numProtokolle] = await Promise.all([
      this.countInvoicesByCustomer(tenantId, ids, InvoiceKind.RECHNUNG),
      this.countInvoicesByCustomer(tenantId, ids, InvoiceKind.ANGEBOT),
      this.countAbgerechneteAuftraege(tenantId, ids),
      this.countSignierteProtokolle(tenantId, ids),
    ]);

    const faellige: FaelligerKunde[] = [];
    for (const k of kandidaten) {
      const dates = [
        k.updatedAt,
        maxOrder.get(k.id),
        maxAppt.get(k.id),
        maxInvoice.get(k.id),
        maxRental.get(k.id),
        maxMessung.get(k.id),
        maxDelle.get(k.id),
      ];
      const letzter = this.maxDate(dates);
      if (!letzter || letzter >= cutoff) continue; // juengere Aktivitaet -> nicht faellig

      const belege = {
        rechnungen: numRechnungen.get(k.id) ?? 0,
        angebote: numAngebote.get(k.id) ?? 0,
        abgerechneteAuftraege: numAbgerechnet.get(k.id) ?? 0,
        signierteProtokolle: numProtokolle.get(k.id) ?? 0,
      };
      const pflicht =
        belege.rechnungen + belege.angebote + belege.abgerechneteAuftraege + belege.signierteProtokolle > 0;
      faellige.push({
        id: k.id,
        name: this.anzeigeName(k),
        letzterKontakt: letzter.toISOString(),
        modus: pflicht ? 'anonymisiert' : 'geloescht',
        belege,
      });
    }

    // Aeltester Kontakt zuerst (dringlichste Faelle oben).
    faellige.sort((a, b) => (a.letzterKontakt ?? '').localeCompare(b.letzterKontakt ?? ''));
    const gekappt = faellige.length > FAELLIGE_CAP;
    return {
      aktiv: true,
      fristJahre,
      cutoff: cutoff.toISOString(),
      anzahl: faellige.length,
      gekappt,
      kunden: gekappt ? faellige.slice(0, FAELLIGE_CAP) : faellige,
    };
  }

  /**
   * PII-freier Verlauf der DSGVO-Aktionen (Export/Loeschung/Anonymisierung/
   * Betriebs-Export) tenant-scoped, neueste zuerst.
   */
  async getVerlauf(tenantId: string, limit = 100): Promise<VerlaufEintrag[]> {
    const take = Math.min(Math.max(1, limit), 500);
    const rows = await this.dataSource
      .getRepository(AuditLog)
      .createQueryBuilder('a')
      .where('a.tenantId = :t', { t: tenantId })
      .andWhere('a.action IN (:...actions)', {
        actions: ['gdpr_delete', 'gdpr_anonymize', 'gdpr_export', 'gdpr_tenant_export'],
      })
      .orderBy('a.createdAt', 'DESC')
      .take(take)
      .getMany();
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityId: r.entityId ?? null,
      userId: r.userId ?? null,
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      payload: r.payload ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Batch-Helfer (grouped queries)
  // ---------------------------------------------------------------------------

  private async latestByCustomer(
    tenantId: string,
    ids: string[],
    entity: EntityTarget<ObjectLiteral>,
    dateCol: string,
  ): Promise<Map<string, Date>> {
    const out = new Map<string, Date>();
    if (!ids.length) return out;
    const rows = await this.dataSource
      .getRepository(entity)
      .createQueryBuilder('e')
      .select('e.customerId', 'cid')
      .addSelect(`MAX(e.${dateCol})`, 'maxd')
      .where('e.tenantId = :t AND e.customerId IN (:...ids)', { t: tenantId, ids })
      .groupBy('e.customerId')
      .getRawMany<{ cid: string; maxd: string | number | Date | null }>();
    for (const r of rows) {
      if (r.cid == null || r.maxd == null) continue;
      const d = r.maxd instanceof Date ? r.maxd : new Date(r.maxd);
      if (!Number.isNaN(d.getTime())) out.set(r.cid, d);
    }
    return out;
  }

  private async countInvoicesByCustomer(
    tenantId: string,
    ids: string[],
    art: InvoiceKind,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    const rows = await this.dataSource
      .getRepository(Invoice)
      .createQueryBuilder('i')
      .select('i.customerId', 'cid')
      .addSelect('COUNT(*)', 'n')
      .where('i.tenantId = :t AND i.customerId IN (:...ids) AND i.nummer IS NOT NULL AND i.art = :art', {
        t: tenantId,
        ids,
        art,
      })
      .groupBy('i.customerId')
      .getRawMany<{ cid: string; n: string | number }>();
    for (const r of rows) out.set(r.cid, Number(r.n) || 0);
    return out;
  }

  private async countAbgerechneteAuftraege(tenantId: string, ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    const rows = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .select('o.customerId', 'cid')
      .addSelect('COUNT(*)', 'n')
      .where('o.tenantId = :t AND o.customerId IN (:...ids) AND o.status = :st', {
        t: tenantId,
        ids,
        st: OrderStatus.ABGERECHNET,
      })
      .groupBy('o.customerId')
      .getRawMany<{ cid: string; n: string | number }>();
    for (const r of rows) out.set(r.cid, Number(r.n) || 0);
    return out;
  }

  private async countSignierteProtokolle(tenantId: string, ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    // Signierte Schaden-/Uebergabe-Inspektionen UND signierte Schichtdicken-
    // Messungen (beide = Haftungsbeweis) je Kunde aufsummieren – konsistent zu
    // hatAufbewahrungspflicht, damit der Cockpit-Modus dem tatsaechlichen entspricht.
    const [inspRows, layerRows] = await Promise.all([
      this.dataSource
        .getRepository(DamageInspection)
        .createQueryBuilder('d')
        .select('d.customerId', 'cid')
        .addSelect('COUNT(*)', 'n')
        .where('d.tenantId = :t AND d.customerId IN (:...ids)', { t: tenantId, ids })
        .andWhere("(d.unterschriftPng IS NOT NULL OR d.status = 'freigegeben')")
        .groupBy('d.customerId')
        .getRawMany<{ cid: string; n: string | number }>(),
      this.dataSource
        .getRepository(LayerMeasurement)
        .createQueryBuilder('l')
        .select('l.customerId', 'cid')
        .addSelect('COUNT(*)', 'n')
        .where('l.tenantId = :t AND l.customerId IN (:...ids)', { t: tenantId, ids })
        .andWhere('l.unterschriftPng IS NOT NULL')
        .groupBy('l.customerId')
        .getRawMany<{ cid: string; n: string | number }>(),
    ]);
    for (const r of inspRows) out.set(r.cid, (out.get(r.cid) ?? 0) + (Number(r.n) || 0));
    for (const r of layerRows) out.set(r.cid, (out.get(r.cid) ?? 0) + (Number(r.n) || 0));
    return out;
  }

  private maxDate(dates: Array<Date | null | undefined>): Date | null {
    let max: Date | null = null;
    for (const d of dates) {
      if (!d) continue;
      const dd = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(dd.getTime())) continue;
      if (!max || dd > max) max = dd;
    }
    return max;
  }

  private anzeigeName(c: Customer): string {
    if (c.companyName) return c.companyName;
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Kunde';
  }
}
