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
import { IntakeModule } from './intake/intake.module';
import { LocationsModule } from './locations/locations.module';
import { TenantsModule } from './tenants/tenants.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ZeiterfassungModule } from './zeiterfassung/zeiterfassung.module';
import { InspectionModule } from './inspection/inspection.module';
import { GdprModule } from './gdpr/gdpr.module';
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
    // Hochgeladene Fotos (Vorher/Nachher) unter /uploads ausliefern.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      // Liefert NUR oeffentliche Dateien (Auftrags-Fotos, flach unter uploads/).
      // FIX 2 (DSGVO): Inspektions-Fotos liegen bewusst NICHT hier, sondern unter
      // private-uploads/ (NICHT gemountet) und gehen ausschliesslich ueber den
      // guard-geschuetzten InspectionPhotoController raus.
      serveStaticOptions: { index: false, fallthrough: true },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'client'),
      exclude: ['/api/{*path}'],
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
    IntakeModule,
    LocationsModule,
    TenantsModule,
    SubscriptionsModule,
    ZeiterfassungModule,
    InspectionModule,
    GdprModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
