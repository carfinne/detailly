import 'reflect-metadata';
import { PublicBookingService } from './public-booking.service';
import { PublicBookingController } from './public-booking.controller';
import { TenantStatus } from '../tenants/entities/tenant.entity';

/**
 * Oeffentlicher Slots-Endpoint (Kalender 2.0 W2): striktes Datums-Parsing,
 * Tenant NUR aus dem Slug (404 statt Enumeration), betriebsweite + tenant-
 * gescopte Belegt-Abfrage, PII-freie Antwort (nur 'HH:MM'-Zeitfenster) und
 * Throttle-Metadaten am Controller. Reine Unit-Tests mit gemockten Repos.
 */
function makeService() {
  const tenantRepo = { findOne: jest.fn() };
  const serviceRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
  const bookingRepo = { count: jest.fn(), findOne: jest.fn() };
  const managerFind = jest.fn().mockResolvedValue([]);
  const appointmentRepo = { manager: { find: managerFind } };
  const svc = new PublicBookingService(
    tenantRepo as any,
    serviceRepo as any,
    bookingRepo as any,
    appointmentRepo as any,
    { send: jest.fn() } as any,
  );
  return { svc, tenantRepo, managerFind };
}

/** Betrieb mit gepflegten Arbeitszeiten (Mi aktiv 08-12, 60-min-Slots). */
const BETRIEB = {
  id: 'TENANT-1',
  name: 'Muster Aufbereitung',
  email: 'inhaber@muster.de',
  status: TenantStatus.ACTIVE,
  settings: {
    kalender: {
      arbeitszeiten: { mi: { von: '08:00', bis: '12:00', aktiv: true } },
      slotDauerMin: 60,
      pufferMin: 0,
    },
    buchung: { vorlaufMinStunden: 0, vorlaufMaxTage: 365 },
  },
};

/**
 * getSlots rechnet mit dem ECHTEN `new Date()` – die Testdaten muessen also
 * relativ zur Laufzeit liegen: nah genug fuer vorlaufMaxTage, weit genug fuer
 * vorlaufMinStunden. Naechster Wochentag (getDay-Wert) mind. `abTagen` voraus.
 */
function naechster(getDayZiel: number, abTagen: number) {
  const d = new Date();
  d.setDate(d.getDate() + abTagen);
  while (d.getDay() !== getDayZiel) d.setDate(d.getDate() + 1);
  const jahr = d.getFullYear();
  const monat = d.getMonth() + 1;
  const tag = d.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { datum: `${jahr}-${pad(monat)}-${pad(tag)}`, jahr, monat, tag };
}

const MI = naechster(3, 8); // ein Mittwoch, mind. 8 Tage voraus
const DO = naechster(4, 8); // ein Donnerstag, mind. 8 Tage voraus
const MITTWOCH = MI.datum;

describe('PublicBookingService.getSlots · Datums-Parsing', () => {
  it.each(['', 'muell', '14.07.2027', '2027-07-14T09:00', '2027-02-31', "x' OR 1=1"])(
    'Format-Muell "%s" -> 400 OHNE Tenant-Lookup',
    async (bad) => {
      const { svc, tenantRepo } = makeService();
      await expect(svc.getSlots('muster', bad)).rejects.toMatchObject({ status: 400 });
      expect(tenantRepo.findOne).not.toHaveBeenCalled();
    },
  );

  it('unbekannter/inaktiver Betrieb -> 404 (keine Enumeration)', async () => {
    const { svc, tenantRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(null);
    await expect(svc.getSlots('gibtsnicht', MITTWOCH)).rejects.toMatchObject({ status: 404 });
  });
});

describe('PublicBookingService.getSlots · Berechnung + Isolation', () => {
  it('liefert freie Slots des Tages, Belegt-Abfrage ist tenant-scoped', async () => {
    const { svc, tenantRepo, managerFind } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...BETRIEB });
    // Belegter Termin 09:00-10:00 (lokal) -> 09:00 faellt weg.
    managerFind.mockResolvedValue([
      {
        id: 'a1',
        titel: 'Kunde Anna Beispiel',
        start: new Date(MI.jahr, MI.monat - 1, MI.tag, 9, 0, 0),
        ende: new Date(MI.jahr, MI.monat - 1, MI.tag, 10, 0, 0),
      },
    ]);

    const res = await svc.getSlots('muster', MITTWOCH);
    expect(res).toEqual({ datum: MITTWOCH, slotDauerMin: 60, slots: ['08:00', '10:00', '11:00'] });

    // Tenant-Isolation: die Termin-Abfrage filtert auf den Slug-Betrieb.
    const where = managerFind.mock.calls[0][1].where;
    expect(where.tenantId).toBe('TENANT-1');
    // Nur blockende Status (geplant/bestaetigt/laeuft) zaehlen.
    const statusJson = JSON.stringify(where.status);
    for (const s of ['geplant', 'bestaetigt', 'laeuft']) expect(statusJson).toContain(s);
    expect(statusJson).not.toContain('abgesagt');
    expect(statusJson).not.toContain('abgeschlossen');
  });

  it('Antwort ist STRIKT PII-frei (keine IDs, Titel, Namen des belegenden Termins)', async () => {
    const { svc, tenantRepo, managerFind } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...BETRIEB });
    managerFind.mockResolvedValue([
      {
        id: 'appt-geheim',
        titel: 'Online-Anfrage: Anna Beispiel',
        customerId: 'kunde-geheim',
        start: new Date(MI.jahr, MI.monat - 1, MI.tag, 8, 0, 0),
        ende: new Date(MI.jahr, MI.monat - 1, MI.tag, 9, 0, 0),
      },
    ]);
    const res = await svc.getSlots('muster', MITTWOCH);
    const json = JSON.stringify(res);
    for (const verboten of ['appt-geheim', 'Anna', 'kunde-geheim', 'TENANT-1', 'titel']) {
      expect(json).not.toContain(verboten);
    }
    expect(Object.keys(res).sort()).toEqual(['datum', 'slotDauerMin', 'slots']);
  });

  it('Slot-Modus AUS (Arbeitszeiten nicht gepflegt) -> leere Liste, KEIN Termin-Lookup', async () => {
    const { svc, tenantRepo, managerFind } = makeService();
    tenantRepo.findOne.mockResolvedValue({ ...BETRIEB, settings: {} });
    const res = await svc.getSlots('muster', MITTWOCH);
    expect(res.slots).toEqual([]);
    expect(managerFind).not.toHaveBeenCalled();
  });

  it('inaktiver Wochentag -> leere Liste', async () => {
    const { svc, tenantRepo } = makeService();
    // Der Donnerstag ist im Fixture nicht gepflegt -> resolveKalender ergaenzt
    // ihn als Default (aktiv), daher hier explizit deaktivieren:
    const settings = {
      ...BETRIEB.settings,
      kalender: {
        ...BETRIEB.settings.kalender,
        arbeitszeiten: {
          mi: { von: '08:00', bis: '12:00', aktiv: true },
          do: { von: '08:00', bis: '12:00', aktiv: false },
        },
      },
    };
    tenantRepo.findOne.mockResolvedValue({ ...BETRIEB, settings });
    const res = await svc.getSlots('muster', DO.datum);
    expect(res.slots).toEqual([]);
  });
});

describe('PublicBookingController · Throttle am Slots-Endpoint', () => {
  it('getSlots traegt Throttler-Metadaten (unauthentifiziertes Surface)', () => {
    const keys = Reflect.getMetadataKeys(PublicBookingController.prototype.getSlots);
    expect(keys.some((k) => String(k).toUpperCase().includes('THROTTLER'))).toBe(true);
  });
});
