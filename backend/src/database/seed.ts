/**
 * Seed-Skript fuer die lauffaehige Demo.
 *
 * Aufruf: `npm run seed`
 *
 * Das Skript ist idempotent durch Reset: bei jedem Lauf werden die Tabellen
 * geleert (synchronize + dropSchema) und mit frischen Demo-Daten befuellt.
 * Standard-DB ist SQLite (Datei `detailly.db`), per `DB_TYPE=postgres`
 * umschaltbar.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { buildDataSourceOptions } from './data-source-options';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { Vehicle, FuelType } from '../vehicles/entities/vehicle.entity';
import { ServiceItem, ServiceCategory, ServiceUnit } from '../services/entities/service-item.entity';
import { Order, OrderStatus, ServiceType } from '../orders/entities/order.entity';
import { OrderItem, OrderItemType } from '../orders/entities/order-item.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Product } from '../shop/entities/product.entity';
import { Invoice, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';

dotenv.config();

const MWST = 0.19;

function tageVoraus(tage: number, stunde = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  d.setHours(stunde, 0, 0, 0);
  return d;
}

/**
 * Befuellt eine bereits initialisierte DataSource mit Demo-Daten.
 * Wird sowohl vom CLI-Seed (`npm run seed`) als auch beim App-Start
 * (Auto-Seed, wenn die DB leer ist) verwendet. Zerstoert die Verbindung NICHT.
 */
export async function seedDatabase(dataSource: DataSource) {
  const tenantRepo = dataSource.getRepository(Tenant);
  const userRepo = dataSource.getRepository(User);
  const customerRepo = dataSource.getRepository(Customer);
  const vehicleRepo = dataSource.getRepository(Vehicle);
  const serviceRepo = dataSource.getRepository(ServiceItem);
  const orderRepo = dataSource.getRepository(Order);
  const apptRepo = dataSource.getRepository(Appointment);
  const productRepo = dataSource.getRepository(Product);
  const invoiceRepo = dataSource.getRepository(Invoice);

  // --- Tenant ---
  const tenant = await tenantRepo.save(
    tenantRepo.create({
      name: 'Detailly Pilotbetrieb',
      slug: 'pilotbetrieb',
      email: 'info@detailly.de',
      phone: '+49 30 1234567',
      street: 'Musterstrasse 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      status: TenantStatus.ACTIVE,
    }),
  );
  console.log(`[seed] Tenant angelegt: ${tenant.name}`);

  // --- Benutzer (alle Rollen) ---
  const pw = await bcrypt.hash('Detailly2026!', 12);
  const mkUser = (email: string, firstName: string, lastName: string, role: UserRole) =>
    userRepo.create({ email, passwordHash: pw, firstName, lastName, role, tenantId: tenant.id });

  const admin = await userRepo.save(
    mkUser('admin@detailly.de', 'Admin', 'Detailly', UserRole.FRANCHISE_OWNER),
  );
  await userRepo.save([
    mkUser('manager@detailly.de', 'Maria', 'Manager', UserRole.MANAGER),
    mkUser('technik@detailly.de', 'Tom', 'Techniker', UserRole.TECHNICIAN),
    mkUser('empfang@detailly.de', 'Rita', 'Rezeption', UserRole.RECEPTIONIST),
  ]);
  const superAdmin = await userRepo.save(
    mkUser('superadmin@detailly.de', 'Super', 'Admin', UserRole.SUPER_ADMIN),
  );
  console.log('[seed] 5 Benutzer angelegt (alle Rollen).');

  // --- Kunden + Fahrzeuge ---
  const kunde1 = await customerRepo.save(
    customerRepo.create({
      tenantId: tenant.id,
      type: CustomerType.PRIVATE,
      firstName: 'Lukas',
      lastName: 'Meyer',
      email: 'lukas.meyer@example.de',
      phone: '+49 170 1111111',
      street: 'Eichenweg 12',
      city: 'Berlin',
      postalCode: '10827',
    }),
  );
  const kunde2 = await customerRepo.save(
    customerRepo.create({
      tenantId: tenant.id,
      type: CustomerType.PRIVATE,
      firstName: 'Sophie',
      lastName: 'Bauer',
      email: 'sophie.bauer@example.de',
      phone: '+49 170 2222222',
      street: 'Lindenallee 5',
      city: 'Potsdam',
      postalCode: '14467',
    }),
  );
  const kunde3 = await customerRepo.save(
    customerRepo.create({
      tenantId: tenant.id,
      type: CustomerType.BUSINESS,
      companyName: 'AutoHaus Premium GmbH',
      vatNumber: 'DE123456789',
      email: 'fuhrpark@autohaus-premium.de',
      phone: '+49 30 9999999',
      street: 'Industriestrasse 88',
      city: 'Berlin',
      postalCode: '12099',
    }),
  );
  const kunde4 = await customerRepo.save(
    customerRepo.create({
      tenantId: tenant.id,
      type: CustomerType.PRIVATE,
      firstName: 'Jonas',
      lastName: 'Klein',
      email: 'jonas.klein@example.de',
      phone: '+49 170 4444444',
      street: 'Bergstrasse 3',
      city: 'Berlin',
      postalCode: '10965',
    }),
  );
  console.log('[seed] 4 Kunden angelegt.');

  const bmw = await vehicleRepo.save(
    vehicleRepo.create({
      tenantId: tenant.id,
      customerId: kunde1.id,
      make: 'BMW',
      model: 'M3 Competition',
      variant: 'G80',
      year: 2022,
      color: 'Frozen Black',
      licensePlate: 'B-MW 380',
      fuelType: FuelType.PETROL,
      estimatedSqm: 18.5,
    }),
  );
  const tesla = await vehicleRepo.save(
    vehicleRepo.create({
      tenantId: tenant.id,
      customerId: kunde2.id,
      make: 'Tesla',
      model: 'Model Y',
      variant: 'Long Range',
      year: 2023,
      color: 'Pearl White',
      licensePlate: 'P-TS 100E',
      fuelType: FuelType.ELECTRIC,
      estimatedSqm: 20.0,
    }),
  );
  const porsche = await vehicleRepo.save(
    vehicleRepo.create({
      tenantId: tenant.id,
      customerId: kunde3.id,
      make: 'Porsche',
      model: '911 Carrera',
      variant: '992',
      year: 2021,
      color: 'Guards Red',
      licensePlate: 'B-PR 911',
      fuelType: FuelType.PETROL,
      estimatedSqm: 16.0,
    }),
  );
  await vehicleRepo.save(
    vehicleRepo.create({
      tenantId: tenant.id,
      customerId: kunde4.id,
      make: 'Audi',
      model: 'RS6 Avant',
      year: 2020,
      color: 'Nardograu',
      licensePlate: 'B-AU 600',
      fuelType: FuelType.PETROL,
      estimatedSqm: 21.0,
    }),
  );
  console.log('[seed] 4 Fahrzeuge angelegt.');

  // --- Leistungen / Pakete ---
  const leistungen = await serviceRepo.save([
    serviceRepo.create({ tenantId: tenant.id, name: 'Basis-Aufbereitung', beschreibung: 'Aussen- und Innenreinigung', kategorie: ServiceCategory.AUFBEREITUNG, basispreis: 149, einheit: ServiceUnit.PAUSCHAL }),
    serviceRepo.create({ tenantId: tenant.id, name: 'Premium-Aufbereitung', beschreibung: 'Inkl. Politur und Lackreinigung', kategorie: ServiceCategory.AUFBEREITUNG, basispreis: 399, einheit: ServiceUnit.PAUSCHAL }),
    serviceRepo.create({ tenantId: tenant.id, name: 'Keramikversiegelung', beschreibung: '9H Keramik-Coating, 2 Jahre Schutz', kategorie: ServiceCategory.AUFBEREITUNG, basispreis: 899, einheit: ServiceUnit.PAUSCHAL }),
    serviceRepo.create({ tenantId: tenant.id, name: 'Teilfolierung', beschreibung: 'Teilbereiche nach Wunsch', kategorie: ServiceCategory.FOLIERUNG, basispreis: 65, einheit: ServiceUnit.QM }),
    serviceRepo.create({ tenantId: tenant.id, name: 'Vollfolierung', beschreibung: 'Komplette Fahrzeugfolierung', kategorie: ServiceCategory.FOLIERUNG, basispreis: 55, einheit: ServiceUnit.QM }),
    serviceRepo.create({ tenantId: tenant.id, name: 'PPF Front', beschreibung: 'Lackschutzfolie Frontpartie', kategorie: ServiceCategory.PPF, basispreis: 950, einheit: ServiceUnit.PAUSCHAL }),
    serviceRepo.create({ tenantId: tenant.id, name: 'PPF Komplett', beschreibung: 'Lackschutzfolie gesamtes Fahrzeug', kategorie: ServiceCategory.PPF, basispreis: 120, einheit: ServiceUnit.QM }),
  ]);
  console.log(`[seed] ${leistungen.length} Leistungen/Pakete angelegt.`);

  // --- Auftraege in verschiedenen Status ---
  const calc = (items: { menge: number; einzelpreis: number }[], material = 0) => {
    const netto = items.reduce((s, i) => s + i.menge * i.einzelpreis, 0) + material;
    const mwst = Math.round(netto * MWST * 100) / 100;
    return { nettoSumme: netto, mwstBetrag: mwst, gesamtpreis: Math.round((netto + mwst) * 100) / 100 };
  };

  const mkItem = (beschreibung: string, menge: number, einzelpreis: number, typ = OrderItemType.LEISTUNG) =>
    Object.assign(new OrderItem(), { beschreibung, menge, einzelpreis, gesamtpreis: menge * einzelpreis, typ });

  let lfd = 0;
  const mkOrder = (data: Partial<Order>, items: OrderItem[], material = 0) => {
    lfd += 1;
    return orderRepo.create({
      tenantId: tenant.id,
      auftragsnummer: `AU-${new Date().getFullYear()}-${String(lfd).padStart(4, '0')}`,
      materialkosten: material,
      items,
      ...calc(items.map((i) => ({ menge: Number(i.menge), einzelpreis: Number(i.einzelpreis) })), material),
      ...data,
    });
  };

  const order1 = await orderRepo.save(
    mkOrder(
      { customerId: kunde1.id, vehicleId: bmw.id, assignedUserId: admin.id, serviceType: ServiceType.AUFBEREITUNG, status: OrderStatus.IN_ARBEIT, geplanterStart: tageVoraus(1), geplantesEnde: tageVoraus(1, 17) },
      [mkItem('Premium-Aufbereitung', 1, 399), mkItem('Keramikversiegelung', 1, 899)],
      40,
    ),
  );
  await orderRepo.save(
    mkOrder(
      { customerId: kunde2.id, vehicleId: tesla.id, serviceType: ServiceType.FOLIERUNG, status: OrderStatus.KALKULIERT, geplanterStart: tageVoraus(3) },
      [mkItem('Teilfolierung Dach + Spiegel', 4.5, 65)],
      120,
    ),
  );
  await orderRepo.save(
    mkOrder(
      { customerId: kunde3.id, vehicleId: porsche.id, serviceType: ServiceType.PPF, status: OrderStatus.BESTAETIGT, geplanterStart: tageVoraus(5) },
      [mkItem('PPF Komplett', 16, 120, OrderItemType.LEISTUNG)],
      300,
    ),
  );
  await orderRepo.save(
    mkOrder(
      { customerId: kunde1.id, vehicleId: bmw.id, serviceType: ServiceType.AUFBEREITUNG, status: OrderStatus.ANGEFRAGT },
      [mkItem('Basis-Aufbereitung', 1, 149)],
    ),
  );
  const order5 = await orderRepo.save(
    mkOrder(
      { customerId: kunde3.id, vehicleId: porsche.id, serviceType: ServiceType.AUFBEREITUNG, status: OrderStatus.FERTIG },
      [mkItem('Premium-Aufbereitung', 1, 399)],
    ),
  );
  console.log('[seed] 5 Auftraege in verschiedenen Status angelegt.');

  // --- Termine in der naechsten Woche ---
  await apptRepo.save([
    apptRepo.create({ tenantId: tenant.id, orderId: order1.id, customerId: kunde1.id, vehicleId: bmw.id, assignedUserId: admin.id, titel: 'BMW M3 – Aufbereitung', start: tageVoraus(1, 9), ende: tageVoraus(1, 17), status: AppointmentStatus.BESTAETIGT }),
    apptRepo.create({ tenantId: tenant.id, customerId: kunde2.id, vehicleId: tesla.id, titel: 'Tesla Model Y – Folierung', start: tageVoraus(3, 8), ende: tageVoraus(3, 16), status: AppointmentStatus.GEPLANT }),
    apptRepo.create({ tenantId: tenant.id, customerId: kunde3.id, vehicleId: porsche.id, titel: 'Porsche 911 – PPF Komplett', start: tageVoraus(5, 9), ende: tageVoraus(6, 17), status: AppointmentStatus.GEPLANT }),
    apptRepo.create({ tenantId: tenant.id, customerId: kunde4.id, titel: 'Beratung Vollfolierung Audi RS6', start: tageVoraus(2, 14), ende: tageVoraus(2, 15), status: AppointmentStatus.GEPLANT }),
  ]);
  console.log('[seed] 4 Termine angelegt.');

  // --- Produkte / Lager ---
  await productRepo.save([
    productRepo.create({ tenantId: tenant.id, name: 'PPF-Folie XPEL Ultimate Plus', sku: 'PPF-001', kategorie: 'Folie', einkaufspreis: 18, verkaufspreis: 35, bestand: 120, mindestbestand: 30, einheit: 'qm' }),
    productRepo.create({ tenantId: tenant.id, name: 'Wrapping-Folie 3M 2080 Matt Schwarz', sku: 'WRAP-002', kategorie: 'Folie', einkaufspreis: 12, verkaufspreis: 28, bestand: 8, mindestbestand: 20, einheit: 'qm' }),
    productRepo.create({ tenantId: tenant.id, name: 'Politur Menzerna 2500', sku: 'POL-003', kategorie: 'Politur', einkaufspreis: 14, verkaufspreis: 29, bestand: 25, mindestbestand: 10, einheit: 'Flasche' }),
    productRepo.create({ tenantId: tenant.id, name: 'Keramikversiegelung Gtechniq Crystal', sku: 'KER-004', kategorie: 'Keramik', einkaufspreis: 45, verkaufspreis: 89, bestand: 12, mindestbestand: 5, einheit: 'Set' }),
    productRepo.create({ tenantId: tenant.id, name: 'Poliermaschine Rupes LHR21 (Vermietung)', sku: 'TOOL-005', kategorie: 'Werkzeug', einkaufspreis: 380, verkaufspreis: 0, bestand: 3, mindestbestand: 1, einheit: 'Stueck', istVermietbar: true, mietpreisProTag: 35 }),
  ]);
  console.log('[seed] 5 Produkte angelegt (1 unter Mindestbestand, 1 vermietbar).');

  // --- Beispiel-Rechnung aus fertigem Auftrag ---
  const reItems = [Object.assign(new InvoiceItem(), { beschreibung: 'Premium-Aufbereitung', menge: 1, einzelpreis: 399, gesamtpreis: 399 })];
  const reNetto = 399;
  await invoiceRepo.save(
    invoiceRepo.create({
      tenantId: tenant.id,
      nummer: `RE-${new Date().getFullYear()}-0001`,
      art: InvoiceKind.RECHNUNG,
      customerId: kunde3.id,
      orderId: order5.id,
      status: InvoiceStatus.BEZAHLT,
      datum: new Date(),
      leistungsdatum: new Date(),
      netto: reNetto,
      mwst: Math.round(reNetto * MWST * 100) / 100,
      brutto: Math.round(reNetto * (1 + MWST) * 100) / 100,
      items: reItems,
    }),
  );
  console.log('[seed] 1 Beispiel-Rechnung (bezahlt) angelegt.');

  console.log('\n[seed] Fertig! Demo-Login: admin@detailly.de / Detailly2026!');
  console.log(`[seed] Super-Admin: ${superAdmin.email} / Detailly2026!`);
}

/** CLI-Einstieg: eigene Verbindung, Schema zuruecksetzen, dann befuellen. */
async function runCli() {
  const options = { ...buildDataSourceOptions(), dropSchema: true, synchronize: true };
  const dataSource = new DataSource(options as any);
  await dataSource.initialize();
  console.log(`[seed] Verbindung hergestellt (${options.type}). Schema zurueckgesetzt.`);
  await seedDatabase(dataSource);
  await dataSource.destroy();
}

// Nur ausfuehren, wenn direkt als Skript gestartet (nicht beim Import).
if (require.main === module) {
  runCli().catch((err) => {
    console.error('[seed] Fehler:', err);
    process.exit(1);
  });
}
