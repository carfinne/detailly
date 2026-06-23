import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

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
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();

    // Ohne Benutzer entscheidet der Auth-Guard; super_admin ist betriebsuebergreifend.
    if (!user) return true;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (!user.tenantId) return true;

    const result = await this.subscriptions.evaluateAccess(user.tenantId);
    if (result.access === 'blocked') {
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
