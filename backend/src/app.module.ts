import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { CustomersModule } from './customers/customers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ServicesModule } from './services/services.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { EmployeesModule } from './employees/employees.module';
import { ShopModule } from './shop/shop.module';
import { SevdeskModule } from './sevdesk/sevdesk.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { OrderMaterialModule } from './order-material/order-material.module';
import { RemindersModule } from './reminders/reminders.module';
import { ProfitabilityModule } from './profitability/profitability.module';
import { PlatformAnalyticsModule } from './platform-analytics/platform-analytics.module';
import { SupportModule } from './support/support.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { IntakeModule } from './intake/intake.module';
import { LocationsModule } from './locations/locations.module';
import { TenantsModule } from './tenants/tenants.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ZeiterfassungModule } from './zeiterfassung/zeiterfassung.module';
import { InspectionModule } from './inspection/inspection.module';
import { GdprModule } from './gdpr/gdpr.module';
import { SearchModule } from './search/search.module';
import { PublicBookingModule } from './public-booking/public-booking.module';
import { BillingModule } from './billing/billing.module';
import { CalendarModule } from './calendar/calendar.module';
import { buildDataSourceOptions } from './database/data-source-options';
import { validateEnv } from './config/env.validation';
import { MailerModule } from './mailer/mailer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    // FIX 5: globaler Rate-Limiter (v5: ttl in MILLISEKUNDEN). Grosszuegig (600/min
    // pro IP), damit der Mehrplatzbetrieb hinter einer gemeinsamen Buero-IP +
    // statische Assets/SPA-Fallback nicht geblockt werden; striktes Login-Limit
    // (5/min) via @Throttle am AuthController, Foto-Streams via @SkipThrottle ausgenommen.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 600 }]),
    // Liefert das gebaute Next.js-Frontend (statischer Export) unter der gleichen
    // Origin aus. Erwartet die Dateien im Ordner `client/` neben dem Backend.
    // API-Routen (/api/...) werden ausgenommen, damit sie das Backend bedient.
    //
    // HINWEIS: Es gibt KEINEN oeffentlichen /uploads-Mount mehr. ALLE Fotos
    // (Inspektion UND Auftrag) liegen unter private-uploads/ (nicht gemountet)
    // und werden ausschliesslich guard-geschuetzt + tenant-scoped ausgeliefert
    // (InspectionPhotoController bzw. OrderPhotoController).
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'client'),
      // WICHTIG: Express-4-Syntax. Das installierte path-to-regexp (0.2.5, von
      // @nestjs/serve-static gebuendelt) versteht die neue '{*path}'-Syntax NICHT
      // -> sie wuerde literal kompilieren und NIE matchen, d.h. /api-Routen kaemen
      // doch in den index.html-Fallback (-> ENOENT/500 bei unbekannter API-Route).
      // '/api/(.*)' matcht /api/... korrekt und laesst /login etc. unberuehrt.
      exclude: ['/api/(.*)'],
      // Kein automatischer Trailing-Slash-Redirect: Beim pplx.app-Hosting wuerde
      // dieser das Proxy-Praefix /port/3001 verlieren und auf eine 404-Route
      // zeigen. Stattdessen uebernimmt der SpaFallbackController unbekannte
      // Routen und liefert das passende index.html OHNE Redirect aus.
      serveStaticOptions: {
        redirect: false,
        index: ['index.html'],
      },
    }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    AuthModule,
    AuditModule,
    SevdeskModule,
    MailerModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    OrdersModule,
    InvoicesModule,
    AppointmentsModule,
    EmployeesModule,
    ShopModule,
    DashboardModule,
    ReportsModule,
    OrderMaterialModule,
    RemindersModule,
    ProfitabilityModule,
    PlatformAnalyticsModule,
    SupportModule,
    MarketplaceModule,
    IntakeModule,
    LocationsModule,
    TenantsModule,
    SubscriptionsModule,
    ZeiterfassungModule,
    InspectionModule,
    GdprModule,
    SearchModule,
    PublicBookingModule,
    BillingModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
