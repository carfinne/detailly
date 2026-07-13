import {
  DnsResolver,
  buildDnsRecords,
  checkDkim,
  checkMailDomain,
  checkMx,
  checkSpf,
  generateDkimKeyPair,
} from './mail-domain-check';
import { MailService } from '../../mailer/mail.service';

/**
 * Tests der reinen DNS-Check-Logik (feat/eigene-domain-mail). Der DNS-Resolver
 * wird IMMER gemockt -> keine echten DNS-Calls. Geprueft: SPF ok/fehlt/zu offen,
 * DKIM match/mismatch/fehlt (inkl. gechunkter TXT), MX da/fehlt, Gesamt-Ampel.
 */

/** Baut einen gemockten Resolver aus vorgegebenen TXT-/MX-Antworten. */
function resolverFor(
  txt: Record<string, string[][]>,
  mx: Record<string, { exchange: string; priority: number }[]> = {},
): DnsResolver {
  const enodata = () => Object.assign(new Error('queryTxt ENODATA'), { code: 'ENODATA' });
  return {
    resolveTxt: async (h: string) => {
      if (Object.prototype.hasOwnProperty.call(txt, h)) return txt[h];
      throw enodata();
    },
    resolveMx: async (h: string) => {
      if (Object.prototype.hasOwnProperty.call(mx, h)) return mx[h];
      throw enodata();
    },
  };
}

const DOMAIN = 'muster.de';
const SELECTOR = 'detailly';
const PUBKEY = 'MIIBIjANBgkqTESTKEYtestkeyTESTKEYtestkey1234567890abcdefABCDEF==';

describe('checkSpf', () => {
  it('restriktives ~all/-all -> gruen', async () => {
    const r1 = await checkSpf(DOMAIN, resolverFor({ [DOMAIN]: [['v=spf1 include:_spf.provider.de ~all']] }));
    expect(r1.status).toBe('gruen');
    const r2 = await checkSpf(DOMAIN, resolverFor({ [DOMAIN]: [['v=spf1 -all']] }));
    expect(r2.status).toBe('gruen');
  });

  it('offenes +all/?all -> gelb', async () => {
    const r1 = await checkSpf(DOMAIN, resolverFor({ [DOMAIN]: [['v=spf1 +all']] }));
    expect(r1.status).toBe('gelb');
    const r2 = await checkSpf(DOMAIN, resolverFor({ [DOMAIN]: [['v=spf1 ?all']] }));
    expect(r2.status).toBe('gelb');
  });

  it('SPF ohne all-Regel -> gelb', async () => {
    const r = await checkSpf(DOMAIN, resolverFor({ [DOMAIN]: [['v=spf1 include:_spf.provider.de']] }));
    expect(r.status).toBe('gelb');
  });

  it('kein SPF-Eintrag (andere TXT vorhanden) -> rot', async () => {
    const r = await checkSpf(DOMAIN, resolverFor({ [DOMAIN]: [['google-site-verification=abc']] }));
    expect(r.status).toBe('rot');
  });

  it('DNS nicht aufloesbar -> rot (kein Throw)', async () => {
    const r = await checkSpf(DOMAIN, resolverFor({}));
    expect(r.status).toBe('rot');
  });

  it('findet den SPF-Record unter mehreren TXT-Eintraegen', async () => {
    const r = await checkSpf(
      DOMAIN,
      resolverFor({ [DOMAIN]: [['some=other'], ['v=spf1 ip4:1.2.3.4 -all']] }),
    );
    expect(r.status).toBe('gruen');
    expect(r.found).toContain('v=spf1');
  });
});

describe('checkDkim', () => {
  const host = `${SELECTOR}._domainkey.${DOMAIN}`;

  it('veroeffentlichter Key == erwarteter Key -> gruen', async () => {
    const r = await checkDkim(
      DOMAIN,
      SELECTOR,
      PUBKEY,
      resolverFor({ [host]: [[`v=DKIM1; k=rsa; p=${PUBKEY}`]] }),
    );
    expect(r.status).toBe('gruen');
  });

  it('gechunkte TXT (>255) werden zusammengefuegt -> gruen', async () => {
    const half = Math.ceil(PUBKEY.length / 2);
    const chunk1 = `v=DKIM1; k=rsa; p=${PUBKEY.slice(0, half)}`;
    const chunk2 = PUBKEY.slice(half);
    const r = await checkDkim(DOMAIN, SELECTOR, PUBKEY, resolverFor({ [host]: [[chunk1, chunk2]] }));
    expect(r.status).toBe('gruen');
  });

  it('falscher/alter Key -> gelb', async () => {
    const r = await checkDkim(
      DOMAIN,
      SELECTOR,
      PUBKEY,
      resolverFor({ [host]: [['v=DKIM1; k=rsa; p=EINGANZANDERERKEYxyz==']] }),
    );
    expect(r.status).toBe('gelb');
  });

  it('kein DKIM-Eintrag -> rot', async () => {
    const r = await checkDkim(DOMAIN, SELECTOR, PUBKEY, resolverFor({}));
    expect(r.status).toBe('rot');
  });

  it('Whitespace im veroeffentlichten Key wird ignoriert -> gruen', async () => {
    const r = await checkDkim(
      DOMAIN,
      SELECTOR,
      PUBKEY,
      resolverFor({ [host]: [[`v=DKIM1; k=rsa; p=${PUBKEY.slice(0, 20)} ${PUBKEY.slice(20)}`]] }),
    );
    expect(r.status).toBe('gruen');
  });
});

describe('checkMx', () => {
  it('MX vorhanden -> gruen', async () => {
    const r = await checkMx(DOMAIN, resolverFor({}, { [DOMAIN]: [{ exchange: 'mx.muster.de', priority: 10 }] }));
    expect(r.status).toBe('gruen');
  });

  it('kein MX -> gelb (informativ, nie rot)', async () => {
    const r = await checkMx(DOMAIN, resolverFor({}, {}));
    expect(r.status).toBe('gelb');
  });

  it('leere MX-Liste -> gelb', async () => {
    const r = await checkMx(DOMAIN, resolverFor({}, { [DOMAIN]: [] }));
    expect(r.status).toBe('gelb');
  });
});

describe('checkMailDomain (Gesamt)', () => {
  const host = `${SELECTOR}._domainkey.${DOMAIN}`;

  it('alles korrekt -> overall gruen + verifiziert-Voraussetzung', async () => {
    const resolver = resolverFor(
      { [DOMAIN]: [['v=spf1 -all']], [host]: [[`v=DKIM1; k=rsa; p=${PUBKEY}`]] },
      { [DOMAIN]: [{ exchange: 'mx.muster.de', priority: 10 }] },
    );
    const r = await checkMailDomain(DOMAIN, SELECTOR, PUBKEY, resolver);
    expect(r.overall).toBe('gruen');
    expect(r.spf.status).toBe('gruen');
    expect(r.dkim.status).toBe('gruen');
    expect(r.mx.status).toBe('gruen');
  });

  it('SPF fehlt -> overall rot (schlechtester aus SPF/DKIM)', async () => {
    const resolver = resolverFor({ [host]: [[`v=DKIM1; k=rsa; p=${PUBKEY}`]] });
    const r = await checkMailDomain(DOMAIN, SELECTOR, PUBKEY, resolver);
    expect(r.spf.status).toBe('rot');
    expect(r.dkim.status).toBe('gruen');
    expect(r.overall).toBe('rot');
  });

  it('DKIM fehlt (SPF ok) -> overall rot', async () => {
    const resolver = resolverFor({ [DOMAIN]: [['v=spf1 ~all']] });
    const r = await checkMailDomain(DOMAIN, SELECTOR, PUBKEY, resolver);
    expect(r.dkim.status).toBe('rot');
    expect(r.overall).toBe('rot');
  });

  it('MX fehlt beeinflusst overall nicht (informativ)', async () => {
    const resolver = resolverFor({ [DOMAIN]: [['v=spf1 ~all']], [host]: [[`v=DKIM1; k=rsa; p=${PUBKEY}`]] });
    const r = await checkMailDomain(DOMAIN, SELECTOR, PUBKEY, resolver);
    expect(r.mx.status).toBe('gelb');
    expect(r.overall).toBe('gruen');
  });

  it('geprueftAm ist ein ISO-Zeitstempel', async () => {
    const r = await checkMailDomain(DOMAIN, SELECTOR, PUBKEY, resolverFor({}));
    expect(Number.isNaN(Date.parse(r.geprueftAm))).toBe(false);
  });
});

describe('generateDkimKeyPair + buildDnsRecords', () => {
  it('erzeugt PEM-Privatkey + base64-Publickey, der als Privatkey nutzbar ist', () => {
    const kp = generateDkimKeyPair();
    expect(kp.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(kp.publicKeyBase64.length).toBeGreaterThan(100);
    // Der erzeugte private Schluessel ist strukturell brauchbar (DKIM-Signier-Gate).
    expect(MailService.isDkimKeyUsable(kp.privateKeyPem)).toBe(true);
  });

  it('erzeugtes Paar verifiziert sich selbst ueber checkDkim', async () => {
    const kp = generateDkimKeyPair();
    const host = `${SELECTOR}._domainkey.${DOMAIN}`;
    const r = await checkDkim(
      DOMAIN,
      SELECTOR,
      kp.publicKeyBase64,
      resolverFor({ [host]: [[`v=DKIM1; k=rsa; p=${kp.publicKeyBase64}`]] }),
    );
    expect(r.status).toBe('gruen');
  });

  it('buildDnsRecords liefert korrekte Hosts/Werte', () => {
    const recs = buildDnsRecords(DOMAIN, SELECTOR, PUBKEY);
    expect(recs.spf.host).toBe(DOMAIN);
    expect(recs.spf.value).toContain('v=spf1');
    expect(recs.dkim.host).toBe(`${SELECTOR}._domainkey.${DOMAIN}`);
    expect(recs.dkim.value).toBe(`v=DKIM1; k=rsa; p=${PUBKEY}`);
  });
});
