import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { REQUIRES_FEATURE_KEY } from '../decorators/requires-feature.decorator';

/**
 * Setzt Tarif-Feature-Gates **serverseitig** durch (T-002, Umsatzsicherung):
 * Endpunkte mit `@RequiresFeature('shop')` sind nur nutzbar, wenn der Tarif des
 * Betriebs den Feature-Key enthaelt – sonst 403 `code: 'PLAN_FEATURE_MISSING'`
 * (eigener Code, damit das Frontend einen Upgrade-Hinweis zeigen kann statt auf
 * die Sperrseite umzuleiten). In der Guard-Kette NACH dem `SubscriptionGuard`:
 *
 *   `@UseGuards(JwtAuthGuard, SubscriptionGuard, PlanFeatureGuard, RolesGuard)`
 *
 * Ohne `@RequiresFeature`-Metadata laesst der Guard durch; Methoden-Metadata
 * ueberschreibt Klassen-Metadata. Kein Tarif zugewiesen (z. B. Trial mit
 * planId null) bedeutet Vollzugriff (siehe `plan-entitlements.ts`).
 */
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const { user } = context.switchToHttp().getRequest();

    // Ohne Benutzer entscheidet der Auth-Guard; platform_admin ist betriebsuebergreifend.
    if (!user) return true;
    if (user.role === UserRole.PLATFORM_ADMIN) return true;
    if (!user.tenantId) return true;

    await this.subscriptions.assertFeature(user.tenantId, feature);
    return true;
  }
}
