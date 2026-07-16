import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { AuditService } from '../../audit/audit.service';
import { SUBSCRIPTION_DENIED_ACTION } from '../../incidents/incident.constants';

/**
 * Setzt den Abo-Status eines Betriebs **serverseitig** durch (nie nur im Frontend).
 * Auf operative Controller anwenden – NACH dem `JwtAuthGuard`, damit der Benutzer
 * bereits am Request haengt:
 *
 *   `@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)`
 *
 * Geblockte Betriebe erhalten 403 mit `code: 'SUBSCRIPTION_INACTIVE'`, woran das
 * Frontend die Sperrseite erkennt. Login und `auth/me` bleiben bewusst frei,
 * damit ein gesperrter Betrieb sich anmelden und die Sperrseite sehen kann.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    // @Optional wie bei RolesGuard: haelt bestehende Guard-Tests konstruierbar.
    @Optional() private readonly audit?: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();

    // Ohne Benutzer entscheidet der Auth-Guard; platform_admin ist betriebsuebergreifend.
    if (!user) return true;
    if (user.role === UserRole.PLATFORM_ADMIN) return true;
    if (!user.tenantId) return true;

    const result = await this.subscriptions.evaluateAccess(user.tenantId);
    if (result.access === 'blocked') {
      // Abo-403 nur zur Nachvollziehbarkeit im Audit-Trail (best-effort). Dieses
      // Signal ist fachlich erwartbar und triggert BEWUSST KEINEN Auto-Vorfall.
      if (this.audit) {
        void this.audit.log({
          tenantId: user.tenantId,
          userId: user.id,
          action: SUBSCRIPTION_DENIED_ACTION,
          entityType: 'Http',
          payload: { reason: result.reason, status: result.status },
        });
      }
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        status: result.status,
        reason: result.reason,
        message: `Abo nicht aktiv: ${result.reason}`,
      });
    }
    return true;
  }
}
