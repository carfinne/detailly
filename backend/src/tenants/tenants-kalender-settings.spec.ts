import { TenantsService } from './tenants.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Round-Trip der Kalender-/Darstellungs-Einstellungen (Kalender 2.0) ueber den
 * bestehenden Settings-GET/PATCH: Speichern via `updateOwnProfile` -> Auslesen via
 * `getOwnProfile` bzw. den rollen-offenen `getKalenderEinstellungen`. Reine Mocks
 * (keine DB, kein Nest-Bootstrap): ein persistenter Tenant, dessen `settings` der
 * Service selbst mutiert.
 */
describe('TenantsService – Kalender/Darstellung (settings.kalender / settings.darstellung)', () => {
  let stored: any;
  let tenantRepo: { findOne: jest.Mock; save: jest.Mock };
  let svc: TenantsService;

  const user = { id: 'u1', tenantId: 't1', role: 'owner' } as unknown as AuthUser;

  beforeEach(() => {
    stored = { id: 't1', name: 'Betrieb', country: 'DE', settings: {} };
    tenantRepo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      save: jest.fn().mockImplementation((t: any) => Promise.resolve(t)),
    };
    svc = new TenantsService(
      {} as any, // DataSource
      tenantRepo as any,
      {} as any, // AuthService
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      { loadSmtpPassword: jest.fn().mockResolvedValue(null), invalidateTenant: jest.fn() } as any,
      { loadToken: jest.fn().mockResolvedValue(null) } as any,
      {} as any, // SubscriptionsService
    );
  });

  it('getOwnProfile ohne gespeicherte Werte -> Kalender-/Darstellungs-Defaults', async () => {
    const p = await svc.getOwnProfile('t1');
    expect(p.kalender.konfliktverhalten).toBe('warnen');
    expect(p.kalender.standortKonflikt).toBe(false);
    expect(p.kalender.slotDauerMin).toBe(30);
    expect(p.kalender.arbeitszeiten.mo).toEqual({ von: '08:00', bis: '18:00', aktiv: true });
    expect(p.kalender.arbeitszeiten.so.aktiv).toBe(false);
    expect(p.darstellung).toEqual({
      wochenstart: 'montag',
      zeitformat: '24h',
      kalenderStartStunde: 7,
      kalenderEndStunde: 19,
    });
  });

  it('Kalender-Teil-Update: nur uebergebene Felder aendern sich, Rest bleibt Default', async () => {
    const result = await svc.updateOwnProfile(user, {
      kalender: { konfliktverhalten: 'blockieren', standortKonflikt: true, slotDauerMin: 15 },
    } as any);
    expect(result.kalender.konfliktverhalten).toBe('blockieren');
    expect(result.kalender.standortKonflikt).toBe(true);
    expect(result.kalender.slotDauerMin).toBe(15);
    // Arbeitszeiten unveraendert (Default).
    expect(result.kalender.arbeitszeiten.mo).toEqual({ von: '08:00', bis: '18:00', aktiv: true });
    // Persistiert unter settings.kalender (Quelle fuer den naechsten GET).
    expect(stored.settings.kalender.konfliktverhalten).toBe('blockieren');
    expect(tenantRepo.save).toHaveBeenCalled();
  });

  it('Darstellung-Teil-Update erzwingt Endstunde > Startstunde (defensiv)', async () => {
    const result = await svc.updateOwnProfile(user, {
      darstellung: { kalenderStartStunde: 22 },
    } as any);
    expect(result.darstellung.kalenderStartStunde).toBe(22);
    expect(result.darstellung.kalenderEndStunde).toBe(23); // Default 19 <= 22 -> Start + 1
  });

  it('erneutes Auslesen liefert die gespeicherten Werte (Round-Trip)', async () => {
    await svc.updateOwnProfile(user, {
      kalender: { arbeitszeiten: { sa: { aktiv: true } }, pufferMin: 10 },
    } as any);
    const p = await svc.getOwnProfile('t1');
    expect(p.kalender.arbeitszeiten.sa.aktiv).toBe(true);
    expect(p.kalender.pufferMin).toBe(10);
  });

  describe('umsatzZielWoche (Wochen-Umsatzziel des Chef-Layers)', () => {
    it('Default null; PATCH setzt + Round-Trip ueber getOwnProfile (Owner-Formular)', async () => {
      const vorher = await svc.getOwnProfile('t1');
      expect(vorher.kalender.umsatzZielWoche).toBeNull();

      await svc.updateOwnProfile(user, { kalender: { umsatzZielWoche: 5000 } } as any);
      expect(stored.settings.kalender.umsatzZielWoche).toBe(5000);
      const p = await svc.getOwnProfile('t1');
      expect(p.kalender.umsatzZielWoche).toBe(5000);
      // Teil-Update: uebrige Kalender-Werte unveraendert (Defaults).
      expect(p.kalender.slotDauerMin).toBe(30);
    });

    it('klammert statt abzulehnen (Spec): 2 Mio -> 1 Mio, -5 -> 0', async () => {
      const zuGross = await svc.updateOwnProfile(user, {
        kalender: { umsatzZielWoche: 2_000_000 },
      } as any);
      expect(zuGross.kalender.umsatzZielWoche).toBe(1_000_000);

      const negativ = await svc.updateOwnProfile(user, {
        kalender: { umsatzZielWoche: -5 },
      } as any);
      expect(negativ.kalender.umsatzZielWoche).toBe(0);
    });

    it('null loescht das Ziel; Weglassen laesst es unveraendert', async () => {
      await svc.updateOwnProfile(user, { kalender: { umsatzZielWoche: 5000 } } as any);
      const unveraendert = await svc.updateOwnProfile(user, {
        kalender: { pufferMin: 15 },
      } as any);
      expect(unveraendert.kalender.umsatzZielWoche).toBe(5000);

      const geloescht = await svc.updateOwnProfile(user, {
        kalender: { umsatzZielWoche: null },
      } as any);
      expect(geloescht.kalender.umsatzZielWoche).toBeNull();
      expect(stored.settings.kalender.umsatzZielWoche).toBeNull();
    });

    it('rollen-offener getKalenderEinstellungen liefert das Ziel NICHT aus (Leitungs-Info)', async () => {
      stored.settings = { kalender: { umsatzZielWoche: 5000, konfliktverhalten: 'blockieren' } };
      const res = await svc.getKalenderEinstellungen('t1');
      expect('umsatzZielWoche' in res.kalender).toBe(false);
      // Uebrige Kalender-Werte kommen weiterhin vollstaendig an.
      expect(res.kalender.konfliktverhalten).toBe('blockieren');
      expect(res.kalender.slotDauerMin).toBe(30);
    });
  });

  describe('getKalenderEinstellungen (rollen-offener Read)', () => {
    it('ohne gespeicherte Werte -> aufgeloeste Defaults (kalender + darstellung)', async () => {
      const res = await svc.getKalenderEinstellungen('t1');
      expect(res.kalender.konfliktverhalten).toBe('warnen');
      expect(res.darstellung.kalenderStartStunde).toBe(7);
      // tenant-scoped ueber die id, nur settings selektiert.
      expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { id: 't1' }, select: ['id', 'settings'] });
    });

    it('liefert die gespeicherten Werte, unbekannter Tenant (null) -> Defaults, kein Throw', async () => {
      stored.settings = { kalender: { konfliktverhalten: 'blockieren' } };
      const res = await svc.getKalenderEinstellungen('t1');
      expect(res.kalender.konfliktverhalten).toBe('blockieren');

      tenantRepo.findOne.mockResolvedValueOnce(null);
      const res2 = await svc.getKalenderEinstellungen('t-unknown');
      expect(res2.kalender.konfliktverhalten).toBe('warnen');
    });
  });
});
