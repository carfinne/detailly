import { Betriebstyp } from '../tenants/entities/tenant.entity';
import {
  stadtZuSlug,
  isValidCitySlug,
  isValidGewerk,
  gewerkeFuerBetrieb,
  gewerkKategorieLabelDe,
  ortGruppeKey,
  ortsPageCanonicalUrl,
  GEWERK_KATEGORIEN,
  CITY_SLUG_MAX_LENGTH,
} from './orts-slug';

describe('stadtZuSlug (Ort-Kanonisierung)', () => {
  it('faltet Gross/Klein/Leerzeichen auf DENSELBEN Slug', () => {
    expect(stadtZuSlug('Regensburg')).toBe('regensburg');
    expect(stadtZuSlug('regensburg')).toBe('regensburg');
    expect(stadtZuSlug('Regensburg ')).toBe('regensburg');
    expect(stadtZuSlug('  REGENSBURG  ')).toBe('regensburg');
  });

  it('faltet deutsche Umlaute/ß (ae/oe/ue/ss)', () => {
    expect(stadtZuSlug('München')).toBe('muenchen');
    expect(stadtZuSlug('Örebro')).toBe('oerebro');
    expect(stadtZuSlug('Grüße')).toBe('gruesse');
    expect(stadtZuSlug('Aßlar')).toBe('asslar');
  });

  it('ersetzt Sonderzeichen/Trenner durch EINEN Bindestrich und trimmt Raender', () => {
    expect(stadtZuSlug('Frankfurt am Main')).toBe('frankfurt-am-main');
    expect(stadtZuSlug('Sankt   Wendel')).toBe('sankt-wendel');
    expect(stadtZuSlug('Halle (Saale)')).toBe('halle-saale');
    expect(stadtZuSlug('--Berlin--')).toBe('berlin');
    expect(stadtZuSlug('Bad Zwischenahn / Ammerland')).toBe('bad-zwischenahn-ammerland');
  });

  it('liefert null fuer leere/unbrauchbare Eingaben (kein Fehler)', () => {
    expect(stadtZuSlug('')).toBeNull();
    expect(stadtZuSlug('   ')).toBeNull();
    expect(stadtZuSlug('!!!')).toBeNull();
    expect(stadtZuSlug('()/&%')).toBeNull();
    expect(stadtZuSlug(null)).toBeNull();
    expect(stadtZuSlug(undefined)).toBeNull();
  });

  it('behaelt reine Ziffern (gueltiger Slug)', () => {
    expect(stadtZuSlug('12345')).toBe('12345');
  });

  it('INVARIANTE: ein Nicht-null-Ergebnis erfuellt IMMER isValidCitySlug', () => {
    const eingaben = ['Regensburg', 'Frankfurt am Main', 'München', 'a'.repeat(200), '  x  ', 'Halle (Saale)'];
    for (const e of eingaben) {
      const slug = stadtZuSlug(e);
      if (slug !== null) expect(isValidCitySlug(slug)).toBe(true);
    }
  });

  it('kappt uebermaessig lange Eingaben auf die Maximallaenge (weiter gueltig)', () => {
    const slug = stadtZuSlug('a'.repeat(500));
    expect(slug).not.toBeNull();
    expect((slug as string).length).toBeLessThanOrEqual(CITY_SLUG_MAX_LENGTH);
    expect(isValidCitySlug(slug as string)).toBe(true);
  });
});

describe('isValidCitySlug', () => {
  it('akzeptiert klein-alphanumerisch + Bindestrich (1–80)', () => {
    expect(isValidCitySlug('regensburg')).toBe(true);
    expect(isValidCitySlug('frankfurt-am-main')).toBe(true);
    expect(isValidCitySlug('a')).toBe(true);
    expect(isValidCitySlug('a'.repeat(80))).toBe(true);
  });
  it('lehnt Traversal/Grossbuchstaben/Sonderzeichen/zu lang/leer ab', () => {
    expect(isValidCitySlug('../etc')).toBe(false);
    expect(isValidCitySlug('Berlin')).toBe(false);
    expect(isValidCitySlug('a b')).toBe(false);
    expect(isValidCitySlug('a_b')).toBe(false);
    expect(isValidCitySlug('a'.repeat(81))).toBe(false);
    expect(isValidCitySlug('')).toBe(false);
    expect(isValidCitySlug(null)).toBe(false);
  });
});

describe('isValidGewerk (feste Whitelist)', () => {
  it('akzeptiert nur die drei Gewerk-Kategorien', () => {
    expect(isValidGewerk('aufbereitung')).toBe(true);
    expect(isValidGewerk('folierung')).toBe(true);
    expect(isValidGewerk('ppf')).toBe(true);
  });
  it('lehnt komplett + Unbekanntes ab', () => {
    expect(isValidGewerk('komplett')).toBe(false);
    expect(isValidGewerk('lackierung')).toBe(false);
    expect(isValidGewerk('AUFBEREITUNG')).toBe(false);
    expect(isValidGewerk('')).toBe(false);
    expect(isValidGewerk(null)).toBe(false);
  });
  it('GEWERK_KATEGORIEN enthaelt genau die drei Werte', () => {
    expect([...GEWERK_KATEGORIEN]).toEqual(['aufbereitung', 'folierung', 'ppf']);
  });
});

describe('gewerkeFuerBetrieb (betriebstyp -> Gewerk-Seiten)', () => {
  it('mappt die drei Spezial-Typen 1:1', () => {
    expect(gewerkeFuerBetrieb(Betriebstyp.AUFBEREITUNG)).toEqual(['aufbereitung']);
    expect(gewerkeFuerBetrieb(Betriebstyp.FOLIERUNG)).toEqual(['folierung']);
    expect(gewerkeFuerBetrieb(Betriebstyp.PPF)).toEqual(['ppf']);
  });
  it('KOMPLETT deckt ALLE drei Gewerke ab', () => {
    expect(gewerkeFuerBetrieb(Betriebstyp.KOMPLETT)).toEqual(['aufbereitung', 'folierung', 'ppf']);
  });
});

describe('gewerkKategorieLabelDe', () => {
  it('liefert die deutschen Labels', () => {
    expect(gewerkKategorieLabelDe('aufbereitung')).toBe('Fahrzeugaufbereitung');
    expect(gewerkKategorieLabelDe('folierung')).toBe('Folierung');
    expect(gewerkKategorieLabelDe('ppf')).toBe('PPF / Lackschutz');
  });
});

describe('ortGruppeKey / ortsPageCanonicalUrl', () => {
  it('baut einen stabilen Gruppen-Schluessel', () => {
    expect(ortGruppeKey('folierung', 'regensburg')).toBe('folierung|regensburg');
  });
  it('baut die kanonische Orts-URL mit /betriebe/-Praefix und Slash', () => {
    expect(ortsPageCanonicalUrl('https://x.de', 'folierung', 'regensburg')).toBe(
      'https://x.de/betriebe/folierung/regensburg/',
    );
  });
});
