import { DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { ServiceItem } from '../services/entities/service-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Product } from '../shop/entities/product.entity';
import { StockMovement } from '../shop/entities/stock-movement.entity';
import { PurchaseOrder } from '../shop/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../shop/entities/purchase-order-item.entity';
import { Rental } from '../shop/entities/rental.entity';
import { Location } from '../locations/entities/location.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { TimeEntry } from '../zeiterfassung/entities/time-entry.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { BookingRequest } from '../public-booking/entities/booking-request.entity';
import { OrderTime } from '../zeiterfassung/entities/order-time.entity';
import { OrderMaterial } from '../order-material/entities/order-material.entity';
import { FolienRolle } from '../folien-rollen/entities/folien-rolle.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { SupportMessage } from '../support/entities/support-message.entity';
import { MarketplaceDealer } from '../marketplace/entities/marketplace-dealer.entity';
import { MarketplaceProduct } from '../marketplace/entities/marketplace-product.entity';
import { MarketplaceClick } from '../marketplace/entities/marketplace-click.entity';
import { MarketplaceOrder } from '../marketplace/entities/marketplace-order.entity';
import { MarketplaceOrderItem } from '../marketplace/entities/marketplace-order-item.entity';
import { MarketplaceCategory } from '../marketplace/entities/marketplace-category.entity';
import { MarketplaceReview } from '../marketplace/entities/marketplace-review.entity';
import { MarketplaceProductImage } from '../marketplace/entities/marketplace-product-image.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { LayerMeasurement } from '../schichtdicke/entities/layer-measurement.entity';
import { LayerMeasurementPoint } from '../schichtdicke/entities/layer-measurement-point.entity';
import { IncomingInvoice } from '../e-invoice-eingang/entities/incoming-invoice.entity';
import { DataIncident } from '../incidents/entities/data-incident.entity';
import { SecurityEvent } from '../security/entities/security-event.entity';
import { IpBlock } from '../security/entities/ip-block.entity';
import { GeraeteInserat } from '../geraetemarkt/entities/geraete-inserat.entity';
import { GeraeteInseratBild } from '../geraetemarkt/entities/geraete-inserat-bild.entity';
import { GeraeteInseratMeldung } from '../geraetemarkt/entities/geraete-inserat-meldung.entity';
import { KassenbuchEintrag } from '../kassenbuch/entities/kassenbuch-eintrag.entity';
import { DellenKalkulation } from '../dellenkalkulation/entities/dellen-kalkulation.entity';
import { DellenMarker } from '../dellenkalkulation/entities/dellen-marker.entity';
import { DellenPreismatrix } from '../dellenkalkulation/entities/dellen-preismatrix.entity';
import { ReferralCode } from '../affiliate/entities/referral-code.entity';
import { Referral } from '../affiliate/entities/referral.entity';
import { ShowcaseItem } from '../showcase/entities/showcase-item.entity';
import { MarktBeobachtung } from '../marktregister/entities/markt-beobachtung.entity';
import { OrderFeedback } from '../orders/entities/order-feedback.entity';

/**
 * Alle Entities zentral, damit App-Modul, Seed-Skript UND die TypeORM-CLI
 * (migration:generate liest die Liste aus data-source.ts) exakt dieselbe
 * Menge sehen. Diese Liste ist die einzige Quelle der Wahrheit fuer das
 * Prod-Schema: fehlt eine hier registrierte @Entity, legt die Baseline-
 * Migration ihre Tabelle nie an -> in Prod `relation does not exist`.
 * Stand: 54 Entities (== Anzahl `*.entity.ts`-Dateien unter backend/src;
 * Sentinel Teil 2 ergaenzt IpBlock, Geraetemarkt ergaenzt GeraeteInserat*,
 * Affiliate ergaenzt ReferralCode + Referral, Schaufenster ergaenzt ShowcaseItem,
 * Marktrecherche-Register ergaenzt MarktBeobachtung, Mappe-Feedback ergaenzt
 * OrderFeedback).
 */
export const entities = [
  User,
  PasswordResetToken,
  Tenant,
  Customer,
  Vehicle,
  AuditLog,
  ServiceItem,
  Order,
  OrderItem,
  Invoice,
  InvoiceItem,
  Appointment,
  Product,
  StockMovement,
  PurchaseOrder,
  PurchaseOrderItem,
  Rental,
  Location,
  Plan,
  Subscription,
  TimeEntry,
  DamageInspection,
  DamageItem,
  DamagePhoto,
  DamageItemPhoto,
  BookingRequest,
  OrderTime,
  OrderMaterial,
  FolienRolle,
  SupportTicket,
  SupportMessage,
  MarketplaceDealer,
  MarketplaceProduct,
  MarketplaceClick,
  MarketplaceOrder,
  MarketplaceOrderItem,
  MarketplaceCategory,
  MarketplaceReview,
  MarketplaceProductImage,
  NewsletterSubscriber,
  LayerMeasurement,
  LayerMeasurementPoint,
  IncomingInvoice,
  DataIncident,
  SecurityEvent,
  IpBlock,
  GeraeteInserat,
  GeraeteInseratBild,
  GeraeteInseratMeldung,
  KassenbuchEintrag,
  DellenKalkulation,
  DellenMarker,
  DellenPreismatrix,
  ReferralCode,
  Referral,
  ShowcaseItem,
  MarktBeobachtung,
  OrderFeedback,
];

/**
 * Baut die TypeORM-Verbindungsoptionen aus der Umgebung.
 * `DB_TYPE=sqlite` (Default) -> lokale Datei ohne Infrastruktur.
 * `DB_TYPE=postgres` -> klassische Postgres-Verbindung.
 */
export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const dbType = (env.DB_TYPE || 'sqlite').toLowerCase();
  // Eindeutig: SQLite immer synchronize (kein Migrations-Setup), Postgres nur
  // ausserhalb Produktion. In Prod uebernehmen Migrationen das Schema.
  const synchronize = dbType === 'sqlite' ? true : env.NODE_ENV !== 'production';
  // TypeORM-CLI-Betrieb (migration:generate / migration:run): die Verbindung darf
  // beim Initialisieren WEDER auto-synchronisieren NOCH Migrationen automatisch
  // ausfuehren. Sonst diffed `migration:generate` gegen ein bereits gefuelltes
  // Schema (-> leere Baseline) bzw. laeuft der Abo-Backfill vor der Baseline.
  const cliMode = env.TYPEORM_CLI === 'true';

  if (dbType === 'postgres') {
    return {
      type: 'postgres',
      host: env.DB_HOST || 'localhost',
      port: parseInt(env.DB_PORT || '5432', 10),
      username: env.DB_USER || 'detailly',
      password: env.DB_PASS || 'detailly',
      database: env.DB_NAME || 'detailly',
      entities,
      synchronize: cliMode ? false : synchronize,
      // In Prod baut/aktualisiert NICHT mehr synchronize das Schema, sondern
      // committete Migrationen. Glob deckt ts (ts-node-CLI) UND js (dist) ab.
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      migrationsRun: cliMode ? false : env.NODE_ENV === 'production',
      migrationsTableName: 'typeorm_migrations',
      logging: env.NODE_ENV === 'development',
    };
  }

  // SQLite hat kein Migrations-Setup; Schema wird immer per synchronize erzeugt,
  // damit die Datei-DB (auch im gehosteten Produktions-Build) sofort funktioniert.
  return {
    type: 'better-sqlite3',
    database: env.DB_DATABASE || 'detailly.db',
    entities,
    synchronize: true,
    logging: false,
  };
}
