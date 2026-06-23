import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from './entities/time-entry.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { ZeiterfassungService } from './zeiterfassung.service';
import { ZeiterfassungController } from './zeiterfassung.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEntry, User, Location]), AuditModule],
  controllers: [ZeiterfassungController],
  providers: [ZeiterfassungService],
})
export class ZeiterfassungModule {}
