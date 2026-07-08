import { TenantsService } from './tenants.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Round-trip-Test der Kalkulations-Einstellung (EUR/qm) ueber den bestehenden
 * Settings-GET/PATCH: Speichern via `updateOwnProfile` -> Auslesen via
 * `getOwnProfile`. Reine Mocks (keine DB, kein Nest-Bootstrap): ein persistenter
 * Tenant, dessen `settings` der Service selbst mutiert.
 */
describe('TenantsService – Kalkulation (settings.kalkulation)', () => {
  let stored: any;
  let tenantRepo: { findOne: jest.Mock; save: jest.Mock };
  let sevdesk: { loadToken: jest.Mock };
  let mail: { loadSmtpPassword: jest.Mock; invalidateTenant: jest.Mock };
  let audit: { log: jest.Mock };
  let svc: TenantsService;

  const user = { id: 'u1', tenantId: 't1', role: 'owner' } as unknown as AuthUser;

  beforeEach(() => {
    stored = { id: 't1', name: 'Betrieb', country: 'DE', settings: {} };
    tenantRepo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      save: jest.fn().mockImplementation((t: any) => Promise.resolve(t)),
    };
    sevdesk = { loadToken: jest.fn().mockResolvedValue(null) };
    mail = { loadSmtpPassword: jest.fn().mockResolvedValue(null), invalidateTenant: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    svc = new TenantsService(
      {} as any, // DataSource (nur fuer register genutzt)
      tenantRepo as any,
      {} as any, // AuthService
      audit as any,
      mail as any,
      sevdesk as any,
      {} as any, // SubscriptionsService (nur fuer getEntitlements genutzt)
    );
  });

  it('ohne gespeicherte Kalkulation -> Defaults 60/130/25 beim Auslesen', async () => {
    const profile = await svc.getOwnProfile('t1');
    expect(profile.kalkulation).toEqual({
      folierungProQm: 60,
      ppfProQm: 130,
      aufbereitungProQm: 25,
    });
  });

  it('Speichern (Teil-Update) + Auslesen: nur uebergebene Felder aendern sich', async () => {
    const result = await svc.updateOwnProfile(user, {
      kalkulation: { folierungProQm: 80, ppfProQm: 150 },
    } as any);

    // Rueckgabe (frisch ausgelesen) traegt die neuen Werte + Default fuer aufbereitung.
    expect(result.kalkulation).toEqual({
      folierungProQm: 80,
      ppfProQm: 150,
      aufbereitungProQm: 25,
    });
    // Persistiert unter settings.kalkulation (Quelle fuer den naechsten GET).
    expect(stored.settings.kalkulation).toEqual({
      folierungProQm: 80,
      ppfProQm: 150,
      aufbereitungProQm: 25,
    });
    expect(tenantRepo.save).toHaveBeenCalled();
  });

  it('erneutes Auslesen liefert die gespeicherten Werte zurueck', async () => {
    await svc.updateOwnProfile(user, { kalkulation: { aufbereitungProQm: 35 } } as any);
    const profile = await svc.getOwnProfile('t1');
    expect(profile.kalkulation).toEqual({
      folierungProQm: 60,
      ppfProQm: 130,
      aufbereitungProQm: 35,
    });
  });
});
