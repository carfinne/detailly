import {
  IMPRESSUM_DEFAULTS,
  baueImpressum,
  mergeImpressum,
  pruefeImpressum,
  resolveImpressum,
  type ImpressumQuelle,
} from './impressum';

/** Vollstaendige, valide Basis-Quelle (Einzelunternehmen) fuer die Pruef-Tests. */
function quelle(overrides: Partial<ImpressumQuelle> = {}): ImpressumQuelle {
  return {
    firmenname: 'Muster Aufbereitung',
    strasse: 'Musterweg 1',
    plz: '10115',
    ort: 'Berlin',
    land: 'DE',
    telefon: '030 1234567',
    email: 'inhaber@muster.de',
    rechtsform: 'einzelunternehmen',
    vertretungsberechtigte: 'Max Mustermann',
    registergericht: '',
    registernummer: '',
    ustId: '',
    berufshaftpflicht: '',
    aufsichtsbehoerde: '',
    ...overrides,
  };
}

describe('resolveImpressum (defensives Lesen)', () => {
  it('undefined/null/Nicht-Objekt -> leere Defaults', () => {
    for (const raw of [undefined, null, 42, 'x', []]) {
      expect(resolveImpressum(raw as unknown)).toEqual(IMPRESSUM_DEFAULTS);
    }
  });

  it('leeres Objekt -> Defaults', () => {
    expect(resolveImpressum({})).toEqual(IMPRESSUM_DEFAULTS);
  });

  it('trimmt und kappt zu lange Werte', () => {
    const c = resolveImpressum({
      berufshaftpflicht: '  Allianz, Berlin, DE  ',
      aufsichtsbehoerde: 'x'.repeat(500),
    });
    expect(c.berufshaftpflicht).toBe('Allianz, Berlin, DE');
    expect(c.aufsichtsbehoerde.length).toBe(200);
  });
});

describe('mergeImpressum (Teil-Update)', () => {
  it('ueberlagert nur angegebene Felder', () => {
    const base = resolveImpressum({ berufshaftpflicht: 'A', aufsichtsbehoerde: 'B' });
    expect(mergeImpressum(base, { aufsichtsbehoerde: 'C' })).toEqual({
      berufshaftpflicht: 'A',
      aufsichtsbehoerde: 'C',
    });
  });

  it('leeres Patch aendert nichts', () => {
    const base = resolveImpressum({ berufshaftpflicht: 'A', aufsichtsbehoerde: 'B' });
    expect(mergeImpressum(base, {})).toEqual(base);
  });

  it('leerer String loescht das Feld', () => {
    const base = resolveImpressum({ berufshaftpflicht: 'A', aufsichtsbehoerde: 'B' });
    expect(mergeImpressum(base, { berufshaftpflicht: '' })).toEqual({
      berufshaftpflicht: '',
      aufsichtsbehoerde: 'B',
    });
  });
});

describe('pruefeImpressum (Pflichtangaben je Rechtsform)', () => {
  it('Einzelunternehmen vollstaendig -> keine fehlenden Felder', () => {
    const r = pruefeImpressum(quelle());
    expect(r.vollstaendig).toBe(true);
    expect(r.fehlend).toEqual([]);
    expect(r.warnungen).toEqual([]);
  });

  it('meldet fehlende Basis-Pflichtangaben (inkl. Telefon)', () => {
    const r = pruefeImpressum(quelle({ telefon: '', email: '', strasse: '   ' }));
    expect(r.vollstaendig).toBe(false);
    expect(r.fehlend).toEqual(expect.arrayContaining(['strasse', 'telefon', 'email']));
  });

  it('Einzelunternehmen ohne Inhaber-Namen -> vertretungsberechtigte fehlt', () => {
    const r = pruefeImpressum(quelle({ vertretungsberechtigte: '' }));
    expect(r.fehlend).toContain('vertretungsberechtigte');
  });

  it('GbR ohne Gesellschafter -> vertretungsberechtigte fehlt (kein Register noetig)', () => {
    const r = pruefeImpressum(quelle({ rechtsform: 'gbr', vertretungsberechtigte: '' }));
    expect(r.fehlend).toContain('vertretungsberechtigte');
    expect(r.fehlend).not.toContain('registergericht');
    expect(r.fehlend).not.toContain('registernummer');
  });

  it('UG ohne Registerangaben -> Registergericht + Registernummer fehlen', () => {
    const r = pruefeImpressum(quelle({ rechtsform: 'ug' }));
    expect(r.vollstaendig).toBe(false);
    expect(r.fehlend).toEqual(expect.arrayContaining(['registergericht', 'registernummer']));
  });

  it('UG mit Register, aber ohne USt-IdNr. -> vollstaendig, nur Warnung', () => {
    const r = pruefeImpressum(
      quelle({
        rechtsform: 'ug',
        registergericht: 'Amtsgericht Charlottenburg',
        registernummer: 'HRB 123456',
        vertretungsberechtigte: 'Max Mustermann',
        ustId: '',
      }),
    );
    expect(r.vollstaendig).toBe(true);
    expect(r.fehlend).toEqual([]);
    expect(r.warnungen).toContain('ustId');
  });

  it('GmbH vollstaendig inkl. USt-IdNr. -> keine Warnung', () => {
    const r = pruefeImpressum(
      quelle({
        rechtsform: 'gmbh',
        registergericht: 'Amtsgericht Berlin',
        registernummer: 'HRB 999',
        ustId: 'DE123456789',
      }),
    );
    expect(r.vollstaendig).toBe(true);
    expect(r.warnungen).toEqual([]);
  });

  it('GmbH & Co. KG verlangt ebenfalls Registerangaben', () => {
    const r = pruefeImpressum(quelle({ rechtsform: 'gmbh_co_kg' }));
    expect(r.fehlend).toEqual(expect.arrayContaining(['registergericht', 'registernummer']));
  });

  it('Freiberufler verlangt KEINE Registerangaben und keine USt-Warnung', () => {
    const r = pruefeImpressum(quelle({ rechtsform: 'freiberufler', ustId: '' }));
    expect(r.vollstaendig).toBe(true);
    expect(r.warnungen).toEqual([]);
  });
});

describe('baueImpressum (oeffentliche Whitelist-Ausgabe)', () => {
  it('formatiert Anschrift, Land und Labels korrekt', () => {
    const a = baueImpressum(quelle({ rechtsform: 'gbr', vertretungsberechtigte: 'A. Meier, B. Schulz' }));
    expect(a.anschrift.plzOrt).toBe('10115 Berlin');
    expect(a.anschrift.land).toBe('Deutschland'); // 'DE' -> ausgeschrieben
    expect(a.vertretungLabel).toBe('Gesellschafter');
    expect(a.vertretungsberechtigte).toBe('A. Meier, B. Schulz');
  });

  it('Einzelunternehmen -> Label "Inhaber/in"; Kapitalgesellschaft -> "Vertretungsberechtigte(r)"', () => {
    expect(baueImpressum(quelle({ rechtsform: 'einzelunternehmen' })).vertretungLabel).toBe('Inhaber/in');
    expect(baueImpressum(quelle({ rechtsform: 'ug' })).vertretungLabel).toBe('Vertretungsberechtigte(r)');
  });

  it('leeres/ausländisches Land wird korrekt gesetzt', () => {
    expect(baueImpressum(quelle({ land: '' })).anschrift.land).toBe('Deutschland');
    expect(baueImpressum(quelle({ land: 'Österreich' })).anschrift.land).toBe('Österreich');
  });

  it('gibt die USt-IdNr. aus, aber strukturell KEINE Steuernummer/IBAN-Felder', () => {
    const a = baueImpressum(quelle({ ustId: 'DE123456789' }));
    expect(a.ustId).toBe('DE123456789');
    const keys = Object.keys(a);
    expect(keys).not.toContain('steuernummer');
    expect(keys).not.toContain('iban');
    expect(keys).not.toContain('steuer');
  });

  it('best-effort: fehlende Felder bleiben leer (kein Fehler, kein vollstaendig-Flag)', () => {
    const a = baueImpressum(quelle({ telefon: '', registergericht: '' }));
    expect(a.telefon).toBe('');
    expect(a.registergericht).toBe('');
    expect((a as unknown as Record<string, unknown>).vollstaendig).toBeUndefined();
  });
});
