import {
  berlinDatumDe,
  berlinMonatsGrenzen,
  berlinTagesGrenzen,
  berlinYMDvonInstant,
  berlinYMDvonString,
} from './kassenbuch-zeit';

/**
 * Zeitzonen-Helfer (Europe/Berlin) – DST-sicher, maschinen-TZ-unabhaengig.
 * Wichtig, weil Prod auf UTC laeuft und Mitternachts-Buchungen sonst in den
 * falschen Tag/Monat fielen.
 */
describe('kassenbuch-zeit', () => {
  describe('berlinYMDvonString', () => {
    it('parst gueltiges YYYY-MM-DD', () => {
      expect(berlinYMDvonString('2026-07-18')).toEqual({ y: 2026, m: 7, day: 18 });
    });
    it('lehnt ungueltige Formate/Daten ab', () => {
      expect(berlinYMDvonString('18.07.2026')).toBeNull();
      expect(berlinYMDvonString('2026-13-01')).toBeNull();
      expect(berlinYMDvonString('kaputt')).toBeNull();
    });
  });

  describe('berlinTagesGrenzen (Sommerzeit, UTC+2)', () => {
    it('Berliner Tag 2026-07-18 = [2026-07-17T22:00Z, 2026-07-18T21:59:59.999Z]', () => {
      const { von, bis } = berlinTagesGrenzen({ y: 2026, m: 7, day: 18 });
      expect(von.toISOString()).toBe('2026-07-17T22:00:00.000Z');
      expect(bis.toISOString()).toBe('2026-07-18T21:59:59.999Z');
    });
  });

  describe('berlinTagesGrenzen (Winterzeit, UTC+1)', () => {
    it('Berliner Tag 2026-01-15 = [2026-01-14T23:00Z, 2026-01-15T22:59:59.999Z]', () => {
      const { von, bis } = berlinTagesGrenzen({ y: 2026, m: 1, day: 15 });
      expect(von.toISOString()).toBe('2026-01-14T23:00:00.000Z');
      expect(bis.toISOString()).toBe('2026-01-15T22:59:59.999Z');
    });
  });

  describe('berlinMonatsGrenzen', () => {
    it('Juli 2026 = [2026-06-30T22:00Z, 2026-07-31T21:59:59.999Z]', () => {
      const { von, bis } = berlinMonatsGrenzen({ y: 2026, m: 7, day: 18 });
      expect(von.toISOString()).toBe('2026-06-30T22:00:00.000Z');
      expect(bis.toISOString()).toBe('2026-07-31T21:59:59.999Z');
    });
    it('Dezember rollt sauber ins Folgejahr', () => {
      const { von, bis } = berlinMonatsGrenzen({ y: 2026, m: 12, day: 1 });
      expect(von.toISOString()).toBe('2026-11-30T23:00:00.000Z');
      expect(bis.toISOString()).toBe('2026-12-31T22:59:59.999Z');
    });
  });

  describe('berlinYMDvonInstant', () => {
    it('ordnet 00:30 Berlin dem richtigen Kalendertag zu', () => {
      // 2026-07-17 22:30 UTC = 2026-07-18 00:30 Berlin.
      expect(berlinYMDvonInstant(new Date('2026-07-17T22:30:00Z'))).toEqual({ y: 2026, m: 7, day: 18 });
    });
  });

  describe('berlinDatumDe', () => {
    it('formatiert einen UTC-Instant als Berliner Kalenderdatum', () => {
      // 2026-07-18 22:30 UTC = 2026-07-19 00:30 Berlin.
      expect(berlinDatumDe(new Date('2026-07-18T22:30:00Z'))).toBe('19.07.2026');
    });
    it('leerer Wert -> leerer String', () => {
      expect(berlinDatumDe(null)).toBe('');
    });
  });
});
