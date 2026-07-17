import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityEvent } from './entities/security-event.entity';
import { SecurityEventService } from './security-event.service';
import { LoginGuardService } from './login-guard.service';

/**
 * Sentinel (Teil 1) – aktive Login-Abwehr: In-Memory-Fehlversuchs-Sperre
 * (LoginGuardService) + plattformweites Sicherheits-Ereignis-Protokoll
 * (SecurityEventService, inkl. Auto-Purge).
 *
 * Beide Services werden exportiert und vom AuthModule (AuthService/MfaService)
 * konsumiert. Der LoginGuardService haelt seinen Zustand IN-MEMORY -> als
 * Singleton (ein Provider, ein Modul) verhalten sich beide Login-Pfade
 * konsistent.
 *
 * Betreiber-Dashboard/Alarm-Mail sind bewusst Teil 2 (kein Controller hier).
 */
@Module({
  imports: [TypeOrmModule.forFeature([SecurityEvent])],
  providers: [SecurityEventService, LoginGuardService],
  exports: [SecurityEventService, LoginGuardService],
})
export class SecurityModule {}
