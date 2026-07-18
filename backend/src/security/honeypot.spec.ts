import { PublicNewsletterController } from '../newsletter/public-newsletter.controller';
import { TenantsController } from '../tenants/tenants.controller';

/**
 * Honeypot-Abwehr (Sentinel Teil 2, Rest-Haertung). Simuliert den Bot-Angriff:
 * das versteckte `website`-Feld ist gefuellt -> der Server taeuscht Erfolg vor und
 * legt NICHTS an / versendet NICHTS (der Bot lernt nicht, erkannt worden zu sein).
 * Menschen lassen das Feld leer -> normaler Ablauf (Service wird aufgerufen).
 */
describe('Honeypot – Newsletter-Anmeldung', () => {
  function makeSut() {
    const service = { anmelden: jest.fn(async () => undefined) };
    const controller = new PublicNewsletterController(service as any);
    return { controller, service };
  }

  it('gefuelltes Honeypot-Feld -> Erfolg vorgetaeuscht, service.anmelden NICHT aufgerufen', async () => {
    const { controller, service } = makeSut();
    const res = await controller.anmelden({ email: 'bot@spam.example', website: 'http://spam' } as any);
    expect(res).toEqual({ ok: true });
    expect(service.anmelden).not.toHaveBeenCalled();
  });

  it('leeres Honeypot-Feld -> normaler Ablauf (service.anmelden aufgerufen)', async () => {
    const { controller, service } = makeSut();
    const res = await controller.anmelden({ email: 'mensch@example.de' } as any);
    expect(res).toEqual({ ok: true });
    expect(service.anmelden).toHaveBeenCalledWith('mensch@example.de');
  });
});

describe('Honeypot – Betrieb-Selbstregistrierung', () => {
  function makeSut() {
    const service = { register: jest.fn(async () => ({ accessToken: 'jwt', user: {} })) };
    const controller = new TenantsController(service as any);
    return { controller, service };
  }

  it('gefuelltes Honeypot-Feld -> Erfolg vorgetaeuscht (erfolgs-formig), KEINE Registrierung', () => {
    const { controller, service } = makeSut();
    const res: any = controller.register({
      firmenname: 'Bot GmbH',
      firstName: 'B',
      lastName: 'O',
      email: 'bot@spam.example',
      password: 'x'.repeat(12),
      website: 'http://spam',
    } as any);
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
  });

  it('leeres Honeypot-Feld -> normale Registrierung (service.register aufgerufen)', () => {
    const { controller, service } = makeSut();
    controller.register({
      firmenname: 'Muster',
      firstName: 'M',
      lastName: 'U',
      email: 'mensch@example.de',
      password: 'x'.repeat(12),
    } as any);
    expect(service.register).toHaveBeenCalledTimes(1);
  });
});
