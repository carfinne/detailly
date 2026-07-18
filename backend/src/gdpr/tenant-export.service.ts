import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityTarget, In, ObjectLiteral } from 'typeorm';

import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { Rental } from '../shop/entities/rental.entity';
import { Product } from '../shop/entities/product.entity';
import { PurchaseOrder } from '../shop/entities/purchase-order.entity';
import { StockMovement } from '../shop/entities/stock-movement.entity';
import { ServiceItem } from '../services/entities/service-item.entity';
import { Location } from '../locations/entities/location.entity';
import { FolienRolle } from '../folien-rollen/entities/folien-rolle.entity';
import { KassenbuchEintrag } from '../kassenbuch/entities/kassenbuch-eintrag.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { TimeEntry } from '../zeiterfassung/entities/time-entry.entity';
import { BookingRequest } from '../public-booking/entities/booking-request.entity';
import { IncomingInvoice } from '../e-invoice-eingang/entities/incoming-invoice.entity';
import { LayerMeasurement } from '../schichtdicke/entities/layer-measurement.entity';
import { LayerMeasurementPoint } from '../schichtdicke/entities/layer-measurement-point.entity';
import { DellenKalkulation } from '../dellenkalkulation/entities/dellen-kalkulation.entity';
import { DellenMarker } from '../dellenkalkulation/entities/dellen-marker.entity';
import { DellenPreismatrix } from '../dellenkalkulation/entities/dellen-preismatrix.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

/** Minimaler Schreib-Sink (Express-Response erfuellt dieses Interface). */
export interface ExportSink {
  write(chunk: string): void;
  end(): void;
}

/**
 * Feldnamen, die NIE exportiert werden (Geheimnisse). Die meisten liegen ohnehin
 * als `select:false`-Spalten vor und werden von `find()` nicht geladen – diese
 * Denylist ist der zweite, harte Riegel (v. a. fuer `passwordHash`, das eine
 * NORMALE Spalte ist und sonst mitexportiert wuerde).
 */
const SECRET_FIELDS = new Set<string>([
  'passwordHash',
  'totpSecret',
  'recoveryCodes',
  'emailVerificationTokenHash',
  'passwordResetTokenHash',
  'sevdeskApiToken',
  'smtpPassword',
  'dkimPrivateKey',
  'calendarToken',
  'downloadToken',
  'angebotToken',
  'freigabeToken',
  'tokenHash',
  'abmeldeTokenHash',
  'sourceIpHash',
]);

/**
 * Ein exportierter Datenbestand (Schluessel im JSON + Entity). Manche Kind-Tabellen
 * (OrderItem/InvoiceItem) haben KEINE eigene tenantId-Spalte -> sie werden ueber
 * die tenant-gescoped erhobenen Eltern-IDs gefiltert (`parent`).
 */
interface Descriptor {
  key: string;
  entity: EntityTarget<ObjectLiteral>;
  /** Optionale Eltern-Scope-Definition fuer Kind-Tabellen ohne tenantId. */
  parent?: { entity: EntityTarget<ObjectLiteral>; fk: string };
}

/** Seitengroesse fuer das paginierte Einsammeln (Memory-schonend). */
const PAGE = 500;

/**
 * Betriebs-Gesamtexport (Datenportabilitaet/Kuendigung). Sammelt ALLE
 * tenant-eigenen Betriebsdaten paginiert ein und STREAMT sie als eine JSON-Datei
 * – je Entitaet ein Array. Strikt tenant-scoped; Geheimnisse (Passwort-Hashes,
 * Tokens, 2FA-Secrets, SMTP/DKIM/sevDesk) werden ausgeschlossen.
 */
@Injectable()
export class TenantExportService {
  private readonly logger = new Logger(TenantExportService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Kuratierte Liste der exportierten Betriebsdaten (tenant-scoped ueber tenantId). */
  private descriptors(): Descriptor[] {
    return [
      { key: 'mitarbeiter', entity: User },
      { key: 'kunden', entity: Customer },
      { key: 'fahrzeuge', entity: Vehicle },
      { key: 'auftraege', entity: Order },
      // OrderItem hat KEINE tenantId -> ueber die Auftraege des Betriebs scopen.
      { key: 'auftragsPositionen', entity: OrderItem, parent: { entity: Order, fk: 'orderId' } },
      { key: 'rechnungen', entity: Invoice },
      // InvoiceItem hat KEINE tenantId -> ueber die Rechnungen des Betriebs scopen.
      { key: 'rechnungsPositionen', entity: InvoiceItem, parent: { entity: Invoice, fk: 'invoiceId' } },
      { key: 'termine', entity: Appointment },
      { key: 'inspektionen', entity: DamageInspection },
      { key: 'schaeden', entity: DamageItem },
      { key: 'schadenFotos', entity: DamagePhoto },
      { key: 'schichtdickenMessungen', entity: LayerMeasurement },
      { key: 'schichtdickenMesspunkte', entity: LayerMeasurementPoint },
      { key: 'dellenKalkulationen', entity: DellenKalkulation },
      { key: 'dellenMarker', entity: DellenMarker },
      { key: 'dellenPreismatrix', entity: DellenPreismatrix },
      { key: 'vermietungen', entity: Rental },
      { key: 'produkte', entity: Product },
      { key: 'bestellungen', entity: PurchaseOrder },
      { key: 'lagerbewegungen', entity: StockMovement },
      { key: 'leistungen', entity: ServiceItem },
      { key: 'standorte', entity: Location },
      { key: 'folienRollen', entity: FolienRolle },
      { key: 'kassenbuch', entity: KassenbuchEintrag },
      { key: 'auftragsZeiten', entity: OrderTime },
      { key: 'zeiterfassung', entity: TimeEntry },
      { key: 'buchungsanfragen', entity: BookingRequest },
      { key: 'eingangsrechnungen', entity: IncomingInvoice },
    ];
  }

  /**
   * Streamt den kompletten Betriebs-Export als JSON in den Sink. Robust gegen
   * Fehler MITTEN im Stream: try/finally garantiert, dass die JSON-Datei sauber
   * geschlossen wird. Bricht ein Abschnitt ab, wird ein `_abgebrochen`-Marker
   * gesetzt, der Sink beendet und ein Fehler-Audit geschrieben (Header sind
   * bereits raus -> der Controller kann den Status nicht mehr aendern).
   */
  async streamExport(user: AuthUser, sink: ExportSink): Promise<void> {
    const tenantId = user.tenantId;
    const descriptors = this.descriptors();
    let abgebrochen = false;
    let fehlerMeldung: string | null = null;

    try {
      sink.write('{\n');
      sink.write(`"exportiertAm":${JSON.stringify(new Date().toISOString())},\n`);
      sink.write(`"exportiertVon":${JSON.stringify(user.id)},\n`);
      sink.write(`"tenantId":${JSON.stringify(tenantId)},\n`);
      sink.write(
        '"hinweis":"Betriebs-Gesamtexport (Datenportabilitaet). Geheimnisse (Passwort-Hashes, Tokens, 2FA/SMTP/DKIM/sevDesk) sind bewusst ausgeschlossen.",\n',
      );

      // Betriebs-Stammdaten (ohne Geheimnisse). Tenant ist per id gescoped.
      sink.write('"betrieb":');
      sink.write(JSON.stringify(await this.loadTenantProfile(tenantId)));
      sink.write(',\n');

      for (const d of descriptors) {
        sink.write(`${JSON.stringify(d.key)}:[`);
        try {
          await this.streamEntity(tenantId, d, sink);
        } catch (err) {
          // Fehler in EINEM Abschnitt: Array schliessen (JSON bleibt valide),
          // abbrechen und den Rest ueberspringen.
          abgebrochen = true;
          fehlerMeldung = (err as Error).message;
          this.logger.error(
            `Betriebs-Export abgebrochen bei "${d.key}" (Betrieb ${tenantId}): ${fehlerMeldung}`,
          );
        }
        sink.write('],\n');
        if (abgebrochen) break;
      }
    } catch (err) {
      abgebrochen = true;
      fehlerMeldung = (err as Error).message;
      this.logger.error(`Betriebs-Export abgebrochen (Betrieb ${tenantId}): ${fehlerMeldung}`);
    } finally {
      // Abschluss-Feld ohne nachfolgendes Komma -> JSON bleibt valide, egal ob
      // regulaer beendet oder abgebrochen.
      sink.write(`"_abgebrochen":${abgebrochen ? 'true' : 'false'}\n}`);
      sink.end();
    }

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'gdpr_tenant_export',
      entityType: 'Tenant',
      entityId: tenantId,
      payload: abgebrochen
        ? { entitaeten: descriptors.length, abgebrochen: true }
        : { entitaeten: descriptors.length },
    });
  }

  /** Streamt EINE Entitaet paginiert, tenant-scoped, mit Secret-Redaktion. */
  private async streamEntity(tenantId: string, d: Descriptor, sink: ExportSink): Promise<void> {
    // Kind-Tabellen ohne tenantId: erst die tenant-eigenen Eltern-IDs sammeln, dann
    // ueber In(parentIds) filtern (nie ueber eine nicht existierende tenantId-Spalte).
    let parentIds: string[] | null = null;
    if (d.parent) {
      parentIds = (
        await this.dataSource
          .getRepository(d.parent.entity)
          .find({ where: { tenantId } as ObjectLiteral, select: { id: true } as ObjectLiteral })
      ).map((r) => (r as { id: string }).id);
      if (!parentIds.length) return; // keine Eltern -> keine Kinder
    }

    const repo = this.dataSource.getRepository(d.entity);
    let offset = 0;
    let first = true;
    // Stabile Sortierung ueber die (immer vorhandene) uuid-PK id.
    for (;;) {
      const where = d.parent
        ? ({ [d.parent.fk]: In(parentIds as string[]) } as ObjectLiteral)
        : ({ tenantId } as ObjectLiteral);
      const rows = await repo.find({
        where,
        order: { id: 'ASC' } as ObjectLiteral,
        take: PAGE,
        skip: offset,
      });
      for (const row of rows) {
        if (!first) sink.write(',');
        sink.write(JSON.stringify(this.sanitize(row as Record<string, unknown>)));
        first = false;
      }
      if (rows.length < PAGE) break;
      offset += PAGE;
    }
  }

  /** Entfernt Secret-Felder aus einer Zeile (belt-and-suspenders zu select:false). */
  private sanitize(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (SECRET_FIELDS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }

  /** Betriebs-Stammdaten ohne Geheimnisse (select nur unbedenkliche Spalten). */
  private async loadTenantProfile(tenantId: string): Promise<Record<string, unknown>> {
    const t = await this.dataSource.getRepository(Tenant).findOne({
      where: { id: tenantId },
      // Bewusst NUR unbedenkliche Spalten (kein sevdeskApiToken/smtpPassword/
      // dkimPrivateKey/calendarToken – die sind select:false, hier zusaetzlich
      // nicht selektiert).
      select: [
        'id',
        'name',
        'slug',
        'email',
        'phone',
        'street',
        'city',
        'postalCode',
        'country',
        'status',
        'betriebstyp',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!t) return {};
    return this.sanitize(t as unknown as Record<string, unknown>);
  }
}
