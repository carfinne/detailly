import { BadRequestException } from '@nestjs/common';
import { VehiclesImportService } from './vehicles-import.service';

/**
 * Tests fuer den Fahrzeug-CSV-Import (T-007): Kunden-Zuordnung ueber E-Mail,
 * Duplikate ueber Kennzeichen/VIN, kein Tarif-Limit. Gemockte Repositories.
 */

interface MockOptionen {
  kunden?: any[];
  fahrzeuge?: any[];
}

function makeService(over: MockOptionen = {}) {
  const em = {
    create: jest.fn((_cls: unknown, daten: Record<string, unknown>) => daten),
    save: jest.fn(async (e: unknown) => e),
  };
  const repo: any = {
    find: jest.fn().mockResolvedValue(over.fahrzeuge ?? []),
    manager: { transaction: jest.fn(async (cb: (em: unknown) => Promise<void>) => cb(em)) },
  };
  const customerRepo: any = { find: jest.fn().mockResolvedValue(over.kunden ?? []) };
  const audit: any = { log: jest.fn() };
  const svc = new VehiclesImportService(repo, customerRepo, audit);
  return { svc, repo, customerRepo, em, audit };
}

const USER: any = { id: 'u1', tenantId: 't1' };
const datei = (text: string) => ({ buffer: Buffer.from(text, 'utf8'), originalname: 'fahrzeuge.csv' });
const KUNDEN = [
  { id: 'k1', email: 'max@muster.de' },
  { id: 'k2', email: 'erika@beispiel.de' },
];

describe('VehiclesImportService · Kunden-Zuordnung', () => {
  it('ordnet Fahrzeuge ueber KundeEmail zu (case-insensitive) und schreibt bei commit', async () => {
    const { svc, em, customerRepo } = makeService({ kunden: KUNDEN });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell;Kennzeichen;Baujahr\nMAX@muster.de;BMW;M3;K-AB 123;2019\n'),
      { mode: 'commit' },
    );
    expect(bericht.neu).toBe(1);
    expect(em.create.mock.calls[0][1]).toMatchObject({
      customerId: 'k1',
      tenantId: 't1',
      make: 'BMW',
      model: 'M3',
      licensePlate: 'K-AB 123',
      year: 2019,
    });
    // Zuordnung nur gegen AKTIVE Kunden des eigenen Betriebs.
    expect(customerRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', isActive: true } }),
    );
  });

  it('unbekannte E-Mail -> Zeilenfehler mit Hinweis auf Kunden-Import', async () => {
    const { svc } = makeService({ kunden: KUNDEN });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell\nniemand@nirgendwo.de;VW;Golf\n'),
      {},
    );
    expect(bericht.fehler).toBe(1);
    expect(bericht.zeilen[0].hinweis).toMatch(/Kein Kunde/);
  });

  it('mehrdeutige E-Mail (zwei Kunden) -> Zeilenfehler', async () => {
    const doppelt = [
      { id: 'k1', email: 'max@muster.de' },
      { id: 'k9', email: 'max@muster.de' },
    ];
    const { svc } = makeService({ kunden: doppelt });
    const bericht = await svc.importCsv(USER, datei('KundeEmail;Marke;Modell\nmax@muster.de;VW;Golf\n'), {});
    expect(bericht.fehler).toBe(1);
    expect(bericht.zeilen[0].hinweis).toMatch(/nicht eindeutig/);
  });
});

describe('VehiclesImportService · Validierung + Duplikate', () => {
  it('fehlende Pflichtspalte in der Kopfzeile -> 400', async () => {
    const { svc } = makeService({ kunden: KUNDEN });
    await expect(
      svc.importCsv(USER, datei('KundeEmail;Modell\nmax@muster.de;Golf\n'), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fehlende Pflichtwerte je Zeile -> fehler (E-Mail/Marke/Modell)', async () => {
    const { svc } = makeService({ kunden: KUNDEN });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell\n;VW;Golf\nmax@muster.de;;Golf\nmax@muster.de;VW;\n'),
      {},
    );
    expect(bericht.fehler).toBe(3);
  });

  it('unplausibles Baujahr -> fehler statt stillem Verwerfen', async () => {
    const { svc } = makeService({ kunden: KUNDEN });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell;Baujahr\nmax@muster.de;VW;Golf;kaputt\n'),
      {},
    );
    expect(bericht.fehler).toBe(1);
    expect(bericht.zeilen[0].hinweis).toMatch(/Baujahr/);
  });

  it('Duplikat im Bestand (gleicher Kunde + Kennzeichen, normalisiert) -> uebersprungen', async () => {
    const { svc } = makeService({
      kunden: KUNDEN,
      fahrzeuge: [{ id: 'f1', customerId: 'k1', licensePlate: 'K-AB123', vin: null }],
    });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell;Kennzeichen\nmax@muster.de;BMW;M3;k-ab 123\n'),
      {},
    );
    expect(bericht.uebersprungen).toBe(1);
    expect(bericht.zeilen[0].hinweis).toMatch(/existiert bereits/);
  });

  it('gleiches Kennzeichen bei ANDEREM Kunden ist KEIN Duplikat', async () => {
    const { svc } = makeService({
      kunden: KUNDEN,
      fahrzeuge: [{ id: 'f1', customerId: 'k2', licensePlate: 'K-AB123', vin: null }],
    });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell;Kennzeichen\nmax@muster.de;BMW;M3;K-AB 123\n'),
      {},
    );
    expect(bericht.neu).toBe(1);
  });

  it('Duplikat INNERHALB der Datei (VIN) -> zweite Zeile uebersprungen', async () => {
    const { svc } = makeService({ kunden: KUNDEN });
    const bericht = await svc.importCsv(
      USER,
      datei(
        'KundeEmail;Marke;Modell;VIN\n' +
          'max@muster.de;BMW;M3;WBA1234567890\n' +
          'max@muster.de;BMW;M3;wba 1234567890\n',
      ),
      {},
    );
    expect(bericht.neu).toBe(1);
    expect(bericht.uebersprungen).toBe(1);
  });

  it('ohne Kennzeichen/VIN keine Duplikat-Heuristik (zwei gleiche Modelle sind legitim)', async () => {
    const { svc } = makeService({ kunden: KUNDEN });
    const bericht = await svc.importCsv(
      USER,
      datei('KundeEmail;Marke;Modell\nmax@muster.de;VW;Golf\nmax@muster.de;VW;Golf\n'),
      {},
    );
    expect(bericht.neu).toBe(2);
  });
});

describe('VehiclesImportService · Preview/Commit-Protokoll', () => {
  it('preview schreibt nichts und loggt kein Audit', async () => {
    const { svc, repo, audit } = makeService({ kunden: KUNDEN });
    await svc.importCsv(USER, datei('KundeEmail;Marke;Modell\nmax@muster.de;VW;Golf\n'), {});
    expect(repo.manager.transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('commit loggt Zaehlwerte ohne PII', async () => {
    const { svc, audit } = makeService({ kunden: KUNDEN });
    await svc.importCsv(USER, datei('KundeEmail;Marke;Modell\nmax@muster.de;VW;Golf\n'), {
      mode: 'commit',
    });
    const eintrag = audit.log.mock.calls[0][0];
    expect(eintrag.action).toBe('vehicle.import');
    expect(JSON.stringify(eintrag.payload)).not.toContain('max@muster.de');
    expect(eintrag.payload).toMatchObject({ gesamt: 1, neu: 1 });
  });
});
