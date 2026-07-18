import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

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

/** Ein exportierter Datenbestand (Schluessel im JSON + Entity + Sortierspalte). */
interface Descriptor {
  key: string;
  entity: EntityTarget<ObjectLiteral>;
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
      { key: 'auftragsPositionen', entity: OrderItem },
      { key: 'rechnungen', entity: Invoice },
      { key: 'rechnungsPositionen', entity: InvoiceItem },
      { key: 'termine', entity: Appointment },
      { key: 'inspektionen', entity: DamageInspection },
      { key: 'schaeden', entity: DamageItem },
      { key: 'schadenFotos', entity: DamagePhoto },
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
   * Streamt den kompletten Betriebs-Export als JSON in den Sink. Bei einem Fehler
   * MITTEN im Stream (Header sind schon raus) wird der Stream sauber geschlossen
   * und der Fehler geworfen/geloggt – der Controller kann dann nichts mehr am
   * Status aendern, deshalb best-effort.
   */
  async streamExport(user: AuthUser, sink: ExportSink): Promise<void> {
    const tenantId = user.tenantId;

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

    const descriptors = this.descriptors();
    for (let i = 0; i < descriptors.length; i++) {
      const d = descriptors[i];
      sink.write(`${JSON.stringify(d.key)}:[`);
      await this.streamEntity(tenantId, d.entity, sink);
      sink.write(i === descriptors.length - 1 ? ']\n' : '],\n');
    }

    sink.write('}\n');
    sink.end();

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'gdpr_tenant_export',
      entityType: 'Tenant',
      entityId: tenantId,
      payload: { entitaeten: descriptors.length },
    });
  }

  /** Streamt EINE Entitaet paginiert, tenant-scoped, mit Secret-Redaktion. */
  private async streamEntity(
    tenantId: string,
    entity: EntityTarget<ObjectLiteral>,
    sink: ExportSink,
  ): Promise<void> {
    const repo = this.dataSource.getRepository(entity);
    let offset = 0;
    let first = true;
    // Stabile Sortierung ueber die (immer vorhandene) uuid-PK id.
    for (;;) {
      const rows = await repo.find({
        where: { tenantId } as ObjectLiteral,
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
