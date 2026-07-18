import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityEvent } from './entities/security-event.entity';
import { IpBlock } from './entities/ip-block.entity';
import { SecurityEventService } from './security-event.service';
import { LoginGuardService } from './login-guard.service';
import { IpBlockService } from './ip-block.service';
import { ThreatDetectionService } from './threat-detection.service';
import { SecurityAlertService } from './security-alert.service';
import { PlatformSecurityService } from './platform-security.service';
import { PlatformSecurityController } from './platform-security.controller';

/**
 * Sentinel – aktive Sicherheits-Abwehr.
 *
 * Teil 1 (Login-Abwehr): In-Memory-Fehlversuchs-Sperre (LoginGuardService) +
 * plattformweites Sicherheits-Ereignis-Protokoll (SecurityEventService, Auto-Purge).
 *
 * Teil 2 (Auto-IP-Sperre + Erkennung + Betreiber-Sicht):
 *  - IpBlockService: aktive IP-Sperren mit kurzem In-Memory-Cache (isBlocked =
 *    eine DB-Query pro Fenster). Wird per app.get() von der frueh registrierten
 *    Express-Middleware (main.ts) genutzt -> daher exportiert.
 *  - ThreatDetectionService: periodischer Scan der security_events -> automatische,
 *    befristete Sperre bei Fehl-Login-/4xx-Scan-Fluten.
 *  - SecurityAlertService: transaktionale Betreiber-Alarm-Mail (kein Review-Gate).
 *  - PlatformSecurityController/Service: Betreiber-Bereich platform/security/*.
 *
 * MailService (MailerModule) + AuditService (AuditModule) sind @Global -> ohne
 * expliziten Import injizierbar.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SecurityEvent, IpBlock])],
  controllers: [PlatformSecurityController],
  providers: [
    SecurityEventService,
    LoginGuardService,
    IpBlockService,
    ThreatDetectionService,
    SecurityAlertService,
    PlatformSecurityService,
  ],
  exports: [SecurityEventService, LoginGuardService, IpBlockService],
})
export class SecurityModule {}
