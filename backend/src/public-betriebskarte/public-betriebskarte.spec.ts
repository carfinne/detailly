import { PublicBetriebskarteService } from './public-betriebskarte.service';
import { Betriebstyp, TenantStatus } from '../tenants/entities/tenant.entity';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';

/**
 * Sicherheitskritische Logik der OEFFENTLICHEN Betriebskarte:
 *  - Nur zwei Bedingungen lassen einen Betrieb als Punkt erscheinen: aktiv ZAHLEND
 *    (Subscription ACTIVE) UND Opt-in (settings.mitgliedProfil.zeigen === true).
 *  - PII-Whitelist: KEINE E-Mail/Adresse/Telefon/volle PLZ/interne ID/Bankdaten.
 *  - `gesamtZahlend`: anonyme Gesamtzahl aller aktiv zahlenden Abos (nur eine Zahl).
 *  - Datensparsame Leitregion + grobe Zentroid-Koordinate; unbekannte/leere PLZ ->
 *    kein Punkt.
 * Reine Unit-Tests mit gemockten Repositories (keine DB).
 */
function makeService(gesamtZahlend = 0) {
  const tenantRepo = { find: jest.fn() };
  const subscriptionRepo = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(gesamtZahlend),
  };
  const svc = new PublicBetriebskarteService(tenantRepo as any, subscriptionRepo as any);
  return { svc, tenantRepo, subscriptionRepo };
}

/** Hilfe: gibt fuer die uebergebenen Tenant-IDs je eine ACTIVE-Subscription zurueck. */
function aktivFuer(...tenantIds: string[]) {
  return tenantIds.map((tenantId) => ({ tenantId, status: SubscriptionStatus.ACTIVE }));
}

/** Hilfe: gibt fuer die uebergebenen Tenant-IDs je eine PILOT-Subscription zurueck. */
function pilotFuer(...tenantIds: string[]) {
  return tenantIds.map((tenantId) => ({ tenantId, status: SubscriptionStatus.PILOT }));
}

// Voll ausgestatteter Tenant inkl. sensibler Felder – die Whitelist muss sie ALLE
// unterdruecken. `settings` traegt Bank-/Steuerdaten NEBEN dem freigegebenen Profil.
const betriebA = {
  id: 'TENANT-A',
  name: 'Glanzwerk Aufbereitung',
  email: 'chef@glanzwerk.de',
  phone: '030-111',
  street: 'Poliergasse 3',
  city: 'Berlin',
  postalCode: '10115',
  betriebstyp: Betriebstyp.AUFBEREITUNG,
  status: TenantStatus.ACTIVE,
  settings: {
    iban: 'DE00 1234 5678 9012 3456 78',
    steuernummer: '12/345/67890',
    mitgliedProfil: { zeigen: true, stadt: 'Berlin', kurzbeschreibung: 'Premium', webseite: 'https://glanzwerk.de' },
  },
};

const betriebB = {
  id: 'TENANT-B',
  name: 'FolienMeister',
  email: 'info@folienmeister.de',
  phone: '089-222',
  postalCode: '80331',
  betriebstyp: Betriebstyp.FOLIERUNG,
  status: TenantStatus.ACTIVE,
  settings: { ustId: 'DE999999999', mitgliedProfil: { zeigen: true, stadt: 'München' } },
};

const betriebOhneOptin = {
  id: 'TENANT-C',
  name: 'Stiller Betrieb',
  email: 'still@example.de',
  postalCode: '50667',
  status: TenantStatus.ACTIVE,
  settings: { mitgliedProfil: { zeigen: false, stadt: 'Köln' } },
};

describe('PublicBetriebskarteService · Opt-in + zahlend (nur beide zusammen)', () => {
  it('zeigt NUR Betriebe mit Opt-in UND aktivem (ACTIVE) Abo als Punkt', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(2);
    tenantRepo.find.mockResolvedValue([betriebA, betriebB, betriebOhneOptin]);
    // Nur A ist zahlend; B ist Opt-in aber NICHT zahlend; C zahlt zwar, aber kein Opt-in.
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    const res = await svc.getBetriebskarte();
    expect(res.betriebe.map((b) => b.firmenname)).toEqual(['Glanzwerk Aufbereitung']);
  });

  it('laesst einen Opt-in-Betrieb OHNE aktives Abo NICHT erscheinen (nicht zahlend)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(0);
    tenantRepo.find.mockResolvedValue([betriebB]); // Opt-in, aber kein ACTIVE-Sub
    subscriptionRepo.find.mockResolvedValue([]);
    const res = await svc.getBetriebskarte();
    expect(res.betriebe).toHaveLength(0);
  });

  it('laesst einen zahlenden Betrieb OHNE Opt-in NICHT erscheinen', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(1);
    tenantRepo.find.mockResolvedValue([betriebOhneOptin]);
    // Query wird gar nicht gestellt, da es keine Opt-in-Betriebe gibt.
    const res = await svc.getBetriebskarte();
    expect(res.betriebe).toHaveLength(0);
    expect(subscriptionRepo.find).not.toHaveBeenCalled();
  });

  it('schliesst inaktive Betriebe bereits per Query aus (status != inactive)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.find.mockResolvedValue([]);
    await svc.getBetriebskarte();
    const arg = tenantRepo.find.mock.calls[0][0];
    expect(JSON.stringify(arg.where)).toContain('inactive');
    expect(arg.select).toContain('settings');
    expect(arg.select).not.toContain('email');
    expect(arg.select).not.toContain('street');
  });

  it('filtert die Subscription-Query auf status=ACTIVE ODER PILOT (nicht trial)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(1);
    tenantRepo.find.mockResolvedValue([betriebA]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    await svc.getBetriebskarte();
    const arg = subscriptionRepo.find.mock.calls[0][0];
    const where = JSON.stringify(arg.where);
    // Pilotbetriebe erscheinen (echte, freigeschaltete Betriebe) – trial bewusst nicht.
    expect(where).toContain('active');
    expect(where).toContain('pilot');
    expect(where).not.toContain('trial');
  });

  it('zeigt einen PILOT-Betrieb mit Opt-in als Punkt (Pilotprogramm)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(1);
    tenantRepo.find.mockResolvedValue([betriebA]); // Opt-in, PLZ 10115
    // Pilotbetrieb: kein bezahltes Abo, aber vom Betreiber freigeschaltet.
    subscriptionRepo.find.mockResolvedValue(pilotFuer('TENANT-A'));
    const res = await svc.getBetriebskarte();
    expect(res.betriebe.map((b) => b.firmenname)).toEqual(['Glanzwerk Aufbereitung']);
  });
});

describe('PublicBetriebskarteService · gesamtZahlend (anonym)', () => {
  it('liefert die Gesamtzahl aktiv zahlender Abos, unabhaengig vom Opt-in', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(42);
    tenantRepo.find.mockResolvedValue([betriebOhneOptin]); // kein Opt-in -> kein Punkt
    const res = await svc.getBetriebskarte();
    expect(res.gesamtZahlend).toBe(42);
    expect(res.betriebe).toHaveLength(0);
    // Der Zaehler kommt aus count({ status: In([active, pilot]) }) – deckungsgleich
    // mit dem Punkt-Kriterium, damit Zaehler und Karte konsistent bleiben.
    const countArg = subscriptionRepo.count.mock.calls[0][0];
    const where = JSON.stringify(countArg.where);
    expect(where).toContain('active');
    expect(where).toContain('pilot');
    expect(where).not.toContain('trial');
  });
});

describe('PublicBetriebskarteService · PII-Whitelist (kein Leak)', () => {
  it('gibt KEINE E-Mail/Adresse/Telefon/volle PLZ/interne ID/Bankdaten nach aussen', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(1);
    tenantRepo.find.mockResolvedValue([betriebA]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    const res = await svc.getBetriebskarte();
    const json = JSON.stringify(res);
    expect(json).not.toContain('chef@glanzwerk.de');
    expect(json).not.toContain('030-111');
    expect(json).not.toContain('Poliergasse');
    expect(json).not.toContain('10115'); // volle PLZ NIE
    expect(json).not.toContain('TENANT-A'); // interne id NIE
    expect(json).not.toContain('DE00 1234'); // IBAN NIE
    expect(json).not.toContain('12/345/67890'); // Steuernummer NIE
    // Nur die freigegebenen Felder sind gesetzt (strikte Objekt-Form).
    expect(Object.keys(res.betriebe[0]).sort()).toEqual(
      ['firmenname', 'plzRegion', 'stadt', 'x', 'y'].sort(),
    );
    expect(res.betriebe[0]).toMatchObject({
      firmenname: 'Glanzwerk Aufbereitung',
      stadt: 'Berlin',
      plzRegion: '10', // NUR die 2-stellige Leitregion, NIE die volle "10115"
    });
    expect(typeof res.betriebe[0].x).toBe('number');
    expect(typeof res.betriebe[0].y).toBe('number');
  });
});

describe('PublicBetriebskarteService · Leitregion-Koordinate', () => {
  it('leitet die Koordinate aus dem Regions-Zentroid ab (Berlin ~ 10)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(1);
    tenantRepo.find.mockResolvedValue([betriebA]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    const res = await svc.getBetriebskarte();
    // Zentroid der Leitregion 10 (Berlin) im viewBox 600x800.
    expect(res.betriebe[0]).toMatchObject({ x: 449, y: 279 });
  });

  it('laesst Betriebe mit leerer/kaputter/unbekannter PLZ weg (kein Punkt)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService(3);
    tenantRepo.find.mockResolvedValue([
      { ...betriebA, id: 'T-LEER', name: 'Leer', postalCode: '' },
      { ...betriebA, id: 'T-KAPUTT', name: 'Kaputt', postalCode: 'AB-XY' },
      { ...betriebA, id: 'T-UNBEKANNT', name: 'Unbekannt', postalCode: '05999' }, // Region '05' hat keinen Zentroid
    ]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('T-LEER', 'T-KAPUTT', 'T-UNBEKANNT'));
    const res = await svc.getBetriebskarte();
    expect(res.betriebe).toHaveLength(0);
  });
});
