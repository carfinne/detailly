import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { BENACHRICHTIGUNGEN_DEFAULTS } from '../common/benachrichtigungen';

/**
 * Benachrichtigungs-Praeferenzen je Nutzer (Welle 3-A), repo-gemockt (kein Boot,
 * keine DB). Kernaussagen:
 *  - Default = alles an (fehlender Block im Profil).
 *  - Teil-Update persistiert + laesst andere Kategorien unveraendert.
 *  - Unbekannter Nutzer -> 401.
 */
function makeService() {
  const users = new Map<string, any>();
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      for (const u of users.values()) {
        if (where.id !== undefined && u.id !== where.id) continue;
        if (where.isActive !== undefined && u.isActive !== where.isActive) continue;
        return u;
      }
      return null;
    }),
    save: jest.fn(async (u: any) => u),
  };
  // Tenant ohne mfaPflicht -> getOwnProfile-Flags bleiben leer.
  const tenantRepo = { findOne: jest.fn(async () => ({ id: 't1', settings: {} })) };
  const jwt = { sign: jest.fn(() => 'jwt') };
  const config = { get: jest.fn(() => 'http://localhost:3000') };
  const mail = { send: jest.fn(async () => undefined) };

  const svc = new AuthService(
    userRepo as any,
    tenantRepo as any,
    { findOne: jest.fn() } as any,
    jwt as any,
    config as any,
    mail as any,
  );
  return { svc, users, userRepo };
}

const addUser = (users: Map<string, any>, over: any = {}) =>
  users.set('u1', {
    id: 'u1',
    email: 'a@b.de',
    isActive: true,
    firstName: 'A',
    lastName: 'B',
    role: 'technician',
    tenantId: 't1',
    totpEnabled: false,
    benachrichtigungen: null,
    ...over,
  });

describe('AuthService · Benachrichtigungs-Praeferenzen', () => {
  it('getOwnProfile: fehlender Block -> alle Kategorien an (Default)', async () => {
    const { svc, users } = makeService();
    addUser(users);
    const profile = await svc.getOwnProfile('u1');
    expect(profile.benachrichtigungen).toEqual(BENACHRICHTIGUNGEN_DEFAULTS);
  });

  it('updateBenachrichtigungen: Teil-Update persistiert + laesst Rest an', async () => {
    const { svc, users, userRepo } = makeService();
    addUser(users);

    const profile = await svc.updateBenachrichtigungen('u1', { steuerTermine: false, materialKnapp: false });

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    // In der DB persistiert:
    expect(users.get('u1').benachrichtigungen).toEqual({
      rechnungenFaellig: true,
      termineHeute: true,
      materialKnapp: false,
      angeboteAngenommen: true,
      steuerTermine: false,
      auslastung: true,
      par19: true,
    });
    // Antwort spiegelt den neuen Stand:
    expect(profile.benachrichtigungen.steuerTermine).toBe(false);
    expect(profile.benachrichtigungen.auslastung).toBe(true);
  });

  it('updateBenachrichtigungen: Round-Trip aus + wieder an', async () => {
    const { svc, users } = makeService();
    addUser(users, { benachrichtigungen: { par19: false } });

    const profile = await svc.updateBenachrichtigungen('u1', { par19: true });
    expect(profile.benachrichtigungen.par19).toBe(true);
  });

  it('updateBenachrichtigungen: unbekannter Nutzer -> 401', async () => {
    const { svc } = makeService();
    await expect(svc.updateBenachrichtigungen('nope', { par19: false })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
