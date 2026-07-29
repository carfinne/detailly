import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1783456549418 implements MigrationInterface {
    name = 'Migration1783456549418'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 'haendler' (Marktplatz-Ausbau PR2) ist bewusst DIREKT im CREATE TYPE
        // enthalten – NICHT per spaeterem `ALTER TYPE ... ADD VALUE`. Letzteres ist
        // vor PG12 nicht innerhalb einer Transaktion erlaubt (TypeORM faehrt
        // Migrationen in einer TX); der Enum-Wert am Ursprung vermeidet die Falle.
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('platform_admin', 'platform_analyst', 'platform_support', 'owner', 'manager', 'technician', 'receptionist', 'haendler')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "phone" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'technician', "tenantId" character varying, "isActive" boolean NOT NULL DEFAULT true, "stundenlohn" numeric(10,2), "geburtstag" date, "funktion" character varying, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "passwordChangedAt" TIMESTAMP WITH TIME ZONE, "tokenVersion" integer NOT NULL DEFAULT 0, "emailVerifiedAt" TIMESTAMP WITH TIME ZONE, "emailVerificationTokenHash" character varying, "emailVerificationExpiresAt" TIMESTAMP WITH TIME ZONE, "totpSecret" text, "totpEnabled" boolean NOT NULL DEFAULT false, "recoveryCodes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6a19d4b4f6c62dcd29daa497e" ON "password_reset_tokens" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1143abb8c3fad8b06dd857a8c9" ON "password_reset_tokens" ("tokenHash") `);
        await queryRunner.query(`CREATE TYPE "public"."tenants_status_enum" AS ENUM('active', 'inactive', 'trial')`);
        await queryRunner.query(`CREATE TYPE "public"."tenants_betriebstyp_enum" AS ENUM('aufbereitung', 'folierung', 'ppf', 'komplett')`);
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "email" character varying, "phone" character varying, "street" character varying, "city" character varying, "postalCode" character varying, "country" character varying NOT NULL DEFAULT 'DE', "franchiseId" character varying, "status" "public"."tenants_status_enum" NOT NULL DEFAULT 'trial', "betriebstyp" "public"."tenants_betriebstyp_enum" NOT NULL DEFAULT 'komplett', "logoUrl" character varying, "sevdeskApiToken" text, "smtpPassword" text, "dkimPrivateKey" text, "calendarToken" character varying, "businessHours" jsonb, "settings" text, "trialEndsAt" TIMESTAMP WITH TIME ZONE, "agbAkzeptiertAm" TIMESTAMP WITH TIME ZONE, "agbVersion" character varying, "dseAkzeptiertAm" TIMESTAMP WITH TIME ZONE, "dseVersion" character varying, "avvAkzeptiertAm" TIMESTAMP WITH TIME ZONE, "avvVersion" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE ("slug"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."customers_type_enum" AS ENUM('private', 'business')`);
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "type" "public"."customers_type_enum" NOT NULL DEFAULT 'private', "firstName" character varying, "lastName" character varying, "companyName" character varying, "vatNumber" character varying, "leitwegId" character varying, "email" character varying, "phone" character varying, "mobile" character varying, "street" character varying, "city" character varying, "postalCode" character varying, "country" character varying NOT NULL DEFAULT 'DE', "sevdeskContactId" character varying, "notes" text, "isActive" boolean NOT NULL DEFAULT true, "anonymisiertAm" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."vehicles_fueltype_enum" AS ENUM('petrol', 'diesel', 'electric', 'hybrid', 'other')`);
        await queryRunner.query(`CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "customerId" character varying NOT NULL, "make" character varying NOT NULL, "model" character varying NOT NULL, "variant" character varying, "year" integer, "color" character varying, "colorCode" character varying, "licensePlate" character varying, "vin" character varying, "fuelType" "public"."vehicles_fueltype_enum", "lengthCm" numeric(10,2), "widthCm" numeric(10,2), "ppfTemplate" character varying, "estimatedSqm" numeric(10,2), "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_64f050f3becb5fce8d13383fc2" ON "vehicles" ("tenantId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "userId" character varying, "action" character varying NOT NULL, "entityType" character varying NOT NULL, "entityId" character varying, "payload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_889633a4291bcb0bf4680fff23" ON "audit_logs" ("tenantId") `);
        await queryRunner.query(`CREATE TYPE "public"."service_items_kategorie_enum" AS ENUM('aufbereitung', 'folierung', 'ppf', 'sonstiges')`);
        await queryRunner.query(`CREATE TYPE "public"."service_items_einheit_enum" AS ENUM('pauschal', 'qm', 'stunde')`);
        await queryRunner.query(`CREATE TABLE "service_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "name" character varying NOT NULL, "beschreibung" text, "kategorie" "public"."service_items_kategorie_enum" NOT NULL DEFAULT 'aufbereitung', "basispreis" numeric(10,2) NOT NULL DEFAULT '0', "einheit" "public"."service_items_einheit_enum" NOT NULL DEFAULT 'pauschal', "aktiv" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7383c18e3c8e4956860b117728a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."order_items_typ_enum" AS ENUM('leistung', 'material')`);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "beschreibung" character varying NOT NULL, "typ" "public"."order_items_typ_enum" NOT NULL DEFAULT 'leistung', "menge" numeric(10,2) NOT NULL DEFAULT '1', "einzelpreis" numeric(10,2) NOT NULL DEFAULT '0', "gesamtpreis" numeric(10,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orders_servicetype_enum" AS ENUM('aufbereitung', 'folierung', 'ppf', 'sonstiges')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('angefragt', 'kalkuliert', 'bestaetigt', 'in_arbeit', 'qualitaetskontrolle', 'fertig', 'abgerechnet', 'storniert')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "auftragsnummer" character varying NOT NULL, "customerId" character varying NOT NULL, "vehicleId" character varying, "locationId" character varying, "assignedUserId" character varying, "angebotInvoiceId" character varying, "angebotOnlineAngenommenAm" TIMESTAMP WITH TIME ZONE, "freigabeToken" character varying, "serviceType" "public"."orders_servicetype_enum" NOT NULL DEFAULT 'aufbereitung', "status" "public"."orders_status_enum" NOT NULL DEFAULT 'angefragt', "materialkosten" numeric(10,2) NOT NULL DEFAULT '0', "arbeitsstunden" numeric(10,2) NOT NULL DEFAULT '0', "geplanterStart" TIMESTAMP WITH TIME ZONE, "geplantesEnde" TIMESTAMP WITH TIME ZONE, "bilderVorher" jsonb, "bilderNachher" jsonb, "leistungDetails" jsonb, "internerHinweis" text, "nettoSumme" numeric(10,2) NOT NULL DEFAULT '0', "mwstBetrag" numeric(10,2) NOT NULL DEFAULT '0', "gesamtpreis" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_208a358e9fe8abe6e1d8245980" ON "orders" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_67c4414db46ec33bcc03a0e5df" ON "orders" ("freigabeToken") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c9de42155f7c8471eed66bd0e4" ON "orders" ("tenantId", "auftragsnummer") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2cfc2bf7cb89228185e15644c" ON "orders" ("tenantId", "createdAt") `);
        // Welle 1 (F2): UNIQUE-Backstop gegen doppelte Auftrags-Erzeugung aus einem
        // Angebot (Race/Doppelklick); dient zugleich dem Idempotenz-Lookup. Mehrere
        // NULL-angebotInvoiceId bleiben "distinct". Custom-Name (pre-launch-Baseline;
        // ein spaeterer TypeORM-Generate reconciliert die Namen).
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_orders_tenant_angebotInvoiceId" ON "orders" ("tenantId", "angebotInvoiceId") `);
        await queryRunner.query(`CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceId" uuid NOT NULL, "beschreibung" character varying NOT NULL, "menge" numeric(10,2) NOT NULL DEFAULT '1', "einzelpreis" numeric(10,2) NOT NULL DEFAULT '0', "gesamtpreis" numeric(10,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."invoices_art_enum" AS ENUM('angebot', 'rechnung')`);
        await queryRunner.query(`CREATE TYPE "public"."invoices_status_enum" AS ENUM('entwurf', 'offen', 'bezahlt', 'storniert')`);
        // Welle 1 (F2): Angebots-Lebenszyklus (separates Feld, GoBD-Rechnungsstatus unberuehrt).
        await queryRunner.query(`CREATE TYPE "public"."invoices_angebotstatus_enum" AS ENUM('offen', 'angenommen', 'abgelehnt', 'abgelaufen')`);
        await queryRunner.query(`CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "nummer" character varying, "art" "public"."invoices_art_enum" NOT NULL DEFAULT 'rechnung', "customerId" character varying NOT NULL, "orderId" character varying, "status" "public"."invoices_status_enum" NOT NULL DEFAULT 'entwurf', "datum" TIMESTAMP WITH TIME ZONE, "leistungsdatum" TIMESTAMP WITH TIME ZONE, "netto" numeric(10,2) NOT NULL DEFAULT '0', "mwst" numeric(10,2) NOT NULL DEFAULT '0', "brutto" numeric(10,2) NOT NULL DEFAULT '0', "mwstSatz" numeric(5,2) NOT NULL DEFAULT '19', "faelligkeitsdatum" TIMESTAMP WITH TIME ZONE, "zahlungsziel" integer, "zahldatum" TIMESTAMP WITH TIME ZONE, "mahnstufe" integer NOT NULL DEFAULT '0', "versendetAm" TIMESTAMP WITH TIME ZONE, "sevdeskInvoiceId" character varying, "downloadToken" character varying, "hinweis" text, "varianteGruppeId" character varying, "varianteLabel" character varying, "istGewaehlt" boolean NOT NULL DEFAULT false, "gueltigBis" TIMESTAMP WITH TIME ZONE, "angebotStatus" "public"."invoices_angebotstatus_enum", "angebotToken" character varying, "istAnzahlung" boolean NOT NULL DEFAULT false, "anzahlungFuerInvoiceId" character varying, "empfaengerName" text, "empfaengerAnschrift" text, "empfaengerVatNumber" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_89c82485e364081f457b210120" ON "invoices" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_84c835fc8d35b53bcc70a620b2" ON "invoices" ("downloadToken") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df6e527a0fefc6f54ab52e65d2" ON "invoices" ("tenantId", "nummer") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3ae9c1e7978f09414ad2c5943" ON "invoices" ("tenantId", "createdAt") `);
        // Welle 1: Gruppen-Load + oeffentliche Token-Aufloesung (Custom-Namen, pre-launch-Baseline).
        await queryRunner.query(`CREATE INDEX "IDX_invoices_varianteGruppeId" ON "invoices" ("varianteGruppeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_angebotToken" ON "invoices" ("angebotToken") `);
        await queryRunner.query(`CREATE TYPE "public"."appointments_status_enum" AS ENUM('geplant', 'bestaetigt', 'laeuft', 'abgeschlossen', 'abgesagt')`);
        // Kundenkommunikation (Termin-Erinnerung): `erinnerungGesendetAm` (nullable,
        // additiv) inline in der Baseline (pre-launch-Konvention, s. "products" oben).
        // Doppelversand-Schutz: der Erinnerungs-Scheduler claimt diese Spalte konditional.
        // down() faellt ueber DROP TABLE "appointments" ab -> keine separate Spalten-Ruecknahme.
        await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "orderId" character varying, "customerId" character varying, "vehicleId" character varying, "assignedUserId" character varying, "locationId" character varying, "titel" character varying NOT NULL, "start" TIMESTAMP WITH TIME ZONE NOT NULL, "ende" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'geplant', "notiz" text, "erinnerungGesendetAm" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_46e6a4182e96de9d4c1bba5060" ON "appointments" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c8a4a8ac719bb03535bb93a163" ON "appointments" ("tenantId", "start") `);
        // Folierer-Welle 2 (Folien-Bibliothek): strukturierte Folien-Attribute
        // hersteller/serie/farbcode/finish/breiteCm inline in der Baseline (alle
        // nullable/additiv, pre-launch-Konvention). down() faellt ueber DROP TABLE
        // "products" ab -> keine separate Spalten-Ruecknahme noetig.
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "name" character varying NOT NULL, "sku" character varying, "kategorie" character varying, "hersteller" character varying, "serie" character varying, "farbcode" character varying, "finish" character varying, "breiteCm" numeric(10,2), "einkaufspreis" numeric(10,2) NOT NULL DEFAULT '0', "verkaufspreis" numeric(10,2) NOT NULL DEFAULT '0', "bestand" numeric(10,2) NOT NULL DEFAULT '0', "mindestbestand" numeric(10,2) NOT NULL DEFAULT '0', "einheit" character varying NOT NULL DEFAULT 'Stueck', "istVermietbar" boolean NOT NULL DEFAULT false, "mietpreisProTag" numeric(10,2), "aktiv" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."stock_movements_typ_enum" AS ENUM('zugang', 'abgang', 'inventur')`);
        await queryRunner.query(`CREATE TABLE "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "productId" character varying NOT NULL, "typ" "public"."stock_movements_typ_enum" NOT NULL, "menge" numeric(10,2) NOT NULL, "grund" character varying, "userId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "purchase_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchaseOrderId" uuid NOT NULL, "productId" character varying, "beschreibung" character varying NOT NULL, "menge" numeric(10,2) NOT NULL DEFAULT '1', "einzelpreis" numeric(10,2) NOT NULL DEFAULT '0', "gesamtpreis" numeric(10,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_e8b7568d25c41e3290db596b312" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."purchase_orders_status_enum" AS ENUM('entwurf', 'eingereicht', 'freigegeben', 'bestellt', 'geliefert', 'abgelehnt')`);
        await queryRunner.query(`CREATE TABLE "purchase_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "nummer" character varying NOT NULL, "lieferant" character varying, "status" "public"."purchase_orders_status_enum" NOT NULL DEFAULT 'entwurf', "erstelltVon" character varying, "freigegebenVon" character varying, "summe" numeric(10,2) NOT NULL DEFAULT '0', "notiz" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_05148947415204a897e8beb2553" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9ce8320f3a9c6f6229a76cb8ed" ON "purchase_orders" ("tenantId", "nummer") `);
        await queryRunner.query(`CREATE TYPE "public"."rentals_status_enum" AS ENUM('reserviert', 'aktiv', 'zurueck')`);
        await queryRunner.query(`CREATE TABLE "rentals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "productId" character varying NOT NULL, "customerId" character varying NOT NULL, "von" TIMESTAMP WITH TIME ZONE NOT NULL, "bis" TIMESTAMP WITH TIME ZONE NOT NULL, "preis" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."rentals_status_enum" NOT NULL DEFAULT 'reserviert', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2b10d04c95a8bfe85b506ba52ba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "name" character varying NOT NULL, "street" character varying, "city" character varying, "postalCode" character varying, "phone" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bb2c7f27ed444aba2e33f76f8f" ON "locations" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "beschreibung" text, "preisMonatlich" numeric(10,2) NOT NULL DEFAULT '0', "preisJaehrlich" numeric(10,2), "waehrung" character varying NOT NULL DEFAULT 'EUR', "features" jsonb, "limits" jsonb, "stripePriceId" character varying, "stripePriceIdYearly" character varying, "istAktiv" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e7b71bb444e74ee067df057397e" UNIQUE ("slug"), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('trial', 'active', 'past_due', 'canceled', 'suspended', 'pilot')`);
        // `addons` (jsonb) additiv inline: gebuchte à-la-carte Add-on-Feature-Keys
        // (z. B. ['folierung_ppf']); NULL = keine. Down = DROP TABLE (unten) deckt es.
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "planId" character varying, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'trial', "trialEndsAt" TIMESTAMP WITH TIME ZONE, "currentPeriodStart" TIMESTAMP WITH TIME ZONE, "currentPeriodEnd" TIMESTAMP WITH TIME ZONE, "canceledAt" TIMESTAMP WITH TIME ZONE, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "notiz" text, "addons" jsonb, "stripeCustomerId" character varying, "stripeSubscriptionId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0c5fe8e5f9f4dd4a8c0134abc9c" UNIQUE ("tenantId"), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."time_entries_art_enum" AS ENUM('kommen', 'gehen')`);
        await queryRunner.query(`CREATE TABLE "time_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "userId" character varying NOT NULL, "locationId" character varying, "art" "public"."time_entries_art_enum" NOT NULL, "zeitpunkt" TIMESTAMP WITH TIME ZONE NOT NULL, "korrigiert" boolean NOT NULL DEFAULT false, "notiz" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8bc5f10269ba2fe88708904aa0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f74d57735d357f2b81cfccee2b" ON "time_entries" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1b452d7f0d45863303b7d3000" ON "time_entries" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."damage_inspections_typ_enum" AS ENUM('annahme', 'gutachten', 'ausgang')`);
        await queryRunner.query(`CREATE TYPE "public"."damage_inspections_status_enum" AS ENUM('entwurf', 'abgeschlossen', 'freigegeben')`);
        await queryRunner.query(`CREATE TABLE "damage_inspections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "customerId" character varying NOT NULL, "vehicleId" character varying, "orderId" character varying, "typ" "public"."damage_inspections_typ_enum" NOT NULL DEFAULT 'annahme', "status" "public"."damage_inspections_status_enum" NOT NULL DEFAULT 'entwurf', "previousInspectionId" character varying, "modelKey" character varying, "kmStand" integer, "tankstand" integer, "notiz" text, "erfasstVonUserId" character varying, "erfasstVonRolle" character varying, "clientUuid" character varying, "unterschriftPng" text, "unterschriebenVonName" character varying, "unterschriebenAm" TIMESTAMP WITH TIME ZONE, "unterschriebenVonUserId" character varying, "consentText" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_45a5a1d7eda3dbbedfd263ca41b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8f67ca6ca9f86b096cb3a4c541" ON "damage_inspections" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c05f38949f41f1c8c19ff6e3c9" ON "damage_inspections" ("clientUuid") `);
        await queryRunner.query(`CREATE INDEX "IDX_df22cf46a6e16c2bb8fde349b4" ON "damage_inspections" ("tenantId", "vehicleId", "typ") `);
        await queryRunner.query(`CREATE TYPE "public"."damage_items_positionmode_enum" AS ENUM('3d', '2d')`);
        await queryRunner.query(`CREATE TYPE "public"."damage_items_origin_enum" AS ENUM('vorschaden', 'neu')`);
        await queryRunner.query(`CREATE TYPE "public"."damage_items_art_enum" AS ENUM('kratzer', 'delle', 'steinschlag', 'lackschaden', 'rost', 'riss', 'bruch', 'verzogen', 'fehlteil', 'sonstiges')`);
        await queryRunner.query(`CREATE TYPE "public"."damage_items_schweregrad_enum" AS ENUM('leicht', 'mittel', 'schwer')`);
        await queryRunner.query(`CREATE TYPE "public"."damage_items_reparaturart_enum" AS ENUM('polieren', 'smart_repair', 'lackieren', 'instandsetzen', 'austausch', 'keine')`);
        await queryRunner.query(`CREATE TYPE "public"."damage_items_status_enum" AS ENUM('offen', 'in_arbeit', 'erledigt', 'abgelehnt', 'uebernommen')`);
        await queryRunner.query(`CREATE TABLE "damage_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "inspectionId" character varying NOT NULL, "partId" character varying NOT NULL, "partLabel" character varying, "positionMode" "public"."damage_items_positionmode_enum" NOT NULL DEFAULT '3d', "position3d" jsonb, "ansicht2d" character varying, "x2d" double precision, "y2d" double precision, "origin" "public"."damage_items_origin_enum" NOT NULL DEFAULT 'neu', "art" "public"."damage_items_art_enum" NOT NULL, "schweregrad" "public"."damage_items_schweregrad_enum" NOT NULL, "groesseLaengeMm" integer, "groesseBreiteMm" integer, "ausmass" character varying, "reparaturart" "public"."damage_items_reparaturart_enum", "status" "public"."damage_items_status_enum" NOT NULL DEFAULT 'offen', "kostenSchaetzung" numeric(10,2), "notiz" text, "carriedFromItemId" character varying, "istUebernommen" boolean NOT NULL DEFAULT false, "behobenBeiAusgang" boolean, "clientUuid" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b474890449d523c9bea0383eea0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_06fd837baaf8a57e9107b9b84d" ON "damage_items" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_579931f753f1f74c9d95d9a48f" ON "damage_items" ("carriedFromItemId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1619f454f470b8609f1a965c7b" ON "damage_items" ("tenantId", "partId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da51399c21502baee79ad0e770" ON "damage_items" ("tenantId", "inspectionId") `);
        await queryRunner.query(`CREATE TYPE "public"."damage_photos_kategorie_enum" AS ENUM('detail', 'uebersicht', 'vin', 'tacho', 'kennzeichen')`);
        await queryRunner.query(`CREATE TABLE "damage_photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "inspectionId" character varying NOT NULL, "pfad" character varying NOT NULL, "thumbnailPfad" character varying, "partId" character varying, "kategorie" "public"."damage_photos_kategorie_enum" NOT NULL DEFAULT 'detail', "breite" integer, "hoehe" integer, "reihenfolge" integer, "clientUuid" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b753f67ac89d47c0183b72ee0ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1b7119899a8562e2b80c94cdc" ON "damage_photos" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7c141e97ccde6ccdd47869b31" ON "damage_photos" ("partId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bca4961a6b0399f1b65da2246d" ON "damage_photos" ("tenantId", "inspectionId") `);
        await queryRunner.query(`CREATE TABLE "damage_item_photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "damageItemId" character varying NOT NULL, "photoId" character varying NOT NULL, "istHauptfoto" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2f811e5313e5ce8f1fc144146ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_344b087f9495a39ba6e7402b50" ON "damage_item_photos" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ab60cf3bfdc579846beebd9b92" ON "damage_item_photos" ("damageItemId", "photoId") `);
        await queryRunner.query(`CREATE TYPE "public"."booking_requests_status_enum" AS ENUM('neu', 'angenommen', 'abgelehnt')`);
        await queryRunner.query(`CREATE TABLE "booking_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying, "phone" character varying, "serviceItemId" character varying, "serviceName" character varying, "fahrzeug" text, "wunschtermin" TIMESTAMP WITH TIME ZONE, "nachricht" text, "status" "public"."booking_requests_status_enum" NOT NULL DEFAULT 'neu', "reference" character varying NOT NULL, "sourceIpHash" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_62c29ee249979fe0bcdcde33dae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a246dd6062a40f23c147ac80d6" ON "booking_requests" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_71b6552a46262b4cb4662dde50" ON "booking_requests" ("reference") `);
        await queryRunner.query(`CREATE TABLE "order_times" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "orderId" character varying NOT NULL, "userId" character varying NOT NULL, "datum" TIMESTAMP WITH TIME ZONE NOT NULL, "minuten" integer NOT NULL, "notiz" text, "erfasstVon" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_56d69a051f849861e6b848b0f3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_84e08f7dd016e2079879170db2" ON "order_times" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3946c97986bbecd8609b18f4a" ON "order_times" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c297c711efae08b25bcfb267f7" ON "order_times" ("userId") `);
        // Folierer-Welle 2: nullable/additive Spalten folienRolleId + geplantLfm
        // inline in der Baseline (pre-launch-Konvention). folienRolleId = optionale
        // Restrollen-Verortung, geplantLfm = Planzahl (lfm-Rechner) fuer die
        // Verschnitt-KPI. down() faellt ueber DROP TABLE "order_materials" ab.
        await queryRunner.query(`CREATE TABLE "order_materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "orderId" character varying NOT NULL, "productId" character varying NOT NULL, "produktName" character varying NOT NULL, "einheit" character varying NOT NULL DEFAULT 'Stueck', "menge" numeric(10,2) NOT NULL, "folienRolleId" character varying, "geplantLfm" numeric(10,2), "erfasstVon" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b30720223246b37b360737d0890" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e48a7636d1ab3aa2e23c864272" ON "order_materials" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_baba44cb2423607d04f56feef0" ON "order_materials" ("orderId") `);
        // Folierer-Welle 2 (Restrollen-Register): entkoppeltes Reste-Register neben
        // dem groben Produkt-`bestand`. Inline in der Baseline (pre-launch); Custom-
        // Namen wie bei den Welle-1-Adds. down() reicht DROP INDEX/TABLE/TYPE.
        await queryRunner.query(`CREATE TYPE "public"."folien_rollen_status_enum" AS ENUM('verfuegbar', 'aufgebraucht', 'entsorgt')`);
        await queryRunner.query(`CREATE TABLE "folien_rollen" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "productId" character varying, "bezeichnung" character varying NOT NULL, "charge" character varying, "restLfm" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."folien_rollen_status_enum" NOT NULL DEFAULT 'verfuegbar', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_folien_rollen" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_folien_rollen_tenant_product" ON "folien_rollen" ("tenantId", "productId") `);
        await queryRunner.query(`CREATE TYPE "public"."support_tickets_kategorie_enum" AS ENUM('frage', 'problem', 'idee', 'abrechnung')`);
        await queryRunner.query(`CREATE TYPE "public"."support_tickets_status_enum" AS ENUM('offen', 'beantwortet', 'geschlossen')`);
        await queryRunner.query(`CREATE TABLE "support_tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "createdByUserId" character varying NOT NULL, "betreff" character varying(150) NOT NULL, "kategorie" "public"."support_tickets_kategorie_enum" NOT NULL DEFAULT 'frage', "status" "public"."support_tickets_status_enum" NOT NULL DEFAULT 'offen', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_942e8d8f5df86100471d2324643" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f39d4242941c82c75c939c7e0" ON "support_tickets" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_439ad5aa62c0b07094ed5d3707" ON "support_tickets" ("tenantId", "updatedAt") `);
        await queryRunner.query(`CREATE TYPE "public"."support_messages_autortyp_enum" AS ENUM('kunde', 'detailly')`);
        await queryRunner.query(`CREATE TABLE "support_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "ticketId" character varying NOT NULL, "autorTyp" "public"."support_messages_autortyp_enum" NOT NULL, "autorName" character varying NOT NULL, "text" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2aa37479e71ef29cbf4dba2b1a2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e8cb5841790aa5245ddbfe5264" ON "support_messages" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ea9200e64f7172a68dfdc0e25" ON "support_messages" ("ticketId", "createdAt") `);
        // Marktplatz-Welle 3 (Grosshaendler-Portal): Bewerbungs-Spalten inline in
        // der Baseline (pre-launch-Konvention wie order_materials/folien_rollen).
        // "status" DEFAULT 'freigegeben' haelt Bestands-Haendler rueckwaerts-
        // kompatibel im Katalog; Bewerbungen kommen als 'beantragt' + aktiv=false.
        // down() faellt ueber DROP TABLE "marketplace_dealers" ab.
        // Marktplatz-Welle 5 (KYB): USt-IdNr feld-verschluesselt -> "text" (Chiffretext
        // ist laenger als 20 Zeichen), plus Gewerbeanmeldungs-/Vorpruefungs-Spalten inline
        // (pre-launch-Baseline-Konvention). dokumentHash bleibt "character varying"
        // (unverschluesselt, per WHERE fuer die Dubletten-Erkennung durchsucht).
        await queryRunner.query(`CREATE TABLE "marketplace_dealers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "beschreibung" text, "logoUrl" character varying, "webseite" character varying, "kontaktEmail" character varying, "provisionSatz" numeric(5,2) NOT NULL DEFAULT '10', "uploadToken" character varying, "aktiv" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'freigegeben', "ansprechpartner" character varying, "telefon" character varying, "adresse" character varying, "ustIdNr" text, "sortiment" character varying, "nachricht" text, "beantragtAm" TIMESTAMP WITH TIME ZONE, "gewerbeanmeldungDatei" character varying, "dokumentHash" character varying, "kybErgebnis" text, "kybGeprueftVonUserId" character varying, "abgelehntAm" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_99da8a031a5c226d41dd229f935" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "marketplace_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dealerId" character varying NOT NULL, "name" character varying NOT NULL, "beschreibung" text, "bereich" character varying NOT NULL DEFAULT 'sonstiges', "marke" character varying, "kategorie" character varying, "preis" numeric(10,2), "preisHinweis" character varying, "bildUrl" character varying, "affiliateUrl" character varying, "bestellbar" boolean NOT NULL DEFAULT false, "aktiv" boolean NOT NULL DEFAULT true, "klicks" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e69a52f8060b84d9ef701752926" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aff5c5b20bebb6d95b30fc938c" ON "marketplace_products" ("dealerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f026c8339a716d73e60e46572" ON "marketplace_products" ("bereich") `);
        await queryRunner.query(`CREATE INDEX "IDX_d744f404fac04891dabd89fbcb" ON "marketplace_products" ("aktiv", "bereich") `);
        await queryRunner.query(`CREATE TABLE "marketplace_clicks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" character varying NOT NULL, "dealerId" character varying NOT NULL, "tenantId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_96c491c3251fcee4dce5a5a612b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ba6cadcba1b3f610e970b61a58" ON "marketplace_clicks" ("dealerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8d79c67e3598a460ef44cd3966" ON "marketplace_clicks" ("productId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."marketplace_orders_status_enum" AS ENUM('eingegangen', 'bestaetigt', 'versendet', 'storniert')`);
        await queryRunner.query(`CREATE TABLE "marketplace_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nummer" character varying NOT NULL, "tenantId" character varying NOT NULL, "dealerId" character varying NOT NULL, "createdByUserId" character varying NOT NULL, "kontaktName" character varying NOT NULL, "kontaktEmail" character varying NOT NULL, "kontaktTelefon" character varying, "lieferFirma" character varying, "lieferStrasse" character varying, "lieferPlz" character varying, "lieferOrt" character varying, "lieferLand" character varying NOT NULL DEFAULT 'DE', "notiz" text, "status" "public"."marketplace_orders_status_enum" NOT NULL DEFAULT 'eingegangen', "summeBrutto" numeric(10,2) NOT NULL DEFAULT '0', "summeProvision" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_357fa54c892b12b528e30d2b550" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3d10b52eaf9ff34ed968d13f77" ON "marketplace_orders" ("nummer") `);
        await queryRunner.query(`CREATE INDEX "IDX_798f8598465e812b0be6696577" ON "marketplace_orders" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_614f2b4b252fe99ea1651aa568" ON "marketplace_orders" ("dealerId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_edbd1e0acd26b29378804a062a" ON "marketplace_orders" ("tenantId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "marketplace_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" character varying NOT NULL, "dealerId" character varying NOT NULL, "productId" character varying NOT NULL, "produktName" character varying NOT NULL, "einzelpreis" numeric(10,2) NOT NULL DEFAULT '0', "menge" integer NOT NULL DEFAULT '1', "zeilenSumme" numeric(10,2) NOT NULL DEFAULT '0', "provisionSatz" numeric(5,2) NOT NULL DEFAULT '0', "provisionBetrag" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3158549b0b7ff521b5386e819e9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f09cc37b5989539738689ae8c6" ON "marketplace_order_items" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0494d92b5130e6477bf768451" ON "marketplace_order_items" ("dealerId") `);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_7fb6895fc8fad9f5200e91abb59" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_1de7eb246940b05765d2c99a7ec" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // Zusaetzliche Performance-Indizes (perf/core-indexes): decken die haeufigen
        // tenant-/FK-gescopten Lese-Muster ab, die bisher ohne Index voll scannten.
        // Namen sind die von TypeORM generierten (DefaultNamingStrategy), damit kein
        // Schema-Drift gegenueber den @Index-Dekoratoren entsteht.
        await queryRunner.query(`CREATE INDEX "IDX_37c1a605468d156e6a8f78f1dc" ON "customers" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1d359a55923bb45b057fbdab0" ON "order_items" ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fb6895fc8fad9f5200e91abb5" ON "invoice_items" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6804855ba1a19523ea57e0769b" ON "products" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_056f27f5450a7348de3c7797c5" ON "stock_movements" ("tenantId", "productId") `);
        await queryRunner.query(`CREATE INDEX "IDX_89c7d328b7026b3410e241dcb1" ON "service_items" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4663e4fd5d590e1b58098a1418" ON "rentals" ("tenantId") `);
        // Plattform-Newsletter (feat/newsletter): eigenstaendige Tabelle, KEIN
        // Tenant-Scope (Detailly ist Verantwortlicher). PII-minimal: E-Mail +
        // Status + Zeitstempel + zwei Token-Slots (einmaliger Bestaetigungs-Hash;
        // stabiler, verschluesselter Abmelde-Token + Lookup-Hash) + append-only
        // Nachweis-Log. Inline in der Baseline ergaenzt.
        await queryRunner.query(`CREATE TYPE "public"."newsletter_subscribers_status_enum" AS ENUM('pending', 'confirmed', 'unsubscribed')`);
        await queryRunner.query(`CREATE TABLE "newsletter_subscribers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "status" "public"."newsletter_subscribers_status_enum" NOT NULL DEFAULT 'pending', "tokenHash" character varying, "abmeldeToken" text, "abmeldeTokenHash" character varying, "angemeldetAm" TIMESTAMP WITH TIME ZONE NOT NULL, "bestaetigtAm" TIMESTAMP WITH TIME ZONE, "abgemeldetAm" TIMESTAMP WITH TIME ZONE, "letzteOptInMailAm" TIMESTAMP WITH TIME ZONE, "nachweisLog" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_newsletter_subscribers" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_newsletter_subscribers_email" ON "newsletter_subscribers" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_newsletter_subscribers_token" ON "newsletter_subscribers" ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_newsletter_subscribers_abmelde" ON "newsletter_subscribers" ("abmeldeTokenHash") `);
        // Schichtdicken-Messprotokoll (Pro-Add-on 'schichtdicke'): zwei neue
        // Tabellen inline in der Baseline (pre-launch-Konvention wie order_materials/
        // folien_rollen; Custom-Index-Namen). Additiv, keine Bestandstabelle beruehrt.
        // Freigabe-/Signatur-Spalten sind bereits vorhanden (Welle 2), werden aber
        // noch nicht befuellt. down() reicht DROP INDEX/TABLE/TYPE (Reverse).
        await queryRunner.query(`CREATE TYPE "public"."layer_measurements_anlass_enum" AS ENUM('vor_folierung', 'vor_ppf', 'ankauf', 'gutachten', 'sonstiges')`);
        await queryRunner.query(`CREATE TYPE "public"."layer_measurements_status_enum" AS ENUM('entwurf', 'abgeschlossen', 'freigegeben')`);
        await queryRunner.query(`CREATE TABLE "layer_measurements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "customerId" character varying NOT NULL, "vehicleId" character varying, "orderId" character varying, "inspectionId" character varying, "modelKey" character varying, "anlass" "public"."layer_measurements_anlass_enum" NOT NULL DEFAULT 'ankauf', "status" "public"."layer_measurements_status_enum" NOT NULL DEFAULT 'entwurf', "normProfileKey" character varying NOT NULL DEFAULT 'serienlack_stahl', "messgeraet" character varying, "notiz" text, "erfasstVonUserId" character varying, "erfasstVonRolle" character varying, "clientUuid" character varying, "freigabeToken" character varying, "unterschriftPng" text, "unterschriebenVonName" character varying, "unterschriebenAm" TIMESTAMP WITH TIME ZONE, "unterschriebenVonUserId" character varying, "consentText" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_layer_measurements" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_layer_measurements_tenant" ON "layer_measurements" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_layer_measurements_clientUuid" ON "layer_measurements" ("clientUuid") `);
        await queryRunner.query(`CREATE INDEX "IDX_layer_measurements_freigabeToken" ON "layer_measurements" ("freigabeToken") `);
        await queryRunner.query(`CREATE INDEX "IDX_layer_measurements_tenant_vehicle" ON "layer_measurements" ("tenantId", "vehicleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_layer_measurements_tenant_order" ON "layer_measurements" ("tenantId", "orderId") `);
        await queryRunner.query(`CREATE TYPE "public"."layer_measurement_points_punkttyp_enum" AS ENUM('standard', 'frei')`);
        await queryRunner.query(`CREATE TYPE "public"."layer_measurement_points_positionmode_enum" AS ENUM('3d', '2d')`);
        await queryRunner.query(`CREATE TABLE "layer_measurement_points" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "measurementId" character varying NOT NULL, "partId" character varying NOT NULL, "partLabel" character varying, "punktTyp" "public"."layer_measurement_points_punkttyp_enum" NOT NULL DEFAULT 'frei', "standardKey" character varying, "label" character varying, "positionMode" "public"."layer_measurement_points_positionmode_enum" NOT NULL DEFAULT '3d', "position3d" jsonb, "ansicht2d" character varying, "x2d" double precision, "y2d" double precision, "readings" jsonb, "reihenfolge" integer, "clientUuid" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_layer_measurement_points" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_layer_points_tenant" ON "layer_measurement_points" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_layer_points_tenant_measurement" ON "layer_measurement_points" ("tenantId", "measurementId") `);
        await queryRunner.query(`CREATE INDEX "IDX_layer_points_tenant_part" ON "layer_measurement_points" ("tenantId", "partId") `);
        // ====================================================================
        // E-Rechnungs-Eingang (feat/erechnung-eingang): eigenstaendige, FK-freie
        // Tabelle fuer empfangene E-Rechnungen (§14 UStG Empfangspflicht). ADDITIV
        // am Ende der up() – HINTER dem Schichtdicke-Block (geplante Merge-Reihen-
        // folge). PII/Bankdaten feld-verschluesselt (text). Custom-Index-Namen.
        // down() (unten): E-Rechnungs-Eingang VOR Schichtdicke droppen (Reverse).
        // ====================================================================
        await queryRunner.query(`CREATE TYPE "public"."incoming_invoices_status_enum" AS ENUM('gelesen', 'teilweise', 'nicht_lesbar')`);
        await queryRunner.query(`CREATE TYPE "public"."incoming_invoices_format_enum" AS ENUM('ubl', 'cii', 'cii_pdf', 'unbekannt')`);
        await queryRunner.query(`CREATE TABLE "incoming_invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "status" "public"."incoming_invoices_status_enum" NOT NULL DEFAULT 'nicht_lesbar', "format" "public"."incoming_invoices_format_enum" NOT NULL DEFAULT 'unbekannt', "archivDatei" character varying NOT NULL, "dokumentHash" character varying NOT NULL, "mimeType" character varying NOT NULL, "dateiGroesse" integer NOT NULL DEFAULT '0', "originalDateiname" text, "rechnungsnummer" character varying, "rechnungsdatum" TIMESTAMP WITH TIME ZONE, "faelligkeitsdatum" TIMESTAMP WITH TIME ZONE, "leistungsdatum" TIMESTAMP WITH TIME ZONE, "nettoBetrag" numeric(12,2), "mwstBetrag" numeric(12,2), "bruttoBetrag" numeric(12,2), "waehrung" character varying NOT NULL DEFAULT 'EUR', "leitwegId" character varying, "verkaeuferName" text, "verkaeuferAnschrift" text, "verkaeuferUstId" text, "verkaeuferSteuernummer" text, "iban" text, "bic" text, "parseFehler" text, "hochgeladenVonUserId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_incoming_invoices" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_incoming_invoices_tenant" ON "incoming_invoices" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_incoming_invoices_tenant_created" ON "incoming_invoices" ("tenantId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_incoming_invoices_tenant_datum" ON "incoming_invoices" ("tenantId", "rechnungsdatum") `);
        await queryRunner.query(`CREATE INDEX "IDX_incoming_invoices_tenant_hash" ON "incoming_invoices" ("tenantId", "dokumentHash") `);
        // ====================================================================
        // Datenpannen-Register (feat/datenpannen-register, Art. 33/34 DSGVO):
        // eigenstaendige, FK-freie Tabelle. ADDITIV am Ende der up() (hinter dem
        // E-Rechnungs-Eingang, geplante Merge-Reihenfolge). Status/Schweregrad/
        // Quelle/Signaltyp bewusst als TEXT (kein Postgres-enum: Enum-WERT-
        // Aenderungen sind teuer) mit @IsIn-Validierung in den DTOs. tenantId
        // NULLABLE (NULL = plattformweiter Vorfall). Custom-Index-Namen.
        // down() (unten): Datenpannen-Register VOR dem E-Rechnungs-Eingang droppen.
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "data_incidents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying, "quelle" character varying NOT NULL DEFAULT 'manuell', "signalTyp" character varying, "status" character varying NOT NULL DEFAULT 'erkannt', "schweregrad" character varying NOT NULL DEFAULT 'mittel', "kenntnisAm" TIMESTAMP WITH TIME ZONE NOT NULL, "betroffeneDatenkategorien" jsonb, "betroffenePersonenAnzahl" integer, "betroffeneDatensaetzeAnzahl" integer, "beschreibung" text, "wahrscheinlicheFolgen" text, "getroffeneMassnahmen" text, "risikoBewertung" text, "meldungEntwurf" text, "verantwortlicherInformiertAm" TIMESTAMP WITH TIME ZONE, "aufsichtsbehoerdeGemeldetAm" TIMESTAMP WITH TIME ZONE, "betroffeneInformiertAm" TIMESTAMP WITH TIME ZONE, "bearbeiterUserId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_data_incidents" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_data_incidents_tenant_created" ON "data_incidents" ("tenantId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_data_incidents_tenant_status" ON "data_incidents" ("tenantId", "status") `);
        // ====================================================================
        // Sentinel Teil 1 – Sicherheits-Ereignis-Protokoll (security_events).
        // Plattformweit (NICHT tenant-gebunden) und IP-tragend. `type`/`severity`
        // als TEXT + @IsIn (kein Postgres-`enum`). `ip` ist personenbezogen ->
        // Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO (IT-Sicherheit); Auto-Purge
        // begrenzt die Aufbewahrung (SecurityEventService). `emailHash` = SHA-256
        // (nie Klartext). Additiv inline in die Baseline (pre-launch-Konvention).
        // down() (unten): security_events VOR dem Datenpannen-Register droppen.
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "security_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" text NOT NULL, "severity" text NOT NULL DEFAULT 'info', "ip" text, "emailHash" text, "userId" text, "tenantId" text, "details" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_security_events" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_security_events_created" ON "security_events" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_security_events_ip" ON "security_events" ("ip") `);
        await queryRunner.query(`CREATE INDEX "IDX_security_events_type_created" ON "security_events" ("type", "createdAt") `);
        // ====================================================================
        // Sentinel Teil 2 – Aktive IP-Sperren (ip_blocks). Plattformweit,
        // IP-tragend. `severity`/`createdBy`/`reason` als TEXT (kein Postgres-
        // `enum`, vgl. security_events) mit @IsIn im DTO. `expiresAt` NULLABLE =
        // dauerhafte Sperre (nur manuell durch PLATFORM_ADMIN); Auto-Sperren
        // setzen immer eine TTL. `ip` ist personenbezogen -> Art. 6 Abs. 1 lit. f
        // DSGVO (IT-Sicherheit); befristete Sperren + Purge (IpBlockService)
        // wahren die Verhaeltnismaessigkeit. Additiv inline in die Baseline
        // (pre-launch-Konvention). down() (unten): ip_blocks VOR security_events.
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "ip_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ip" text NOT NULL, "reason" text NOT NULL, "severity" text NOT NULL DEFAULT 'warn', "createdBy" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, "releasedAt" TIMESTAMP WITH TIME ZONE, "releasedBy" text, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ip_blocks" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ip_blocks_ip" ON "ip_blocks" ("ip") `);
        await queryRunner.query(`CREATE INDEX "IDX_ip_blocks_active" ON "ip_blocks" ("active") `);
        await queryRunner.query(`CREATE INDEX "IDX_ip_blocks_created" ON "ip_blocks" ("createdAt") `);
        // ====================================================================
        // Marktplatz-Ausbau PR1 (feat/marktplatz-datenmodell): Datenmodell-
        // Fundament fuer den B2B-Marktplatz. ADDITIV, ganz am Ende der up() –
        // HINTER dem E-Rechnungs-Eingang. Neue Tabellen (categories/reviews/
        // product_images) + additive Spalten auf marketplace_products (die
        // bestehende CREATE TABLE oben bleibt unangetastet -> conflict-arm).
        // Migration additiv; bei Merge nach dem Sentinel-/DSGVO-Stack ggf.
        // Reihenfolge rebasen. down() (unten) droppt diesen Block ZUERST.
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "marketplace_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parentId" character varying, "slug" character varying NOT NULL, "name" character varying NOT NULL, "bereich" character varying NOT NULL DEFAULT 'sonstiges', "sortIndex" integer NOT NULL DEFAULT '0', "aktiv" boolean NOT NULL DEFAULT true, "sdbPflicht" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace_categories" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_marketplace_categories_slug" ON "marketplace_categories" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_marketplace_categories_parent" ON "marketplace_categories" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_marketplace_categories_bereich_aktiv" ON "marketplace_categories" ("bereich", "aktiv") `);
        // Additive Spalten auf marketplace_products (alle nullable/Default -> Altbestand gueltig).
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "categoryId" character varying`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "herkunftsland" character varying`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "sdbDatei" text`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "sdbHochgeladenAm" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "versandKosten" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "versandHinweis" text`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "lieferzeitTage" integer`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "bestand" integer`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "istHighlight" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "anwendungshinweise" text`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "technischeDaten" jsonb`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "inhaltMenge" character varying`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "bewertungSchnitt" numeric(3,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" ADD "bewertungAnzahl" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "IDX_marketplace_products_category" ON "marketplace_products" ("categoryId") `);
        await queryRunner.query(`CREATE TABLE "marketplace_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" character varying NOT NULL, "tenantId" character varying NOT NULL, "userId" character varying NOT NULL, "sterne" integer NOT NULL, "text" text, "verifiziert" boolean NOT NULL DEFAULT false, "aktiv" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace_reviews" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_marketplace_reviews_product" ON "marketplace_reviews" ("productId") `);
        await queryRunner.query(`CREATE INDEX "IDX_marketplace_reviews_product_aktiv" ON "marketplace_reviews" ("productId", "aktiv") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_marketplace_reviews_product_tenant" ON "marketplace_reviews" ("productId", "tenantId") `);
        await queryRunner.query(`CREATE TABLE "marketplace_product_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" character varying NOT NULL, "datei" text NOT NULL, "sortIndex" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace_product_images" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_marketplace_product_images_product" ON "marketplace_product_images" ("productId") `);
        // ====================================================================
        // Marktplatz-Ausbau PR2 (feat/marktplatz-haendler-auth): Haendler-Login.
        // ADDITIV, ganz am Ende der up(). Der Enum-Wert 'haendler' steckt bereits
        // im CREATE TYPE users_role_enum oben (kein ALTER TYPE ADD VALUE). Hier
        // nur die neue, nullable Spalte users.dealerId (+ Index) – Bestand bleibt
        // gueltig (NULL fuer alle bisherigen User). down() droppt diesen Block
        // ZUERST. HINWEIS bei Merge: Reihenfolge ggf. hinter neuere Baseline-
        // Bloecke rebasen (rein additiv, keine Bestandsspalte beruehrt).
        // ====================================================================
        await queryRunner.query(`ALTER TABLE "users" ADD "dealerId" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_users_dealerId" ON "users" ("dealerId") `);
        // ====================================================================
        // Geraete-Gebrauchtmarkt (feat/geraetemarkt-fundament): 3 eigenstaendige,
        // FK-freie Tabellen (Inserat + Bilder + Meldungen). ADDITIV am Ende der
        // up() – HINTER dem E-Rechnungs-Eingang (geplante Merge-Reihenfolge).
        // Wertespalten (kategorie/zustand/preisModus/status/...) sind BEWUSST
        // varchar + Code-Konstante, KEIN DB-Enum (kein Reseed bei neuen Werten).
        // KEINE Kontakt-/PII-Spalten. Custom-Index-Namen (pre-launch-Baseline).
        // down() (unten): Geraetemarkt VOR dem E-Rechnungs-Eingang droppen (Reverse).
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "geraete_inserate" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "userId" character varying NOT NULL, "titel" character varying NOT NULL, "beschreibung" text NOT NULL, "kategorie" character varying NOT NULL, "zustand" character varying NOT NULL, "preis" numeric(10,2), "preisModus" character varying NOT NULL, "plzRegion" character varying, "ort" character varying, "status" character varying NOT NULL DEFAULT 'aktiv', "moderationStatus" character varying NOT NULL DEFAULT 'ok', "ablaufAm" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_geraete_inserate" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_geraete_inserate_tenant" ON "geraete_inserate" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_geraete_inserate_kategorie" ON "geraete_inserate" ("kategorie") `);
        await queryRunner.query(`CREATE INDEX "IDX_geraete_inserate_moderation_status_created" ON "geraete_inserate" ("moderationStatus", "status", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "geraete_inserat_bilder" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "inseratId" character varying NOT NULL, "datei" text NOT NULL, "sortIndex" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_geraete_inserat_bilder" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_geraete_inserat_bilder_inserat" ON "geraete_inserat_bilder" ("inseratId") `);
        await queryRunner.query(`CREATE TABLE "geraete_inserat_meldungen" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "inseratId" character varying NOT NULL, "melderTenantId" character varying NOT NULL, "melderUserId" character varying NOT NULL, "grund" character varying NOT NULL, "kommentar" text, "status" character varying NOT NULL DEFAULT 'offen', "bearbeitetVonUserId" character varying, "bearbeitetAm" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_geraete_inserat_meldungen" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_geraete_inserat_meldungen_inserat" ON "geraete_inserat_meldungen" ("inseratId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_geraete_inserat_meldungen_inserat_melder" ON "geraete_inserat_meldungen" ("inseratId", "melderTenantId") `);
        // Welle 3-A: additive Benachrichtigungs-Praeferenzen je Nutzer (kleines JSON;
        // nullable, ohne Default -> fehlend gilt im Code als "alle Kategorien an").
        await queryRunner.query(`ALTER TABLE "users" ADD "benachrichtigungen" jsonb`);

        // ====================================================================
        // Verbraucherrechtlicher Buchungs-Abschluss (§312j/§312f/§356 BGB):
        // additive TEXT-Spalten auf booking_requests. Modus-Snapshot + ISO-
        // Zeitstempel der Pflicht-Zustimmungen (Nachweis). down() (unten) droppt
        // sie zuerst wieder (Reverse-Reihenfolge).
        // ====================================================================
        await queryRunner.query(`ALTER TABLE "booking_requests" ADD "abschlussModus" text`);
        await queryRunner.query(`ALTER TABLE "booking_requests" ADD "pflichtinfoBestaetigtAm" text`);
        await queryRunner.query(`ALTER TABLE "booking_requests" ADD "vorzeitigerLeistungsbeginnAm" text`);
        await queryRunner.query(`ALTER TABLE "booking_requests" ADD "datenschutzHinweisAm" text`);

        // ====================================================================
        // GoBD-Kassenbuch (feat/kassenbuch-gobd): eine eigenstaendige, FK-freie
        // Tabelle fuer Bargeld-Bewegungen. ADDITIV ganz am Ende der up() – HINTER
        // dem Geraetemarkt (geplante Merge-Reihenfolge). down() (unten): Kassenbuch
        // ZUERST droppen (Reverse). Wertespalte `typ` ist BEWUSST varchar +
        // Code-Konstante, KEIN DB-Enum (kein Reseed bei neuen Werten). Der
        // Unique-Index (tenantId, laufendeNummer) sichert die lueckenlose,
        // kollisionsfeste Nummernvergabe (withUniqueRetry). Custom-Index-Namen
        // (pre-launch-Baseline).
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "kassenbuch_eintraege" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "laufendeNummer" integer NOT NULL, "datum" TIMESTAMP WITH TIME ZONE NOT NULL, "typ" character varying NOT NULL, "betrag" numeric(10,2) NOT NULL, "mwstSatz" numeric(5,2) NOT NULL DEFAULT '0', "zweck" character varying NOT NULL, "belegNummer" character varying, "kategorie" character varying, "kassenbestandNach" numeric(12,2) NOT NULL, "erfasstVonUserId" character varying NOT NULL, "festgeschrieben" boolean NOT NULL DEFAULT false, "festgeschriebenAm" TIMESTAMP WITH TIME ZONE, "stornoVonId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_kassenbuch_eintraege" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_kassenbuch_tenant" ON "kassenbuch_eintraege" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_kassenbuch_tenant_datum" ON "kassenbuch_eintraege" ("tenantId", "datum") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_kassenbuch_tenant_nummer" ON "kassenbuch_eintraege" ("tenantId", "laufendeNummer") `);
        // Doppelstorno-Sperre: je Original hoechstens EINE Gegenbuchung (partieller
        // Unique-Index, nur Storno-Zeilen). Normale Buchungen (stornoVonId NULL)
        // sind ausgenommen und kollidieren nie (mehrere NULLs sind distinct).
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_kassenbuch_storno_von" ON "kassenbuch_eintraege" ("tenantId", "stornoVonId") WHERE "stornoVonId" IS NOT NULL`);

        // ====================================================================
        // Dellenkalkulation (feat/dellenkalkulation-pdr): Smart Repair / PDR.
        // 3 eigenstaendige, FK-freie Tabellen (Kalkulation + Marker + Preismatrix).
        // ADDITIV am Ende der up() – HINTER dem Kassenbuch (geplante Merge-
        // Reihenfolge). Wertespalten (modus/status/positionMode/groessenklasse)
        // sind BEWUSST varchar + Code-Konstante/@IsIn, KEIN DB-Enum (kein Reseed
        // bei neuen Werten). Geldbetraege/Faktoren als numeric (decimal-Konvention);
        // nur die variabel lange Hagel-Staffel als jsonb. Custom-Index-Namen
        // (pre-launch-Baseline). down() (unten) droppt diesen Block ZUERST.
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "dellen_kalkulationen" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "customerId" character varying, "vehicleId" character varying, "modelKey" character varying, "modus" character varying NOT NULL DEFAULT 'einzel', "status" character varying NOT NULL DEFAULT 'entwurf', "gesamtpreis" numeric(10,2) NOT NULL DEFAULT '0', "notiz" text, "erstelltVonUserId" character varying, "erstelltVonRolle" character varying, "finalisiertAm" TIMESTAMP WITH TIME ZONE, "clientUuid" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dellen_kalkulationen" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_kalk_tenant" ON "dellen_kalkulationen" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_kalk_clientUuid" ON "dellen_kalkulationen" ("clientUuid") `);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_kalk_tenant_vehicle" ON "dellen_kalkulationen" ("tenantId", "vehicleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_kalk_tenant_created" ON "dellen_kalkulationen" ("tenantId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "dellen_marker" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "kalkulationId" character varying NOT NULL, "bauteil" character varying NOT NULL, "bauteilLabel" character varying, "positionMode" character varying NOT NULL DEFAULT '3d', "position3d" jsonb, "ansicht2d" character varying, "x2d" double precision, "y2d" double precision, "groessenklasse" character varying, "kante" boolean NOT NULL DEFAULT false, "alu" boolean NOT NULL DEFAULT false, "lackschaden" boolean NOT NULL DEFAULT false, "dellenAnzahl" integer, "einzelpreis" numeric(10,2) NOT NULL DEFAULT '0', "reihenfolge" integer, "clientUuid" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dellen_marker" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_marker_tenant" ON "dellen_marker" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_marker_tenant_kalk" ON "dellen_marker" ("tenantId", "kalkulationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dellen_marker_tenant_bauteil" ON "dellen_marker" ("tenantId", "bauteil") `);
        await queryRunner.query(`CREATE TABLE "dellen_preismatrix" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "basis1Euro" numeric(10,2) NOT NULL DEFAULT '0', "basis2Euro" numeric(10,2) NOT NULL DEFAULT '0', "basis5Euro" numeric(10,2) NOT NULL DEFAULT '0', "basisGolfball" numeric(10,2) NOT NULL DEFAULT '0', "basisGroesser" numeric(10,2) NOT NULL DEFAULT '0', "kantenFaktor" numeric(6,3) NOT NULL DEFAULT '1', "aluFaktor" numeric(6,3) NOT NULL DEFAULT '1', "lackschadenAufschlag" numeric(10,2) NOT NULL DEFAULT '0', "mindestpauschale" numeric(10,2) NOT NULL DEFAULT '0', "anfahrtspauschale" numeric(10,2) NOT NULL DEFAULT '0', "hagelStaffel" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dellen_preismatrix" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dellen_preismatrix_tenant" ON "dellen_preismatrix" ("tenantId") `);

        // ====================================================================
        // Affiliate-/Empfehlungsprogramm (feat/affiliate-programm): zwei
        // eigenstaendige, FK-freie Tabellen (Empfehlungs-Code je Betrieb +
        // Werbungen). ADDITIV ganz am Ende der up() – HINTER der Dellenkalkulation
        // (geplante Merge-Reihenfolge). Referrals sind fachlich tenant-UEBER-
        // greifend (Werber -> Geworbener); der Zugriff ist dennoch strikt
        // geschnitten (Tenant nur eigene, Plattform alles) – rein im Service.
        // Wertespalte `status` ist BEWUSST varchar + Code-Konstante/@IsIn, KEIN
        // DB-Enum (kein Reseed bei neuen Werten). UNIQUE(referredTenantId) sichert
        // „ein Betrieb nur einmal geworben"; UNIQUE(code)/(tenantId) einen Code je
        // Betrieb. Custom-Index-Namen (pre-launch-Baseline). down() (unten) droppt
        // diesen Block nach dem Umlaut-Block (Reverse).
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "referral_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "code" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_referral_codes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_referral_codes_tenant" ON "referral_codes" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_referral_codes_code" ON "referral_codes" ("code") `);
        await queryRunner.query(`CREATE TABLE "referrals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referrerTenantId" character varying NOT NULL, "referredTenantId" character varying NOT NULL, "code" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'registriert', "belohnungAnwartschaft" boolean NOT NULL DEFAULT false, "belohnungTyp" character varying, "zahlendSeit" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_referrals" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_referrals_referrer" ON "referrals" ("referrerTenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_referrals_referred" ON "referrals" ("referredTenantId") `);

        // ====================================================================
        // Umlautfester Kennzeichen-Lookup (fix/kennzeichen-lookup-umlaute):
        // additive, nullable Spalte vehicles.kennzeichenNormalisiert + Index.
        // ADDITIV am Ende der up() – HINTER dem Affiliate-Block, VOR dem
        // Schaufenster-Block (geplante Merge-Reihenfolge). Backfill fuer
        // Bestandszeilen direkt hier (Postgres-UPPER/REGEXP_REPLACE ist – anders
        // als SQLite – umlautfest; identische Regel wie normalizeKennzeichen:
        // Leerzeichen/Bindestriche raus, gross, 32 Zeichen Deckel, leer -> NULL).
        // Laufend gefuellt wird die Spalte durch die BeforeInsert/BeforeUpdate-
        // Hooks der Vehicle-Entity; als Netz zieht der Boot-Backfill im
        // VehiclesService (JS-normalisiert) Zeilen ohne Normalform nach. down()
        // (unten) droppt diesen Block NACH dem Schaufenster (Reverse).
        // ====================================================================
        await queryRunner.query(`ALTER TABLE "vehicles" ADD "kennzeichenNormalisiert" character varying`);
        await queryRunner.query(`UPDATE "vehicles" SET "kennzeichenNormalisiert" = NULLIF(UPPER(LEFT(REGEXP_REPLACE("licensePlate", '[\\s-]+', '', 'g'), 32)), '') WHERE "licensePlate" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_vehicles_tenant_kennzeichen_norm" ON "vehicles" ("tenantId", "kennzeichenNormalisiert") `);

        // ====================================================================
        // Oeffentliches Schaufenster (feat/oeffentlicher-slider): EINE
        // eigenstaendige, FK-freie Tabelle fuer Vorher/Nachher-Referenzen mit
        // Consent-Nachweis + token-scoped Foto-Auslieferung. ADDITIV ganz am Ende
        // der up() – HINTER dem Umlaut-Block (geplante Merge-Reihenfolge).
        // Wertespalte `gewerk` ist BEWUSST varchar + Code-Konstante/@IsIn, KEIN
        // DB-Enum (kein Reseed bei neuen Werten). `shareToken` ist unique
        // (mehrere NULL bleiben distinct = unveroeffentlichte Eintraege). Bilder
        // liegen als eigene Kopien unter private-uploads/schaufenster/<tenantId>/;
        // die Tabelle traegt nur logische Pfade. Custom-Index-Namen (pre-launch-
        // Baseline). down() (unten) droppt diesen Block ZUERST (Reverse).
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "showcase_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "titel" character varying NOT NULL, "beschreibung" text, "gewerk" character varying NOT NULL DEFAULT 'aufbereitung', "vorherPfad" character varying NOT NULL, "nachherPfad" character varying NOT NULL, "veroeffentlicht" boolean NOT NULL DEFAULT false, "shareToken" character varying, "reihenfolge" integer, "kundeEinverstaendnis" boolean NOT NULL DEFAULT false, "einverstaendnisAm" TIMESTAMP WITH TIME ZONE, "einverstaendnisHinweis" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_showcase_items" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_showcase_items_tenant" ON "showcase_items" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_showcase_items_tenant_reihenfolge" ON "showcase_items" ("tenantId", "reihenfolge") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_showcase_items_shareToken" ON "showcase_items" ("shareToken") `);

        // ====================================================================
        // Marktrecherche-Register (feat/marktrecherche-register): EINE
        // eigenstaendige, FK-freie, PLATTFORMWEITE Tabelle (BEWUSST OHNE
        // tenantId – interne Betreiber-Sicht, Zugriff strikt ueber PLATFORM_ADMIN
        // im RolesGuard). ADDITIV ganz am Ende der up() – HINTER dem Schaufenster-
        // Block. Wertespalten kategorie/status/prioritaet sind BEWUSST varchar +
        // Code-Konstante/@IsIn (KEIN DB-Enum -> kein Reseed bei neuen Werten).
        // NEUTRALITAET: nur sachliche, oeffentlich beobachtbare Fakten + die
        // daraus abgeleitete eigene Idee; kein Bewertungs-/Herabsetzungsfeld.
        // down() (unten) droppt diesen Block ZUERST (Reverse).
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "markt_beobachtungen" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "wettbewerber" character varying NOT NULL, "kategorie" character varying NOT NULL DEFAULT 'sonstiges', "beobachtung" text NOT NULL, "quelleUrl" character varying, "beobachtetAm" date NOT NULL, "abgeleiteteIdee" text NOT NULL, "status" character varying NOT NULL DEFAULT 'neu', "prioritaet" character varying NOT NULL DEFAULT 'mittel', "erstelltVonUserId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_markt_beobachtungen" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_markt_beobachtungen_status" ON "markt_beobachtungen" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_markt_beobachtungen_created" ON "markt_beobachtungen" ("createdAt") `);

        // ====================================================================
        // Privates Kunden-Feedback zur Uebergabe-Mappe (feat/mappe-fotos-feedback,
        // Welle 2-C): EINE eigenstaendige, FK-freie Tabelle. Der Endkunde bewertet
        // ueber seinen login-freien Mappe-Token; das Feedback bleibt tenant-intern
        // (erscheint nur in der App). ADDITIV ganz am Ende der up() – HINTER dem
        // Marktrecherche-Block (geplante Merge-Reihenfolge). `sterne` ist ein
        // gebundener Integer (1..5, im DTO validiert), KEIN DB-Enum. `kommentar`
        // ist in der App verschluesselt (Transformer) -> hier `text`. Unique
        // (tenantId, orderId) erzwingt EIN Feedback je Auftrag (idempotentes
        // Doppel-Absenden). Custom-Index-Namen (pre-launch-Baseline). down() (unten)
        // droppt diesen Block ZUERST (Reverse).
        // ====================================================================
        await queryRunner.query(`CREATE TABLE "order_feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "orderId" character varying NOT NULL, "sterne" integer NOT NULL, "kommentar" text, "gelesen" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_order_feedback" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_order_feedback_tenant" ON "order_feedback" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_order_feedback_tenant_created" ON "order_feedback" ("tenantId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_order_feedback_tenant_gelesen" ON "order_feedback" ("tenantId", "gelesen") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_order_feedback_tenant_order" ON "order_feedback" ("tenantId", "orderId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Kunden-Feedback zuerst (in up() zuletzt angelegt).
        await queryRunner.query(`DROP INDEX "public"."UQ_order_feedback_tenant_order"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_feedback_tenant_gelesen"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_feedback_tenant_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_feedback_tenant"`);
        await queryRunner.query(`DROP TABLE "order_feedback"`);
        // Marktrecherche-Register danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_markt_beobachtungen_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_markt_beobachtungen_status"`);
        await queryRunner.query(`DROP TABLE "markt_beobachtungen"`);
        // Oeffentliches Schaufenster danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."UQ_showcase_items_shareToken"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_showcase_items_tenant_reihenfolge"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_showcase_items_tenant"`);
        await queryRunner.query(`DROP TABLE "showcase_items"`);
        // Umlautfester Kennzeichen-Lookup danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_vehicles_tenant_kennzeichen_norm"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "kennzeichenNormalisiert"`);
        // Affiliate-/Empfehlungsprogramm danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."UQ_referrals_referred"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_referrals_referrer"`);
        await queryRunner.query(`DROP TABLE "referrals"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_referral_codes_code"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_referral_codes_tenant"`);
        await queryRunner.query(`DROP TABLE "referral_codes"`);
        // Dellenkalkulation danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_preismatrix_tenant"`);
        await queryRunner.query(`DROP TABLE "dellen_preismatrix"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_marker_tenant_bauteil"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_marker_tenant_kalk"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_marker_tenant"`);
        await queryRunner.query(`DROP TABLE "dellen_marker"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_kalk_tenant_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_kalk_tenant_vehicle"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_kalk_clientUuid"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dellen_kalk_tenant"`);
        await queryRunner.query(`DROP TABLE "dellen_kalkulationen"`);
        // GoBD-Kassenbuch danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."UQ_kassenbuch_storno_von"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_kassenbuch_tenant_nummer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_kassenbuch_tenant_datum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_kassenbuch_tenant"`);
        await queryRunner.query(`DROP TABLE "kassenbuch_eintraege"`);
        // Verbraucherrechtliche Buchungs-Nachweis-Spalten danach (in up() davor angelegt).
        await queryRunner.query(`ALTER TABLE "booking_requests" DROP COLUMN "datenschutzHinweisAm"`);
        await queryRunner.query(`ALTER TABLE "booking_requests" DROP COLUMN "vorzeitigerLeistungsbeginnAm"`);
        await queryRunner.query(`ALTER TABLE "booking_requests" DROP COLUMN "pflichtinfoBestaetigtAm"`);
        await queryRunner.query(`ALTER TABLE "booking_requests" DROP COLUMN "abschlussModus"`);
        // Welle 3-A danach zurueck (in up() davor ergaenzt).
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "benachrichtigungen"`);
        // Geraete-Gebrauchtmarkt danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_geraete_inserat_meldungen_inserat_melder"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_geraete_inserat_meldungen_inserat"`);
        await queryRunner.query(`DROP TABLE "geraete_inserat_meldungen"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_geraete_inserat_bilder_inserat"`);
        await queryRunner.query(`DROP TABLE "geraete_inserat_bilder"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_geraete_inserate_moderation_status_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_geraete_inserate_kategorie"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_geraete_inserate_tenant"`);
        await queryRunner.query(`DROP TABLE "geraete_inserate"`);
        // Marktplatz-Ausbau PR2 zuerst wieder abbauen (in up() zuletzt angelegt).
        // Der Enum-Wert 'haendler' verschwindet mit DROP TYPE users_role_enum weiter unten.
        await queryRunner.query(`DROP INDEX "public"."IDX_users_dealerId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "dealerId"`);
        // Marktplatz-Ausbau PR1 abbauen.
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_product_images_product"`);
        await queryRunner.query(`DROP TABLE "marketplace_product_images"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_marketplace_reviews_product_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_reviews_product_aktiv"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_reviews_product"`);
        await queryRunner.query(`DROP TABLE "marketplace_reviews"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_products_category"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "bewertungAnzahl"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "bewertungSchnitt"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "inhaltMenge"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "technischeDaten"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "anwendungshinweise"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "istHighlight"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "bestand"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "lieferzeitTage"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "versandHinweis"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "versandKosten"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "sdbHochgeladenAm"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "sdbDatei"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "herkunftsland"`);
        await queryRunner.query(`ALTER TABLE "marketplace_products" DROP COLUMN "categoryId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_categories_bereich_aktiv"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_categories_parent"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_marketplace_categories_slug"`);
        await queryRunner.query(`DROP TABLE "marketplace_categories"`);
        // Sentinel Teil 2 – IP-Sperren zuerst (in up() ganz zuletzt angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_ip_blocks_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ip_blocks_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ip_blocks_ip"`);
        await queryRunner.query(`DROP TABLE "ip_blocks"`);
        // Sentinel-Sicherheits-Protokoll danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_security_events_type_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_security_events_ip"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_security_events_created"`);
        await queryRunner.query(`DROP TABLE "security_events"`);
        // Datenpannen-Register danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_data_incidents_tenant_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_data_incidents_tenant_created"`);
        await queryRunner.query(`DROP TABLE "data_incidents"`);
        // E-Rechnungs-Eingang danach (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_incoming_invoices_tenant_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_incoming_invoices_tenant_datum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_incoming_invoices_tenant_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_incoming_invoices_tenant"`);
        await queryRunner.query(`DROP TABLE "incoming_invoices"`);
        await queryRunner.query(`DROP TYPE "public"."incoming_invoices_format_enum"`);
        await queryRunner.query(`DROP TYPE "public"."incoming_invoices_status_enum"`);
        // Schichtdicken-Messprotokoll (in up() vor dem E-Rechnungs-Eingang angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_points_tenant_part"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_points_tenant_measurement"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_points_tenant"`);
        await queryRunner.query(`DROP TABLE "layer_measurement_points"`);
        await queryRunner.query(`DROP TYPE "public"."layer_measurement_points_positionmode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."layer_measurement_points_punkttyp_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_measurements_tenant_order"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_measurements_tenant_vehicle"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_measurements_freigabeToken"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_measurements_clientUuid"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_layer_measurements_tenant"`);
        await queryRunner.query(`DROP TABLE "layer_measurements"`);
        await queryRunner.query(`DROP TYPE "public"."layer_measurements_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."layer_measurements_anlass_enum"`);
        // Plattform-Newsletter (in up() davor angelegt).
        await queryRunner.query(`DROP INDEX "public"."IDX_newsletter_subscribers_abmelde"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_newsletter_subscribers_token"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_newsletter_subscribers_email"`);
        await queryRunner.query(`DROP TABLE "newsletter_subscribers"`);
        await queryRunner.query(`DROP TYPE "public"."newsletter_subscribers_status_enum"`);
        // perf/core-indexes zuerst wieder abbauen (Reverse-Reihenfolge zu up()).
        await queryRunner.query(`DROP INDEX "public"."IDX_4663e4fd5d590e1b58098a1418"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89c7d328b7026b3410e241dcb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_056f27f5450a7348de3c7797c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6804855ba1a19523ea57e0769b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7fb6895fc8fad9f5200e91abb5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d359a55923bb45b057fbdab0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_37c1a605468d156e6a8f78f1dc"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP CONSTRAINT "FK_1de7eb246940b05765d2c99a7ec"`);
        await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_7fb6895fc8fad9f5200e91abb59"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d0494d92b5130e6477bf768451"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f09cc37b5989539738689ae8c6"`);
        await queryRunner.query(`DROP TABLE "marketplace_order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_edbd1e0acd26b29378804a062a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_614f2b4b252fe99ea1651aa568"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_798f8598465e812b0be6696577"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3d10b52eaf9ff34ed968d13f77"`);
        await queryRunner.query(`DROP TABLE "marketplace_orders"`);
        await queryRunner.query(`DROP TYPE "public"."marketplace_orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d79c67e3598a460ef44cd3966"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba6cadcba1b3f610e970b61a58"`);
        await queryRunner.query(`DROP TABLE "marketplace_clicks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d744f404fac04891dabd89fbcb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f026c8339a716d73e60e46572"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aff5c5b20bebb6d95b30fc938c"`);
        await queryRunner.query(`DROP TABLE "marketplace_products"`);
        await queryRunner.query(`DROP TABLE "marketplace_dealers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ea9200e64f7172a68dfdc0e25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8cb5841790aa5245ddbfe5264"`);
        await queryRunner.query(`DROP TABLE "support_messages"`);
        await queryRunner.query(`DROP TYPE "public"."support_messages_autortyp_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_439ad5aa62c0b07094ed5d3707"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f39d4242941c82c75c939c7e0"`);
        await queryRunner.query(`DROP TABLE "support_tickets"`);
        await queryRunner.query(`DROP TYPE "public"."support_tickets_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."support_tickets_kategorie_enum"`);
        // Folierer-Welle 2 (Restrollen-Register) zuerst wieder abbauen.
        await queryRunner.query(`DROP INDEX "public"."IDX_folien_rollen_tenant_product"`);
        await queryRunner.query(`DROP TABLE "folien_rollen"`);
        await queryRunner.query(`DROP TYPE "public"."folien_rollen_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_baba44cb2423607d04f56feef0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e48a7636d1ab3aa2e23c864272"`);
        await queryRunner.query(`DROP TABLE "order_materials"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c297c711efae08b25bcfb267f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3946c97986bbecd8609b18f4a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_84e08f7dd016e2079879170db2"`);
        await queryRunner.query(`DROP TABLE "order_times"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_71b6552a46262b4cb4662dde50"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a246dd6062a40f23c147ac80d6"`);
        await queryRunner.query(`DROP TABLE "booking_requests"`);
        await queryRunner.query(`DROP TYPE "public"."booking_requests_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab60cf3bfdc579846beebd9b92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_344b087f9495a39ba6e7402b50"`);
        await queryRunner.query(`DROP TABLE "damage_item_photos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bca4961a6b0399f1b65da2246d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7c141e97ccde6ccdd47869b31"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1b7119899a8562e2b80c94cdc"`);
        await queryRunner.query(`DROP TABLE "damage_photos"`);
        await queryRunner.query(`DROP TYPE "public"."damage_photos_kategorie_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da51399c21502baee79ad0e770"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1619f454f470b8609f1a965c7b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_579931f753f1f74c9d95d9a48f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_06fd837baaf8a57e9107b9b84d"`);
        await queryRunner.query(`DROP TABLE "damage_items"`);
        await queryRunner.query(`DROP TYPE "public"."damage_items_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."damage_items_reparaturart_enum"`);
        await queryRunner.query(`DROP TYPE "public"."damage_items_schweregrad_enum"`);
        await queryRunner.query(`DROP TYPE "public"."damage_items_art_enum"`);
        await queryRunner.query(`DROP TYPE "public"."damage_items_origin_enum"`);
        await queryRunner.query(`DROP TYPE "public"."damage_items_positionmode_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_df22cf46a6e16c2bb8fde349b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c05f38949f41f1c8c19ff6e3c9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8f67ca6ca9f86b096cb3a4c541"`);
        await queryRunner.query(`DROP TABLE "damage_inspections"`);
        await queryRunner.query(`DROP TYPE "public"."damage_inspections_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."damage_inspections_typ_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d1b452d7f0d45863303b7d3000"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f74d57735d357f2b81cfccee2b"`);
        await queryRunner.query(`DROP TABLE "time_entries"`);
        await queryRunner.query(`DROP TYPE "public"."time_entries_art_enum"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
        await queryRunner.query(`DROP TABLE "plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb2c7f27ed444aba2e33f76f8f"`);
        await queryRunner.query(`DROP TABLE "locations"`);
        await queryRunner.query(`DROP TABLE "rentals"`);
        await queryRunner.query(`DROP TYPE "public"."rentals_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ce8320f3a9c6f6229a76cb8ed"`);
        await queryRunner.query(`DROP TABLE "purchase_orders"`);
        await queryRunner.query(`DROP TYPE "public"."purchase_orders_status_enum"`);
        await queryRunner.query(`DROP TABLE "purchase_order_items"`);
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP TYPE "public"."stock_movements_typ_enum"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c8a4a8ac719bb03535bb93a163"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_46e6a4182e96de9d4c1bba5060"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_angebotToken"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_varianteGruppeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3ae9c1e7978f09414ad2c5943"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_df6e527a0fefc6f54ab52e65d2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_84c835fc8d35b53bcc70a620b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89c82485e364081f457b210120"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TYPE "public"."invoices_angebotstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invoices_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invoices_art_enum"`);
        await queryRunner.query(`DROP TABLE "invoice_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_orders_tenant_angebotInvoiceId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2cfc2bf7cb89228185e15644c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9de42155f7c8471eed66bd0e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_67c4414db46ec33bcc03a0e5df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_208a358e9fe8abe6e1d8245980"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_servicetype_enum"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP TYPE "public"."order_items_typ_enum"`);
        await queryRunner.query(`DROP TABLE "service_items"`);
        await queryRunner.query(`DROP TYPE "public"."service_items_einheit_enum"`);
        await queryRunner.query(`DROP TYPE "public"."service_items_kategorie_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_889633a4291bcb0bf4680fff23"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64f050f3becb5fce8d13383fc2"`);
        await queryRunner.query(`DROP TABLE "vehicles"`);
        await queryRunner.query(`DROP TYPE "public"."vehicles_fueltype_enum"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP TYPE "public"."customers_type_enum"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_betriebstyp_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1143abb8c3fad8b06dd857a8c9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6a19d4b4f6c62dcd29daa497e"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
