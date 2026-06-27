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
import { VehicleIntake } from '../intake/entities/vehicle-intake.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { TimeEntry } from '../zeiterfassung/entities/time-entry.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { DamagePhoto } from '../inspection/entities/damage-photo.entity';
import { DamageItemPhoto } from '../inspection/entities/damage-item-photo.entity';
import { BookingRequest } from '../public-booking/entities/booking-request.entity';

/** Alle Entities zentral, damit App-Modul und Seed-Skript dieselbe Liste nutzen. */
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
  VehicleIntake,
  Plan,
  Subscription,
  TimeEntry,
  DamageInspection,
  DamageItem,
  DamagePhoto,
  DamageItemPhoto,
  BookingRequest,
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

  if (dbType === 'postgres') {
    return {
      type: 'postgres',
      host: env.DB_HOST || 'localhost',
      port: parseInt(env.DB_PORT || '5432', 10),
      username: env.DB_USER || 'detailly',
      password: env.DB_PASS || 'detailly',
      database: env.DB_NAME || 'detailly',
      entities,
      synchronize,
      // In Prod baut/aktualisiert NICHT mehr synchronize das Schema, sondern
      // committete Migrationen. Glob deckt ts (ts-node-CLI) UND js (dist) ab.
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      migrationsRun: env.NODE_ENV === 'production',
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
