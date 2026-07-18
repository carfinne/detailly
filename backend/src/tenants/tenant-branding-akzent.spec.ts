import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantsService } from './tenants.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * "Dein Look" – eigene Akzentfarbe (settings.akzentfarbe).
 *
 * Deckt ab:
 *  - DTO-Validierung (@Matches 3-/6-stelliges Hex, `#` optional; leerer String
 *    erlaubt = zuruecksetzen; ungueltige Werte -> Fehler).
 *  - Service-Round-Trip: speichert IMMER mit fuehrendem `#` (der Lesepfad
 *    resolveTenantAkzent verlangt es); leerer Wert loescht den Key.
 */

// ---------------------------------------------------------------------------
// DTO-Validierung
// ---------------------------------------------------------------------------
describe('UpdateTenantSettingsDto – akzentfarbe', () => {
  const errorsFor = async (value: unknown) => {
    const errs = await validate(plainToInstance(UpdateTenantSettingsDto, { akzentfarbe: value }));
    return errs.filter((e) => e.property === 'akzentfarbe');
  };

  it('akzeptiert 6-stelliges Hex mit fuehrendem #', async () => {
    expect(await errorsFor('#B5722F')).toHaveLength(0);
  });

  it('akzeptiert Hex ohne # und 3-stelliges Kurz-Hex', async () => {
    expect(await errorsFor('B5722F')).toHaveLength(0);
    expect(await errorsFor('#abc')).toHaveLength(0);
    expect(await errorsFor('abc')).toHaveLength(0);
  });

  it('akzeptiert leeren String (= zuruecksetzen auf Branchen-Standard)', async () => {
    expect(await errorsFor('')).toHaveLength(0);
  });

  it('lehnt ungueltige Farben ab', async () => {
    expect((await errorsFor('rot')).length).toBeGreaterThan(0);
    expect((await errorsFor('#12')).length).toBeGreaterThan(0);
    expect((await errorsFor('#1234')).length).toBeGreaterThan(0);
    expect((await errorsFor('#GGGGGG')).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Service-Round-Trip (settings.akzentfarbe)
// ---------------------------------------------------------------------------
describe('TenantsService – akzentfarbe (settings-Merge)', () => {
  let stored: any;
  let tenantRepo: { findOne: jest.Mock; save: jest.Mock };
  let sevdesk: { loadToken: jest.Mock };
  let mail: { loadSmtpPassword: jest.Mock; invalidateTenant: jest.Mock };
  let audit: { log: jest.Mock };
  let svc: TenantsService;

  const user = { id: 'u1', tenantId: 't1', role: 'owner' } as unknown as AuthUser;

  beforeEach(() => {
    stored = { id: 't1', name: 'Betrieb', country: 'DE', settings: {}, logoUrl: null };
    tenantRepo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      save: jest.fn().mockImplementation((t: any) => Promise.resolve(t)),
    };
    sevdesk = { loadToken: jest.fn().mockResolvedValue(null) };
    mail = { loadSmtpPassword: jest.fn().mockResolvedValue(null), invalidateTenant: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    svc = new TenantsService(
      {} as any,
      tenantRepo as any,
      {} as any,
      audit as any,
      mail as any,
      sevdesk as any,
      {} as any,
    );
  });

  it('ohne gepflegte Farbe -> leeres akzentfarbe-Feld im Profil', async () => {
    const profile = await svc.getOwnProfile('t1');
    expect(profile.akzentfarbe).toBe('');
  });

  it('speichert mit fuehrendem # (auch wenn ohne # uebergeben)', async () => {
    const profile = await svc.updateOwnProfile(user, { akzentfarbe: 'B5722F' } as any);
    expect(stored.settings.akzentfarbe).toBe('#B5722F');
    expect(profile.akzentfarbe).toBe('#B5722F');
  });

  it('leerer String loescht die Farbe (zurueck auf Branchen-Standard)', async () => {
    stored.settings = { akzentfarbe: '#B5722F' };
    const profile = await svc.updateOwnProfile(user, { akzentfarbe: '' } as any);
    expect(stored.settings.akzentfarbe).toBeUndefined();
    expect(profile.akzentfarbe).toBe('');
  });
});
