import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CustomersImportService } from './customers-import.service';
import { CustomerType } from './entities/customer.entity';

/**
 * Tests fuer den Kunden-CSV-Import (T-007). Reine Unit-Tests mit gemockten
 * Repositories (kein DB-Zugriff), Muster wie customers-plan-limit.spec.ts.
 */

interface MockOptionen {
  bestand?: any[];
  max?: number | null;
}

function makeService(over: MockOptionen = {}) {
  const em = {
    create: jest.fn((_cls: unknown, daten: Record<string, unknown>) => daten),
    save: jest.fn(async (e: unknown) => e),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const repo: any = {
    find: jest.fn().mockResolvedValue(over.bestand ?? []),
    manager: { transaction: jest.fn(async (cb: (em: unknown) => Promise<void>) => cb(em)) },
  };
  const audit: any = { log: jest.fn() };
  const subscriptions: any = {
    getLimit: jest.fn().mockResolvedValue(over.max === undefined ? null : over.max),
  };
  const svc = new CustomersImportService(repo, audit, subscriptions);
  return { svc, repo, em, audit, subscriptions };
}

const USER: any = { id: 'u1', tenantId: 't1' };
const datei = (text: string) => ({ buffer: Buffer.from(text, 'utf8'), originalname: 'kunden.csv' });

describe('CustomersImportService · Parsen + Klassifizieren (preview)', () => {
  it('Excel/DE (Semikolon): neue Kunden erkannt, nichts geschrieben', async () => {
    const { svc, repo } = makeService();
    const bericht = await svc.importCsv(
      USER,
      datei('Vorname;Nachname;E-Mail;Ort\nMax;Muster;max@muster.de;Koeln\nErika;Beispiel;;Bonn\n'),
      {},
    );
    expect(bericht.modus).toBe('preview');
    expect(bericht.trennzeichen).toBe(';');
    expect(bericht.gesamt).toBe(2);
    expect(bericht.neu).toBe(2);
    expect(bericht.fehler).toBe(0);
    expect(bericht.zeilen[0]).toMatchObject({ zeile: 2, name: 'Max Muster', status: 'neu' });
    // Preview schreibt NIE (keine Transaktion).
    expect(repo.manager.transaction).not.toHaveBeenCalled();
  });

  it('englische Komma-Header werden gemappt; unbekannte Spalten nur gemeldet', async () => {
    const { svc } = makeService();
    const bericht = await svc.importCsv(
      USER,
      datei('firstName,lastName,email,favoriteColor\nJohn,Doe,john@doe.com,blau\n'),
      {},
    );
    expect(bericht.neu).toBe(1);
    expect(bericht.ignorierteSpalten).toEqual(['favoriteColor']);
  });

  it('Windows-1252 (Excel/DE) wird erkannt und Umlaute korrekt gelesen', async () => {
    const { svc } = makeService();
    // "Nachname\nMüller" in cp1252 (0xfc = ü) -> als UTF-8 ungueltig.
    const buffer = Buffer.concat([
      Buffer.from('Nachname\nM', 'ascii'),
      Buffer.from([0xfc]),
      Buffer.from('ller\n', 'ascii'),
    ]);
    const bericht = await svc.importCsv(USER, { buffer, originalname: 'x.csv' }, {});
    expect(bericht.encoding).toBe('windows-1252');
    expect(bericht.zeilen[0].name).toBe('Müller');
  });

  it('Zeilenfehler: fehlender Name, kaputte E-Mail, unbekannter Typ', async () => {
    const { svc } = makeService();
    const bericht = await svc.importCsv(
      USER,
      datei(
        'Vorname;Nachname;E-Mail;Typ\n' +
          'NurVorname;;;\n' + // weder Nachname noch Firma
          'Max;Muster;keine-mail;\n' + // E-Mail kaputt
          'Erika;Beispiel;;dings\n', // Typ unbekannt
      ),
      {},
    );
    expect(bericht.fehler).toBe(3);
    expect(bericht.zeilen[0].hinweis).toMatch(/Nachname oder Firma/);
    expect(bericht.zeilen[1].hinweis).toMatch(/E-Mail/);
    expect(bericht.zeilen[2].hinweis).toMatch(/Typ/);
  });

  it('Typ: explizit gesetzt bzw. aus Firma abgeleitet', async () => {
    const { svc, repo, em } = makeService();
    await svc.importCsv(
      USER,
      datei('Nachname;Firma;Typ\nMuster;;privat\n;Glanzwerk GmbH;\n'),
      { mode: 'commit' },
    );
    expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
    // Neue Kunden werden GEBUENDELT gespeichert (ein Batch-Save mit beiden
    // Entities) statt Zeile-fuer-Zeile – frueher: em.save 2x.
    expect(em.save).toHaveBeenCalledTimes(1);
    expect(em.save.mock.calls[0][0]).toHaveLength(2);
    expect(em.create.mock.calls[0][1]).toMatchObject({ type: CustomerType.PRIVATE, tenantId: 't1' });
    expect(em.create.mock.calls[1][1]).toMatchObject({
      type: CustomerType.BUSINESS,
      companyName: 'Glanzwerk GmbH',
      tenantId: 't1',
    });
  });

  it('CSV-Formel-Injection: fuehrende "="/"@"/"-" werden entfernt', async () => {
    const { svc, em } = makeService();
    await svc.importCsv(
      USER,
      datei('Vorname;Nachname\n=cmd()|boese;@Muster\n;-MINUS(1)Muster\n'),
      { mode: 'commit' },
    );
    expect(em.create.mock.calls[0][1]).toMatchObject({ firstName: 'cmd()|boese', lastName: 'Muster' });
    expect(em.create.mock.calls[1][1]).toMatchObject({ lastName: 'MINUS(1)Muster' });
  });
});

describe('CustomersImportService · Batch-Insert (Reihenfolge/Report unveraendert)', () => {
  it('commit schreibt neue Kunden in EINEM Batch-Save, Dateireihenfolge erhalten', async () => {
    const { svc, em } = makeService();
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname\nEins\nZwei\nDrei\n'),
      { mode: 'commit' },
    );
    // Genau EIN Save-Aufruf mit allen drei neuen Kunden (kein Zeile-fuer-Zeile).
    expect(em.save).toHaveBeenCalledTimes(1);
    const batch = em.save.mock.calls[0][0] as Array<{ lastName: string; tenantId: string }>;
    expect(batch).toHaveLength(3);
    // Reihenfolge = Dateireihenfolge; tenantId serverseitig gesetzt.
    expect(batch.map((k) => k.lastName)).toEqual(['Eins', 'Zwei', 'Drei']);
    expect(batch.every((k) => k.tenantId === 't1')).toBe(true);
    // Report unveraendert: drei neue Zeilen in Dateireihenfolge.
    expect(bericht.neu).toBe(3);
    expect(bericht.zeilen.map((z) => z.name)).toEqual(['Eins', 'Zwei', 'Drei']);
  });

  it('gemischt: neue Kunden gebuendelt, Bestands-Update bleibt pro Zeile', async () => {
    const bestand = [
      { id: 'k1', email: 'max@muster.de', firstName: 'Max', lastName: 'Muster', companyName: null },
    ];
    const { svc, em } = makeService({ bestand });
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname;E-Mail;Telefon\nMuster;max@muster.de;0221 1\nNeuA;a@a.de;\nNeuB;b@b.de;\n'),
      { mode: 'commit', duplikate: 'update' },
    );
    // Ein Batch-Save fuer die zwei Neuzugaenge ...
    expect(em.save).toHaveBeenCalledTimes(1);
    expect((em.save.mock.calls[0][0] as unknown[]).length).toBe(2);
    // ... und ein einzelnes Update fuer den Bestandstreffer.
    expect(em.update).toHaveBeenCalledTimes(1);
    expect(bericht.neu).toBe(2);
    expect(bericht.aktualisiert).toBe(1);
  });
});

describe('CustomersImportService · Duplikate', () => {
  const bestand = [
    { id: 'k1', email: 'max@muster.de', firstName: 'Max', lastName: 'Muster', companyName: null },
  ];

  it('E-Mail-Treffer im Bestand -> uebersprungen (Default skip)', async () => {
    const { svc } = makeService({ bestand });
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname;E-Mail\nAnders;MAX@MUSTER.DE\n'), // case-insensitive
      {},
    );
    expect(bericht.uebersprungen).toBe(1);
    expect(bericht.zeilen[0].hinweis).toMatch(/existiert bereits/);
  });

  it('duplikate=update -> aktualisiert; Commit schreibt tenant-scoped Update ohne isActive', async () => {
    const { svc, em } = makeService({ bestand });
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname;E-Mail;Telefon\nMuster;max@muster.de;0221 123\n'),
      { mode: 'commit', duplikate: 'update' },
    );
    expect(bericht.aktualisiert).toBe(1);
    expect(em.update).toHaveBeenCalledTimes(1);
    const aufruf = em.update.mock.calls[0] as unknown[];
    expect(aufruf[1]).toEqual({ id: 'k1', tenantId: 't1' });
    expect(aufruf[2]).toMatchObject({ phone: '0221 123' });
    expect(aufruf[2]).not.toHaveProperty('isActive'); // Reaktivierung ausgeschlossen
  });

  it('update OHNE Typ-Spalte laesst den Kundentyp unangetastet (kein stilles "privat")', async () => {
    const firmenBestand = [
      { id: 'k7', email: 'info@glanzwerk.de', firstName: null, lastName: null, companyName: 'Glanzwerk GmbH' },
    ];
    const { svc, em } = makeService({ bestand: firmenBestand });
    await svc.importCsv(
      USER,
      datei('Nachname;E-Mail;Telefon\nGlanzwerk;info@glanzwerk.de;0221 999\n'),
      { mode: 'commit', duplikate: 'update' },
    );
    const aufruf = em.update.mock.calls[0] as unknown[];
    expect(aufruf[2]).not.toHaveProperty('type');
  });

  it('update MIT expliziter Typ-Spalte setzt den Typ', async () => {
    const { svc, em } = makeService({ bestand });
    await svc.importCsv(
      USER,
      datei('Nachname;E-Mail;Typ\nMuster;max@muster.de;firma\n'),
      { mode: 'commit', duplikate: 'update' },
    );
    const aufruf = em.update.mock.calls[0] as unknown[];
    expect(aufruf[2]).toMatchObject({ type: CustomerType.BUSINESS });
  });

  it('Namens-Match ohne E-Mail; mehrdeutige Treffer werden uebersprungen', async () => {
    const zweiMaxe = [
      { id: 'k1', email: '', firstName: 'Max', lastName: 'Muster', companyName: null },
      { id: 'k2', email: '', firstName: 'Max', lastName: 'Muster', companyName: null },
    ];
    const { svc, em } = makeService({ bestand: zweiMaxe });
    const bericht = await svc.importCsv(USER, datei('Vorname;Nachname\nMax;Muster\n'), {
      mode: 'commit',
      duplikate: 'update',
    });
    expect(bericht.uebersprungen).toBe(1);
    expect(bericht.zeilen[0].hinweis).toMatch(/Mehrere/);
    expect(em.update).not.toHaveBeenCalled();
  });

  it('Duplikat INNERHALB der Datei -> zweite Zeile uebersprungen', async () => {
    const { svc } = makeService();
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname;E-Mail\nMuster;max@muster.de\nAnders;max@muster.de\n'),
      {},
    );
    expect(bericht.neu).toBe(1);
    expect(bericht.uebersprungen).toBe(1);
    expect(bericht.zeilen[1].hinweis).toMatch(/Zeile 2/);
  });

  it('Duplikat-Abgleich laeuft NUR gegen aktive Kunden (tenant-scoped Query)', async () => {
    const { svc, repo } = makeService();
    await svc.importCsv(USER, datei('Nachname\nMuster\n'), {});
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', isActive: true } }),
    );
  });
});

describe('CustomersImportService · Tarif-Limit (Bulk)', () => {
  it('preview meldet Ueberschreitung, wirft aber nicht', async () => {
    const bestand = [{ id: 'k1', email: 'a@b.de', firstName: 'A', lastName: 'B', companyName: null }];
    const { svc } = makeService({ bestand, max: 2 });
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname\nEins\nZwei\nDrei\n'), // 3 neue, frei ist nur 1
      {},
    );
    expect(bericht.limit).toEqual({ max: 2, aktiv: 1, frei: 1, ueberschritten: true });
  });

  it('commit bei Ueberschreitung -> 403 PLAN_LIMIT_REACHED, nichts geschrieben', async () => {
    const { svc, repo } = makeService({ max: 1 });
    const fehler = await svc
      .importCsv(USER, datei('Nachname\nEins\nZwei\n'), { mode: 'commit' })
      .catch((e) => e);
    expect(fehler).toBeInstanceOf(ForbiddenException);
    expect(fehler.getResponse()).toMatchObject({ code: 'PLAN_LIMIT_REACHED', limit: 'maxCustomers' });
    expect(repo.manager.transaction).not.toHaveBeenCalled();
  });

  it('Duplikate/Fehler verbrauchen KEINE Plaetze', async () => {
    const bestand = [{ id: 'k1', email: 'max@muster.de', firstName: '', lastName: 'Muster', companyName: null }];
    const { svc } = makeService({ bestand, max: 2 });
    const bericht = await svc.importCsv(
      USER,
      datei('Nachname;E-Mail\nMuster;max@muster.de\n;kaputt\nNeu;neu@kunde.de\n'),
      { mode: 'commit' },
    );
    // 1 uebersprungen + 1 fehler + 1 neu -> passt in frei=1.
    expect(bericht.neu).toBe(1);
    expect(bericht.limit!.ueberschritten).toBe(false);
  });

  it('kein Tarif/unbegrenzt (max null) -> nie Ueberschreitung', async () => {
    const { svc } = makeService({ max: null });
    const bericht = await svc.importCsv(USER, datei('Nachname\nEins\nZwei\n'), {});
    expect(bericht.limit).toEqual({ max: null, aktiv: 0, frei: null, ueberschritten: false });
  });
});

describe('CustomersImportService · Ablehnungen + Protokoll', () => {
  it('Datei ohne Namensspalte -> 400 mit Hinweis auf erwartete Spalten', async () => {
    const { svc } = makeService();
    await expect(svc.importCsv(USER, datei('Telefon;Ort\n123;Koeln\n'), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('leere Datei / nur Kopfzeile -> 400', async () => {
    const { svc } = makeService();
    await expect(svc.importCsv(USER, { buffer: Buffer.alloc(0) }, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.importCsv(USER, datei('Nachname;Ort\n'), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mehr als 2000 Datenzeilen -> 400 (DoS-Schutz)', async () => {
    const { svc } = makeService();
    const zeilen = Array.from({ length: 2001 }, (_, i) => `Kunde${i}`).join('\n');
    await expect(svc.importCsv(USER, datei(`Nachname\n${zeilen}\n`), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('commit protokolliert NUR Zaehlwerte im Audit-Log (keine PII)', async () => {
    const { svc, audit } = makeService();
    await svc.importCsv(USER, datei('Nachname;E-Mail\nMuster;max@muster.de\n'), { mode: 'commit' });
    expect(audit.log).toHaveBeenCalledTimes(1);
    const eintrag = audit.log.mock.calls[0][0];
    expect(eintrag.action).toBe('customer.import');
    expect(JSON.stringify(eintrag.payload)).not.toContain('max@muster.de');
    expect(eintrag.payload).toMatchObject({ gesamt: 1, neu: 1 });
  });

  it('preview schreibt kein Audit-Log', async () => {
    const { svc, audit } = makeService();
    await svc.importCsv(USER, datei('Nachname\nMuster\n'), {});
    expect(audit.log).not.toHaveBeenCalled();
  });
});
