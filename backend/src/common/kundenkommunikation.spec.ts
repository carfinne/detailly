import {
  BEWERTUNG_DEFAULTS,
  KUNDENKOMMUNIKATION_DEFAULTS,
  STUNDEN_VORLAUF_DEFAULT,
  STUNDEN_VORLAUF_MAX,
  STUNDEN_VORLAUF_MIN,
  mergeBewertung,
  mergeKundenkommunikation,
  resolveBewertung,
  resolveKundenkommunikation,
} from './kundenkommunikation';

describe('resolveKundenkommunikation', () => {
  it('fehlender/leerer Block -> Defaults (Erinnerung AUS, 24 h)', () => {
    expect(resolveKundenkommunikation(undefined)).toEqual(KUNDENKOMMUNIKATION_DEFAULTS);
    expect(resolveKundenkommunikation({})).toEqual({
      terminErinnerungAktiv: false,
      stundenVorlauf: STUNDEN_VORLAUF_DEFAULT,
    });
  });

  it('terminErinnerungAktiv nur bei echtem true', () => {
    expect(resolveKundenkommunikation({ terminErinnerungAktiv: true }).terminErinnerungAktiv).toBe(true);
    expect(resolveKundenkommunikation({ terminErinnerungAktiv: 'yes' }).terminErinnerungAktiv).toBe(false);
  });

  it('stundenVorlauf wird geklammert', () => {
    expect(resolveKundenkommunikation({ stundenVorlauf: 0 }).stundenVorlauf).toBe(STUNDEN_VORLAUF_MIN);
    expect(resolveKundenkommunikation({ stundenVorlauf: 9999 }).stundenVorlauf).toBe(STUNDEN_VORLAUF_MAX);
    expect(resolveKundenkommunikation({ stundenVorlauf: 48 }).stundenVorlauf).toBe(48);
    expect(resolveKundenkommunikation({ stundenVorlauf: 'x' }).stundenVorlauf).toBe(STUNDEN_VORLAUF_DEFAULT);
  });
});

describe('mergeKundenkommunikation', () => {
  it('Teil-Update laesst nicht angegebene Felder unveraendert', () => {
    const base = { terminErinnerungAktiv: true, stundenVorlauf: 48 };
    expect(mergeKundenkommunikation(base, { stundenVorlauf: 12 })).toEqual({
      terminErinnerungAktiv: true,
      stundenVorlauf: 12,
    });
    expect(mergeKundenkommunikation(base, {})).toEqual(base);
  });
});

describe('resolveBewertung', () => {
  it('fehlender Block -> Defaults (aus, leer)', () => {
    expect(resolveBewertung(undefined)).toEqual(BEWERTUNG_DEFAULTS);
  });

  it('nur sichere https-URLs werden akzeptiert', () => {
    expect(resolveBewertung({ googleUrl: 'https://g.page/x' }).googleUrl).toBe('https://g.page/x');
    expect(resolveBewertung({ googleUrl: 'http://g.page/x' }).googleUrl).toBe('');
    expect(resolveBewertung({ googleUrl: 'javascript:alert(1)' }).googleUrl).toBe('');
  });

  it('aktiv nur bei echtem true; Text getrimmt', () => {
    const r = resolveBewertung({ aktiv: true, text: '  Danke  ' });
    expect(r.aktiv).toBe(true);
    expect(r.text).toBe('Danke');
  });
});

describe('mergeBewertung', () => {
  it('unsichere URL im Patch wird verworfen', () => {
    const base = { aktiv: true, googleUrl: 'https://g.page/x', text: '' };
    expect(mergeBewertung(base, { googleUrl: 'ftp://boese' }).googleUrl).toBe('');
    expect(mergeBewertung(base, {}).googleUrl).toBe('https://g.page/x');
  });
});
