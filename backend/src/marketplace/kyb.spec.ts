import { BadRequestException, Logger } from '@nestjs/common';
import { promises as fsp } from 'fs';
import { KybService } from './kyb.service';
import {
  encryptBuffer,
  decryptBuffer,
  DecryptionError,
  resetEncryptionKeyCache,
} from '../common/crypto/encryption';

/** ConfigService-Stub: liefert den Anthropic-Key nur, wenn gesetzt. */
function makeConfig(key?: string): any {
  return { get: jest.fn((name: string) => (name === 'ANTHROPIC_API_KEY' ? key : undefined)) };
}

function makeDealerRepo(over: { find?: any[] } = {}): any {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue(over.find ?? []),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

/** Gueltige Magic-Bytes je Typ (nur der Header zaehlt fuer die Erkennung). */
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('x'.repeat(100))]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('rest'),
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('rest')]);

describe('encryptBuffer / decryptBuffer (AES-256-GCM at rest)', () => {
  beforeAll(() => {
    process.env.DATA_ENC_KEY = 'a'.repeat(64);
    resetEncryptionKeyCache();
  });
  afterAll(() => {
    delete process.env.DATA_ENC_KEY;
    resetEncryptionKeyCache();
  });

  it('Roundtrip: entschluesselt exakt die Ausgangsbytes', () => {
    const klar = Buffer.from('%PDF-1.4 geheime Gewerbeanmeldung äöü \x00\x01\x02');
    const enc = encryptBuffer(klar);
    // Chiffretext beginnt mit dem Datei-Marker und ist NICHT der Klartext.
    expect(enc.subarray(0, 8).toString('utf8')).toBe('DLYENC1\0');
    expect(enc.includes(Buffer.from('Gewerbeanmeldung'))).toBe(false);
    expect(decryptBuffer(enc).equals(klar)).toBe(true);
  });

  it('manipulierter/fremder Buffer -> DecryptionError (nie Muell zurueck)', () => {
    expect(() => decryptBuffer(Buffer.from('kein gueltiger container'))).toThrow(DecryptionError);
    const enc = encryptBuffer(Buffer.from('abc'));
    enc[enc.length - 1] ^= 0xff; // Tag/CT kippen
    expect(() => decryptBuffer(enc)).toThrow(DecryptionError);
  });
});

describe('KybService · speichereDokument (Magic-Byte / Groesse / Verschluesselung)', () => {
  beforeEach(() => {
    jest.spyOn(fsp, 'mkdir').mockResolvedValue(undefined as any);
    jest.spyOn(fsp, 'writeFile').mockResolvedValue(undefined as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const svc = () => new KybService(makeDealerRepo(), makeConfig());

  it('fehlende Datei -> 400', async () => {
    await expect(svc().speichereDokument(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Nicht-PDF/Bild (getarnte Datei) -> 400, nichts geschrieben', async () => {
    const write = fsp.writeFile as jest.Mock;
    await expect(
      svc().speichereDokument({ buffer: Buffer.from('<html>nope</html>') } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(write).not.toHaveBeenCalled();
  });

  it('zu grosse Datei (>10 MB) -> 400', async () => {
    const gross = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    await expect(svc().speichereDokument({ buffer: gross } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    ['PDF', PDF, 'pdf'],
    ['PNG', PNG, 'png'],
    ['JPG', JPG, 'jpg'],
  ])('%s: sha256 ueber Klartext + VERSCHLUESSELTE Ablage', async (_n, buf, ext) => {
    process.env.DATA_ENC_KEY = 'b'.repeat(64);
    resetEncryptionKeyCache();
    const write = fsp.writeFile as jest.Mock;
    const res = await svc().speichereDokument({ buffer: buf } as any);

    expect(res.pfad).toMatch(new RegExp(`^/private-uploads/kyb/[0-9a-f-]+\\.${ext}\\.enc$`));
    expect(res.hash).toMatch(/^[0-9a-f]{64}$/);
    // Auf die Platte geht NIE der Klartext, sondern der GCM-Container (Marker vorn).
    const geschrieben = write.mock.calls[0][1] as Buffer;
    expect(geschrieben.subarray(0, 8).toString('utf8')).toBe('DLYENC1\0');
    expect(decryptBuffer(geschrieben).equals(buf)).toBe(true);
    delete process.env.DATA_ENC_KEY;
    resetEncryptionKeyCache();
  });
});

describe('KybService · Auto-Vorpruefung (Ampel + Abweichungen)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const dealer = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    name: 'FolienGroßhandel Nord GmbH',
    adresse: 'Hafenstraße 1, 20457 Hamburg',
    ustIdNr: 'DE123456789',
    gewerbeanmeldungDatei: '/private-uploads/kyb/x.pdf.enc',
    dokumentHash: 'hash-1',
    ...over,
  });

  const mockVisionJson = (obj: Record<string, string>) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] }) }) as any;
  };

  function svcWith(key: string | undefined, repoOver: { find?: any[] } = {}) {
    const svc = new KybService(makeDealerRepo(repoOver), makeConfig(key));
    // Dokument-Bytes kommen aus dem (gemockten) verschluesselten Speicher.
    jest
      .spyOn(svc as any, 'ladeDokument')
      .mockResolvedValue({ buffer: Buffer.from('%PDF-1.4'), mime: 'application/pdf', filename: 'g.pdf' });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    return svc;
  }

  it('GRUEN: Firmenname + Anschrift passen, USt-IdNr ok, keine Dublette', async () => {
    mockVisionJson({
      firmenname: 'FolienGroßhandel Nord GmbH',
      anschrift: 'Hafenstraße 1, 20457 Hamburg',
      taetigkeit: 'Großhandel mit Folien',
      anmeldedatum: '01.02.2020',
      behoerde: 'Gewerbeamt Hamburg',
    });
    const svc = svcWith('sk-ant-test');
    const res = await svc.ermittleErgebnis(dealer() as any);
    expect(res.ampel).toBe('gruen');
    expect(res.abweichungen).toHaveLength(0);
    expect(res.felder.firmenname).toBe('FolienGroßhandel Nord GmbH');
    // Wire-Format: PDF als document-Block + Extraktions-Prompt.
    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sent.model).toBe('claude-opus-4-8');
    expect(sent.messages[0].content[0].type).toBe('document');
  });

  it('ROT: Firmenname weicht vom Dokument ab', async () => {
    mockVisionJson({ firmenname: 'Ganz Andere Handels AG', anschrift: 'Woanders 9, 99999 Ort' });
    const svc = svcWith('sk-ant-test');
    const res = await svc.ermittleErgebnis(dealer() as any);
    expect(res.ampel).toBe('rot');
    expect(res.abweichungen.join(' ')).toMatch(/Firmenname/);
  });

  it('GELB graceful: ohne ANTHROPIC_API_KEY -> nicht automatisch geprueft', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;
    const svc = svcWith(undefined);
    const res = await svc.ermittleErgebnis(dealer() as any);
    expect(res.ampel).toBe('gelb');
    expect(res.abweichungen.join(' ')).toMatch(/Nicht automatisch geprüft/);
    expect(fetchSpy).not.toHaveBeenCalled(); // kein Netz-Call ohne Key
  });

  it('ROT gewinnt: Dublette (gleicher Hash, andere Firma) schlaegt Gelb', async () => {
    const svc = svcWith(undefined, {
      find: [{ id: 'other', name: 'Wildfremde GmbH', dokumentHash: 'hash-1' }],
    });
    const res = await svc.ermittleErgebnis(dealer() as any);
    expect(res.ampel).toBe('rot');
    expect(res.abweichungen.join(' ')).toMatch(/bereits für eine andere Firma/);
  });

  it('GELB: ungueltiges USt-IdNr-Format wird als Abweichung markiert', async () => {
    mockVisionJson({ firmenname: 'FolienGroßhandel Nord GmbH', anschrift: 'Hafenstraße 1, 20457 Hamburg' });
    const svc = svcWith('sk-ant-test');
    const res = await svc.ermittleErgebnis(dealer({ ustIdNr: 'keine-ustid' }) as any);
    expect(res.ampel).toBe('gelb');
    expect(res.abweichungen.join(' ')).toMatch(/USt-IdNr/);
  });
});

describe('KybService · reine Helfer', () => {
  const svc = new KybService(makeDealerRepo(), makeConfig());

  it('ustIdFormatOk: DE + 9 Ziffern und grobes EU-Muster ja; Muell nein', () => {
    expect(svc.ustIdFormatOk('DE123456789')).toBe(true);
    expect(svc.ustIdFormatOk('DE 123 456 789')).toBe(true);
    expect(svc.ustIdFormatOk('ATU12345678')).toBe(true);
    expect(svc.ustIdFormatOk('hallo')).toBe(false);
    expect(svc.ustIdFormatOk('')).toBe(false);
    expect(svc.ustIdFormatOk(undefined)).toBe(false);
  });

  it('nameMatch: Rechtsform-tolerant, aber echte Abweichung faellt durch', () => {
    expect(svc.nameMatch('FolienProfi GmbH', 'FolienProfi')).toBe(true);
    expect(svc.nameMatch('Koch Chemie GmbH', 'Koch Chemie GmbH & Co. KG')).toBe(true);
    expect(svc.nameMatch('FolienProfi GmbH', 'Rupes Handel AG')).toBe(false);
  });
});
