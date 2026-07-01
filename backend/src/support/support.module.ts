import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportMessage } from './entities/support-message.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { PlatformSupportController } from './platform-support.controller';

@Module({
  // User fuer Absender-Namen (Snapshot), Tenant fuer den Betriebsnamen (Plattform-Liste).
  imports: [TypeOrmModule.forFeature([SupportTicket, SupportMessage, User, Tenant])],
  controllers: [SupportController, PlatformSupportController],
  providers: [SupportService],
})
export class SupportModule {}
