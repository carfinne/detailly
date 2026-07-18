import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

/**
 * @Global: AuditService ist ein querschnittlicher Best-Effort-Logger, den auch
 * die Guards (forbidden_access) und der Auth-Service (login_failed) fuer die
 * Datenpannen-Erkennungssignale brauchen. Global erspart den expliziten Import in
 * jedem nutzenden Modul (bestehende `imports: [AuditModule]` bleiben gueltig).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
