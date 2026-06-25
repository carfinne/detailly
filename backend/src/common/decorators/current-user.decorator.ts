import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Der aus dem JWT extrahierte Benutzer, wie ihn die JwtStrategy zurueckgibt. */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  emailVerified?: boolean;
}

/**
 * Liest den authentifizierten Benutzer aus dem Request.
 * Verwendung: `@CurrentUser() user: AuthUser`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
