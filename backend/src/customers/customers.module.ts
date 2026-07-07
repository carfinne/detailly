import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomersService } from './customers.service';
import { CustomersImportService } from './customers-import.service';
import { CustomersController } from './customers.controller';
import { AuditModule } from '../audit/audit.module';

// SubscriptionsService/SevdeskService kommen aus @Global-Modulen (kein Import noetig).
@Module({
  imports: [TypeOrmModule.forFeature([Customer]), AuditModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersImportService],
  exports: [CustomersService],
})
export class CustomersModule {}
