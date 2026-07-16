import { Injectable, CanActivate, ExecutionContext, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { REQUIRES_FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { AuditService } from '../../audit/audit.service';
import { PLAN_FEATURE_DENIED_ACTION } from '../../incidents/incident.constants';

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
    // @Optional wie bei RolesGuard: haelt bestehende Guard-Tests konstruierbar.
    @Optional() private readonly audit?: AuditService,
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

    try {
      await this.subscriptions.assertFeature(user.tenantId, feature);
    } catch (err) {
      // Tarif-403 nur zur Nachvollziehbarkeit im Audit-Trail (best-effort). Wie
      // das Abo-403 fachlich erwartbar -> triggert BEWUSST KEINEN Auto-Vorfall.
      if (this.audit) {
        void this.audit.log({
          tenantId: user.tenantId,
          userId: user.id,
          action: PLAN_FEATURE_DENIED_ACTION,
          entityType: 'Http',
          payload: { feature },
        });
      }
      throw err;
    }
    return true;
  }
}
