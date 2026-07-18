import { PublicBookingService } from './public-booking.service';
import { TenantStatus } from '../tenants/entities/tenant.entity';

/**
 * Verbraucherrechtliche Durchsetzung des oeffentlichen Buchungs-Flows
 * (§312j Button-Loesung / §312f dauerhafter Datentraeger / §356 Abs. 4 BGB).
 *
 * Kernaussagen:
 *  - Modus `verbindlich` OHNE Pflichtinfo-Zustimmung -> 400, kein DB-Write.
 *  - Modus `verbindlich` + Termin < 14 Tage OHNE §356-Zustimmung -> 400.
 *  - Modus `verbindlich` mit allen Zustimmungen -> gespeicherte Nachweis-Zeitstempel.
 *  - Modus `anfrage` verlangt KEINE Widerruf-Zustimmung.
 *  - Bestaetigungs-Mail traegt je Modus die richtigen Pflichtinhalte.
 *  - Der Modus wird tenant-scoped aus tenant.settings.buchung gelesen (nie vom Client).
 */

/** Laesst fire-and-forget-Promises (void ...) auslaufen. */
const flush = () => new Promise((r) => setImmediate(r));

function makeService() {
  const tenantRepo = { findOne: jest.fn() };
  const serviceRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
  const bookingRepo = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'b1', ...x })),
    delete: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const appointmentRepo = { manager: { find: jest.fn().mockResolvedValue([]) } };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const svc = new PublicBookingService(
    tenantRepo as any,
    serviceRepo as any,
    bookingRepo as any,
    appointmentRepo as any,
    mail as any,
  );
  return { svc, tenantRepo, serviceRepo, bookingRepo, mail };
}

function betrieb(modus?: 'anfrage' | 'verbindlich') {
  return {
    id: 'TENANT-1',
    name: 'Muster Aufbereitung',
    email: 'info@muster.de',
    phone: '030 12345',
    street: 'Werkstraße 1',
    city: 'Berlin',
    postalCode: '10115',
    country: 'DE',
    logoUrl: null,
    businessHours: null,
    status: TenantStatus.ACTIVE,
    settings: modus ? { buchung: { modus } } : {},
  };
}

/** Datum in `tage` Tagen ab jetzt als ISO-String. */
function inTagen(tage: number): string {
  return new Date(Date.now() + tage * 24 * 60 * 60 * 1000).toISOString();
}

/** Findet die an den Endkunden gerichtete Bestaetigungs-Mail. */
function kundenMail(mail: { send: jest.Mock }, to: string) {
  const call = mail.send.mock.calls.find((c) => c[0]?.to === to);
  return call?.[0];
}

describe('PublicBookingService · Verbindlicher Modus (§312j)', () => {
  it('lehnt ohne Pflichtinfo-Zustimmung ab (400) und schreibt NICHTS', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await expect(
      svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' }),
    ).rejects.toThrow(/Pflichtinformationen|Widerrufsbelehrung/);
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it('Termin < 14 Tage ohne §356-Zustimmung -> 400', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await expect(
      svc.createAnfrage('muster', {
        name: 'Anna',
        email: 'anna@kunde.de',
        wunschtermin: inTagen(3),
        pflichtinfoBestaetigt: true,
      }),
    ).rejects.toThrow(/vorzeitigen Leistungsbeginn/);
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it('Termin < 14 Tage MIT allen Zustimmungen -> speichert Nachweis-Zeitstempel', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await svc.createAnfrage('muster', {
      name: 'Anna',
      email: 'anna@kunde.de',
      wunschtermin: inTagen(3),
      pflichtinfoBestaetigt: true,
      vorzeitigerLeistungsbeginn: true,
      datenschutzHinweis: true,
    });
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.abschlussModus).toBe('verbindlich');
    expect(saved.pflichtinfoBestaetigtAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.vorzeitigerLeistungsbeginnAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.datenschutzHinweisAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('Termin > 14 Tage: §356-Zustimmung NICHT nötig, kein Zeitstempel dafür', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await svc.createAnfrage('muster', {
      name: 'Anna',
      email: 'anna@kunde.de',
      wunschtermin: inTagen(30),
      pflichtinfoBestaetigt: true,
    });
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.abschlussModus).toBe('verbindlich');
    expect(saved.pflichtinfoBestaetigtAm).toBeTruthy();
    expect(saved.vorzeitigerLeistungsbeginnAm).toBeUndefined();
  });

  it('Bestätigungs-Mail (verbindlich) enthält Widerrufsbelehrung + Muster-Formular + Vertragspartner', async () => {
    const { svc, tenantRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await svc.createAnfrage('muster', {
      name: 'Anna',
      email: 'anna@kunde.de',
      wunschtermin: inTagen(30),
      pflichtinfoBestaetigt: true,
    });
    await flush();
    const opts = kundenMail(mail, 'anna@kunde.de');
    expect(opts).toBeDefined();
    expect(opts.subject).toContain('Buchungsbestätigung');
    expect(opts.text).toContain('Widerrufsbelehrung');
    expect(opts.text).toContain('Muster-Widerrufsformular');
    expect(opts.text).toContain('Ihr Vertragspartner');
    expect(opts.text).toContain('Muster Aufbereitung');
    // Reply-To beim Betrieb, tenant-SMTP-Kontext gesetzt.
    expect(opts.replyTo).toBe('info@muster.de');
    expect(opts.tenantId).toBe('TENANT-1');
  });
});

describe('PublicBookingService · Unverbindlicher Modus (anfrage)', () => {
  it('verlangt KEINE Widerruf-/Pflichtinfo-Zustimmung (Default-Modus)', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb()); // kein settings.buchung -> anfrage
    await svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' });
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.abschlussModus).toBe('anfrage');
    expect(saved.pflichtinfoBestaetigtAm).toBeUndefined();
    expect(saved.vorzeitigerLeistungsbeginnAm).toBeUndefined();
  });

  it('Eingangsbestätigung ist unverbindlich und OHNE Widerrufsbelehrung', async () => {
    const { svc, tenantRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('anfrage'));
    await svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' });
    await flush();
    const opts = kundenMail(mail, 'anna@kunde.de');
    expect(opts).toBeDefined();
    expect(opts.subject).toContain('Terminanfrage');
    expect(opts.text).toContain('unverbindliche Terminanfrage');
    expect(opts.text).toContain('kein Vertrag');
    expect(opts.text).not.toContain('Widerrufsbelehrung');
  });

  it('respektiert das Opt-out-Flag nur im unverbindlichen Modus', async () => {
    const { svc, tenantRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue({
      ...betrieb('anfrage'),
      settings: { buchung: { modus: 'anfrage' }, kundenmailTerminbestaetigung: '0' },
    });
    await svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' });
    await flush();
    expect(kundenMail(mail, 'anna@kunde.de')).toBeUndefined();
  });

  it('verbindliche §312f-Bestätigung ist NICHT durch das Opt-out-Flag unterdrückbar', async () => {
    const { svc, tenantRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue({
      ...betrieb('verbindlich'),
      settings: { buchung: { modus: 'verbindlich' }, kundenmailTerminbestaetigung: '0' },
    });
    await svc.createAnfrage('muster', {
      name: 'Anna',
      email: 'anna@kunde.de',
      wunschtermin: inTagen(30),
      pflichtinfoBestaetigt: true,
    });
    await flush();
    expect(kundenMail(mail, 'anna@kunde.de')).toBeDefined();
  });
});

describe('PublicBookingService · Tenant-Isolation des Modus', () => {
  it('liest den Modus aus tenant.settings, nicht aus dem Client-Body', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    // Betrieb ist `anfrage`; ein „geschummeltes" Client-Feld darf keinen
    // verbindlichen Abschluss erzwingen (und umgekehrt keinen 400 auslösen).
    tenantRepo.findOne.mockResolvedValue(betrieb('anfrage'));
    await svc.createAnfrage('muster', {
      name: 'Anna',
      email: 'anna@kunde.de',
      // Kein pflichtinfoBestaetigt -> im anfrage-Modus trotzdem kein 400.
    });
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.tenantId).toBe('TENANT-1');
    expect(saved.abschlussModus).toBe('anfrage');
  });
});
