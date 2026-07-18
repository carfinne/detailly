import {
  WIDERRUFSFRIST_TAGE,
  baueMusterWiderrufsformular,
  baueWiderrufsbelehrung,
  betriebAnschriftZeile,
  istInnerhalbWiderrufsfrist,
  type WiderrufBetrieb,
} from './widerruf';

const betrieb: WiderrufBetrieb = {
  name: 'Muster Aufbereitung',
  strasse: 'Werkstraße 1',
  plzOrt: '10115 Berlin',
  land: 'Deutschland',
  telefon: '030 12345',
  email: 'info@muster.de',
};

describe('istInnerhalbWiderrufsfrist', () => {
  const jetzt = new Date('2026-07-18T10:00:00.000Z');

  it('Frist beträgt 14 Tage', () => {
    expect(WIDERRUFSFRIST_TAGE).toBe(14);
  });

  it('Termin in 3 Tagen -> innerhalb der Frist', () => {
    const termin = new Date(jetzt.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(istInnerhalbWiderrufsfrist(termin, jetzt)).toBe(true);
  });

  it('Termin in 30 Tagen -> außerhalb der Frist', () => {
    const termin = new Date(jetzt.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(istInnerhalbWiderrufsfrist(termin, jetzt)).toBe(false);
  });

  it('ohne Termin -> false (Betrieb terminiert später)', () => {
    expect(istInnerhalbWiderrufsfrist(undefined, jetzt)).toBe(false);
    expect(istInnerhalbWiderrufsfrist(null, jetzt)).toBe(false);
  });

  it('ungültiges Datum -> false', () => {
    expect(istInnerhalbWiderrufsfrist(new Date('nonsense'), jetzt)).toBe(false);
  });
});

describe('baueWiderrufsbelehrung / Muster-Formular', () => {
  it('Belehrung enthält 14-Tage-Frist und die Betriebs-Kontaktdaten', () => {
    const text = baueWiderrufsbelehrung(betrieb).join('\n');
    expect(text).toContain('Widerrufsbelehrung');
    expect(text).toContain('vierzehn Tagen');
    expect(text).toContain('Muster Aufbereitung');
    expect(text).toContain('info@muster.de');
  });

  it('Muster-Formular adressiert den Betrieb als Empfänger', () => {
    const text = baueMusterWiderrufsformular(betrieb).join('\n');
    expect(text).toContain('Muster-Widerrufsformular');
    expect(text).toContain('An: ');
    expect(text).toContain('Muster Aufbereitung');
    expect(text).toContain('10115 Berlin');
  });

  it('betriebAnschriftZeile lässt leere Teile aus', () => {
    const zeile = betriebAnschriftZeile({ ...betrieb, land: '', telefon: '' });
    expect(zeile).toBe('Muster Aufbereitung, Werkstraße 1, 10115 Berlin');
  });
});
