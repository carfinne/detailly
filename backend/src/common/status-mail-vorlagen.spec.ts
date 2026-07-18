import {
  STATUS_MAIL_BETREFF_MAX,
  STATUS_MAIL_TEXT_MAX,
  STATUS_MAIL_VORLAGEN_DEFAULTS,
  ersetzeStatusMailPlatzhalter,
  hatStatusMailVorlage,
  mergeStatusMailVorlagen,
  resolveStatusMailVorlagen,
} from './status-mail-vorlagen';

describe('resolveStatusMailVorlagen', () => {
  it('fehlender/leerer Block -> alle Vorlagen leer (= Default-Texte)', () => {
    expect(resolveStatusMailVorlagen(undefined)).toEqual(STATUS_MAIL_VORLAGEN_DEFAULTS);
    expect(resolveStatusMailVorlagen(null)).toEqual(STATUS_MAIL_VORLAGEN_DEFAULTS);
    expect(resolveStatusMailVorlagen({})).toEqual(STATUS_MAIL_VORLAGEN_DEFAULTS);
  });

  it('liest gepflegte Felder je Status', () => {
    const r = resolveStatusMailVorlagen({
      bestaetigt: { betreff: 'Hallo {betrieb}', text: 'Auftrag {auftragsnummer}' },
    });
    expect(r.bestaetigt).toEqual({ betreff: 'Hallo {betrieb}', text: 'Auftrag {auftragsnummer}' });
    expect(r.in_arbeit).toEqual({ betreff: '', text: '' });
    expect(r.abholbereit).toEqual({ betreff: '', text: '' });
  });

  it('kappt zu lange Betreff/Text-Werte (Backstop zur DTO-Pruefung)', () => {
    const r = resolveStatusMailVorlagen({
      in_arbeit: { betreff: 'x'.repeat(STATUS_MAIL_BETREFF_MAX + 50), text: 'y'.repeat(STATUS_MAIL_TEXT_MAX + 50) },
    });
    expect(r.in_arbeit.betreff).toHaveLength(STATUS_MAIL_BETREFF_MAX);
    expect(r.in_arbeit.text).toHaveLength(STATUS_MAIL_TEXT_MAX);
  });

  it('nicht-String-Werte -> leer (robust gegen Altbestand)', () => {
    const r = resolveStatusMailVorlagen({ bestaetigt: { betreff: 123, text: {} } });
    expect(r.bestaetigt).toEqual({ betreff: '', text: '' });
  });
});

describe('mergeStatusMailVorlagen', () => {
  it('Teil-Update laesst nicht angegebene Status/Felder unveraendert', () => {
    const base = resolveStatusMailVorlagen({
      bestaetigt: { betreff: 'B', text: 'T' },
      abholbereit: { betreff: 'AB', text: 'ABT' },
    });
    const merged = mergeStatusMailVorlagen(base, { bestaetigt: { text: 'NEU' } });
    expect(merged.bestaetigt).toEqual({ betreff: 'B', text: 'NEU' });
    expect(merged.abholbereit).toEqual({ betreff: 'AB', text: 'ABT' });
    expect(merged.in_arbeit).toEqual({ betreff: '', text: '' });
  });

  it('leerer String im Patch leert das Feld (zurueck auf Default-Text)', () => {
    const base = resolveStatusMailVorlagen({ in_arbeit: { betreff: 'B', text: 'T' } });
    const merged = mergeStatusMailVorlagen(base, { in_arbeit: { betreff: '', text: '' } });
    expect(merged.in_arbeit).toEqual({ betreff: '', text: '' });
  });
});

describe('ersetzeStatusMailPlatzhalter', () => {
  const werte = {
    auftragsnummer: 'AU-2026-0001',
    betrieb: 'Muster GmbH',
    fahrzeug: 'VW Golf',
    status: 'in Arbeit',
  };

  it('ersetzt alle unterstuetzten Platzhalter', () => {
    const out = ersetzeStatusMailPlatzhalter(
      'Auftrag {auftragsnummer} bei {betrieb} ({fahrzeug}) ist {status}.',
      werte,
    );
    expect(out).toBe('Auftrag AU-2026-0001 bei Muster GmbH (VW Golf) ist in Arbeit.');
  });

  it('Single-Pass: ein eingesetzter Wert wird NICHT erneut interpretiert', () => {
    const out = ersetzeStatusMailPlatzhalter('{betrieb} - {fahrzeug}', {
      ...werte,
      betrieb: '{fahrzeug}',
    });
    // {betrieb} -> "{fahrzeug}" (bleibt stehen), {fahrzeug} -> "VW Golf"
    expect(out).toBe('{fahrzeug} - VW Golf');
  });

  it('unbekannte {…}-Tokens bleiben unveraendert', () => {
    expect(ersetzeStatusMailPlatzhalter('Hallo {unbekannt}', werte)).toBe('Hallo {unbekannt}');
  });
});

describe('hatStatusMailVorlage', () => {
  it('true bei gepflegtem Betreff ODER Text; false bei leer/whitespace', () => {
    expect(hatStatusMailVorlage({ betreff: 'x', text: '' })).toBe(true);
    expect(hatStatusMailVorlage({ betreff: '', text: 'y' })).toBe(true);
    expect(hatStatusMailVorlage({ betreff: '', text: '' })).toBe(false);
    expect(hatStatusMailVorlage({ betreff: '   ', text: '  ' })).toBe(false);
  });
});
