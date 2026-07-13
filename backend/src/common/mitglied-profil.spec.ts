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
