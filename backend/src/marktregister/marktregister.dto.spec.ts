import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateMarktBeobachtungDto,
  UpdateMarktBeobachtungDto,
  UpdateMarktPrioritaetDto,
  UpdateMarktStatusDto,
} from './dto/markt-beobachtung.dto';

const VALID = {
  wettbewerber: 'Mitbewerber GmbH',
  kategorie: 'feature',
  beobachtung: 'Bietet einen 3D-Konfigurator auf der Startseite.',
  quelleUrl: 'https://example.com/produkt',
  beobachtetAm: '2026-07-20',
  abgeleiteteIdee: 'Eigenen Konfigurator prominenter platzieren.',
};

async function errorsFor(obj: any, Dto: any = CreateMarktBeobachtungDto): Promise<string[]> {
  const errs = await validate(plainToInstance(Dto, obj));
  return errs.map((e) => e.property);
}

describe('CreateMarktBeobachtungDto · Validierung', () => {
  it('valide Beobachtung -> keine Fehler', async () => {
    expect(await errorsFor(VALID)).toHaveLength(0);
  });

  it('quelleUrl ist optional (darf fehlen)', async () => {
    const { quelleUrl, ...ohne } = VALID;
    expect(await errorsFor(ohne)).toHaveLength(0);
  });

  it('quelleUrl ohne Protokoll -> 400', async () => {
    expect(await errorsFor({ ...VALID, quelleUrl: 'example.com/x' })).toContain('quelleUrl');
  });

  it('quelleUrl mit ftp/javascript-Schema -> 400 (nur http/https)', async () => {
    expect(await errorsFor({ ...VALID, quelleUrl: 'ftp://example.com' })).toContain('quelleUrl');
    expect(await errorsFor({ ...VALID, quelleUrl: 'javascript:alert(1)' })).toContain('quelleUrl');
  });

  it('http und https werden akzeptiert', async () => {
    expect(await errorsFor({ ...VALID, quelleUrl: 'http://example.com' })).toHaveLength(0);
    expect(await errorsFor({ ...VALID, quelleUrl: 'https://example.com/p?a=1' })).toHaveLength(0);
  });

  it('kategorie ausserhalb der Whitelist -> 400', async () => {
    expect(await errorsFor({ ...VALID, kategorie: 'wettbewerb' })).toContain('kategorie');
  });

  it('status ausserhalb der Whitelist -> 400', async () => {
    expect(await errorsFor({ ...VALID, status: 'erledigt' })).toContain('status');
  });

  it('prioritaet ausserhalb der Whitelist -> 400', async () => {
    expect(await errorsFor({ ...VALID, prioritaet: 'kritisch' })).toContain('prioritaet');
  });

  it('beobachtetAm kein ISO-Datum -> 400', async () => {
    expect(await errorsFor({ ...VALID, beobachtetAm: 'irgendwann' })).toContain('beobachtetAm');
  });

  it('leerer Wettbewerber / Beobachtung / Idee -> 400', async () => {
    expect(await errorsFor({ ...VALID, wettbewerber: '' })).toContain('wettbewerber');
    expect(await errorsFor({ ...VALID, beobachtung: '' })).toContain('beobachtung');
    expect(await errorsFor({ ...VALID, abgeleiteteIdee: '' })).toContain('abgeleiteteIdee');
  });

  it('zu lange Freitexte -> 400', async () => {
    const zuLang = 'x'.repeat(4001);
    expect(await errorsFor({ ...VALID, beobachtung: zuLang })).toContain('beobachtung');
    expect(await errorsFor({ ...VALID, abgeleiteteIdee: zuLang })).toContain('abgeleiteteIdee');
  });
});

describe('UpdateMarktBeobachtungDto · Validierung (alle optional)', () => {
  it('leeres Objekt -> keine Fehler', async () => {
    expect(await errorsFor({}, UpdateMarktBeobachtungDto)).toHaveLength(0);
  });

  it('ungueltiger Status auch beim Update -> 400', async () => {
    expect(await errorsFor({ status: 'boese' }, UpdateMarktBeobachtungDto)).toContain('status');
  });
});

describe('UpdateMarktStatusDto / UpdateMarktPrioritaetDto · @IsIn erzwungen', () => {
  it('Status: gueltig ok, ungueltig 400', async () => {
    expect(await errorsFor({ status: 'geprueft' }, UpdateMarktStatusDto)).toHaveLength(0);
    expect(await errorsFor({ status: 'foo' }, UpdateMarktStatusDto)).toContain('status');
    expect(await errorsFor({}, UpdateMarktStatusDto)).toContain('status'); // Pflicht
  });

  it('Prioritaet: gueltig ok, ungueltig 400', async () => {
    expect(await errorsFor({ prioritaet: 'niedrig' }, UpdateMarktPrioritaetDto)).toHaveLength(0);
    expect(await errorsFor({ prioritaet: 'egal' }, UpdateMarktPrioritaetDto)).toContain('prioritaet');
    expect(await errorsFor({}, UpdateMarktPrioritaetDto)).toContain('prioritaet'); // Pflicht
  });
});
