import { BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { DnsResolver, generateDkimKeyPair } from '../common/mail/mail-domain-check';

/**
 * Tests des Zustellbarkeits-Features (feat/eigene-domain-mail) auf Service-Ebene:
 *  - DKIM-Schluessel wird beim Setzen der Domain erzeugt (Public-Key in settings,
 *    Private-Key in der select:false-Spalte) – der private Schluessel verlaesst
 *    das Backend NIE (weder in getOwnProfile noch im Verify-Ergebnis).
 *  - verifyMailDomain persistiert den Ampel-Stand, ist tenant-scoped, self-healt
 *    einen fehlenden Schluessel und wirft ohne Domain.
 *  - DNS wird IMMER gemockt (setDnsResolver) – keine echten DNS-Calls.
 */
describe('TenantsService – eigene Mail-Domain (SPF/DKIM/MX)', () => {
  let stored: any;
  let tenantRepo: any;
  let sevdesk: { loadToken: jest.Mock };
  let mail: { loadSmtpPassword: jest.Mock; invalidateTenant: jest.Mock };
  let audit: { log: jest.Mock };
  let svc: TenantsService;
  let lastWhere: { id: string } | undefined;

  const user = { id: 'u1', tenantId: 't1', role: 'owner' } as unknown as AuthUser;

  /** Gemockter Resolver: liefert vorgegebene TXT/MX; sonst ENODATA-Wurf. */
  function resolver(
    txt: Record<string, string[][]>,
    mx: Record<string, { exchange: string; priority: number }[]> = {},
  ): DnsResolver {
    const nodata = () => Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
    return {
      resolveTxt: async (h) => (h in txt ? txt[h] : Promise.reject(nodata())),
      resolveMx: async (h) => (h in mx ? mx[h] : Promise.reject(nodata())),
    };
  }

  beforeEach(() => {
    stored = { id: 't1', name: 'Betrieb', country: 'DE', settings: {}, dkimPrivateKey: null };
    lastWhere = undefined;
    tenantRepo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      save: jest.fn().mockImplementation((t: any) => Promise.resolve(t)),
      // QueryBuilder-Mock fuer verifyMailDomain (addSelect(dkimPrivateKey)).
      createQueryBuilder: jest.fn(() => {
        const qb: any = {
          addSelect: () => qb,
          where: (_c: string, params: { id: string }) => {
            lastWhere = params;
            return qb;
          },
          getOne: async () => stored,
        };
        return qb;
      }),
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

  describe('updateOwnProfile – DKIM-Schluessel-Erzeugung', () => {
    it('Domain setzen erzeugt DKIM-Keypair: Public-Key in settings, Private-Key in Spalte', async () => {
      const profile = await svc.updateOwnProfile(user, {
        mailConfig: {
          enabled: true,
          host: 'smtp.provider.de',
          fromEmail: 'info@muster.de',
          domain: 'muster.de',
        },
      } as any);

      expect(stored.settings.mailConfig.domain).toBe('muster.de');
      expect(stored.settings.mailConfig.dkim.selector).toBe('detailly');
      expect(stored.settings.mailConfig.dkim.publicKey.length).toBeGreaterThan(100);
      // Privater Schluessel liegt in der (verschluesselten) Spalte, NICHT in settings.
      expect(stored.dkimPrivateKey).toContain('BEGIN PRIVATE KEY');
      expect(JSON.stringify(stored.settings)).not.toContain('PRIVATE KEY');

      // Anzeige-Sicht: Public-Key + DNS-Eintraege vorhanden, Private-Key NIE.
      expect(profile.mailConfig.dkim.configured).toBe(true);
      expect(profile.mailConfig.dnsRecords?.dkim.host).toBe('detailly._domainkey.muster.de');
      expect(profile.mailConfig.dnsRecords?.dkim.value).toContain('v=DKIM1');
      expect(JSON.stringify(profile)).not.toContain('PRIVATE KEY');
    });

    it('fromEmail NICHT auf der gesetzten Domain -> BadRequest (kein Key erzeugt)', async () => {
      await expect(
        svc.updateOwnProfile(user, {
          mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'info@fremd.de', domain: 'muster.de' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stored.dkimPrivateKey).toBeNull();
    });

    it('erneutes Speichern ohne Domain-Wechsel erzeugt KEINEN neuen Key (idempotent)', async () => {
      await svc.updateOwnProfile(user, {
        mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'info@muster.de', domain: 'muster.de' },
      } as any);
      const firstKey = stored.dkimPrivateKey;
      const firstPub = stored.settings.mailConfig.dkim.publicKey;
      await svc.updateOwnProfile(user, {
        mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'info@muster.de', domain: 'muster.de' },
      } as any);
      expect(stored.dkimPrivateKey).toBe(firstKey);
      expect(stored.settings.mailConfig.dkim.publicKey).toBe(firstPub);
    });

    it('dkimRotate=true erzeugt einen neuen Key und setzt den DKIM-Check zurueck', async () => {
      await svc.updateOwnProfile(user, {
        mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'info@muster.de', domain: 'muster.de' },
      } as any);
      const firstKey = stored.dkimPrivateKey;
      stored.settings.mailConfig.domainCheck = { verifiziert: true, geprueftAm: 't', spf: 'gruen', dkim: 'gruen', mx: 'gruen' };
      await svc.updateOwnProfile(user, {
        mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'info@muster.de', domain: 'muster.de', dkimRotate: true },
      } as any);
      expect(stored.dkimPrivateKey).not.toBe(firstKey);
      expect(stored.settings.mailConfig.domainCheck.dkim).toBe('ungeprueft');
    });
  });

  describe('verifyMailDomain', () => {
    // Ein festes Keypair, dessen Public-Key wir im gemockten DNS veroeffentlichen.
    const KP = generateDkimKeyPair();

    function prepare(publicKey: string, privateKey: string | null) {
      stored.settings = {
        mailConfig: {
          enabled: true,
          host: 'smtp.provider.de',
          fromEmail: 'info@muster.de',
          domain: 'muster.de',
          dkim: { selector: 'detailly', publicKey },
        },
      };
      stored.dkimPrivateKey = privateKey;
    }

    it('SPF ok + DKIM passend + MX -> overall gruen, verifiziert persistiert', async () => {
      prepare(KP.publicKeyBase64, KP.privateKeyPem);
      svc.setDnsResolver(
        resolver(
          {
            'muster.de': [['v=spf1 include:_spf.provider.de -all']],
            'detailly._domainkey.muster.de': [[`v=DKIM1; k=rsa; p=${KP.publicKeyBase64}`]],
          },
          { 'muster.de': [{ exchange: 'mx.muster.de', priority: 10 }] },
        ),
      );

      const res = await svc.verifyMailDomain('t1');
      expect(res.overall).toBe('gruen');
      expect(res.dkim.status).toBe('gruen');
      // Persistiert -> schaltet die DKIM-Signierung frei.
      expect(stored.settings.mailConfig.domainCheck.dkim).toBe('gruen');
      expect(stored.settings.mailConfig.domainCheck.verifiziert).toBe(true);
      // Cache verworfen + Audit geschrieben.
      expect(mail.invalidateTenant).toHaveBeenCalledWith('t1');
      expect(audit.log).toHaveBeenCalled();
      // Tenant-scoped: die Query filtert auf die tenantId aus dem Token.
      expect(lastWhere).toEqual({ id: 't1' });
      // Der private Schluessel taucht im Ergebnis NIE auf.
      expect(JSON.stringify(res)).not.toContain('PRIVATE KEY');
    });

    it('SPF fehlt -> overall rot, dkim bleibt ungruen -> Signierung nicht freigeschaltet', async () => {
      prepare(KP.publicKeyBase64, KP.privateKeyPem);
      svc.setDnsResolver(
        resolver({ 'detailly._domainkey.muster.de': [[`v=DKIM1; k=rsa; p=${KP.publicKeyBase64}`]] }),
      );
      const res = await svc.verifyMailDomain('t1');
      expect(res.spf.status).toBe('rot');
      expect(res.overall).toBe('rot');
      expect(stored.settings.mailConfig.domainCheck.verifiziert).toBe(false);
    });

    it('ohne hinterlegte Domain -> BadRequest', async () => {
      stored.settings = { mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'a@b.de' } };
      await expect(svc.verifyMailDomain('t1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('self-healing: fehlt der DKIM-Key, wird er bei der Verifikation erzeugt', async () => {
      stored.settings = {
        mailConfig: { enabled: true, host: 'smtp.x.de', fromEmail: 'info@muster.de', domain: 'muster.de' },
      };
      stored.dkimPrivateKey = null;
      svc.setDnsResolver(resolver({ 'muster.de': [['v=spf1 -all']] }));

      const res = await svc.verifyMailDomain('t1');
      // Key wurde erzeugt (Public in settings, Private in Spalte), DNS ohne DKIM -> rot.
      expect(stored.settings.mailConfig.dkim.publicKey.length).toBeGreaterThan(100);
      expect(stored.dkimPrivateKey).toContain('BEGIN PRIVATE KEY');
      expect(res.dkim.status).toBe('rot');
      expect(res.dnsRecords.dkim.value).toContain('v=DKIM1');
    });
  });
});
