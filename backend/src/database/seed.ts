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
import { Plan } from '../subscriptions/entities/plan.entity';
import { PLAN_CATALOG } from '../subscriptions/plan-catalog';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { DamageInspection } from '../inspection/entities/damage-inspection.entity';
import { DamageItem } from '../inspection/entities/damage-item.entity';
import { TimeEntry, TimeEntryType } from '../zeiterfassung/entities/time-entry.entity';
import { MarketplaceDealer } from '../marketplace/entities/marketplace-dealer.entity';
import { MarketplaceProduct } from '../marketplace/entities/marketplace-product.entity';
import { MarketplaceCategory } from '../marketplace/entities/marketplace-category.entity';
import { MarketplaceReview } from '../marketplace/entities/marketplace-review.entity';
import { MarketplaceOrder, MarketplaceOrderStatus } from '../marketplace/entities/marketplace-order.entity';
import { MarketplaceOrderItem } from '../marketplace/entities/marketplace-order-item.entity';
import { seedMarketplaceCategories } from '../marketplace/data/marketplace-taxonomy';
import { DellenPreismatrix } from '../dellenkalkulation/entities/dellen-preismatrix.entity';
import { DEFAULT_DELLEN_PREISMATRIX } from '../dellenkalkulation/dellen-preis.util';

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
  const planRepo = dataSource.getRepository(Plan);
  const subscriptionRepo = dataSource.getRepository(Subscription);
  const timeEntryRepo = dataSource.getRepository(TimeEntry);

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

  // --- Default-Preismatrix der Dellenkalkulation (Smart Repair / PDR) ---
  // Werkstattnahe Richtwerte aus dem Katalog; jeder Betrieb passt sie in den
  // Einstellungen an. Ohne Zeile greift ohnehin der Code-Default (lazy) – der
  // Seed macht die Matrix im Demo-Betrieb aber sofort sicht- und editierbar.
  const dm = DEFAULT_DELLEN_PREISMATRIX;
  await dataSource.getRepository(DellenPreismatrix).save(
    dataSource.getRepository(DellenPreismatrix).create({
      tenantId: tenant.id,
      basis1Euro: dm.basispreise['1euro'].toFixed(2),
      basis2Euro: dm.basispreise['2euro'].toFixed(2),
      basis5Euro: dm.basispreise['5euro'].toFixed(2),
      basisGolfball: dm.basispreise.golfball.toFixed(2),
      basisGroesser: dm.basispreise.groesser.toFixed(2),
      kantenFaktor: dm.kantenFaktor.toFixed(3),
      aluFaktor: dm.aluFaktor.toFixed(3),
      lackschadenAufschlag: dm.lackschadenAufschlag.toFixed(2),
      mindestpauschale: dm.mindestpauschale.toFixed(2),
      anfahrtspauschale: dm.anfahrtspauschale.toFixed(2),
      hagelStaffel: dm.hagelStaffel,
    }),
  );

  // --- Abo-Tarife (SaaS, Preismodell V2: Starter/Basic/Pro) ---
  // Definitionen liegen zentral im Tarif-Katalog (docs/PRICING_V2.md); Preise
  // sind Default/Anzeige, verbindlich fuer den Kauf ist die in Stripe gepflegte
  // Price-ID (stripePriceId/…Yearly, vom Betreiber im Tarif-Editor gesetzt).
  const plaene = await planRepo.save(PLAN_CATALOG.map((p) => planRepo.create(p)));
  // Pilot bekommt Pro: dieser Tarif fuehrt ALLE Feature-Keys, damit das Nachziehen
  // neuer Gates dem Bestandsbetrieb kein Modul entzieht (Rueckwaertskompatibilitaet).
  const planPro = plaene.find((p) => p.slug === 'pro')!;
  console.log(`[seed] ${plaene.length} Abo-Tarife angelegt (${plaene.map((p) => p.name).join('/')}).`);

  // --- Aktives Abo des Pilotbetriebs (Tarif Pro, laeuft 1 Monat) ---
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await subscriptionRepo.save(
    subscriptionRepo.create({
      tenantId: tenant.id,
      planId: planPro.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    }),
  );
  console.log('[seed] Aktives Abo fuer Pilotbetrieb angelegt (Pro).');

  // --- Benutzer (alle Rollen) ---
  // Der Fallback ist NUR fuer lokale Dev-Demos gedacht. In Production haette
  // sonst ein manueller `npm run seed` ohne gesetztes SEED_ADMIN_PASSWORD
  // Konten mit einem oeffentlich im Repo sichtbaren Passwort angelegt.
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error(
      'Seed in Production ohne SEED_ADMIN_PASSWORD verboten - der Dev-Fallback ist oeffentlich bekannt.',
    );
  }
  const pw = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Detailly2026!', 12);
  const mkUser = (email: string, firstName: string, lastName: string, role: UserRole) =>
    userRepo.create({ email, passwordHash: pw, firstName, lastName, role, tenantId: tenant.id });

  const admin = await userRepo.save(
    mkUser('admin@detailly.de', 'Admin', 'Detailly', UserRole.OWNER),
  );
  await userRepo.save([
    mkUser('manager@detailly.de', 'Maria', 'Manager', UserRole.MANAGER),
    mkUser('technik@detailly.de', 'Tom', 'Techniker', UserRole.TECHNICIAN),
    mkUser('empfang@detailly.de', 'Rita', 'Rezeption', UserRole.RECEPTIONIST),
  ]);
  const superAdmin = await userRepo.save(
    mkUser('superadmin@detailly.de', 'Super', 'Admin', UserRole.PLATFORM_ADMIN),
  );
  console.log('[seed] 5 Benutzer angelegt (alle Rollen).');

  // --- Demo-Stempelungen (Zeiterfassung) ---
  const stempelZeit = (tageZurueck: number, stunde: number, minute = 0): Date => {
    const d = new Date();
    d.setDate(d.getDate() - tageZurueck);
    d.setHours(stunde, minute, 0, 0);
    return d;
  };
  await timeEntryRepo.save([
    timeEntryRepo.create({ tenantId: tenant.id, userId: admin.id, art: TimeEntryType.KOMMEN, zeitpunkt: stempelZeit(2, 8), korrigiert: false }),
    timeEntryRepo.create({ tenantId: tenant.id, userId: admin.id, art: TimeEntryType.GEHEN, zeitpunkt: stempelZeit(2, 17), korrigiert: false }),
    timeEntryRepo.create({ tenantId: tenant.id, userId: admin.id, art: TimeEntryType.KOMMEN, zeitpunkt: stempelZeit(1, 8, 15), korrigiert: false }),
    timeEntryRepo.create({ tenantId: tenant.id, userId: admin.id, art: TimeEntryType.GEHEN, zeitpunkt: stempelZeit(1, 16, 45), korrigiert: false }),
    timeEntryRepo.create({ tenantId: tenant.id, userId: admin.id, art: TimeEntryType.KOMMEN, zeitpunkt: stempelZeit(0, 8), korrigiert: false }),
  ]);
  console.log('[seed] Demo-Stempelungen angelegt (Zeiterfassung).');

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

  // --- Demo-Inspektion (3D-Schadenserfassung): 1 Vorschaden + 1 Neuschaden ---
  const inspectionRepo = dataSource.getRepository(DamageInspection);
  const damageItemRepo = dataSource.getRepository(DamageItem);
  const inspektion = await inspectionRepo.save(
    inspectionRepo.create({
      tenantId: tenant.id,
      customerId: kunde1.id,
      vehicleId: bmw.id,
      orderId: order1.id,
      typ: 'annahme',
      status: 'abgeschlossen',
      modelKey: 'generic-5door',
      kmStand: 84120,
      tankstand: 45,
      erfasstVonUserId: admin.id,
      erfasstVonRolle: admin.role,
      notiz: 'Demo-Inspektion (3D-Schadenserfassung).',
    }),
  );
  await damageItemRepo.save([
    damageItemRepo.create({
      tenantId: tenant.id,
      inspectionId: inspektion.id,
      partId: 'tuer_vl',
      partLabel: 'Tuer vorne links',
      positionMode: '3d',
      position3d: { x: -0.812, y: 0.43, z: 0.155, nx: -1, ny: 0, nz: 0 },
      origin: 'vorschaden',
      art: 'kratzer',
      schweregrad: 'leicht',
      groesseLaengeMm: 120,
      reparaturart: 'polieren',
      status: 'uebernommen',
      notiz: 'Vorschaden, Kunde bei Annahme hingewiesen.',
      istUebernommen: false,
    }),
    damageItemRepo.create({
      tenantId: tenant.id,
      inspectionId: inspektion.id,
      partId: 'stossfaenger_hinten',
      partLabel: 'Stossfaenger hinten',
      positionMode: '3d',
      position3d: { x: 0.02, y: 0.21, z: -1.94, nx: 0, ny: 0.2, nz: -0.98 },
      origin: 'neu',
      art: 'delle',
      schweregrad: 'mittel',
      ausmass: 'handtellergross',
      reparaturart: 'instandsetzen',
      status: 'offen',
      kostenSchaetzung: '180.00',
    }),
  ]);
  console.log('[seed] Demo-Inspektion (3D-Schaden) angelegt.');

  // --- Termine in der naechsten Woche ---
  await apptRepo.save([
    apptRepo.create({ tenantId: tenant.id, orderId: order1.id, customerId: kunde1.id, vehicleId: bmw.id, assignedUserId: admin.id, titel: 'BMW M3 – Aufbereitung', start: tageVoraus(1, 9), ende: tageVoraus(1, 17), status: AppointmentStatus.BESTAETIGT }),
    apptRepo.create({ tenantId: tenant.id, customerId: kunde2.id, vehicleId: tesla.id, titel: 'Tesla Model Y – Folierung', start: tageVoraus(3, 8), ende: tageVoraus(3, 16), status: AppointmentStatus.GEPLANT }),
    apptRepo.create({ tenantId: tenant.id, customerId: kunde3.id, vehicleId: porsche.id, titel: 'Porsche 911 – PPF Komplett', start: tageVoraus(5, 9), ende: tageVoraus(6, 17), status: AppointmentStatus.GEPLANT }),
    apptRepo.create({ tenantId: tenant.id, customerId: kunde4.id, titel: 'Beratung Vollfolierung Audi RS6', start: tageVoraus(2, 14), ende: tageVoraus(2, 15), status: AppointmentStatus.GEPLANT }),
    // Laeuft gerade (5. Status LAEUFT): blockt Slots, zaehlt wie bestaetigt als aktiv.
    apptRepo.create({ tenantId: tenant.id, orderId: order1.id, customerId: kunde1.id, vehicleId: bmw.id, assignedUserId: admin.id, titel: 'BMW M3 – Politur (in Arbeit)', start: tageVoraus(0, 8), ende: tageVoraus(0, 18), status: AppointmentStatus.LAEUFT }),
  ]);
  console.log('[seed] 5 Termine angelegt.');

  // --- Produkte / Lager ---
  await productRepo.save([
    productRepo.create({ tenantId: tenant.id, name: 'PPF-Folie XPEL Ultimate Plus', sku: 'PPF-001', kategorie: 'Folie', einkaufspreis: 18, verkaufspreis: 35, bestand: 120, mindestbestand: 30, einheit: 'qm' }),
    productRepo.create({ tenantId: tenant.id, name: 'Wrapping-Folie 3M 2080 Matt Schwarz', sku: 'WRAP-002', kategorie: 'Folie', einkaufspreis: 12, verkaufspreis: 28, bestand: 8, mindestbestand: 20, einheit: 'qm' }),
    productRepo.create({ tenantId: tenant.id, name: 'Politur Menzerna 2500', sku: 'POL-003', kategorie: 'Politur', einkaufspreis: 14, verkaufspreis: 29, bestand: 25, mindestbestand: 10, einheit: 'Flasche' }),
    productRepo.create({ tenantId: tenant.id, name: 'Keramikversiegelung Gtechniq Crystal', sku: 'KER-004', kategorie: 'Keramik', einkaufspreis: 45, verkaufspreis: 89, bestand: 12, mindestbestand: 5, einheit: 'Set' }),
    productRepo.create({ tenantId: tenant.id, name: 'Poliermaschine Rupes LHR21 (Vermietung)', sku: 'TOOL-005', kategorie: 'Werkzeug', einkaufspreis: 380, verkaufspreis: 0, bestand: 3, mindestbestand: 1, einheit: 'Stueck', istVermietbar: true, mietpreisProTag: 35 }),
  ]);
  console.log('[seed] 5 Produkte angelegt (1 unter Mindestbestand, 1 vermietbar).');

  // --- B2B-Marktplatz (plattform-weit, KEIN tenantId) ---
  // Beispiel-Shop: neutrale Fantasie-Haendler + echte Produktmarken. Idempotent
  // per Haendler-Name bzw. (Haendler+Produktname): schon vorhandene Datensaetze
  // werden NICHT erneut angelegt (Auto-Seed beim Start darf mehrfach laufen,
  // ohne den Katalog zu verdoppeln).
  await seedMarketplace(dataSource, { passwordHash: pw, pilotTenantId: tenant.id, pilotUserId: admin.id });

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

  console.log('\n[seed] Fertig! Demo-Daten angelegt (Credentials: siehe SEED_ADMIN_PASSWORD bzw. interne Doku).');
}

// ---------------------------------------------------------------------------
// Demo-Anreicherung des Marktplatz-Katalogs (nur Dev-Seed): deterministische
// Zuordnung von Unterkategorie, Herkunftsland und Highlights je Produkt, plus
// gestreute Bewertungen/Bestellungen – damit der Shop fuer die Live-Demo
// "leuchtet". Alle Tabellen sind EINE Quelle der Wahrheit (Produktname als
// stabiler Schluessel). Idempotent: jede Zeile per Existenz-Check.
// ---------------------------------------------------------------------------

/** Produktname -> Unterkategorie-Slug (aus MARKETPLACE_TAXONOMY, s. #222). */
const DEMO_PRODUKT_KATEGORIE: Record<string, string> = {
  '3M Wrap Film 2080 Gloss Black G12': 'folierung-wrapping-glanz',
  'Avery Dennison SW900 Matt Schwarz': 'folierung-wrapping-matt',
  'KPMF K75400 Satin Black': 'folierung-wrapping-satin',
  'Oracal 970RA Metallic Anthrazit': 'folierung-wrapping-glanz',
  'Hexis Skintac HX20000 Gloss Weiß': 'folierung-wrapping-glanz',
  '3M Knifeless Tape Design Line': 'folierung-cutter-messer-klingen',
  'XPEL Ultimate Plus PPF 61 cm': 'ppf-klar',
  '3M Scotchgard Pro Series PPF': 'ppf-klar',
  'Hexis Bodyfence PPF Gloss': 'ppf-klar',
  '3M Gold Rakel-Set (10 Stück)': 'folierung-rakel-werkzeuge',
  'XPEL Ultimate Plus Bulk-Rolle 152 cm': 'ppf-klar',
  'SunTek PPF Ultra Defense': 'ppf-klar',
  'XPEL Stealth PPF (Satin)': 'ppf-matt',
  'Hexis Bodyfence X PPF': 'ppf-klar',
  'Steinel HL 2020 E Heißluftgebläse': 'folierung-heissluftfoehne',
  'Nitril-Verarbeitungshandschuhe (100 Stück)': 'aufbereitung-schutzausruestung',
  'Gel-Rakel-Set PPF (Softkante)': 'ppf-rakel',
  'Slip-Solution Konzentrat 500 ml': 'ppf-slip-tack-loesung',
  'XPEL Fusion Plus Keramik-Topcoat': 'ppf-zubehoer',
  'Koch Chemie Green Star Allzweckreiniger 10 L': 'aufbereitung-aussenreiniger-shampoos',
  'Koch Chemie 1K-Nano Versiegelung 250 ml': 'aufbereitung-keramik-nano',
  'Koch Chemie P6.01 Politur 1 L': 'aufbereitung-polituren',
  'Menzerna Heavy Cut 400 (1 L)': 'aufbereitung-polituren',
  'Menzerna Power Finish 3500 (1 L)': 'aufbereitung-polituren',
  'Gtechniq Crystal Serum Ultra': 'aufbereitung-keramik-nano',
  'Gtechniq C2v3 Versiegelung 500 ml': 'aufbereitung-wachse-versiegelungen',
  'Menzerna Endless Shine Detailer 1 L': 'aufbereitung-wachse-versiegelungen',
};

/** Produktname -> Herkunftsland (ISO-3166-1 alpha-2), bunt fuer die Flaggen-Demo. */
const DEMO_PRODUKT_HERKUNFT: Record<string, string> = {
  '3M Wrap Film 2080 Gloss Black G12': 'US',
  'Avery Dennison SW900 Matt Schwarz': 'US',
  'KPMF K75400 Satin Black': 'GB',
  'Oracal 970RA Metallic Anthrazit': 'DE',
  'Hexis Skintac HX20000 Gloss Weiß': 'FR',
  '3M Knifeless Tape Design Line': 'US',
  'XPEL Ultimate Plus PPF 61 cm': 'US',
  '3M Scotchgard Pro Series PPF': 'US',
  'Hexis Bodyfence PPF Gloss': 'FR',
  '3M Gold Rakel-Set (10 Stück)': 'US',
  'XPEL Ultimate Plus Bulk-Rolle 152 cm': 'US',
  'SunTek PPF Ultra Defense': 'US',
  'XPEL Stealth PPF (Satin)': 'US',
  'Hexis Bodyfence X PPF': 'FR',
  'Steinel HL 2020 E Heißluftgebläse': 'DE',
  'Nitril-Verarbeitungshandschuhe (100 Stück)': 'IT',
  'Gel-Rakel-Set PPF (Softkante)': 'AT',
  'Slip-Solution Konzentrat 500 ml': 'CH',
  'XPEL Fusion Plus Keramik-Topcoat': 'US',
  'Koch Chemie Green Star Allzweckreiniger 10 L': 'DE',
  'Koch Chemie 1K-Nano Versiegelung 250 ml': 'DE',
  'Koch Chemie P6.01 Politur 1 L': 'DE',
  'Menzerna Heavy Cut 400 (1 L)': 'DE',
  'Menzerna Power Finish 3500 (1 L)': 'DE',
  'Gtechniq Crystal Serum Ultra': 'GB',
  'Gtechniq C2v3 Versiegelung 500 ml': 'GB',
  'Menzerna Endless Shine Detailer 1 L': 'DE',
};

/** Genau 5 redaktionelle Highlights (je Bereich vertreten). */
const DEMO_HIGHLIGHTS = new Set<string>([
  'XPEL Ultimate Plus PPF 61 cm',
  '3M Wrap Film 2080 Gloss Black G12',
  'XPEL Ultimate Plus Bulk-Rolle 152 cm',
  'Gtechniq Crystal Serum Ultra',
  'Koch Chemie Green Star Allzweckreiniger 10 L',
]);

/** Reviewer-Demo-Betriebe (eigene Tenants, damit Produkte MEHRERE Bewertungen
 *  bekommen – UNIQUE(productId,tenantId) je Betrieb nur eine). Realistische
 *  Namen, `.example`-Mails (kollidieren nie mit echten Konten). */
const DEMO_REVIEWER_BETRIEBE = [
  { slug: 'carstyle-berlin', name: 'CarStyle Berlin', vorname: 'Jan', ort: 'Berlin', plz: '10115' },
  { slug: 'ppf-profis-muenchen', name: 'PPF Profis München', vorname: 'Lena', ort: 'München', plz: '80331' },
  { slug: 'glanzmanufaktur-hamburg', name: 'GlanzManufaktur Hamburg', vorname: 'Timo', ort: 'Hamburg', plz: '20095' },
  { slug: 'folienwerk-koeln', name: 'FolienWerk Köln', vorname: 'Sara', ort: 'Köln', plz: '50667' },
  { slug: 'detailing-lounge-stuttgart', name: 'Detailing Lounge Stuttgart', vorname: 'Nico', ort: 'Stuttgart', plz: '70173' },
  { slug: 'autoveredelung-leipzig', name: 'AutoVeredelung Leipzig', vorname: 'Mara', ort: 'Leipzig', plz: '04109' },
];

/** Sterne-Zyklus (positiv gewichtet: viel 5/4, vereinzelt 3) + Textbausteine. */
const DEMO_STERNE_ZYKLUS = [5, 5, 4, 5, 4, 3, 5, 4, 5, 4];
const DEMO_REVIEW_TEXTE = [
  'Top Qualität, verarbeitet sich sauber. Klare Empfehlung.',
  'Schnelle Lieferung und genau wie beschrieben.',
  'Sehr gutes Preis-Leistungs-Verhältnis, gerne wieder.',
  'Hält was es verspricht – nutzen wir jetzt standardmäßig.',
  'Ergebnis überzeugt auch anspruchsvolle Kunden.',
  'Einfache Verarbeitung, gleichbleibende Charge.',
  'Solide Qualität, kleine Abstriche beim Preis.',
  'Funktioniert zuverlässig im Werkstattalltag.',
  'Sehr zufrieden, würde ich Kollegen empfehlen.',
  'Gutes Produkt, Lieferung war diesmal etwas langsamer.',
];

/** Demo-Bestellungen (In-App), damit verkaufsAnzahl/Ranking ein Signal hat.
 *  Alle referenzierten Produkte sind bestellbar mit gesetztem Preis. */
const DEMO_ORDERS = [
  { produkt: '3M Wrap Film 2080 Gloss Black G12', kaeufer: 'pilot', menge: 2 },
  { produkt: 'XPEL Ultimate Plus Bulk-Rolle 152 cm', kaeufer: 'carstyle-berlin', menge: 1 },
  { produkt: 'Koch Chemie Green Star Allzweckreiniger 10 L', kaeufer: 'glanzmanufaktur-hamburg', menge: 4 },
  { produkt: 'Menzerna Heavy Cut 400 (1 L)', kaeufer: 'detailing-lounge-stuttgart', menge: 3 },
  { produkt: 'Hexis Bodyfence X PPF', kaeufer: 'ppf-profis-muenchen', menge: 5 },
  { produkt: 'Koch Chemie P6.01 Politur 1 L', kaeufer: 'folienwerk-koeln', menge: 2 },
];

/** Kaufmaennisch auf 2 Nachkommastellen runden (wie rund2 im Service). */
const rund2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Beispiel-Katalog fuer den B2B-Marktplatz. Bewusst OHNE tenantId (die
 * Marktplatz-Entities sind plattform-weit, alle Betriebe sehen denselben
 * Katalog). Idempotent: Haendler per Name, Produkte per (Haendler+Name) –
 * bereits vorhandene Datensaetze werden uebersprungen, kein Doppel-Seed.
 *
 * `ctx` liefert das gemeinsame Seed-Passwort (bekanntes Demo-Passwort) sowie
 * Pilot-Tenant/-User (fuer eine Beispiel-Bestellung aus Sicht des Pilotbetriebs).
 */
async function seedMarketplace(
  dataSource: DataSource,
  ctx: { passwordHash: string; pilotTenantId: string; pilotUserId: string },
) {
  const dealerRepo = dataSource.getRepository(MarketplaceDealer);
  const productRepo = dataSource.getRepository(MarketplaceProduct);

  // Plattform-weite Kategorie-Taxonomie (Haupt->Unter). Idempotent: legt nur an,
  // wenn die Tabelle leer ist (Auto-Seed beim Start darf mehrfach laufen).
  const kat = await seedMarketplaceCategories(dataSource);
  console.log(
    kat.uebersprungen
      ? '[seed] Marktplatz-Kategorien: bereits vorhanden, uebersprungen.'
      : `[seed] Marktplatz-Kategorien: ${kat.angelegt} angelegt (Haupt + Unter).`,
  );

  // Neutrale Fantasie-Haendler (provisionSatz 8–12 %).
  const HAENDLER = [
    {
      key: 'nord',
      name: 'Folientechnik Nord GmbH',
      beschreibung:
        'Großhandel für Car-Wrapping- und Lackschutzfolien. Führende Marken ab Lager, mit Zuschnitt-Service und Express-Versand für Fachbetriebe.',
      webseite: 'https://folientechnik-nord.example',
      kontaktEmail: 'einkauf@folientechnik-nord.example',
      provisionSatz: 10,
    },
    {
      key: 'sued',
      name: 'CarProtect Handel Süd',
      beschreibung:
        'Spezialdistributor für Paint Protection Film und Verarbeitungszubehör. Beratung, Schulungen und schnelle Nachlieferung für PPF-Profis.',
      webseite: 'https://carprotect-sued.example',
      kontaktEmail: 'service@carprotect-sued.example',
      provisionSatz: 9,
    },
    {
      key: 'glanz',
      name: 'GlanzWerk Vertrieb',
      beschreibung:
        'Vollsortiment für die professionelle Fahrzeugaufbereitung: Politur, Keramikversiegelung und Reinigungschemie namhafter Hersteller.',
      webseite: 'https://glanzwerk-vertrieb.example',
      kontaktEmail: 'bestellung@glanzwerk-vertrieb.example',
      provisionSatz: 11,
    },
  ];

  const dealerByKey = new Map<string, MarketplaceDealer>();
  let neueHaendler = 0;
  for (const h of HAENDLER) {
    let dealer = await dealerRepo.findOne({ where: { name: h.name } });
    if (!dealer) {
      dealer = await dealerRepo.save(
        dealerRepo.create({
          name: h.name,
          beschreibung: h.beschreibung,
          webseite: h.webseite,
          kontaktEmail: h.kontaktEmail,
          provisionSatz: h.provisionSatz,
          aktiv: true,
        }),
      );
      neueHaendler += 1;
    }
    dealerByKey.set(h.key, dealer);
  }

  // Echte Produktmarken, plausible B2B-Preise. Mix aus "bestellbar" (fester
  // Preis, direkte In-App-Bestellung) und Affiliate-only (nur Link zum Haendler).
  // aff = <dealer-domain>/p/<slug>?ref=detailly (reservierte .example-Domain).
  const aff = (dealerKey: string, slug: string) => {
    const domain = HAENDLER.find((h) => h.key === dealerKey)!.webseite;
    return `${domain}/p/${slug}?ref=detailly`;
  };

  type Def = {
    dealer: string;
    name: string;
    beschreibung: string;
    bereich: string;
    marke?: string;
    preis?: number | null;
    preisHinweis?: string;
    bestellbar?: boolean;
    affiliate?: string;
    klicks?: number;
  };

  const PRODUKTE: Def[] = [
    // --- Folientechnik Nord: Wrapping-Folien + PPF ---
    { dealer: 'nord', name: '3M Wrap Film 2080 Gloss Black G12', beschreibung: 'Gegossene Premium-Wrappingfolie, luftkanalisierter Kleber. Rolle 1,52 × 25 m.', bereich: 'folierung', marke: '3M', preis: 649, preisHinweis: 'Rolle 1,52 × 25 m', bestellbar: true, affiliate: aff('nord', '3m-2080-g12'), klicks: 42 },
    { dealer: 'nord', name: 'Avery Dennison SW900 Matt Schwarz', beschreibung: 'Supreme Wrapping Film, konform für Vollverklebungen. Rolle 1,52 × 25 m.', bereich: 'folierung', marke: 'Avery Dennison', preis: 589, preisHinweis: 'Rolle 1,52 × 25 m', bestellbar: true, klicks: 31 },
    { dealer: 'nord', name: 'KPMF K75400 Satin Black', beschreibung: 'Gegossene Wrappingfolie mit Satin-Finish, sehr dehnfähig. Rolle 1,52 × 25 m.', bereich: 'folierung', marke: 'KPMF', preis: 529, preisHinweis: 'Rolle 1,52 × 25 m', bestellbar: true, klicks: 18 },
    { dealer: 'nord', name: 'Oracal 970RA Metallic Anthrazit', beschreibung: 'Gegossene Premium-Folie mit RapidAir-Technologie. Rolle 1,52 × 25 m.', bereich: 'folierung', marke: 'Oracal', preis: 379, preisHinweis: 'Rolle 1,52 × 25 m', bestellbar: true, klicks: 12 },
    { dealer: 'nord', name: 'Hexis Skintac HX20000 Gloss Weiß', beschreibung: 'Gegossene Wrappingfolie, mikroperforierter Kleber für blasenfreie Verlegung.', bereich: 'folierung', marke: 'Hexis', preis: null, bestellbar: false, affiliate: aff('nord', 'hexis-hx20000-weiss'), klicks: 9 },
    { dealer: 'nord', name: '3M Knifeless Tape Design Line', beschreibung: 'Schneidfaden-Band für saubere Folienschnitte ohne Klinge. 50-m-Rolle.', bereich: 'folierung', marke: '3M', preis: 34.9, preisHinweis: 'Rolle 50 m', bestellbar: true, klicks: 27 },
    { dealer: 'nord', name: 'XPEL Ultimate Plus PPF 61 cm', beschreibung: 'Selbstheilende Lackschutzfolie, hochglänzend. Zuschnitt pro Laufmeter.', bereich: 'ppf', marke: 'XPEL', preis: 39, preisHinweis: 'ab / lfm', bestellbar: false, affiliate: aff('nord', 'xpel-ultimate-plus-61'), klicks: 55 },
    { dealer: 'nord', name: '3M Scotchgard Pro Series PPF', beschreibung: 'Transparente Lackschutzfolie mit selbstheilender Deckschicht. Preis auf Anfrage.', bereich: 'ppf', marke: '3M', preis: null, bestellbar: false, affiliate: aff('nord', '3m-scotchgard-pro'), klicks: 21 },
    { dealer: 'nord', name: 'Hexis Bodyfence PPF Gloss', beschreibung: 'Lackschutzfolie mit hydrophober Oberfläche. Breite 152 cm, pro Laufmeter.', bereich: 'ppf', marke: 'Hexis', preis: 33, preisHinweis: '152 cm / lfm', bestellbar: true, klicks: 14 },
    { dealer: 'nord', name: '3M Gold Rakel-Set (10 Stück)', beschreibung: 'Profi-Rakel mit weicher Kante für kratzerfreies Verlegen. 10er-Set.', bereich: 'sonstiges', marke: '3M', preis: 24.9, preisHinweis: 'Set 10 Stück', bestellbar: true, klicks: 8 },

    // --- CarProtect Handel Süd: PPF + Zubehör ---
    { dealer: 'sued', name: 'XPEL Ultimate Plus Bulk-Rolle 152 cm', beschreibung: 'Großrolle selbstheilende Lackschutzfolie für Komplettverklebungen. 152 cm × 15 m.', bereich: 'ppf', marke: 'XPEL', preis: 1290, preisHinweis: 'Rolle 152 cm × 15 m', bestellbar: true, klicks: 48 },
    { dealer: 'sued', name: 'SunTek PPF Ultra Defense', beschreibung: 'Lackschutzfolie mit besonders zäher Deckschicht. Preis und Zuschnitt beim Händler.', bereich: 'ppf', marke: 'SunTek', preis: null, bestellbar: false, affiliate: aff('sued', 'suntek-ultra-defense'), klicks: 22 },
    { dealer: 'sued', name: 'XPEL Stealth PPF (Satin)', beschreibung: 'Selbstheilende Lackschutzfolie mit mattem Finish, veredelt Glanzlack zu Satin.', bereich: 'ppf', marke: 'XPEL', preis: 44, preisHinweis: 'ab / lfm', bestellbar: false, affiliate: aff('sued', 'xpel-stealth'), klicks: 33 },
    { dealer: 'sued', name: 'Hexis Bodyfence X PPF', beschreibung: 'Verstärkte Lackschutzfolie für stark beanspruchte Partien. Pro Laufmeter.', bereich: 'ppf', marke: 'Hexis', preis: 35, preisHinweis: '/ lfm', bestellbar: true, klicks: 11 },
    { dealer: 'sued', name: 'Steinel HL 2020 E Heißluftgebläse', beschreibung: 'Präzise Temperaturregelung für das Anmodellieren von Folie und PPF.', bereich: 'sonstiges', marke: 'Steinel', preis: 119, bestellbar: true, klicks: 7 },
    { dealer: 'sued', name: 'Nitril-Verarbeitungshandschuhe (100 Stück)', beschreibung: 'Puderfreie Nitrilhandschuhe, griffig auch bei Slip-Solution. Box à 100 Stück.', bereich: 'sonstiges', preis: 12.9, preisHinweis: 'Box 100 Stück', bestellbar: true, klicks: 4 },
    { dealer: 'sued', name: 'Gel-Rakel-Set PPF (Softkante)', beschreibung: 'Weiche Gel-Rakel für kratzerfreies Ausstreichen der Slip-Solution.', bereich: 'sonstiges', preis: 29.9, preisHinweis: 'Set', bestellbar: true, klicks: 5 },
    { dealer: 'sued', name: 'Slip-Solution Konzentrat 500 ml', beschreibung: 'Gleitlösungs-Konzentrat für die PPF-Nassverklebung. Ergibt viele Liter Arbeitslösung.', bereich: 'sonstiges', preis: 16.9, preisHinweis: '500 ml Konzentrat', bestellbar: true, klicks: 6 },
    { dealer: 'sued', name: 'XPEL Fusion Plus Keramik-Topcoat', beschreibung: 'Keramikversiegelung speziell für PPF und Folie. Bezug über den Händler.', bereich: 'ppf', marke: 'XPEL', preis: null, bestellbar: false, affiliate: aff('sued', 'xpel-fusion-plus'), klicks: 13 },

    // --- GlanzWerk Vertrieb: Aufbereitung / Detailing-Chemie ---
    { dealer: 'glanz', name: 'Koch Chemie Green Star Allzweckreiniger 10 L', beschreibung: 'Alkalischer Universalreiniger, hoch ergiebig verdünnbar. Kanister 10 L.', bereich: 'aufbereitung', marke: 'Koch Chemie', preis: 24.9, preisHinweis: 'Kanister 10 L', bestellbar: true, klicks: 29 },
    { dealer: 'glanz', name: 'Koch Chemie 1K-Nano Versiegelung 250 ml', beschreibung: 'Keramische Ein-Komponenten-Versiegelung mit langem Standzeitschutz.', bereich: 'aufbereitung', marke: 'Koch Chemie', preis: 39.9, preisHinweis: '250 ml', bestellbar: true, klicks: 26 },
    { dealer: 'glanz', name: 'Koch Chemie P6.01 Politur 1 L', beschreibung: 'Schleif- und Hochglanzpolitur in einem Arbeitsgang, silikonfrei.', bereich: 'aufbereitung', marke: 'Koch Chemie', preis: 27.9, preisHinweis: '1 L', bestellbar: true, klicks: 19 },
    { dealer: 'glanz', name: 'Menzerna Heavy Cut 400 (1 L)', beschreibung: 'Grobe Schleifpolitur zum schnellen Entfernen tiefer Kratzer und Hologramme.', bereich: 'aufbereitung', marke: 'Menzerna', preis: 22.9, preisHinweis: '1 L', bestellbar: true, klicks: 24 },
    { dealer: 'glanz', name: 'Menzerna Power Finish 3500 (1 L)', beschreibung: 'Antihologramm-Finishpolitur für tiefen Glanz auf dunklen Lacken.', bereich: 'aufbereitung', marke: 'Menzerna', preis: 24.9, preisHinweis: '1 L', bestellbar: true, klicks: 17 },
    { dealer: 'glanz', name: 'Gtechniq Crystal Serum Ultra', beschreibung: 'Professionelle Keramikbeschichtung mit langjährigem Schutz. Nur an akkreditierte Betriebe.', bereich: 'aufbereitung', marke: 'Gtechniq', preis: null, bestellbar: false, affiliate: aff('glanz', 'gtechniq-crystal-serum-ultra'), klicks: 38 },
    { dealer: 'glanz', name: 'Gtechniq C2v3 Versiegelung 500 ml', beschreibung: 'Sprüh-Versiegelung mit Wasserabweisung und Glanz-Boost. 500-ml-Sprühflasche.', bereich: 'aufbereitung', marke: 'Gtechniq', preis: 34.9, preisHinweis: '500 ml', bestellbar: true, klicks: 20 },
    { dealer: 'glanz', name: 'Menzerna Endless Shine Detailer 1 L', beschreibung: 'Schnell-Detailer für Zwischenreinigung und Glanzauffrischung. 1 L.', bereich: 'aufbereitung', marke: 'Menzerna', preis: 15.9, preisHinweis: '1 L', bestellbar: true, klicks: 10 },
  ];

  let neueProdukte = 0;
  for (const p of PRODUKTE) {
    const dealer = dealerByKey.get(p.dealer)!;
    const exists = await productRepo.findOne({ where: { dealerId: dealer.id, name: p.name } });
    if (exists) continue;
    await productRepo.save(
      productRepo.create({
        dealerId: dealer.id,
        name: p.name,
        beschreibung: p.beschreibung,
        bereich: p.bereich,
        marke: p.marke,
        preis: p.preis ?? null,
        preisHinweis: p.preisHinweis,
        affiliateUrl: p.affiliate,
        bestellbar: !!p.bestellbar,
        aktiv: true,
        klicks: p.klicks ?? 0,
      }),
    );
    neueProdukte += 1;
  }

  console.log(
    `[seed] Marktplatz: ${HAENDLER.length} Haendler / ${PRODUKTE.length} Produkte ` +
      `(neu angelegt: ${neueHaendler} Haendler, ${neueProdukte} Produkte).`,
  );

  // === Demo-Anreicherung (nur Dev-Seed, idempotent) ===
  const categoryRepo = dataSource.getRepository(MarketplaceCategory);
  const reviewRepo = dataSource.getRepository(MarketplaceReview);
  const mpOrderRepo = dataSource.getRepository(MarketplaceOrder);
  const mpOrderItemRepo = dataSource.getRepository(MarketplaceOrderItem);
  const tenantRepo = dataSource.getRepository(Tenant);
  const userRepo = dataSource.getRepository(User);

  // 1) Kategorie / Herkunftsland / Highlight je Produkt setzen. Fuer die
  //    Zubehoer-Produkte (bisher bereich 'sonstiges', ohne Hauptkategorie in der
  //    Taxonomie) wird `bereich` an die zugewiesene Kategorie angeglichen, damit
  //    sie in der Bereichs-Navigation nicht kategorielos haengen.
  const kategorien = await categoryRepo.find();
  const kategorieBySlug = new Map(kategorien.map((k) => [k.slug, k]));
  const produktByName = new Map<string, MarketplaceProduct>();
  let mitKategorie = 0;
  for (const p of PRODUKTE) {
    const dealer = dealerByKey.get(p.dealer)!;
    const prod = await productRepo.findOne({ where: { dealerId: dealer.id, name: p.name } });
    if (!prod) continue;
    const kategorie = kategorieBySlug.get(DEMO_PRODUKT_KATEGORIE[p.name] ?? '');
    const categoryId = kategorie?.id ?? null;
    const bereich = kategorie ? kategorie.bereich : prod.bereich;
    await productRepo.update(prod.id, {
      categoryId,
      herkunftsland: DEMO_PRODUKT_HERKUNFT[p.name] ?? null,
      istHighlight: DEMO_HIGHLIGHTS.has(p.name),
      bereich,
    });
    if (categoryId) mitKategorie += 1;
    produktByName.set(p.name, prod);
  }

  // 2) Reviewer-Demo-Betriebe (eigene Tenants + je 1 Owner-User) idempotent
  //    anlegen. Nur fuer Marktplatz-Bewertungen; teilen das Seed-Passwort.
  const reviewerListe: { tenantId: string; userId: string; name: string; ort: string; plz: string }[] = [];
  let neueReviewer = 0;
  for (const b of DEMO_REVIEWER_BETRIEBE) {
    const email = `team@${b.slug}.example`;
    let t = await tenantRepo.findOne({ where: { slug: b.slug } });
    if (!t) {
      t = await tenantRepo.save(
        tenantRepo.create({
          name: b.name,
          slug: b.slug,
          email,
          city: b.ort,
          postalCode: b.plz,
          country: 'DE',
          status: TenantStatus.ACTIVE,
        }),
      );
      neueReviewer += 1;
    }
    let u = await userRepo.findOne({ where: { email } });
    if (!u) {
      u = await userRepo.save(
        userRepo.create({
          email,
          passwordHash: ctx.passwordHash,
          firstName: b.vorname,
          lastName: b.name,
          role: UserRole.OWNER,
          tenantId: t.id,
          isActive: true,
        }),
      );
    }
    reviewerListe.push({ tenantId: t.id, userId: u.id, name: b.name, ort: b.ort, plz: b.plz });
  }

  // 3) Bewertungen streuen: Anzahl je Produkt deterministisch aus klicks
  //    (+1 fuer Highlights), gedeckelt auf <= Reviewer-Pool. Reviewer laufen
  //    fortlaufend rotierend -> je Produkt garantiert verschiedene Betriebe
  //    (erfuellt UNIQUE(productId, tenantId) automatisch).
  let reviewLfd = 0;
  let reviewGesamt = 0;
  let produkteMitBewertung = 0;
  for (const p of PRODUKTE) {
    const prod = produktByName.get(p.name);
    if (!prod) continue;
    const basis = Math.round((p.klicks ?? 0) / 18);
    const anzahl = Math.min(reviewerListe.length, basis + (DEMO_HIGHLIGHTS.has(p.name) ? 1 : 0));
    if (anzahl <= 0) continue;
    let erstellt = 0;
    for (let i = 0; i < anzahl; i++) {
      const reviewer = reviewerListe[reviewLfd % reviewerListe.length];
      const sterne = DEMO_STERNE_ZYKLUS[reviewLfd % DEMO_STERNE_ZYKLUS.length];
      const text = DEMO_REVIEW_TEXTE[reviewLfd % DEMO_REVIEW_TEXTE.length];
      reviewLfd += 1;
      const vorhanden = await reviewRepo.findOne({
        where: { productId: prod.id, tenantId: reviewer.tenantId },
      });
      if (vorhanden) continue;
      await reviewRepo.save(
        reviewRepo.create({
          productId: prod.id,
          tenantId: reviewer.tenantId,
          userId: reviewer.userId,
          sterne,
          text,
          verifiziert: true,
          aktiv: true,
        }),
      );
      erstellt += 1;
      reviewGesamt += 1;
    }
    if (erstellt > 0) produkteMitBewertung += 1;
  }

  // 4) Denormalisiertes Aggregat je Produkt fortschreiben (wie aggregatFortschreiben
  //    im Service: Mittel + Anzahl der AKTIVEN Bewertungen).
  for (const prod of produktByName.values()) {
    const aktive = await reviewRepo.find({
      where: { productId: prod.id, aktiv: true },
      select: ['sterne'],
    });
    const bewertungAnzahl = aktive.length;
    const summe = aktive.reduce((s, r) => s + Number(r.sterne), 0);
    const bewertungSchnitt = bewertungAnzahl === 0 ? 0 : rund2(summe / bewertungAnzahl);
    await productRepo.update(prod.id, { bewertungSchnitt, bewertungAnzahl });
  }

  // 5) Ein paar In-App-Bestellungen (Provision-Snapshot je Position) fuer ein
  //    verkaufsAnzahl/Ranking-Signal. Idempotent per Belegnummer MP-<Jahr>-<lfd>.
  const dealerById = new Map([...dealerByKey.values()].map((d) => [d.id, d]));
  const pilotTenant = await tenantRepo.findOne({ where: { id: ctx.pilotTenantId } });
  const kaeuferByKey = new Map<string, { tenantId: string; userId: string; name: string; ort: string; plz: string }>();
  kaeuferByKey.set('pilot', {
    tenantId: ctx.pilotTenantId,
    userId: ctx.pilotUserId,
    name: pilotTenant?.name ?? 'Detailly Pilotbetrieb',
    ort: pilotTenant?.city ?? 'Berlin',
    plz: pilotTenant?.postalCode ?? '10115',
  });
  for (const r of reviewerListe) {
    kaeuferByKey.set(
      DEMO_REVIEWER_BETRIEBE.find((b) => b.name === r.name)!.slug,
      { tenantId: r.tenantId, userId: r.userId, name: r.name, ort: r.ort, plz: r.plz },
    );
  }
  const jahr = new Date().getFullYear();
  let neueOrders = 0;
  let orderLfd = 0;
  for (const od of DEMO_ORDERS) {
    orderLfd += 1;
    const nummer = `MP-${jahr}-${String(orderLfd).padStart(4, '0')}`;
    if (await mpOrderRepo.findOne({ where: { nummer } })) continue;
    const prod = produktByName.get(od.produkt);
    const kaeufer = kaeuferByKey.get(od.kaeufer);
    if (!prod || !kaeufer || prod.preis == null) continue;
    const dealer = dealerById.get(prod.dealerId)!;
    const einzelpreis = Number(prod.preis);
    const zeilenSumme = rund2(einzelpreis * od.menge);
    const provisionSatz = Number(dealer.provisionSatz);
    const provisionBetrag = rund2((zeilenSumme * provisionSatz) / 100);
    const order = await mpOrderRepo.save(
      mpOrderRepo.create({
        nummer,
        tenantId: kaeufer.tenantId,
        dealerId: prod.dealerId,
        createdByUserId: kaeufer.userId,
        kontaktName: kaeufer.name,
        kontaktEmail: `bestellung@${kaeufer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example`,
        lieferFirma: kaeufer.name,
        lieferPlz: kaeufer.plz,
        lieferOrt: kaeufer.ort,
        lieferLand: 'DE',
        status: MarketplaceOrderStatus.BESTAETIGT,
        summeBrutto: zeilenSumme,
        summeProvision: provisionBetrag,
      }),
    );
    await mpOrderItemRepo.save(
      mpOrderItemRepo.create({
        orderId: order.id,
        dealerId: prod.dealerId,
        productId: prod.id,
        produktName: prod.name,
        einzelpreis,
        menge: od.menge,
        zeilenSumme,
        provisionSatz,
        provisionBetrag,
      }),
    );
    neueOrders += 1;
  }

  // 6) Bekanntes Haendler-Login fuer die Portal-Demo (role=haendler, tenantId=NULL,
  //    dealerId gesetzt). Passwort = Seed-Passwort (Default 'Detailly2026!').
  const haendlerDealer = dealerByKey.get('nord')!;
  const haendlerMail = 'haendler@detailly.de';
  if (!(await userRepo.findOne({ where: { email: haendlerMail } }))) {
    await userRepo.save(
      userRepo.create({
        email: haendlerMail,
        passwordHash: ctx.passwordHash,
        firstName: 'Nils',
        lastName: 'Händler',
        role: UserRole.HAENDLER,
        dealerId: haendlerDealer.id,
        tenantId: null as unknown as string,
        isActive: true,
      }),
    );
  }

  console.log(
    `[seed] Marktplatz-Demo angereichert: ${mitKategorie} Produkte mit Kategorie, ` +
      `${DEMO_HIGHLIGHTS.size} Highlights, ${reviewGesamt} Bewertungen auf ${produkteMitBewertung} Produkten, ` +
      `${neueReviewer} Reviewer-Betriebe, ${neueOrders} Bestellungen.`,
  );
  console.log(`[seed] Marktplatz Haendler-Login: ${haendlerMail} (dealer: ${haendlerDealer.name}).`);
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
