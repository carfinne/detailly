import { istHoneypotGefuellt } from '../common/security/honeypot';
import { PublicNewsletterController } from '../newsletter/public-newsletter.controller';
import { PublicBookingService } from '../public-booking/public-booking.service';
import { PublicHaendlerBewerbungController } from '../marketplace/public-haendler-bewerbung.controller';
import { TenantsController } from '../tenants/tenants.controller';

/**
 * Honeypot-Abwehr auf den OEFFENTLICHEN Schreib-Formularen, jetzt ueber den
 * gemeinsamen Baustein `common/security/honeypot` (vormals vierfach dupliziert).
 *
 * Simuliert den Bot-Angriff je Formular: das versteckte `website`-Feld ist
 * gefuellt -> der Server taeuscht Erfolg vor (kein Fehler, keine abweichende
 * Antwort-Form), legt NICHTS an / versendet NICHTS UND protokolliert den Treffer
 * als Sicherheits-Ereignis (`honeypot`, mit Quelle + IP, ohne Body-Daten).
 * Menschen lassen das Feld leer -> normaler Ablauf, KEIN Sicherheits-Ereignis.
 */

/** Frischer Mock des SecurityEventService (nur `record`, fire-and-forget). */
function makeEvents() {
  return { record: jest.fn() };
}

const IP = '203.0.113.7';

describe('istHoneypotGefuellt (reiner Baustein)', () => {
  it('leerer/whitespace/nicht-String-Wert -> false (Mensch)', () => {
    expect(istHoneypotGefuellt(undefined)).toBe(false);
    expect(istHoneypotGefuellt(null)).toBe(false);
    expect(istHoneypotGefuellt('')).toBe(false);
    expect(istHoneypotGefuellt('   ')).toBe(false);
    expect(istHoneypotGefuellt(123 as unknown)).toBe(false);
    expect(istHoneypotGefuellt({} as unknown)).toBe(false);
  });

  it('gefuellter String -> true (Bot)', () => {
    expect(istHoneypotGefuellt('http://spam')).toBe(true);
    expect(istHoneypotGefuellt('  x  ')).toBe(true);
  });
});

describe('Honeypot – Newsletter-Anmeldung', () => {
  function makeSut() {
    const service = { anmelden: jest.fn(async () => undefined) };
    const events = makeEvents();
    const controller = new PublicNewsletterController(service as any, events as any);
    return { controller, service, events };
  }

  it('gefuellt -> Erfolg vorgetaeuscht, anmelden NICHT aufgerufen, Sicherheits-Ereignis', async () => {
    const { controller, service, events } = makeSut();
    const res = await controller.anmelden(
      { email: 'bot@spam.example', website: 'http://spam' } as any,
      { ip: IP } as any,
    );
    expect(res).toEqual({ ok: true });
    expect(service.anmelden).not.toHaveBeenCalled();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'honeypot', severity: 'warn', ip: IP, details: { quelle: 'public_newsletter' } }),
    );
  });

  it('leer -> normaler Ablauf (anmelden aufgerufen), KEIN Sicherheits-Ereignis', async () => {
    const { controller, service, events } = makeSut();
    const res = await controller.anmelden({ email: 'mensch@example.de' } as any, { ip: IP } as any);
    expect(res).toEqual({ ok: true });
    expect(service.anmelden).toHaveBeenCalledWith('mensch@example.de');
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('Honeypot – Oeffentliche Terminanfrage (public-booking)', () => {
  function makeSut() {
    const tenantRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const serviceRepo = { find: jest.fn(), findOne: jest.fn() };
    const bookingRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((x: unknown) => x),
      save: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
    };
    const appointmentRepo = { manager: {} };
    const mail = { send: jest.fn() };
    const config = { get: jest.fn() };
    const events = makeEvents();
    const svc = new PublicBookingService(
      tenantRepo as any,
      serviceRepo as any,
      bookingRepo as any,
      appointmentRepo as any,
      mail as any,
      config as any,
      events as any,
    );
    return { svc, tenantRepo, bookingRepo, events };
  }

  it('gefuellt -> nackte Referenz vorgetaeuscht, KEIN Tenant-Lookup/DB-Write, Sicherheits-Ereignis', async () => {
    const { svc, tenantRepo, bookingRepo, events } = makeSut();
    const res = await svc.createAnfrage(
      'muster',
      { name: 'Bot', email: 'bot@spam.test', website: 'http://spam' } as any,
      IP,
    );
    expect(res.reference).toMatch(/^AF-/);
    expect(tenantRepo.findOne).not.toHaveBeenCalled();
    expect(bookingRepo.save).not.toHaveBeenCalled();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'honeypot', severity: 'warn', ip: IP, details: { quelle: 'public_booking' } }),
    );
  });

  it('leer -> laeuft unveraendert weiter (Tenant-Lookup), KEIN Sicherheits-Ereignis', async () => {
    const { svc, tenantRepo, events } = makeSut();
    // tenantRepo.findOne -> null => resolveTenant wirft NotFound: beweist, dass der
    // Honeypot NICHT kurzgeschlossen hat (der Code lief bis zum Tenant-Lookup).
    await expect(
      svc.createAnfrage('muster', { name: 'Mensch', email: 'm@example.de' } as any, IP),
    ).rejects.toBeInstanceOf(Error);
    expect(tenantRepo.findOne).toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('Honeypot – Grosshaendler-Bewerbung (marketplace)', () => {
  const BEWERBUNG = {
    name: 'FolienGroßhandel Nord GmbH',
    ansprechpartner: 'Kim Weber',
    kontaktEmail: 'einkauf@folien-nord.de',
    ustIdNr: 'DE123456789',
  };
  const DOKUMENT = { buffer: Buffer.from('%PDF-1.4'), mimetype: 'application/pdf', size: 8 };

  function makeSut() {
    const service = { createBewerbung: jest.fn(async () => ({ ok: true })) };
    const events = makeEvents();
    const controller = new PublicHaendlerBewerbungController(service as any, events as any);
    return { controller, service, events };
  }

  it('gefuellt -> Erfolg vorgetaeuscht, createBewerbung NICHT aufgerufen, Sicherheits-Ereignis', async () => {
    const { controller, service, events } = makeSut();
    const res = await controller.create(
      { ...BEWERBUNG, website: 'http://spam' } as any,
      undefined,
      { ip: IP } as any,
    );
    expect(res).toEqual({ ok: true });
    expect(service.createBewerbung).not.toHaveBeenCalled();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'honeypot', severity: 'warn', ip: IP, details: { quelle: 'haendler_bewerbung' } }),
    );
  });

  it('leer -> createBewerbung aufgerufen (mit Dokument), KEIN Sicherheits-Ereignis', async () => {
    const { controller, service, events } = makeSut();
    await controller.create({ ...BEWERBUNG } as any, DOKUMENT as any, { ip: IP } as any);
    expect(service.createBewerbung).toHaveBeenCalledTimes(1);
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('Honeypot – Betrieb-Selbstregistrierung', () => {
  function makeSut() {
    const service = { register: jest.fn(async () => ({ accessToken: 'jwt', user: {} })) };
    const events = makeEvents();
    const controller = new TenantsController(service as any, events as any);
    return { controller, service, events };
  }

  it('gefuellt -> erfolgs-formige, wertlose Antwort, KEINE Registrierung, Sicherheits-Ereignis', () => {
    const { controller, service, events } = makeSut();
    const res: any = controller.register(
      {
        firmenname: 'Bot GmbH',
        firstName: 'B',
        lastName: 'O',
        email: 'bot@spam.example',
        password: 'x'.repeat(12),
        website: 'http://spam',
      } as any,
      { ip: IP } as any,
    );
    // FIX E: Antwort hat dieselbe FORM wie der Erfolgsfall (accessToken + user),
    // ist aber wertlos (Zufalls-Token, kein echtes Konto). Kein register()-Aufruf.
    expect(service.register).not.toHaveBeenCalled();
    expect(typeof res.accessToken).toBe('string');
    expect(res.accessToken.length).toBeGreaterThan(0);
    expect(res.user.email).toBe('bot@spam.example');
    expect(res.user).toHaveProperty('id');
    expect(res.user).toHaveProperty('tenantId');
    // Nicht am Schema unterscheidbar: KEIN verraeterisches { ok: true }.
    expect(res).not.toHaveProperty('ok');
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'honeypot', severity: 'warn', ip: IP, details: { quelle: 'tenant_register' } }),
    );
  });

  it('leer -> normale Registrierung (register aufgerufen), KEIN Sicherheits-Ereignis', () => {
    const { controller, service, events } = makeSut();
    controller.register(
      {
        firmenname: 'Muster',
        firstName: 'M',
        lastName: 'U',
        email: 'mensch@example.de',
        password: 'x'.repeat(12),
      } as any,
      { ip: IP } as any,
    );
    expect(service.register).toHaveBeenCalledTimes(1);
    expect(events.record).not.toHaveBeenCalled();
  });
});
