import { buildInvoiceDocDef, PdfInvoice, PdfTenant } from './invoice-pdf';

/**
 * §14-UStG-Pflichtangaben (Steuernummer/USt-IdNr) + Bankverbindung muessen aus
 * den Tenant-Stammdaten (tenant.settings) in die PDF-Fusszeile gelangen. Diese
 * Tests sichern genau diese Verdrahtung ab (reiner Build, kein pdfmake-Render).
 */
const baseInvoice: PdfInvoice = {
  nummer: 'RE-2026-0001',
  art: 'rechnung',
  netto: 100,
  mwst: 19,
  brutto: 119,
  items: [{ beschreibung: 'Leistung', menge: 1, einzelpreis: 100, gesamtpreis: 100 }],
};

/** Holt die zusammengesetzte Fusszeile (footer ist eine pdfmake-Funktion). */
function footerText(doc: Record<string, unknown>): string | undefined {
  const fn = doc.footer as undefined | (() => { text?: string } | undefined);
  const res = fn?.();
  return res?.text;
}

describe('Rechnungs-PDF · §14-Aussteller-Fusszeile', () => {
  it('druckt Steuernummer, USt-IdNr und Bankverbindung aus den Stammdaten', () => {
    const tenant: PdfTenant = {
      name: 'Muster Aufbereitung',
      settings: {
        steuernummer: '12/345/67890',
        ustId: 'DE123456789',
        iban: 'DE02120300000000202051',
        bic: 'BYLADEM1001',
        bankname: 'Musterbank',
      },
    };
    const text = footerText(buildInvoiceDocDef(baseInvoice, null, tenant)) ?? '';
    expect(text).toContain('Steuernummer: 12/345/67890');
    expect(text).toContain('USt-IdNr.: DE123456789');
    expect(text).toContain('IBAN DE02120300000000202051');
    expect(text).toContain('BIC BYLADEM1001');
    expect(text).toContain('Musterbank');
  });

  it('laesst die Fusszeile ohne gepflegte Stammdaten weg (undefined)', () => {
    const tenant: PdfTenant = { name: 'Ohne Stammdaten' };
    expect(footerText(buildInvoiceDocDef(baseInvoice, null, tenant))).toBeUndefined();
  });

  it('druckt beim Angebot KEINE Bankverbindung, aber die Steuerangaben', () => {
    const tenant: PdfTenant = {
      name: 'Muster',
      settings: { steuernummer: '12/345/67890', iban: 'DE02120300000000202051', bankname: 'Musterbank' },
    };
    const angebot: PdfInvoice = { ...baseInvoice, art: 'angebot', nummer: 'AN-2026-0001' };
    const text = footerText(buildInvoiceDocDef(angebot, null, tenant)) ?? '';
    expect(text).toContain('Steuernummer: 12/345/67890');
    expect(text).not.toContain('Bankverbindung');
    expect(text).not.toContain('IBAN');
  });
});

/** Verkettet alle Text-Bloecke des content-Arrays (fuer Inhaltspruefungen). */
function contentText(doc: Record<string, unknown>): string {
  return ((doc.content as Array<{ text?: unknown }>) ?? [])
    .map((c) => (typeof c.text === 'string' ? c.text : ''))
    .join(' ');
}

describe('Rechnungs-PDF · §19 Kleinunternehmer', () => {
  it('zeigt den §19-Hinweis bei 0% MwSt', () => {
    const klein: PdfInvoice = { ...baseInvoice, mwstSatz: 0, mwst: 0, brutto: 100 };
    expect(contentText(buildInvoiceDocDef(klein, null, { name: 'X' }))).toContain('Gemäß §19 UStG');
  });

  it('zeigt den §19-Hinweis NICHT bei 19% MwSt', () => {
    expect(contentText(buildInvoiceDocDef(baseInvoice, null, { name: 'X' }))).not.toContain('§19');
  });
});
