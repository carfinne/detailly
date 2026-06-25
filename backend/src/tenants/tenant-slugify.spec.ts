import { slugify } from './tenants.service';

/**
 * slugify wandelt den Betriebsnamen in den Basis-slug (Eindeutigkeit stellt
 * danach generateUniqueSlug per DB-Suffix sicher). Wichtig fuer einen sauberen,
 * URL-tauglichen, kollisionsarmen slug aus beliebiger Nutzereingabe.
 */
describe('slugify', () => {
  it('macht einfache Namen klein und bindestrich-getrennt', () => {
    expect(slugify('Schmidt Detailing')).toBe('schmidt-detailing');
  });

  it('schreibt deutsche Umlaute aus', () => {
    expect(slugify('Müller Fahrzeugpflege')).toBe('mueller-fahrzeugpflege');
    expect(slugify('Öko Auto')).toBe('oeko-auto');
    expect(slugify('Straße & Glanz')).toBe('strasse-glanz');
  });

  it('reduziert Sonderzeichen und kollabiert Trenner', () => {
    expect(slugify('A&O   Auto!!!Pflege')).toBe('a-o-auto-pflege');
  });

  it('entfernt fuehrende/abschliessende Bindestriche', () => {
    expect(slugify('  ***Glanz***  ')).toBe('glanz');
  });

  it('faellt bei rein nicht-lateinischer Eingabe auf "betrieb" zurueck', () => {
    expect(slugify('🚗✨')).toBe('betrieb');
    expect(slugify('   ')).toBe('betrieb');
    expect(slugify('!!!')).toBe('betrieb');
  });

  it('begrenzt die Laenge auf 40 Zeichen ohne Trailing-Bindestrich', () => {
    const lang = 'Auto '.repeat(20).trim(); // weit ueber 40 Zeichen
    const slug = slugify(lang);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.startsWith('auto-auto')).toBe(true);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('erzeugt nur erlaubte Zeichen [a-z0-9-]', () => {
    expect(slugify('Café №1 — Pörsche 911!')).toMatch(/^[a-z0-9-]+$/);
  });
});
