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

  describe('getKalkulation (rollen-offener Read /tenants/me/kalkulation)', () => {
    it('ohne gespeicherte Kalkulation -> flaches Default-Objekt 60/130/25', async () => {
      const k = await svc.getKalkulation('t1');
      expect(k).toEqual({ folierungProQm: 60, ppfProQm: 130, aufbereitungProQm: 25 });
    });

    it('liefert die gespeicherten Saetze (settings.kalkulation), tenant-scoped ueber die id', async () => {
      stored.settings = { kalkulation: { folierungProQm: 90, ppfProQm: 160, aufbereitungProQm: 30 } };
      const k = await svc.getKalkulation('t1');
      expect(k).toEqual({ folierungProQm: 90, ppfProQm: 160, aufbereitungProQm: 30 });
      expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { id: 't1' }, select: ['id', 'settings'] });
    });

    it('unbekannter Tenant (null) -> Defaults, kein Throw', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      const k = await svc.getKalkulation('t-unknown');
      expect(k).toEqual({ folierungProQm: 60, ppfProQm: 130, aufbereitungProQm: 25 });
    });
  });

  describe('getEntitlements (Tarif-Berechtigungen + betriebstyp fuer den V3-Empfehlungs-Layer)', () => {
    const buildSvc = (subService: { getEntitlements: jest.Mock }) =>
      new TenantsService(
        {} as any, // DataSource
        tenantRepo as any,
        {} as any, // AuthService
        audit as any,
        mail as any,
        sevdesk as any,
        subService as any,
      );

    // Reine Tarif-Berechtigungen, wie sie die Subscriptions-Domaene liefert.
    const ent = {
      planSlug: 'basic',
      planName: 'Basic',
      features: ['kunden', 'kalkulation'],
      limits: { maxUsers: 10, maxLocations: 1, maxCustomers: null },
    };

    it('reicht die Tarif-Entitlements unveraendert durch und ergaenzt betriebstyp + steuer aus dem Tenant', async () => {
      stored.betriebstyp = 'folierung';
      const subService = { getEntitlements: jest.fn().mockResolvedValue(ent) };
      const result = await buildSvc(subService).getEntitlements('t1');
      // Steuer-Default (kein Block gespeichert): Regelbesteuerung, 19 %.
      expect(result).toEqual({
        ...ent,
        betriebstyp: 'folierung',
        steuer: { kleinunternehmer: false, standardMwstSatz: 19 },
      });
      expect(subService.getEntitlements).toHaveBeenCalledWith('t1');
      // tenant-scoped ueber die id; betriebstyp + settings (fuer die Steuer-Kurzinfo).
      expect(tenantRepo.findOne).toHaveBeenCalledWith({
        where: { id: 't1' },
        select: ['id', 'betriebstyp', 'settings'],
      });
    });

    it('Tenant ohne betriebstyp -> Default komplett, Tarif-Felder unveraendert', async () => {
      delete stored.betriebstyp;
      const subService = { getEntitlements: jest.fn().mockResolvedValue(ent) };
      const result = await buildSvc(subService).getEntitlements('t1');
      expect(result.betriebstyp).toBe('komplett');
      expect(result.planSlug).toBe('basic');
      expect(result.features).toEqual(['kunden', 'kalkulation']);
    });

    it('§19-Kleinunternehmer: steuer-Kurzinfo (kleinunternehmer + standardMwstSatz) fuer alle Rollen', async () => {
      stored.settings = { steuer: { kleinunternehmer: true, standardMwstSatz: 0 } };
      const subService = { getEntitlements: jest.fn().mockResolvedValue(ent) };
      const result = await buildSvc(subService).getEntitlements('t1');
      expect(result.steuer).toEqual({ kleinunternehmer: true, standardMwstSatz: 0 });
    });
  });

  describe('Steuer-Einstellungen (settings.steuer, §19 UStG)', () => {
    it('ohne gespeicherten Block -> Defaults (Regelbesteuerung, 19 %, Einzelunternehmen)', async () => {
      const profile = await svc.getOwnProfile('t1');
      expect(profile.steuer).toEqual({
        kleinunternehmer: false,
        standardMwstSatz: 19,
        kleinunternehmerHinweis: 'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG.',
        rechtsform: 'einzelunternehmen',
        registergericht: '',
        registernummer: '',
        vertretungsberechtigte: '',
      });
    });

    it('Teil-Update (§19 an, Satz 0) + Auslesen: nur uebergebene Felder aendern sich', async () => {
      const result = await svc.updateOwnProfile(user, {
        steuer: { kleinunternehmer: true, standardMwstSatz: 0 },
      } as any);
      expect(result.steuer.kleinunternehmer).toBe(true);
      expect(result.steuer.standardMwstSatz).toBe(0);
      // Uebrige Felder bleiben Default.
      expect(result.steuer.rechtsform).toBe('einzelunternehmen');
      // Persistiert unter settings.steuer (Quelle fuer den naechsten GET).
      expect(stored.settings.steuer.kleinunternehmer).toBe(true);
      expect(stored.settings.steuer.standardMwstSatz).toBe(0);
    });

    it('leerer Hinweistext faellt auf den §19-Default-Text zurueck', async () => {
      const result = await svc.updateOwnProfile(user, {
        steuer: { kleinunternehmer: true, kleinunternehmerHinweis: '' },
      } as any);
      expect(result.steuer.kleinunternehmerHinweis).toBe(
        'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG.',
      );
    });

    it('Rechtsform + Registerangaben werden gespeichert und wieder ausgelesen', async () => {
      await svc.updateOwnProfile(user, {
        steuer: {
          rechtsform: 'gmbh',
          registergericht: 'Amtsgericht Charlottenburg',
          registernummer: 'HRB 123456',
          vertretungsberechtigte: 'Max Mustermann',
        },
      } as any);
      const profile = await svc.getOwnProfile('t1');
      expect(profile.steuer.rechtsform).toBe('gmbh');
      expect(profile.steuer.registergericht).toBe('Amtsgericht Charlottenburg');
      expect(profile.steuer.registernummer).toBe('HRB 123456');
      expect(profile.steuer.vertretungsberechtigte).toBe('Max Mustermann');
    });
  });
});
