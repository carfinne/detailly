import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health-Modul: nur der Controller. Die DataSource fuer den Readiness-Ping
 * kommt aus dem global registrierten TypeOrmModule.forRoot (TypeOrmCoreModule
 * ist @Global) – daher kein forFeature-Import noetig.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
