import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FolienRolle } from './entities/folien-rolle.entity';
import { Product } from '../shop/entities/product.entity';
import { FolienRollenService } from './folien-rollen.service';
import { FolienRollenController } from './folien-rollen.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([FolienRolle, Product]), AuditModule],
  controllers: [FolienRollenController],
  providers: [FolienRollenService],
})
export class FolienRollenModule {}
