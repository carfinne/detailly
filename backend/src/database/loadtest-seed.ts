/**
 * LASTTEST-Seeder (Dev): befuellt einen ISOLIERTEN Tenant "Lasttest GmbH" mit
 * realistischem Volumen, um die P0-Performance-Befunde mit echten Datenmengen zu
 * messen (statt auf Verdacht zu optimieren). Der Demo-/Pilot-Tenant bleibt sauber.
 *
 * Aufruf:  npx ts-node -r tsconfig-paths/register src/database/loadtest-seed.ts
 * Aufraeumen: DELETE der Lasttest-Tenant-Zeilen (siehe Ende-Hinweis) oder npm run seed.
 *
 * Nutzt TypeORM-Repos -> die Encryption-Transformer (internerHinweis/hinweis)
 * verschluesseln beim Insert real, sodass der Decrypt-Overhead beim Lesen
 * tatsaechlich gemessen wird.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { buildDataSourceOptions } from './data-source-options';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { Vehicle, FuelType } from '../vehicles/entities/vehicle.entity';
import { Order, OrderStatus, ServiceType } from '../orders/entities/order.entity';
import { OrderItem, OrderItemType } from '../orders/entities/order-item.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';

dotenv.config();

const N_CUST = 1500;
const N_VEH = 1500;
const N_ORD = 5000;
const N_INV = 5000;

const TENANT_SLUG = 'lasttest';
const LOGIN = 'loadtest@test.de';
const PASS = 'Loadtest2026!';

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rnd = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
const tageZurueck = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

async function insertChunked<T extends ObjectLiteral>(repo: Repository<T>, rows: T[], size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    await repo.insert(rows.slice(i, i + size) as any);
  }
}

async function main() {
  const t0 = Date.now();
  const ds = new DataSource({ ...buildDataSourceOptions(), synchronize: true } as any);
  await ds.initialize();
  console.log(`[loadtest] verbunden (${ds.options.type}).`);

  // Bestehenden Lasttest-Tenant entfernen (idempotent neu aufbauen).
  const tRepo = ds.getRepository(Tenant);
  const alt = await tRepo.findOne({ where: { slug: TENANT_SLUG } });
  if (alt) {
    const tid = alt.id;
    for (const tbl of ['invoice_items', 'order_items']) {
      await ds.query(
        `DELETE FROM ${tbl} WHERE ${tbl === 'invoice_items' ? 'invoiceId' : 'orderId'} IN (SELECT id FROM ${tbl === 'invoice_items' ? 'invoices' : 'orders'} WHERE tenantId = ?)`,
        [tid],
      );
    }
    for (const tbl of ['invoices', 'orders', 'vehicles', 'customers', 'subscriptions', 'users']) {
      await ds.query(`DELETE FROM ${tbl} WHERE tenantId = ?`, [tid]);
    }
    await ds.query(`DELETE FROM tenants WHERE id = ?`, [tid]);
    console.log('[loadtest] alten Lasttest-Tenant entfernt.');
  }

  const tenantId = randomUUID();
  await tRepo.insert({
    id: tenantId,
    name: 'Lasttest GmbH',
    slug: TENANT_SLUG,
    email: 'info@lasttest.de',
    country: 'DE',
    status: TenantStatus.ACTIVE,
  } as any);
  await ds.getRepository(User).insert({
    id: randomUUID(),
    email: LOGIN,
    passwordHash: await bcrypt.hash(PASS, 12),
    firstName: 'Last',
    lastName: 'Test',
    role: UserRole.OWNER,
    tenantId,
    isActive: true,
  } as any);
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await ds.getRepository(Subscription).insert({
    id: randomUUID(),
    tenantId,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date(),
    currentPeriodEnd: periodEnd,
  } as any);
  console.log(`[loadtest] Tenant + Login ${LOGIN} / ${PASS} angelegt.`);

  // --- Kunden ---
  const custIds: string[] = [];
  const customers: Partial<Customer>[] = [];
  for (let i = 0; i < N_CUST; i++) {
    const id = randomUUID();
    custIds.push(id);
    customers.push({
      id,
      tenantId,
      type: i % 5 === 0 ? CustomerType.BUSINESS : CustomerType.PRIVATE,
      firstName: `Kunde${i}`,
      lastName: `Muster${i}`,
      companyName: i % 5 === 0 ? `Firma ${i} GmbH` : undefined,
      email: `kunde${i}@example.de`,
      phone: `+49 30 ${100000 + i}`,
      street: `Teststrasse ${i}`,
      city: 'Berlin',
      postalCode: '10115',
    });
  }
  await insertChunked(ds.getRepository(Customer), customers as any);
  console.log(`[loadtest] ${N_CUST} Kunden.`);

  // --- Fahrzeuge ---
  const vehIds: string[] = [];
  const vehicles: Partial<Vehicle>[] = [];
  const makes = ['BMW', 'Audi', 'Mercedes', 'VW', 'Tesla', 'Porsche'];
  for (let i = 0; i < N_VEH; i++) {
    const id = randomUUID();
    vehIds.push(id);
    vehicles.push({
      id,
      tenantId,
      customerId: pick(custIds),
      make: pick(makes),
      model: `Model ${i % 50}`,
      year: 2015 + (i % 10),
      color: 'Schwarz',
      licensePlate: `B-LT ${i}`,
      fuelType: pick([FuelType.PETROL, FuelType.DIESEL, FuelType.ELECTRIC]),
    });
  }
  await insertChunked(ds.getRepository(Vehicle), vehicles as any);
  console.log(`[loadtest] ${N_VEH} Fahrzeuge.`);

  // --- Auftraege + Positionen ---
  const ordStatus = Object.values(OrderStatus);
  const orders: Partial<Order>[] = [];
  const orderItems: Partial<OrderItem>[] = [];
  const orderIds: string[] = [];
  for (let i = 0; i < N_ORD; i++) {
    const id = randomUUID();
    orderIds.push(id);
    const netto = rnd(100, 2500);
    orders.push({
      id,
      tenantId,
      auftragsnummer: `AU-2026-${String(i + 1).padStart(5, '0')}`,
      customerId: pick(custIds),
      vehicleId: pick(vehIds),
      serviceType: pick(Object.values(ServiceType)),
      status: pick(ordStatus),
      nettoSumme: netto,
      mwstBetrag: Math.round(netto * 0.19 * 100) / 100,
      gesamtpreis: Math.round(netto * 1.19 * 100) / 100,
      // Verschluesseltes Feld -> Decrypt-Pfad beim Listen-Read messbar.
      internerHinweis: `Interne Notiz zu Auftrag ${i}: Kunde bevorzugt Termin vormittags.`,
      createdAt: tageZurueck(Math.floor(Math.random() * 180)),
    });
    const nItems = 1 + (i % 3);
    for (let k = 0; k < nItems; k++) {
      orderItems.push({
        id: randomUUID(),
        orderId: id,
        beschreibung: pick(['Aufbereitung', 'Politur', 'Folierung', 'PPF Front', 'Keramik', 'Innenreinigung']),
        typ: OrderItemType.LEISTUNG,
        menge: 1,
        einzelpreis: rnd(50, 900),
        gesamtpreis: rnd(50, 900),
      });
    }
  }
  await insertChunked(ds.getRepository(Order), orders as any);
  await insertChunked(ds.getRepository(OrderItem), orderItems as any);
  console.log(`[loadtest] ${N_ORD} Auftraege + ${orderItems.length} Positionen.`);

  // --- Rechnungen + Positionen ---
  const invoices: Partial<Invoice>[] = [];
  const invoiceItems: Partial<InvoiceItem>[] = [];
  let reLfd = 1;
  for (let i = 0; i < N_INV; i++) {
    const id = randomUUID();
    const r = Math.random();
    const status = r < 0.4 ? InvoiceStatus.BEZAHLT : r < 0.8 ? InvoiceStatus.OFFEN : InvoiceStatus.ENTWURF;
    const festgesetzt = status !== InvoiceStatus.ENTWURF;
    const netto = rnd(100, 2500);
    const datum = tageZurueck(Math.floor(Math.random() * 180));
    invoices.push({
      id,
      tenantId,
      nummer: festgesetzt ? `RE-2026-${String(reLfd++).padStart(5, '0')}` : null,
      art: InvoiceKind.RECHNUNG,
      customerId: pick(custIds),
      orderId: pick(orderIds),
      status,
      datum,
      leistungsdatum: datum,
      netto,
      mwst: Math.round(netto * 0.19 * 100) / 100,
      brutto: Math.round(netto * 1.19 * 100) / 100,
      mwstSatz: 19,
      zahldatum: status === InvoiceStatus.BEZAHLT ? datum : null,
      // Verschluesseltes Feld -> Decrypt-Pfad beim Listen-Read messbar.
      hinweis: `Zahlbar innerhalb 14 Tagen. Vielen Dank fuer Ihren Auftrag ${i}.`,
      createdAt: datum,
    });
    const nItems = 1 + (i % 3);
    for (let k = 0; k < nItems; k++) {
      invoiceItems.push({
        id: randomUUID(),
        invoiceId: id,
        beschreibung: pick(['Aufbereitung', 'Politur', 'Folierung', 'PPF Front', 'Keramik']),
        menge: 1,
        einzelpreis: rnd(50, 900),
        gesamtpreis: rnd(50, 900),
      });
    }
  }
  await insertChunked(ds.getRepository(Invoice), invoices as any);
  await insertChunked(ds.getRepository(InvoiceItem), invoiceItems as any);
  console.log(`[loadtest] ${N_INV} Rechnungen + ${invoiceItems.length} Positionen.`);

  await ds.destroy();
  console.log(`[loadtest] FERTIG in ${((Date.now() - t0) / 1000).toFixed(1)}s. Login: ${LOGIN} / ${PASS}`);
}

main().catch((err) => {
  console.error('[loadtest] Fehler:', err);
  process.exit(1);
});
