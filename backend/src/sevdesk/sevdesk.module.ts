import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { SevdeskService } from './sevdesk.service';

@Global()
@Module({
  // Tenant-Repo: der sevDesk-Token liegt verschluesselt (select:false) am Tenant.
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [SevdeskService],
  exports: [SevdeskService],
})
export class SevdeskModule {}
