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

/** Verkettet die Summen-Label-Zellen des Beleg-Summenblocks (letzte content-Spalte). */
function summenText(doc: Record<string, unknown>): string {
  const content = (doc.content as Array<Record<string, unknown>>) ?? [];
  const zusammen: string[] = [];
  const sammle = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(sammle);
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (typeof o.text === 'string') zusammen.push(o.text);
      for (const v of Object.values(o)) if (typeof v === 'object') sammle(v);
    }
  };
  content.forEach(sammle);
  return zusammen.join(' ');
}

describe('Rechnungs-PDF · §19 Kleinunternehmer', () => {
  // §19-Tenant: Kleinunternehmer-Flag + (Default-)Hinweistext in settings.steuer.
  const kleinTenant: PdfTenant = { name: 'X', settings: { steuer: { kleinunternehmer: true } } };
  const kleinInvoice: PdfInvoice = { ...baseInvoice, mwstSatz: 0, mwst: 0, brutto: 100 };

  it('zeigt den §19-Befreiungshinweis (Default-Text) bei §19 + 0% MwSt', () => {
    const text = contentText(buildInvoiceDocDef(kleinInvoice, null, kleinTenant));
    expect(text).toContain('Kleinunternehmer gemäß § 19 UStG');
  });

  it('nutzt einen individuell gepflegten Hinweistext aus den Einstellungen', () => {
    const tenant: PdfTenant = {
      name: 'X',
      settings: { steuer: { kleinunternehmer: true, kleinunternehmerHinweis: 'Eigener §19-Text.' } },
    };
    expect(contentText(buildInvoiceDocDef(kleinInvoice, null, tenant))).toContain('Eigener §19-Text.');
  });

  it('laesst bei §19 die MwSt-Zeile im Summenblock WEG (nicht "zzgl. 0 %")', () => {
    const text = summenText(buildInvoiceDocDef(kleinInvoice, null, kleinTenant));
    expect(text).not.toContain('MwSt');
    expect(text).toContain('Zwischensumme netto');
    expect(text).toContain('Gesamtbetrag');
  });

  it('zeigt den §19-Hinweis NICHT bei 19% MwSt (Regelbesteuerung)', () => {
    expect(contentText(buildInvoiceDocDef(baseInvoice, null, { name: 'X' }))).not.toContain('§ 19');
  });

  it('zeigt bei 0% OHNE §19-Flag KEINEN §19-Hinweis, aber weiterhin die MwSt-Zeile', () => {
    // Regulaerer 0%-Beleg (z. B. innergem. Lieferung): kein Kleinunternehmer-Flag.
    const doc = buildInvoiceDocDef(kleinInvoice, null, { name: 'X' });
    expect(contentText(doc)).not.toContain('§ 19');
    expect(summenText(doc)).toContain('MwSt');
  });
});

describe('Rechnungs-PDF · Firmierung/Rechtsform-Fusszeile', () => {
  it('druckt bei UG/GmbH Rechtsform, Sitz, Registergericht/HRB und Vertretung', () => {
    const tenant: PdfTenant = {
      name: 'Glanz GmbH',
      city: 'Berlin',
      settings: {
        steuernummer: '12/345/67890',
        steuer: {
          rechtsform: 'gmbh',
          registergericht: 'Amtsgericht Charlottenburg',
          registernummer: 'HRB 123456',
          vertretungsberechtigte: 'Max Mustermann',
        },
      },
    };
    const text = footerText(buildInvoiceDocDef(baseInvoice, null, tenant)) ?? '';
    expect(text).toContain('GmbH');
    expect(text).toContain('Sitz: Berlin');
    expect(text).toContain('Amtsgericht Charlottenburg HRB 123456');
    expect(text).toContain('Vertretungsberechtigt: Max Mustermann');
  });

  it('druckt bei UG/GmbH auch bei fehlender Registerangabe, was da ist (keine Blockade)', () => {
    const tenant: PdfTenant = {
      name: 'Jung UG',
      city: 'Köln',
      settings: { steuernummer: '9/9/9', steuer: { rechtsform: 'ug' } },
    };
    const text = footerText(buildInvoiceDocDef(baseInvoice, null, tenant)) ?? '';
    expect(text).toContain('UG (haftungsbeschränkt)');
    expect(text).toContain('Sitz: Köln');
  });

  it('druckt bei Einzelunternehmen den Inhaber (falls gepflegt)', () => {
    const tenant: PdfTenant = {
      name: 'Detail Max',
      settings: {
        steuernummer: '1/2/3',
        steuer: { rechtsform: 'einzelunternehmen', vertretungsberechtigte: 'Max Mustermann' },
      },
    };
    const text = footerText(buildInvoiceDocDef(baseInvoice, null, tenant)) ?? '';
    expect(text).toContain('Inhaber: Max Mustermann');
  });
});
