import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TenantsController } from './tenants.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * Guard-Verdrahtung des rollen-offenen Kalkulations-Endpoints. Die
 * Schadenserfassung (auch Mechaniker/Empfang) muss die EUR/qm-Saetze lesen
 * koennen -> `GET /tenants/me/kalkulation` haengt NUR am JwtAuthGuard,
 * NICHT am RolesGuard (im Gegensatz zum owner-only `GET /tenants/me`).
 * Reflection-Test ohne Nest-Bootstrap.
 */
describe('TenantsController – Guard-Verdrahtung me/kalkulation', () => {
  const guardsOf = (handler: (...args: any[]) => unknown): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];

  it('me/kalkulation haengt nur am JwtAuthGuard (kein RolesGuard)', () => {
    const g = guardsOf(TenantsController.prototype.getKalkulation);
    expect(g).toContain(JwtAuthGuard);
    expect(g).not.toContain(RolesGuard);
  });

  it('gleiche Guard-Kette wie me/branding (Referenz fuer rollen-offen)', () => {
    expect(guardsOf(TenantsController.prototype.getKalkulation)).toEqual(
      guardsOf(TenantsController.prototype.getBranding),
    );
  });

  it('owner-only me bleibt hinter RolesGuard (Kontrast, nicht veraendert)', () => {
    expect(guardsOf(TenantsController.prototype.getOwn)).toContain(RolesGuard);
  });
});
