import { Injectable, CanActivate, ExecutionContext, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AuditService } from '../../audit/audit.service';
import { FORBIDDEN_ACTION } from '../../incidents/incident.constants';

/**
 * Prueft die per `@Roles()` geforderten Rollen.
 * platform_admin darf grundsaetzlich alles.
 *
 * Bei einer echten Rollen-Verweigerung (403) wird ein best-effort `forbidden_access`
 * ins Audit-Log geschrieben – das ist das Sicherheitssignal fuer die Datenpannen-
 * Erkennung (403-Haeufung). Der AuditService ist `@Optional`, damit die vielen
 * Unit-Tests, die `new RolesGuard(new Reflector())` bauen, unveraendert laufen.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Optional() private readonly audit?: AuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user) return false;
    if (user.role === UserRole.PLATFORM_ADMIN) return true;
    if (requiredRoles.includes(user.role)) return true;

    this.emitForbidden(user, req);
    return false;
  }

  /** Best-effort-Emission des Sicherheitssignals (blockiert die Antwort nie). */
  private emitForbidden(user: { id?: string; tenantId?: string }, req: { url?: string; method?: string }): void {
    if (!this.audit || !user?.tenantId) return;
    void this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: FORBIDDEN_ACTION,
      entityType: 'Http',
      payload: { path: req?.url, method: req?.method },
    });
  }
}
