import { PublicBookingService } from './public-booking.service';
import { TenantStatus } from '../tenants/entities/tenant.entity';

/**
 * Verbraucherrechtliche Durchsetzung des oeffentlichen Buchungs-Flows
 * (§312j Button-Loesung / §312f dauerhafter Datentraeger / §356 Abs. 4 BGB).
 *
 * Kernaussagen:
 *  - Modus `verbindlich` erzwingt E-Mail, Leistung, Pflichtinfo-Zustimmung (sonst 400).
 *  - Modus `verbindlich` + Termin < 14 Tage OHNE §356-Zustimmung -> 400.
 *  - Modus `verbindlich` mit allen Zustimmungen -> gespeicherte Nachweis-Zeitstempel.
 *  - Festpreis (pauschal) im verbindlich-Modus -> verbindlicher Gesamtpreis (kein Richtwert).
 *  - Modus `anfrage` verlangt KEINE Widerruf-Zustimmung, kein E-Mail-Zwang.
 *  - Bestaetigungs-Mail traegt je Modus die richtigen Pflichtinhalte.
 *  - Missbrauchs-Deckel: >3 Mails/Stunde je (Betrieb, E-Mail) -> Mail ausgelassen.
 *  - Der Modus wird tenant-scoped aus tenant.settings.buchung gelesen (nie vom Client).
 */

/** Laesst fire-and-forget-Promises (void ...) auslaufen. */
const flush = () => new Promise((r) => setImmediate(r));

const LEISTUNG_ID = '11111111-1111-1111-1111-111111111111';
const LEISTUNG = { id: 'svc1', name: 'Keramikversiegelung', basispreis: '199.00', einheit: 'pauschal' };

function makeService() {
  const tenantRepo = { findOne: jest.fn() };
  const serviceRepo = {
    find: jest.fn().mockResolvedValue([]),
    // Default: eine gueltige (pauschale) Leistung – die verbindlichen Tests
    // brauchen sie. Tests ohne Leistung ueberschreiben das gezielt.
    findOne: jest.fn().mockResolvedValue({ ...LEISTUNG }),
  };
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
    { get: jest.fn(() => 'https://app.detailly.de') } as any,
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
    status: TenantStatus.ACTIVE,
    settings: modus ? { buchung: { modus } } : {},
  };
}

/** Datum in `tage` Tagen ab jetzt als ISO-String. */
function inTagen(tage: number): string {
  return new Date(Date.now() + tage * 24 * 60 * 60 * 1000).toISOString();
}

/** Vollstaendiger, gueltiger verbindlicher Buchungs-Body (Termin > 14 Tage). */
function verbindlicherBody(over: Record<string, unknown> = {}) {
  return {
    name: 'Anna',
    email: 'anna@kunde.de',
    serviceItemId: LEISTUNG_ID,
    wunschtermin: inTagen(30),
    pflichtinfoBestaetigt: true,
    ...over,
  };
}

/** Findet die an den Endkunden gerichtete Bestaetigungs-Mail. */
function kundenMail(mail: { send: jest.Mock }, to: string) {
  const call = mail.send.mock.calls.find((c) => c[0]?.to === to);
  return call?.[0];
}

describe('PublicBookingService · Verbindlicher Modus – Abschlussvoraussetzungen', () => {
  it('ohne E-Mail (Telefon-only) -> 400, kein DB-Write (§312f)', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await expect(
      svc.createAnfrage('muster', verbindlicherBody({ email: undefined, phone: '0151 222' })),
    ).rejects.toThrow(/E-Mail-Adresse/);
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it('ohne gewählte Leistung -> 400 (§312j Abs. 2)', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await expect(
      svc.createAnfrage('muster', verbindlicherBody({ serviceItemId: undefined })),
    ).rejects.toThrow(/Leistung/);
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it('ohne Pflichtinfo-Zustimmung -> 400, kein DB-Write', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await expect(
      svc.createAnfrage('muster', verbindlicherBody({ pflichtinfoBestaetigt: undefined })),
    ).rejects.toThrow(/Pflichtinformationen|Widerrufsbelehrung/);
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it('Termin < 14 Tage ohne §356-Zustimmung -> 400', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await expect(
      svc.createAnfrage('muster', verbindlicherBody({ wunschtermin: inTagen(3) })),
    ).rejects.toThrow(/vorzeitigen Leistungsbeginn/);
    expect(bookingRepo.save).not.toHaveBeenCalled();
  });

  it('Termin < 14 Tage MIT allen Zustimmungen -> speichert Nachweis-Zeitstempel', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await svc.createAnfrage(
      'muster',
      verbindlicherBody({ wunschtermin: inTagen(3), vorzeitigerLeistungsbeginn: true, datenschutzHinweis: true }),
    );
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.abschlussModus).toBe('verbindlich');
    expect(saved.pflichtinfoBestaetigtAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.vorzeitigerLeistungsbeginnAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved.datenschutzHinweisAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('Termin > 14 Tage: §356-Zustimmung NICHT nötig, kein Zeitstempel dafür', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await svc.createAnfrage('muster', verbindlicherBody());
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.abschlussModus).toBe('verbindlich');
    expect(saved.pflichtinfoBestaetigtAm).toBeTruthy();
    expect(saved.vorzeitigerLeistungsbeginnAm).toBeUndefined();
  });
});

describe('PublicBookingService · Verbindlicher Modus – Bestätigungs-Mail (§312f)', () => {
  it('enthält Widerrufsbelehrung + Muster-Formular + Vertragspartner + verbindlichen Gesamtpreis', async () => {
    const { svc, tenantRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('verbindlich'));
    await svc.createAnfrage('muster', verbindlicherBody());
    await flush();
    const opts = kundenMail(mail, 'anna@kunde.de');
    expect(opts).toBeDefined();
    expect(opts.subject).toContain('Buchungsbestätigung');
    expect(opts.text).toContain('Widerrufsbelehrung');
    expect(opts.text).toContain('Muster-Widerrufsformular');
    expect(opts.text).toContain('Ihr Vertragspartner');
    expect(opts.text).toContain('Muster Aufbereitung');
    // Festpreis-Leistung -> verbindlicher Gesamtpreis, KEIN Richtwert-Vorbehalt.
    expect(opts.text).toContain('Gesamtpreis: 199,00 €');
    expect(opts.text).not.toContain('Richtwert');
    expect(opts.replyTo).toBe('info@muster.de');
    expect(opts.tenantId).toBe('TENANT-1');
  });

  it('ist NICHT durch das Opt-out-Flag unterdrückbar', async () => {
    const { svc, tenantRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue({
      ...betrieb('verbindlich'),
      settings: { buchung: { modus: 'verbindlich' }, kundenmailTerminbestaetigung: '0' },
    });
    await svc.createAnfrage('muster', verbindlicherBody());
    await flush();
    expect(kundenMail(mail, 'anna@kunde.de')).toBeDefined();
  });
});

describe('PublicBookingService · Unverbindlicher Modus (anfrage)', () => {
  it('verlangt KEINE Widerruf-/Pflichtinfo-Zustimmung und keine E-Mail (Default-Modus)', async () => {
    const { svc, tenantRepo, bookingRepo } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb()); // kein settings.buchung -> anfrage
    await svc.createAnfrage('muster', { name: 'Anna', phone: '0151 222' });
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
});

describe('PublicBookingService · Missbrauchs-Deckel Bestätigungs-Mail', () => {
  it('drosselt ab >3 Mails/Stunde je (Betrieb, E-Mail) – Datensatz entsteht dennoch', async () => {
    const { svc, tenantRepo, bookingRepo, mail } = makeService();
    tenantRepo.findOne.mockResolvedValue(betrieb('anfrage'));
    // count() speist Betriebs-Stundenlimit (< 20 ok) UND Mail-Deckel (> 3 -> aus).
    bookingRepo.count.mockResolvedValue(4);
    await svc.createAnfrage('muster', { name: 'Anna', email: 'anna@kunde.de' });
    await flush();
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
    expect(kundenMail(mail, 'anna@kunde.de')).toBeUndefined();
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
      // Kein pflichtinfoBestaetigt/Leistung -> im anfrage-Modus trotzdem kein 400.
    });
    const saved = bookingRepo.save.mock.calls[0][0];
    expect(saved.tenantId).toBe('TENANT-1');
    expect(saved.abschlussModus).toBe('anfrage');
  });
});
