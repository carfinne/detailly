import {
  WIDERRUFSFRIST_TAGE,
  WIDERRUF_KARENZ_MS,
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

  it('Karenz verschiebt die Grenze nach unten (Grenzband nicht erzwungen)', () => {
    // Termin exakt 30 Min unter der 14-Tage-Grenze: ohne Karenz "innerhalb",
    // mit 60-Min-Karenz "außerhalb" (Server erzwingt die Zustimmung dann NICHT).
    const knappUnterGrenze = new Date(
      jetzt.getTime() + WIDERRUFSFRIST_TAGE * 24 * 60 * 60 * 1000 - 30 * 60 * 1000,
    );
    expect(istInnerhalbWiderrufsfrist(knappUnterGrenze, jetzt)).toBe(true);
    expect(istInnerhalbWiderrufsfrist(knappUnterGrenze, jetzt, WIDERRUF_KARENZ_MS)).toBe(false);
    // Klar innerhalb (3 Tage) bleibt auch mit Karenz innerhalb.
    const dreiTage = new Date(jetzt.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(istInnerhalbWiderrufsfrist(dreiTage, jetzt, WIDERRUF_KARENZ_MS)).toBe(true);
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
