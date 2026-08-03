import {
  buildKopf,
  buildFuss,
  metaTabelle,
  sammlePflichtLines,
  logoDataUrl,
  DETAILLY_HINWEIS,
  PdfKopfTenant,
} from './pdf-theme';

/**
 * Unit-Tests fuer den gemeinsamen PDF-Gestaltungs-Baustein (Theme). Sichert die
 * Garantien ab, auf die sich ALLE fuenf Dokumente verlassen:
 *  - Kopf zeigt Logo ODER Firmenname (nie beides, nie "undefined"/leere Zeile),
 *  - Fuss traegt IMMER den dezenten Detailly-Hinweis + optionale Pflichtangaben,
 *  - Pflichtangaben-Sammler baut die richtigen Zeilen und faengt Luecken ab.
 */
const j = (o: unknown) => JSON.stringify(o);

describe('pdf-theme · buildKopf', () => {
  it('nutzt ein hinterlegtes PNG/JPEG-Logo (data:-URL) im Kopf statt des Namens', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQAY6r0uAAAAAElFTkSuQmCC';
    const kopf = buildKopf({ name: 'Glanzwerk GmbH', logoUrl: logo }, metaTabelle([['Auftrag', 'A-1']]));
    const s = j(kopf);
    expect(s).toContain('"image"');
    expect(s).toContain(logo);
    // Bei aktivem Logo wird der Firmenname NICHT zusaetzlich als Textkopf gesetzt.
    expect(s).not.toContain('"firmenname"');
  });

  it('faellt ohne (einbettbares) Logo auf den Firmennamen zurueck – WebP wird verworfen', () => {
    const webp = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    expect(logoDataUrl(webp)).toBeNull();
    const kopf = buildKopf({ name: 'Folienprofi', logoUrl: webp }, metaTabelle([['Auftrag', 'A-1']]));
    const s = j(kopf);
    expect(s).toContain('Folienprofi');
    expect(s).toContain('"firmenname"');
    expect(s).not.toContain('"image"');
  });

  it('ohne Tenant: neutraler Firmenname "Detailly" (kein Absturz, kein Loch)', () => {
    expect(j(buildKopf(null, metaTabelle([['Auftrag', 'A-1']])))).toContain('Detailly');
  });

  it('lueckenhafte Betriebsdaten erzeugen KEIN "undefined" und keine leere Zeile', () => {
    const tenant: PdfKopfTenant = { name: 'Nur Name' }; // keine Adresse/Kontakt
    const s = j(buildKopf(tenant, metaTabelle([['Auftrag', 'A-1']])));
    expect(s).not.toContain('undefined');
    expect(s).not.toContain('Tel. undefined');
  });
});

describe('pdf-theme · buildFuss', () => {
  it('traegt IMMER den dezenten Detailly-Hinweis (auch ohne Pflichtangaben)', () => {
    const fuss = buildFuss([])();
    expect(j(fuss)).toContain(DETAILLY_HINWEIS);
    // Ohne Pflichtangaben ist NUR der Detailly-Hinweis im Stack.
    const stack = (fuss as any).stack as unknown[];
    expect(stack).toHaveLength(1);
  });

  it('druckt Pflichtangaben (getrennt) UND darunter den Detailly-Hinweis', () => {
    const fuss = buildFuss(['Steuernummer: 12/345/67890', 'USt-IdNr.: DE123456789'])();
    const s = j(fuss);
    expect(s).toContain('Steuernummer: 12/345/67890');
    expect(s).toContain('USt-IdNr.: DE123456789');
    expect(s).toContain(DETAILLY_HINWEIS);
  });
});

describe('pdf-theme · sammlePflichtLines', () => {
  const gmbh: PdfKopfTenant = {
    name: 'Glanz GmbH',
    city: 'Berlin',
    settings: {
      steuernummer: '12/345/67890',
      ustId: 'DE123456789',
      iban: 'DE02120300000000202051',
      bic: 'BYLADEM1001',
      bankname: 'Musterbank',
      rechnungFusstext: 'Vielen Dank für Ihr Vertrauen.',
      steuer: {
        rechtsform: 'gmbh',
        registergericht: 'Amtsgericht Charlottenburg',
        registernummer: 'HRB 123456',
        vertretungsberechtigte: 'Max Mustermann',
      },
    },
  };

  it('Beleg-Fuss: Firmierung, Steuernummer, USt-IdNr., Bank und Fusstext (Reihenfolge stabil)', () => {
    const lines = sammlePflichtLines(gmbh, { steuer: true, bank: true, firmierung: true, fusstext: true });
    expect(lines[0]).toContain('GmbH');
    expect(lines[0]).toContain('Sitz: Berlin');
    expect(lines[0]).toContain('Amtsgericht Charlottenburg HRB 123456');
    expect(lines[0]).toContain('Vertretungsberechtigt: Max Mustermann');
    expect(lines).toContain('Steuernummer: 12/345/67890');
    expect(lines).toContain('USt-IdNr.: DE123456789');
    expect(lines.some((l) => l.startsWith('Bankverbindung:') && l.includes('IBAN DE02120300000000202051'))).toBe(true);
    expect(lines).toContain('Vielen Dank für Ihr Vertrauen.');
  });

  it('Kundendokument-Fuss: NUR Firmierung + Fusstext, KEINE Bank/Steuer', () => {
    const lines = sammlePflichtLines(gmbh, { firmierung: true, fusstext: true });
    expect(lines.some((l) => l.includes('GmbH'))).toBe(true);
    expect(lines).toContain('Vielen Dank für Ihr Vertrauen.');
    expect(lines.some((l) => l.startsWith('Bankverbindung:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Steuernummer:'))).toBe(false);
  });

  it('leere Stammdaten: leere Liste, kein "undefined"', () => {
    const lines = sammlePflichtLines({ name: 'Ohne' }, { steuer: true, bank: true, firmierung: true, fusstext: true });
    expect(lines).toHaveLength(0);
    expect(j(lines)).not.toContain('undefined');
  });
});
