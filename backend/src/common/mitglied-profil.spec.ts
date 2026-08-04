import {
  MITGLIED_KURZBESCHREIBUNG_MAX,
  MITGLIED_PROFIL_DEFAULTS,
  initialeAusName,
  mergeMitgliedProfil,
  resolveMitgliedProfil,
} from './mitglied-profil';

/**
 * Defensive Aufloesung + Teil-Update-Merge des Mitglieds-Profils
 * (settings.mitgliedProfil). Deckt den settings-Roundtrip ab: resolve(merge(...))
 * ist stabil, Defaults sind sicher (zeigen=false), Laengen werden gekappt und
 * unsichere Webseiten-Schemata verworfen.
 */
describe('mitglied-profil · resolve (defensiv)', () => {
  it('faellt fuer fehlenden/kaputten Block auf sichere Defaults (zeigen=false) zurueck', () => {
    expect(resolveMitgliedProfil(undefined)).toEqual(MITGLIED_PROFIL_DEFAULTS);
    expect(resolveMitgliedProfil(null)).toEqual(MITGLIED_PROFIL_DEFAULTS);
    expect(resolveMitgliedProfil('quatsch')).toEqual(MITGLIED_PROFIL_DEFAULTS);
    expect(resolveMitgliedProfil({}).zeigen).toBe(false);
  });

  it('liest gueltige Werte und trimmt/kappt Laengen', () => {
    const lang = 'x'.repeat(300);
    const r = resolveMitgliedProfil({
      zeigen: true,
      stadt: '  Berlin  ',
      kurzbeschreibung: lang,
      webseite: 'https://example.de',
    });
    expect(r.zeigen).toBe(true);
    expect(r.stadt).toBe('Berlin');
    expect(r.kurzbeschreibung).toHaveLength(MITGLIED_KURZBESCHREIBUNG_MAX);
    expect(r.webseite).toBe('https://example.de');
  });

  it('verwirft eine Webseite ohne sicheres http/https-Schema', () => {
    expect(resolveMitgliedProfil({ zeigen: true, webseite: 'javascript:alert(1)' }).webseite).toBe('');
    expect(resolveMitgliedProfil({ zeigen: true, webseite: 'ftp://x' }).webseite).toBe('');
    expect(resolveMitgliedProfil({ zeigen: true, webseite: 'example.de' }).webseite).toBe('');
    expect(resolveMitgliedProfil({ zeigen: true, webseite: 'http://ok.de' }).webseite).toBe('http://ok.de');
  });

  it('zeigen ist strikt boolean-true (kein truthy-Cast)', () => {
    expect(resolveMitgliedProfil({ zeigen: 'true' }).zeigen).toBe(false);
    expect(resolveMitgliedProfil({ zeigen: 1 }).zeigen).toBe(false);
  });
});

describe('mitglied-profil · merge (Teil-Update)', () => {
  const base = resolveMitgliedProfil({
    zeigen: true,
    stadt: 'Berlin',
    kurzbeschreibung: 'Kurz',
    webseite: 'https://a.de',
  });

  it('laesst nicht angegebene Felder unveraendert', () => {
    const merged = mergeMitgliedProfil(base, { stadt: 'Hamburg' });
    expect(merged).toEqual({ ...base, stadt: 'Hamburg' });
  });

  it('leerer String loescht das jeweilige Feld (Webseite/Stadt)', () => {
    const merged = mergeMitgliedProfil(base, { webseite: '', stadt: '' });
    expect(merged.webseite).toBe('');
    expect(merged.stadt).toBe('');
    expect(merged.zeigen).toBe(true); // unangetastet
  });

  it('kann Opt-in widerrufen (zeigen=false)', () => {
    expect(mergeMitgliedProfil(base, { zeigen: false }).zeigen).toBe(false);
  });

  it('verwirft ein unsicheres Webseiten-Schema beim Merge', () => {
    expect(mergeMitgliedProfil(base, { webseite: 'javascript:alert(1)' }).webseite).toBe('');
  });

  it('roundtrip: resolve(merge(...)) ist stabil', () => {
    const merged = mergeMitgliedProfil(base, { kurzbeschreibung: 'Neu', webseite: 'https://b.de' });
    expect(resolveMitgliedProfil(merged)).toEqual(merged);
  });
});

describe('mitglied-profil · Zustimmungs-Nachweis (zugestimmtAm)', () => {
  const NOW = '2026-07-24T10:00:00.000Z';

  it('setzt beim NEU-Aktivieren (false -> true) einen frischen Zeitstempel', () => {
    const base = resolveMitgliedProfil({ zeigen: false });
    const merged = mergeMitgliedProfil(base, { zeigen: true }, NOW);
    expect(merged.zeigen).toBe(true);
    expect(merged.zugestimmtAm).toBe(NOW);
  });

  it('laesst den Nachweis unveraendert, wenn das Opt-in aktiv BLEIBT (nur Feld-Aenderung)', () => {
    const base = resolveMitgliedProfil({ zeigen: true, zugestimmtAm: '2026-01-01T00:00:00.000Z' });
    const merged = mergeMitgliedProfil(base, { stadt: 'Hamburg' }, NOW);
    expect(merged.zugestimmtAm).toBe('2026-01-01T00:00:00.000Z'); // kein Backfill/Ueberschreiben
  });

  it('loescht den Nachweis beim Widerruf (zeigen=false -> null)', () => {
    const base = resolveMitgliedProfil({ zeigen: true, zugestimmtAm: '2026-01-01T00:00:00.000Z' });
    const merged = mergeMitgliedProfil(base, { zeigen: false }, NOW);
    expect(merged.zeigen).toBe(false);
    expect(merged.zugestimmtAm).toBeNull();
  });

  it('setzt beim Wieder-Aktivieren einen NEUEN Zeitstempel (frische Zustimmung)', () => {
    const aus = resolveMitgliedProfil({ zeigen: false, zugestimmtAm: '2020-01-01T00:00:00.000Z' });
    // resolve haelt zugestimmtAm bei zeigen=false schon auf null
    expect(aus.zugestimmtAm).toBeNull();
    const wieder = mergeMitgliedProfil(aus, { zeigen: true }, NOW);
    expect(wieder.zugestimmtAm).toBe(NOW);
  });

  it('resolve gibt zugestimmtAm NUR bei aktivem Opt-in zurueck (Nachweis == aktive Zustimmung)', () => {
    expect(resolveMitgliedProfil({ zeigen: true, zugestimmtAm: NOW }).zugestimmtAm).toBe(NOW);
    expect(resolveMitgliedProfil({ zeigen: false, zugestimmtAm: NOW }).zugestimmtAm).toBeNull();
    expect(resolveMitgliedProfil({ zeigen: true, zugestimmtAm: '   ' }).zugestimmtAm).toBeNull();
    expect(resolveMitgliedProfil({ zeigen: true, zugestimmtAm: 123 }).zugestimmtAm).toBeNull();
  });
});

/**
 * SEPARATE Kontaktdaten-Einwilligung (kontaktdatenZeigen + kontaktZugestimmtAm):
 * eigener, vom Karten-Opt-in UNABHAENGIGER Nachweis. Der Kern der DSGVO-Anforderung:
 * die Einwilligung darf NICHT gebuendelt werden – wer nur `zeigen` aktiviert, hat der
 * Kontaktdaten-Veroeffentlichung nicht zugestimmt (und umgekehrt).
 */
describe('mitglied-profil · Kontaktdaten-Einwilligung (getrennt von zeigen)', () => {
  const NOW = '2026-08-04T09:00:00.000Z';

  it('Default ist false + null (Bestandsbetrieb veroeffentlicht nie ungefragt Kontaktdaten)', () => {
    const r = resolveMitgliedProfil(undefined);
    expect(r.kontaktdatenZeigen).toBe(false);
    expect(r.kontaktZugestimmtAm).toBeNull();
    expect(MITGLIED_PROFIL_DEFAULTS.kontaktdatenZeigen).toBe(false);
    expect(MITGLIED_PROFIL_DEFAULTS.kontaktZugestimmtAm).toBeNull();
  });

  it('kontaktdatenZeigen ist strikt boolean-true (kein truthy-Cast)', () => {
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: 'true' }).kontaktdatenZeigen).toBe(false);
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: 1 }).kontaktdatenZeigen).toBe(false);
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: true }).kontaktdatenZeigen).toBe(true);
  });

  it('NICHT gebuendelt: Karten-Opt-in (zeigen) aktiviert NICHT die Kontaktdaten', () => {
    // zeigen=true, aber kein Kontaktdaten-Opt-in -> kontaktdatenZeigen bleibt false.
    const merged = mergeMitgliedProfil(resolveMitgliedProfil({}), { zeigen: true }, NOW);
    expect(merged.zeigen).toBe(true);
    expect(merged.kontaktdatenZeigen).toBe(false);
    expect(merged.kontaktZugestimmtAm).toBeNull();
  });

  it('setzt beim NEU-Aktivieren (false -> true) einen frischen, EIGENEN Zeitstempel', () => {
    const merged = mergeMitgliedProfil(resolveMitgliedProfil({}), { kontaktdatenZeigen: true }, NOW);
    expect(merged.kontaktdatenZeigen).toBe(true);
    expect(merged.kontaktZugestimmtAm).toBe(NOW);
  });

  it('Widerruf (kontaktdatenZeigen=false) setzt den Nachweis SOFORT auf null', () => {
    const base = resolveMitgliedProfil({ kontaktdatenZeigen: true, kontaktZugestimmtAm: '2026-01-01T00:00:00.000Z' });
    const merged = mergeMitgliedProfil(base, { kontaktdatenZeigen: false }, NOW);
    expect(merged.kontaktdatenZeigen).toBe(false);
    expect(merged.kontaktZugestimmtAm).toBeNull();
  });

  it('laesst den Kontakt-Nachweis unveraendert, wenn er aktiv BLEIBT (nur andere Feld-Aenderung)', () => {
    const base = resolveMitgliedProfil({ kontaktdatenZeigen: true, kontaktZugestimmtAm: '2026-01-01T00:00:00.000Z' });
    const merged = mergeMitgliedProfil(base, { stadt: 'Hamburg' }, NOW);
    expect(merged.kontaktZugestimmtAm).toBe('2026-01-01T00:00:00.000Z'); // kein Backfill/Ueberschreiben
  });

  it('die beiden Einwilligungen sind UNABHAENGIG: Kontakt-Widerruf laesst zeigen unberuehrt', () => {
    const base = resolveMitgliedProfil({
      zeigen: true,
      zugestimmtAm: '2026-01-01T00:00:00.000Z',
      kontaktdatenZeigen: true,
      kontaktZugestimmtAm: '2026-01-01T00:00:00.000Z',
    });
    const merged = mergeMitgliedProfil(base, { kontaktdatenZeigen: false }, NOW);
    expect(merged.zeigen).toBe(true); // Karten-Opt-in unberuehrt
    expect(merged.zugestimmtAm).toBe('2026-01-01T00:00:00.000Z');
    expect(merged.kontaktdatenZeigen).toBe(false); // nur die Kontaktdaten widerrufen
    expect(merged.kontaktZugestimmtAm).toBeNull();
  });

  it('resolve gibt kontaktZugestimmtAm NUR bei aktivem Kontakt-Opt-in zurueck', () => {
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: true, kontaktZugestimmtAm: NOW }).kontaktZugestimmtAm).toBe(NOW);
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: false, kontaktZugestimmtAm: NOW }).kontaktZugestimmtAm).toBeNull();
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: true, kontaktZugestimmtAm: '   ' }).kontaktZugestimmtAm).toBeNull();
    expect(resolveMitgliedProfil({ kontaktdatenZeigen: true, kontaktZugestimmtAm: 123 }).kontaktZugestimmtAm).toBeNull();
  });

  it('roundtrip: resolve(merge(...)) ist auch mit Kontakt-Opt-in stabil', () => {
    const base = resolveMitgliedProfil({ zeigen: true });
    const merged = mergeMitgliedProfil(base, { kontaktdatenZeigen: true }, NOW);
    expect(resolveMitgliedProfil(merged)).toEqual(merged);
  });
});

describe('mitglied-profil · initialeAusName', () => {
  it('bildet 1–2 Buchstaben aus den ersten Woertern', () => {
    expect(initialeAusName('Glanzwerk Aufbereitung')).toBe('GA');
    expect(initialeAusName('FolienMeister')).toBe('F');
    expect(initialeAusName('  a b c ')).toBe('AB');
  });

  it('faellt bei leerem/kaputtem Namen auf ein Zeichen zurueck', () => {
    expect(initialeAusName('')).toBe('•');
    expect(initialeAusName('   ')).toBe('•');
  });
});
