import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1783456549418 implements MigrationInterface {
    name = 'Migration1783456549418'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('platform_admin', 'platform_analyst', 'platform_support', 'owner', 'manager', 'technician', 'receptionist')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "phone" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'technician', "tenantId" character varying, "isActive" boolean NOT NULL DEFAULT true, "stundenlohn" numeric(10,2), "geburtstag" date, "funktion" character varying, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "passwordChangedAt" TIMESTAMP WITH TIME ZONE, "tokenVersion" integer NOT NULL DEFAULT 0, "emailVerifiedAt" TIMESTAMP WITH TIME ZONE, "emailVerificationTokenHash" character varying, "emailVerificationExpiresAt" TIMESTAMP WITH TIME ZONE, "totpSecret" text, "totpEnabled" boolean NOT NULL DEFAULT false, "recoveryCodes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6a19d4b4f6c62dcd29daa497e" ON "password_reset_tokens" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1143abb8c3fad8b06dd857a8c9" ON "password_reset_tokens" ("tokenHash") `);
        await queryRunner.query(`CREATE TYPE "public"."tenants_status_enum" AS ENUM('active', 'inactive', 'trial')`);
        await queryRunner.query(`CREATE TYPE "public"."tenants_betriebstyp_enum" AS ENUM('aufbereitung', 'folierung', 'ppf', 'komplett')`);
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "email" character varying, "phone" character varying, "street" character varying, "city" character varying, "postalCode" character varying, "country" character varying NOT NULL DEFAULT 'DE', "franchiseId" character varying, "status" "public"."tenants_status_enum" NOT NULL DEFAULT 'trial', "betriebstyp" "public"."tenants_betriebstyp_enum" NOT NULL DEFAULT 'komplett', "logoUrl" character varying, "sevdeskApiToken" text, "smtpPassword" text, "dkimPrivateKey" text, "calendarToken" character varying, "businessHours" jsonb, "settings" text, "trialEndsAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE ("slug"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
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
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "auftragsnummer" character varying NOT NULL, "customerId" character varying NOT NULL, "vehicleId" character varying, "locationId" character varying, "assignedUserId" character varying, "angebotInvoiceId" character varying, "freigabeToken" character varying, "serviceType" "public"."orders_servicetype_enum" NOT NULL DEFAULT 'aufbereitung', "status" "public"."orders_status_enum" NOT NULL DEFAULT 'angefragt', "materialkosten" numeric(10,2) NOT NULL DEFAULT '0', "arbeitsstunden" numeric(10,2) NOT NULL DEFAULT '0', "geplanterStart" TIMESTAMP WITH TIME ZONE, "geplantesEnde" TIMESTAMP WITH TIME ZONE, "bilderVorher" jsonb, "bilderNachher" jsonb, "leistungDetails" jsonb, "internerHinweis" text, "nettoSumme" numeric(10,2) NOT NULL DEFAULT '0', "mwstBetrag" numeric(10,2) NOT NULL DEFAULT '0', "gesamtpreis" numeric(10,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
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
        await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "orderId" character varying, "customerId" character varying, "vehicleId" character varying, "assignedUserId" character varying, "locationId" character varying, "titel" character varying NOT NULL, "start" TIMESTAMP WITH TIME ZONE NOT NULL, "ende" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'geplant', "notiz" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
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
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('trial', 'active', 'past_due', 'canceled', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "planId" character varying, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'trial', "trialEndsAt" TIMESTAMP WITH TIME ZONE, "currentPeriodStart" TIMESTAMP WITH TIME ZONE, "currentPeriodEnd" TIMESTAMP WITH TIME ZONE, "canceledAt" TIMESTAMP WITH TIME ZONE, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "notiz" text, "stripeCustomerId" character varying, "stripeSubscriptionId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0c5fe8e5f9f4dd4a8c0134abc9c" UNIQUE ("tenantId"), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Plattform-Newsletter zuerst (in up() zuletzt angelegt).
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
