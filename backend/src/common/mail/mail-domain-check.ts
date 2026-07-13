import { generateKeyPairSync } from 'crypto';

/**
 * Zustellbarkeit der eigenen Domain (SPF/DKIM/MX) – dependency-frei ueber Node
 * `dns/promises`. Dieses Modul ist REIN + testbar: die DNS-Aufloesung wird als
 * Resolver-Schnittstelle hereingereicht, damit Tests sie mocken (keine echten
 * DNS-Calls). Ergebnis je Check als Ampel gruen/gelb/rot + Klartext-Hinweis.
 */

/** Feste DKIM-Selector-Bezeichnung (DNS: `<selector>._domainkey.<domain>`). */
export const DKIM_SELECTOR = 'detailly';

/** Kurzes Timeout je DNS-Aufloesung (Netz-Haenger duerfen den Endpoint nicht blockieren). */
export const DNS_TIMEOUT_MS = 5000;

/** Ampel-Status eines Einzel-Checks. `ungeprueft` = Default vor der ersten Pruefung. */
export type CheckStatus = 'gruen' | 'gelb' | 'rot' | 'ungeprueft';

/** Ergebnis eines Einzel-Checks (Farbe + Klartext-Hinweis fuer die UI). */
export interface DomainCheckResult {
  status: CheckStatus;
  message: string;
  /** Optional: der tatsaechlich gefundene DNS-Wert (fuer die Anzeige). */
  found?: string;
}

/** Gesamt-Ergebnis der Domain-Verifikation. */
export interface MailDomainCheckResult {
  overall: CheckStatus;
  spf: DomainCheckResult;
  dkim: DomainCheckResult;
  mx: DomainCheckResult;
  geprueftAm: string;
}

/**
 * DNS-Resolver-Schnittstelle (Teilmenge von `dns/promises`). Der Service reicht
 * die echten Funktionen herein; Tests eine gemockte Implementierung.
 */
export interface DnsResolver {
  resolveTxt(hostname: string): Promise<string[][]>;
  resolveMx(hostname: string): Promise<{ exchange: string; priority: number }[]>;
}

/** DNS-Eintrag, den der Betrieb bei seinem Provider hinterlegen muss (Anzeige). */
export interface DnsRecordSpec {
  type: 'TXT';
  host: string;
  value: string;
}

/** Die anzuzeigenden DNS-Eintraege (SPF-Vorlage + exakter DKIM-Eintrag). */
export interface DnsRecords {
  spf: DnsRecordSpec;
  dkim: DnsRecordSpec;
}

/**
 * Erzeugt ein RSA-2048-Schluesselpaar fuer die DKIM-Signierung. Der private
 * Schluessel (PEM/PKCS8) wird verschluesselt gespeichert und verlaesst das
 * Backend nie; der oeffentliche Schluessel (base64 der SPKI-DER-Struktur) ist
 * der `p=`-Wert des DKIM-DNS-Eintrags.
 */
export function generateDkimKeyPair(): { privateKeyPem: string; publicKeyBase64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    privateKeyPem: privateKey as unknown as string,
    publicKeyBase64: (publicKey as Buffer).toString('base64'),
  };
}

/** Baut die anzuzeigenden DNS-Eintraege (SPF-Vorlage + exakter DKIM-Eintrag). */
export function buildDnsRecords(domain: string, selector: string, publicKey: string): DnsRecords {
  return {
    spf: {
      type: 'TXT',
      host: domain,
      value: 'v=spf1 include:IHR-MAILPROVIDER ~all',
    },
    dkim: {
      type: 'TXT',
      host: `${selector}._domainkey.${domain}`,
      value: `v=DKIM1; k=rsa; p=${publicKey}`,
    },
  };
}

/** Rangfolge der Ampel-Farben (rot am schlechtesten) fuer die Gesamt-Bewertung. */
const RANK: Record<CheckStatus, number> = { rot: 3, gelb: 2, ungeprueft: 1, gruen: 0 };
function worst(a: CheckStatus, b: CheckStatus): CheckStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Race gegen ein Timeout; der Timer wird bei Erfolg zuverlaessig aufgeraeumt. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('dns-timeout')), ms);
    // Der Timer darf den Prozess nicht am Leben halten.
    (timer as unknown as { unref?: () => void }).unref?.();
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** Normalisiert einen TXT-/Key-Wert: Whitespace entfernen (fuer den p=-Vergleich). */
function stripWhitespace(s: string): string {
  return s.replace(/\s+/g, '');
}

/**
 * SPF-Check: an der Domain-Wurzel muss GENAU ein `v=spf1`-TXT stehen. Da der
 * noetige `include:` vom SMTP-Provider kommt (nicht berechenbar), bewerten wir
 * nur Vorhandensein + Restriktivitaet der `all`-Policy.
 *  - gruen: `v=spf1 ... -all`/`~all` (restriktiv)
 *  - gelb:  SPF vorhanden, aber `+all`/`?all`/kein `all` (zu offen/unvollstaendig)
 *  - rot:   kein SPF-Eintrag / DNS nicht aufloesbar
 */
export async function checkSpf(domain: string, resolver: DnsResolver): Promise<DomainCheckResult> {
  let records: string[][];
  try {
    records = await withTimeout(resolver.resolveTxt(domain), DNS_TIMEOUT_MS);
  } catch {
    return { status: 'rot', message: 'Kein SPF-Eintrag gefunden (DNS nicht auffindbar).' };
  }
  const joined = records.map((chunks) => chunks.join(''));
  const spf = joined.find((r) => /^v=spf1\b/i.test(r.trim()));
  if (!spf) {
    return { status: 'rot', message: 'Kein SPF-Eintrag (v=spf1) an der Domain hinterlegt.' };
  }
  const allToken = spf
    .trim()
    .split(/\s+/)
    .find((tok) => /^[-~?+]?all$/i.test(tok));
  if (!allToken) {
    return {
      status: 'gelb',
      message: 'SPF-Eintrag vorhanden, aber ohne abschliessende all-Regel (z. B. ~all ergaenzen).',
      found: spf,
    };
  }
  const qualifier = /^[-~?+]/.test(allToken) ? allToken[0] : '+';
  if (qualifier === '-' || qualifier === '~') {
    return { status: 'gruen', message: 'SPF-Eintrag gefunden und restriktiv.', found: spf };
  }
  return {
    status: 'gelb',
    message: 'SPF-Eintrag ist zu offen (+all/?all). Fuer bessere Zustellbarkeit ~all oder -all verwenden.',
    found: spf,
  };
}

/**
 * DKIM-Check: unter `<selector>._domainkey.<domain>` muss der von uns erzeugte
 * oeffentliche Schluessel als `v=DKIM1; ...; p=<key>` stehen. `resolveTxt` fuegt
 * die 255-Zeichen-Chunks je Eintrag automatisch zusammen -> exakter Vergleich.
 *  - gruen: veroeffentlichter p= stimmt mit unserem Public-Key ueberein
 *  - gelb:  DKIM-Eintrag vorhanden, aber falscher/alter Schluessel
 *  - rot:   kein DKIM-Eintrag / DNS nicht aufloesbar
 */
export async function checkDkim(
  domain: string,
  selector: string,
  expectedPublicKey: string,
  resolver: DnsResolver,
): Promise<DomainCheckResult> {
  const host = `${selector}._domainkey.${domain}`;
  let records: string[][];
  try {
    records = await withTimeout(resolver.resolveTxt(host), DNS_TIMEOUT_MS);
  } catch {
    return { status: 'rot', message: `Kein DKIM-Eintrag unter ${host} gefunden.` };
  }
  const joined = records.map((chunks) => chunks.join(''));
  const dkim = joined.find((r) => /(^|;|\s)p=/.test(r));
  if (!dkim) {
    return { status: 'rot', message: `Kein DKIM-Eintrag unter ${host} hinterlegt.` };
  }
  const m = dkim.match(/p=([A-Za-z0-9+/=\s]*)/);
  const publishedKey = m ? stripWhitespace(m[1]) : '';
  if (publishedKey && publishedKey === stripWhitespace(expectedPublicKey)) {
    return { status: 'gruen', message: 'DKIM-Schluessel korrekt veroeffentlicht.' };
  }
  return {
    status: 'gelb',
    message: 'DKIM-Eintrag vorhanden, aber der Schluessel stimmt nicht (alter/falscher Wert?).',
    found: dkim,
  };
}

/**
 * MX-Check (informativ): eine Domain ohne MX wirkt fuer Empfaenger verdaechtig,
 * ist fuer den reinen VERSAND aber nicht zwingend -> fehlt/Fehler = gelb (nie rot).
 */
export async function checkMx(domain: string, resolver: DnsResolver): Promise<DomainCheckResult> {
  try {
    const mx = await withTimeout(resolver.resolveMx(domain), DNS_TIMEOUT_MS);
    if (Array.isArray(mx) && mx.length > 0) {
      return { status: 'gruen', message: 'MX-Eintrag vorhanden.', found: mx[0]?.exchange };
    }
    return { status: 'gelb', message: 'Kein MX-Eintrag – fuer den Empfang von Antworten empfohlen.' };
  } catch {
    return { status: 'gelb', message: 'Kein MX-Eintrag gefunden – fuer den Empfang von Antworten empfohlen.' };
  }
}

/**
 * Fuehrt alle Checks nebenlaeufig aus (Promise.allSettled -> ein unerwarteter
 * Fehler eines Checks kippt nie den ganzen Endpoint). Gesamt-Ampel = schlechtester
 * der beiden zustellungsrelevanten Checks SPF/DKIM (MX ist rein informativ).
 */
export async function checkMailDomain(
  domain: string,
  selector: string,
  publicKey: string,
  resolver: DnsResolver,
): Promise<MailDomainCheckResult> {
  const [spfR, dkimR, mxR] = await Promise.allSettled([
    checkSpf(domain, resolver),
    checkDkim(domain, selector, publicKey, resolver),
    checkMx(domain, resolver),
  ]);
  const rotFallback = (msg: string): DomainCheckResult => ({ status: 'rot', message: msg });
  const gelbFallback = (msg: string): DomainCheckResult => ({ status: 'gelb', message: msg });
  const spf = spfR.status === 'fulfilled' ? spfR.value : rotFallback('SPF konnte nicht geprueft werden.');
  const dkim =
    dkimR.status === 'fulfilled' ? dkimR.value : rotFallback('DKIM konnte nicht geprueft werden.');
  const mx = mxR.status === 'fulfilled' ? mxR.value : gelbFallback('MX konnte nicht geprueft werden.');
  return {
    overall: worst(spf.status, dkim.status),
    spf,
    dkim,
    mx,
    geprueftAm: new Date().toISOString(),
  };
}
