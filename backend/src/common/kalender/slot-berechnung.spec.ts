import { KALENDER_DEFAULTS, KalenderConfig, defaultArbeitszeiten } from './kalender-config';
import { BUCHUNG_DEFAULTS, BuchungConfig, mergeBuchung, resolveBuchung } from './buchung-config';
import {
  BelegtZeitraum,
  berechneFreieSlots,
  istSlotModusAktiv,
  parseDatumStrikt,
} from './slot-berechnung';

/**
 * Slot-Berechnung des Buchungsportals (Kalender 2.0 W2): Raster, Puffer,
 * Vorlauf min/max, betriebsweite Belegung, inaktiver Tag, striktes Datums-
 * Parsing und Portal-Modus-Erkennung. Reine Unit-Tests (pure Funktionen).
 *
 * Fixtures: Mi 2026-07-15 ist ein Mittwoch; "jetzt" liegt weit davor, damit
 * der Mindest-Vorlauf die Slots nicht beruehrt, wo er nicht getestet wird.
 */

const JETZT = new Date(2026, 6, 13, 12, 0, 0); // Mo 13.07.2026 12:00 lokal
const MITTWOCH = { jahr: 2026, monat: 7, tag: 15 };

function kal(over: Partial<KalenderConfig> = {}): KalenderConfig {
  return { ...KALENDER_DEFAULTS, arbeitszeiten: defaultArbeitszeiten(), ...over };
}

function buch(over: Partial<BuchungConfig> = {}): BuchungConfig {
  return { ...BUCHUNG_DEFAULTS, ...over };
}

function belegt(vonH: number, vonM: number, bisH: number, bisM: number): BelegtZeitraum {
  return {
    start: new Date(2026, 6, 15, vonH, vonM, 0),
    ende: new Date(2026, 6, 15, bisH, bisM, 0),
  };
}

describe('parseDatumStrikt', () => {
  it('akzeptiert nur exakt YYYY-MM-DD', () => {
    expect(parseDatumStrikt('2026-07-15')).toEqual({ jahr: 2026, monat: 7, tag: 15 });
  });

  it.each([
    '',
    'morgen',
    '15.07.2026',
    '2026-7-15',
    '2026-07-15T09:00',
    '2026-13-01', // Monat 13
    '2026-02-31', // kein realer Tag
    "2026-07-15' OR 1=1",
  ])('lehnt Format-Muell "%s" ab (null)', (bad) => {
    expect(parseDatumStrikt(bad)).toBeNull();
  });
});

describe('istSlotModusAktiv (Portal-Modus, CEO-Entscheidung W2)', () => {
  it('AUS ohne settings.kalender (Defaults zaehlen NICHT als gepflegt)', () => {
    expect(istSlotModusAktiv(undefined)).toBe(false);
    expect(istSlotModusAktiv({})).toBe(false);
    expect(istSlotModusAktiv({ slotDauerMin: 15 })).toBe(false);
  });

  it('AN, sobald arbeitszeiten gespeichert sind und mind. 1 Tag aktiv ist', () => {
    expect(
      istSlotModusAktiv({ arbeitszeiten: { mo: { von: '08:00', bis: '18:00', aktiv: true } } }),
    ).toBe(true);
  });

  it('AUS, wenn arbeitszeiten gespeichert, aber ALLE Tage inaktiv sind', () => {
    const alleAus: Record<string, unknown> = {};
    for (const t of ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']) {
      alleAus[t] = { von: '08:00', bis: '18:00', aktiv: false };
    }
    expect(istSlotModusAktiv({ arbeitszeiten: alleAus })).toBe(false);
  });
});

describe('berechneFreieSlots · Raster', () => {
  it('rastert die aktive Arbeitszeit in slotDauerMin-Schritten (voll passend)', () => {
    const k = kal({ slotDauerMin: 120 });
    k.arbeitszeiten.mi = { von: '09:00', bis: '14:00', aktiv: true };
    // 09-11, 11-13 passen; 13-15 ragt ueber 14:00 hinaus -> weg.
    expect(berechneFreieSlots(MITTWOCH, k, buch(), [], JETZT)).toEqual(['09:00', '11:00']);
  });

  it('Default-Konfiguration: Mo-Fr 08-18 im 30-min-Raster (20 Slots)', () => {
    const slots = berechneFreieSlots(MITTWOCH, kal(), buch(), [], JETZT);
    expect(slots).toHaveLength(20);
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('17:30');
  });

  it('inaktiver Wochentag liefert keine Slots', () => {
    // 2026-07-19 ist ein Sonntag (Default: inaktiv).
    expect(
      berechneFreieSlots({ jahr: 2026, monat: 7, tag: 19 }, kal(), buch(), [], JETZT),
    ).toEqual([]);
  });

  it('defensiv: bis <= von liefert keine Slots', () => {
    const k = kal();
    k.arbeitszeiten.mi = { von: '18:00', bis: '08:00', aktiv: true };
    expect(berechneFreieSlots(MITTWOCH, k, buch(), [], JETZT)).toEqual([]);
  });
});

describe('berechneFreieSlots · Belegung (betriebsweit) + Puffer', () => {
  it('entfernt Slots, die einen belegten Zeitraum schneiden', () => {
    const k = kal({ slotDauerMin: 60 });
    k.arbeitszeiten.mi = { von: '08:00', bis: '12:00', aktiv: true };
    // Termin 09:30-10:30 blockt die Slots 09:00 und 10:00.
    const slots = berechneFreieSlots(MITTWOCH, k, buch(), [belegt(9, 30, 10, 30)], JETZT);
    expect(slots).toEqual(['08:00', '11:00']);
  });

  it('Randberuehrung ohne Puffer blockt NICHT (Termin endet exakt am Slot-Start)', () => {
    const k = kal({ slotDauerMin: 60 });
    k.arbeitszeiten.mi = { von: '08:00', bis: '11:00', aktiv: true };
    const slots = berechneFreieSlots(MITTWOCH, k, buch(), [belegt(8, 0, 9, 0)], JETZT);
    expect(slots).toEqual(['09:00', '10:00']);
  });

  it('Puffer wirkt beidseitig um den belegten Termin', () => {
    const k = kal({ slotDauerMin: 60, pufferMin: 30 });
    k.arbeitszeiten.mi = { von: '08:00', bis: '14:00', aktiv: true };
    // Termin 10:00-11:00 + 30 min Puffer belegt effektiv 09:30-11:30:
    // blockt 09:00-10:00 (ragt in 09:30+) und 11:00-12:00 (beginnt vor 11:30).
    const slots = berechneFreieSlots(MITTWOCH, k, buch(), [belegt(10, 0, 11, 0)], JETZT);
    expect(slots).toEqual(['08:00', '12:00', '13:00']);
  });
});

describe('berechneFreieSlots · Vorlauf', () => {
  it('Mindest-Vorlauf filtert fruehe Slots am Stichtag weg', () => {
    const k = kal({ slotDauerMin: 60 });
    k.arbeitszeiten.mi = { von: '08:00', bis: '12:00', aktiv: true };
    // jetzt = Mi 15.07. 07:30, Vorlauf 2h -> fruehestens 09:30 -> 10:00 + 11:00.
    const jetzt = new Date(2026, 6, 15, 7, 30, 0);
    const slots = berechneFreieSlots(MITTWOCH, k, buch({ vorlaufMinStunden: 2 }), [], jetzt);
    expect(slots).toEqual(['10:00', '11:00']);
  });

  it('Vergangenheit ist nie buchbar (auch bei Vorlauf 0)', () => {
    const k = kal({ slotDauerMin: 60 });
    k.arbeitszeiten.mi = { von: '08:00', bis: '12:00', aktiv: true };
    const jetzt = new Date(2026, 6, 15, 10, 0, 0);
    const slots = berechneFreieSlots(MITTWOCH, k, buch({ vorlaufMinStunden: 0 }), [], jetzt);
    expect(slots).toEqual(['10:00', '11:00']);
  });

  it('maximaler Vorlauf (Tage) blendet zu ferne Tage aus', () => {
    // Mi 15.07. liegt 2 Tage nach "jetzt" (Mo 13.07.) -> max 1 Tag => leer.
    expect(berechneFreieSlots(MITTWOCH, kal(), buch({ vorlaufMaxTage: 1 }), [], JETZT)).toEqual([]);
  });
});

describe('resolveBuchung / mergeBuchung', () => {
  it('Defaults bei fehlendem/kaputtem Rohwert (24 h / 60 Tage)', () => {
    expect(resolveBuchung(undefined)).toEqual({ vorlaufMinStunden: 24, vorlaufMaxTage: 60 });
    expect(resolveBuchung('quatsch')).toEqual({ vorlaufMinStunden: 24, vorlaufMaxTage: 60 });
    expect(resolveBuchung({ vorlaufMinStunden: 'x', vorlaufMaxTage: null })).toEqual({
      vorlaufMinStunden: 24,
      vorlaufMaxTage: 60,
    });
  });

  it('klammert Ausreisser in die plausiblen Grenzen', () => {
    expect(resolveBuchung({ vorlaufMinStunden: -5, vorlaufMaxTage: 9999 })).toEqual({
      vorlaufMinStunden: 0,
      vorlaufMaxTage: 365,
    });
  });

  it('merge ist ein echtes Teil-Update', () => {
    const merged = mergeBuchung({ vorlaufMinStunden: 24, vorlaufMaxTage: 60 }, { vorlaufMaxTage: 14 });
    expect(merged).toEqual({ vorlaufMinStunden: 24, vorlaufMaxTage: 14 });
  });
});
