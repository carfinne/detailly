import { Module } from '@nestjs/common';
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
import { buildDataSourceOptions } from './database/data-source-options';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Liefert das gebaute Next.js-Frontend (statischer Export) unter der gleichen
    // Origin aus. Erwartet die Dateien im Ordner `client/` neben dem Backend.
    // API-Routen (/api/...) werden ausgenommen, damit sie das Backend bedient.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'client'),
      exclude: ['/api/{*path}'],
    }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    AuthModule,
    AuditModule,
    SevdeskModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    OrdersModule,
    InvoicesModule,
    AppointmentsModule,
    EmployeesModule,
    ShopModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
