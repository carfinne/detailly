import { PublicMembersService } from './public-members.service';
import { Betriebstyp, TenantStatus } from '../tenants/entities/tenant.entity';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';

/**
 * Sicherheitskritische Logik des OEFFENTLICHEN Mitglieder-Verzeichnisses:
 *  - Opt-in-Filter: NUR Betriebe mit settings.mitgliedProfil.zeigen === true.
 *  - PII-Whitelist: KEINE E-Mail/Adresse/Telefon/interne ID nach aussen.
 *  - Tenant-Neutralitaet: plattformweit ueber mehrere Tenants, ohne dass sensible
 *    Daten irgendeines Tenants durchsickern (kein Cross-Tenant-Leak).
 *  - Inaktive Betriebe werden bereits per Query ausgeschlossen.
 *  - Datensparsame Leitregion (plzRegion): NUR 2-stellig UND nur fuer aktiv
 *    ZAHLENDE Betriebe (Subscription ACTIVE) – sonst null.
 * Reine Unit-Tests mit gemockten Repositories (keine DB).
 */
function makeService() {
  const tenantRepo = { find: jest.fn() };
  // Standard: kein aktives Abo -> plzRegion bleibt null (bewusst konservativ).
  const subscriptionRepo = { find: jest.fn().mockResolvedValue([]) };
  const svc = new PublicMembersService(tenantRepo as any, subscriptionRepo as any);
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

// Ein voll ausgestatteter Tenant inkl. sensibler Felder – die Whitelist muss sie
// alle unterdruecken. `settings` traegt Bank-/Steuerdaten (im echten Betrieb
// verschluesselt) NEBEN dem freigegebenen mitgliedProfil.
const betriebA = {
  id: 'TENANT-A',
  name: 'Glanzwerk Aufbereitung',
  email: 'chef@glanzwerk.de',
  phone: '030-111',
  street: 'Poliergasse 3',
  city: 'Berlin',
  postalCode: '10115',
  betriebstyp: Betriebstyp.AUFBEREITUNG,
  logoUrl: null,
  status: TenantStatus.ACTIVE,
  settings: {
    iban: 'DE00 1234 5678 9012 3456 78',
    steuernummer: '12/345/67890',
    mitgliedProfil: {
      zeigen: true,
      stadt: 'Berlin',
      kurzbeschreibung: 'Premium-Aufbereitung seit 2012.',
      webseite: 'https://glanzwerk.de',
    },
  },
};

const betriebB = {
  id: 'TENANT-B',
  name: 'FolienMeister',
  email: 'info@folienmeister.de',
  phone: '089-222',
  street: 'Wrapstr. 9',
  city: 'München',
  postalCode: '80331',
  betriebstyp: Betriebstyp.FOLIERUNG,
  logoUrl: null,
  status: TenantStatus.ACTIVE,
  settings: {
    ustId: 'DE999999999',
    mitgliedProfil: { zeigen: true, stadt: 'München', kurzbeschreibung: '', webseite: '' },
  },
};

// Kein Opt-in (zeigen=false) -> darf NIE erscheinen.
const betriebOhneOptin = {
  id: 'TENANT-C',
  name: 'Stiller Betrieb',
  email: 'still@example.de',
  betriebstyp: Betriebstyp.PPF,
  logoUrl: null,
  status: TenantStatus.ACTIVE,
  settings: { mitgliedProfil: { zeigen: false, stadt: 'Köln' } },
};

// Gar kein Profil-Block (Altbestand) -> darf NIE erscheinen.
const betriebOhneProfil = {
  id: 'TENANT-D',
  name: 'Alt Betrieb',
  email: 'alt@example.de',
  betriebstyp: Betriebstyp.KOMPLETT,
  logoUrl: null,
  status: TenantStatus.ACTIVE,
  settings: {},
};

describe('PublicMembersService · Opt-in-Filter', () => {
  it('liefert NUR Betriebe mit zeigen === true', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebOhneOptin, betriebB, betriebOhneProfil]);
    const res = await svc.listMitglieder();
    expect(res.map((m) => m.firmenname).sort()).toEqual(['FolienMeister', 'Glanzwerk Aufbereitung']);
  });

  it('schliesst inaktive Betriebe bereits per Query aus (status != inactive)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.find.mockResolvedValue([]);
    await svc.listMitglieder();
    const arg = tenantRepo.find.mock.calls[0][0];
    // Der WHERE muss inaktive Betriebe ausschliessen (Not(INACTIVE)).
    expect(JSON.stringify(arg.where)).toContain('inactive');
    // settings wird zwar geladen (Entschluesselung/Filter), aber nie als Ganzes projiziert.
    expect(arg.select).toContain('settings');
  });
});

describe('PublicMembersService · PII-Whitelist (kein Leak)', () => {
  it('gibt KEINE E-Mail/Adresse/Telefon/interne ID/Bankdaten nach aussen', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA]);
    const res = await svc.listMitglieder();
    const json = JSON.stringify(res);
    // Sensible Werte tauchen NIRGENDS in der Antwort auf.
    expect(json).not.toContain('chef@glanzwerk.de');
    expect(json).not.toContain('030-111');
    expect(json).not.toContain('Poliergasse');
    expect(json).not.toContain('10115');
    expect(json).not.toContain('TENANT-A');
    expect(json).not.toContain('DE00 1234');
    expect(json).not.toContain('12/345/67890');
    // Nur die freigegebenen Felder sind gesetzt (strikte Objekt-Form).
    expect(Object.keys(res[0]).sort()).toEqual(
      ['betriebstyp', 'firmenname', 'initiale', 'kurzbeschreibung', 'logoUrl', 'plzRegion', 'stadt', 'webseite'].sort(),
    );
    expect(res[0]).toMatchObject({
      firmenname: 'Glanzwerk Aufbereitung',
      betriebstyp: Betriebstyp.AUFBEREITUNG,
      stadt: 'Berlin',
      kurzbeschreibung: 'Premium-Aufbereitung seit 2012.',
      webseite: 'https://glanzwerk.de',
      logoUrl: null,
      initiale: 'GA',
    });
  });

  it('strippt eine unsichere Webseite (kein http/https-Schema) defensiv -> null', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.find.mockResolvedValue([
      {
        ...betriebA,
        settings: {
          mitgliedProfil: { zeigen: true, webseite: 'javascript:alert(1)', stadt: '', kurzbeschreibung: '' },
        },
      },
    ]);
    const res = await svc.listMitglieder();
    expect(res[0].webseite).toBeNull();
  });
});

describe('PublicMembersService · Tenant-Neutralitaet', () => {
  it('fuehrt mehrere zustimmende Tenants zusammen, ohne sensible Daten zu mischen/leaken', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    const res = await svc.listMitglieder();
    expect(res).toHaveLength(2);
    const json = JSON.stringify(res);
    // Keine sensiblen Felder IRGENDEINES Tenants sind enthalten.
    expect(json).not.toContain('info@folienmeister.de');
    expect(json).not.toContain('089-222');
    expect(json).not.toContain('DE999999999');
    expect(json).not.toContain('TENANT-B');
    // Beide freigegebenen Karten sind vorhanden, PII-arm.
    const namen = res.map((m) => m.firmenname);
    expect(namen).toContain('Glanzwerk Aufbereitung');
    expect(namen).toContain('FolienMeister');
    // Leere optionale Felder werden zu null normalisiert.
    const b = res.find((m) => m.firmenname === 'FolienMeister')!;
    expect(b.kurzbeschreibung).toBeNull();
    expect(b.webseite).toBeNull();
    expect(b.initiale).toBe('F');
  });
});

describe('PublicMembersService · Leitregion (plzRegion) – datensparsam + nur zahlend', () => {
  it('setzt plzRegion NUR fuer aktiv zahlende Betriebe (ACTIVE) auf die ersten 2 Ziffern', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA]); // PLZ "10115", Opt-in
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    const res = await svc.listMitglieder();
    expect(res[0].plzRegion).toBe('10'); // Berlin-Leitregion, NIE die volle "10115"
    // Datenschutz: die volle PLZ taucht NIRGENDS auf.
    expect(JSON.stringify(res)).not.toContain('10115');
  });

  it('liefert plzRegion=null fuer Betriebe in der Testphase (KEINE ACTIVE/PILOT-Subscription)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA]); // PLZ "10115", Opt-in
    // trial/kein sichtbares Abo -> die WHERE-Query (status In [active, pilot]) liefert nichts.
    subscriptionRepo.find.mockResolvedValue([]);
    const res = await svc.listMitglieder();
    expect(res[0].plzRegion).toBeNull();
  });

  it('setzt plzRegion auch fuer PILOT-Betriebe (Pilotprogramm), nicht nur ACTIVE', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA]); // PLZ "10115", Opt-in
    subscriptionRepo.find.mockResolvedValue(pilotFuer('TENANT-A'));
    const res = await svc.listMitglieder();
    expect(res[0].plzRegion).toBe('10');
  });

  it('liefert plzRegion=null bei kaputter/leerer PLZ, selbst wenn zahlend', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([
      { ...betriebA, id: 'TENANT-LEER', postalCode: '' },
      { ...betriebA, id: 'TENANT-KAPUTT', name: 'Kaputt PLZ', postalCode: 'AB-XY' },
      { ...betriebA, id: 'TENANT-KURZ', name: 'Kurz PLZ', postalCode: '1' },
    ]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-LEER', 'TENANT-KAPUTT', 'TENANT-KURZ'));
    const res = await svc.listMitglieder();
    expect(res.every((m) => m.plzRegion === null)).toBe(true);
  });

  it('filtert die Subscription-Query auf status=ACTIVE ODER PILOT (nicht trial) – sichtbar ist implizit', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    const res = await svc.listMitglieder();
    // Die Query holt NUR sichtbare Abos (active/pilot) der Opt-in-Tenants (ein Batch-find, kein N+1).
    expect(subscriptionRepo.find).toHaveBeenCalledTimes(1);
    const arg = subscriptionRepo.find.mock.calls[0][0];
    const where = JSON.stringify(arg.where);
    expect(where).toContain('active');
    expect(where).toContain('pilot');
    expect(where).not.toContain('trial');
    // Kein oeffentliches `zahlend`-Feld – der Status ist nur implizit ueber plzRegion sichtbar.
    const a = res.find((m) => m.firmenname === 'Glanzwerk Aufbereitung')!;
    const bMuenchen = res.find((m) => m.firmenname === 'FolienMeister')!;
    expect(a.plzRegion).toBe('10'); // zahlend -> Leitregion gesetzt
    expect(bMuenchen.plzRegion).toBeNull(); // nicht zahlend -> kein Punkt
    const json = JSON.stringify(res);
    expect(json).not.toContain('zahlend');
    expect(json).not.toContain('"status"');
  });

  it('stellt keine Subscription-Query, wenn es keine Opt-in-Betriebe gibt (spart die Query)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebOhneOptin, betriebOhneProfil]);
    const res = await svc.listMitglieder();
    expect(res).toHaveLength(0);
    expect(subscriptionRepo.find).not.toHaveBeenCalled();
  });
});

/**
 * Oeffentliche Betriebs-Suche (sucheMitglieder): wiederverwendet EXAKT dieselbe
 * Opt-in-/Whitelist-Logik wie die Liste. Sicherheitskritisch geprueft:
 *  - liefert NUR Opt-in-Betriebe (Widerruf entfernt sofort),
 *  - KEINE verbotenen Felder (PII-Ausschluss wie beim Karten-/Listen-Test),
 *  - Freitext (Name/Ort, case-/umlaut-tolerant), Leitregion- und Gewerk-Filter,
 *  - Pagination inkl. defensiver Seiten-Kappung.
 */
describe('PublicMembersService · Suche (Opt-in, PII-arm, paginiert)', () => {
  it('liefert ohne Filter alle Opt-in-Betriebe (paginiert) + korrekte Metadaten', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebOhneOptin, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A', 'TENANT-B'));
    const res = await svc.sucheMitglieder({});
    expect(res.total).toBe(2); // C (kein Opt-in) faellt raus
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(12);
    expect(res.items.map((m) => m.firmenname).sort()).toEqual(['FolienMeister', 'Glanzwerk Aufbereitung']);
  });

  it('sucht Freitext case-insensitiv im Firmennamen', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A', 'TENANT-B'));
    const res = await svc.sucheMitglieder({ q: 'FOLIEN' });
    expect(res.items.map((m) => m.firmenname)).toEqual(['FolienMeister']);
    expect(res.total).toBe(1);
  });

  it('sucht Freitext im Ort, umlaut-tolerant (muenchen ~ München)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A', 'TENANT-B'));
    const res = await svc.sucheMitglieder({ q: 'muenchen' });
    expect(res.items.map((m) => m.firmenname)).toEqual(['FolienMeister']);
  });

  it('filtert nach 2-stelliger Leitregion (nur sichtbare Betriebe haben eine)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A', 'TENANT-B'));
    const res = await svc.sucheMitglieder({ plzRegion: '10' });
    expect(res.items.map((m) => m.firmenname)).toEqual(['Glanzwerk Aufbereitung']);
  });

  it('filtert nach Gewerk/Betriebstyp', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A', 'TENANT-B'));
    const folierung = await svc.sucheMitglieder({ betriebstyp: Betriebstyp.FOLIERUNG });
    expect(folierung.items.map((m) => m.firmenname)).toEqual(['FolienMeister']);
    const ppf = await svc.sucheMitglieder({ betriebstyp: Betriebstyp.PPF });
    expect(ppf.items).toHaveLength(0);
    expect(ppf.total).toBe(0);
  });

  it('paginiert deterministisch (pageSize + Seiten-Kappung)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA, betriebB]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A', 'TENANT-B'));
    const s1 = await svc.sucheMitglieder({ pageSize: 1, page: 1 });
    expect(s1.total).toBe(2);
    expect(s1.items).toHaveLength(1);
    const s2 = await svc.sucheMitglieder({ pageSize: 1, page: 2 });
    expect(s2.items).toHaveLength(1);
    // Beide Seiten zusammen ergeben die volle, ueberschneidungsfreie Menge.
    expect([...s1.items, ...s2.items].map((m) => m.firmenname).sort()).toEqual([
      'FolienMeister',
      'Glanzwerk Aufbereitung',
    ]);
    // Zu hohe Seite -> defensiv auf die letzte Seite gekappt (leere Liste waere ein Bug).
    const s999 = await svc.sucheMitglieder({ pageSize: 1, page: 999 });
    expect(s999.page).toBe(2);
    expect(s999.items).toHaveLength(1);
  });

  it('gibt in der Suche KEINE PII nach aussen (gleiche strikte Whitelist)', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    tenantRepo.find.mockResolvedValue([betriebA]);
    subscriptionRepo.find.mockResolvedValue(aktivFuer('TENANT-A'));
    const res = await svc.sucheMitglieder({ q: 'glanz' });
    const json = JSON.stringify(res.items);
    expect(json).not.toContain('chef@glanzwerk.de');
    expect(json).not.toContain('030-111');
    expect(json).not.toContain('Poliergasse');
    expect(json).not.toContain('10115'); // volle PLZ NIE
    expect(json).not.toContain('TENANT-A'); // interne id NIE
    expect(json).not.toContain('DE00 1234'); // IBAN NIE
    expect(json).not.toContain('12/345/67890'); // Steuernummer NIE
    expect(Object.keys(res.items[0]).sort()).toEqual(
      ['betriebstyp', 'firmenname', 'initiale', 'kurzbeschreibung', 'logoUrl', 'plzRegion', 'stadt', 'webseite'].sort(),
    );
  });

  it('liefert NUR Opt-in-Betriebe – ein Widerruf (zeigen=false) entfernt sofort', async () => {
    const { svc, tenantRepo, subscriptionRepo } = makeService();
    // Erst zustimmend, dann widerrufen: dieselbe Firma, aber zeigen=false.
    const widerrufen = {
      ...betriebA,
      settings: { ...betriebA.settings, mitgliedProfil: { ...betriebA.settings.mitgliedProfil, zeigen: false } },
    };
    tenantRepo.find.mockResolvedValue([widerrufen]);
    const res = await svc.sucheMitglieder({ q: 'glanz' });
    expect(res.items).toHaveLength(0);
    expect(res.total).toBe(0);
    // Ohne Opt-in-Betrieb wird gar keine Subscription-Query gestellt.
    expect(subscriptionRepo.find).not.toHaveBeenCalled();
  });
});
