import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { AccountingExportService } from './accounting-export.service';
import { InvoicesService } from './invoices.service';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { REQUIRES_FEATURE_KEY } from '../common/decorators/requires-feature.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * Welle 2 (Einnahmenuebersicht-Export): reine Formatierung (buildEinnahmenCsv)
 * + Service-Zusammenbau (buildEinnahmenExport). Prueft CSV-Format, §19-Kennzeichen,
 * CSV-Injection-Schutz, "nur bezahlt", Zeitraum-Deckel (400) und das Feature-/
 * Rollen-Gate am Endpoint.
 */

// ---------------------------------------------------------------------------
// Formatierer (rein, ohne DB)
// ---------------------------------------------------------------------------
describe('AccountingExportService · buildEinnahmenCsv', () => {
  const svc = new AccountingExportService();
  const cust = new Map<string, any>([
    ['c1', { type: 'private', firstName: 'Max', lastName: 'Mustermann' }],
    ['c2', { type: 'business', companyName: 'Auto & Co; KG' }],
  ]);
  const inv = (over: Partial<any> = {}): any => ({
    nummer: 'RE-2026-0001',
    customerId: 'c1',
    datum: new Date(2026, 0, 15), // 15.01.2026
    zahldatum: new Date(2026, 0, 20), // 20.01.2026
    netto: 100,
    mwst: 0,
    brutto: 100,
    mwstSatz: 0,
    ...over,
  });
  const rows = (invoices: any[], klein: boolean) =>
    svc
      .buildEinnahmenCsv(invoices, cust, klein)
      .toString('utf-8')
      .replace(/^﻿/, '')
      .trim()
      .split('\r\n');

  it('Kopfzeile enthaelt Zahldatum + §19-Kennzeichen', () => {
    expect(rows([inv()], true)[0]).toBe(
      'Belegnummer;Belegdatum;Zahldatum;Kunde;Netto;MwSt-Satz;MwSt-Betrag;Brutto;§19-Kennzeichen',
    );
  });

  it('Kleinunternehmer 0 %: deutsche Zahlen/Datumsformate, §19-Kennzeichen "Ja"', () => {
    expect(rows([inv()], true)[1]).toBe(
      'RE-2026-0001;15.01.2026;20.01.2026;Max Mustermann;100,00;0;0,00;100,00;Ja',
    );
  });

  it('§19-Kennzeichen "Nein" fuer Regelbesteuerer (auch bei 0 %)', () => {
    expect(rows([inv()], false)[1].endsWith(';Nein')).toBe(true);
    expect(rows([inv({ mwstSatz: 19, mwst: 19, brutto: 119 })], false)[1].endsWith(';Nein')).toBe(true);
  });

  it('§19-Kennzeichen "Nein" fuer Kleinunternehmer-Altbeleg mit 19 % (vor Umstellung)', () => {
    expect(rows([inv({ mwstSatz: 19, mwst: 19, brutto: 119 })], true)[1].endsWith(';Nein')).toBe(true);
  });

  it('beginnt mit UTF-8-BOM', () => {
    const buf = svc.buildEinnahmenCsv([inv()], cust, true);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });

  it('CSV-Injection: Formel im Kundennamen wird neutralisiert (fuehrendes Apostroph)', () => {
    const evil = new Map<string, any>([['x', { type: 'business', companyName: '=SUM(A1)' }]]);
    const row = svc
      .buildEinnahmenCsv([inv({ customerId: 'x' })], evil, true)
      .toString('utf-8')
      .replace(/^﻿/, '')
      .trim()
      .split('\r\n')[1];
    expect(row.split(';')[3]).toBe("'=SUM(A1)");
  });

  it('Semikolon im Kundennamen wird gequotet', () => {
    const row = rows([inv({ customerId: 'c2' })], true)[1];
    expect(row).toContain('"Auto & Co; KG"');
  });

  it('fehlendes Zahldatum bleibt leer', () => {
    expect(rows([inv({ zahldatum: null })], true)[1].split(';')[2]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Service (mit gemocktem QueryBuilder + echtem Formatierer)
// ---------------------------------------------------------------------------
function makeExportService(steuer?: Record<string, unknown>) {
  const captured: { params: Record<string, unknown>; where: string[] } = { params: {}, where: [] };
  const qb: any = {
    where: (c: string, p?: Record<string, unknown>) => {
      captured.where.push(c);
      if (p) Object.assign(captured.params, p);
      return qb;
    },
    andWhere: (c: string, p?: Record<string, unknown>) => {
      captured.where.push(c);
      if (p) Object.assign(captured.params, p);
      return qb;
    },
    leftJoin: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    getMany: () => Promise.resolve([]),
  };
  const repo: any = { createQueryBuilder: jest.fn(() => qb) };
  const customerRepo: any = { find: jest.fn().mockResolvedValue([]) };
  const tenantRepo: any = {
    findOne: jest.fn().mockResolvedValue({ id: 't1', settings: steuer ? { steuer } : {} }),
  };
  const svc = new InvoicesService(
    repo,
    {} as any,
    {} as any,
    customerRepo,
    tenantRepo,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    new AccountingExportService(),
  );
  return { svc, repo, captured };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('InvoicesService · buildEinnahmenExport', () => {
  it('Abfrage ist tenant-scoped und liefert NUR bezahlte Rechnungen', async () => {
    const { svc, captured } = makeExportService({ kleinunternehmer: true });
    await svc.buildEinnahmenExport('t1', { von: '2026-01-01', bis: '2026-01-31' });
    expect(captured.params.tenantId).toBe('t1');
    expect(captured.params.art).toBe(InvoiceKind.RECHNUNG);
    expect(captured.params.status).toBe(InvoiceStatus.BEZAHLT);
    expect(captured.where.some((w) => w.includes('i.tenantId'))).toBe(true);
    // Zufluss-Guard: Storno zaehlt nur bei zuvor bezahltem Original (orig.zahldatum).
    expect(
      captured.where.some(
        (w) => w.includes('stornoVonInvoiceId') && w.includes('orig.zahldatum'),
      ),
    ).toBe(true);
  });

  it('liefert CSV mit Kopfzeile + korrektem Dateinamen/Content-Type', async () => {
    const { svc } = makeExportService();
    const out = await svc.buildEinnahmenExport('t1', { von: '2026-01-01', bis: '2026-01-31' });
    expect(out.filename).toBe('Einnahmen_2026-01-01_2026-01-31.csv');
    expect(out.contentType).toBe('text/csv; charset=utf-8');
    const kopf = out.buffer.toString('utf-8').replace(/^﻿/, '').split('\r\n')[0];
    expect(kopf).toContain('§19-Kennzeichen');
  });

  it('Zeitraum > 400 Tage -> BadRequest, KEINE DB-Abfrage', async () => {
    const { svc, repo } = makeExportService();
    const von = new Date(2025, 0, 1);
    const bis = new Date(von.getTime() + 410 * 86_400_000);
    await expect(
      svc.buildEinnahmenExport('t1', { von: iso(von), bis: iso(bis) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('Zeitraum innerhalb 400 Tage ist erlaubt', async () => {
    const { svc } = makeExportService();
    const von = new Date(2025, 0, 1);
    const bis = new Date(von.getTime() + 380 * 86_400_000);
    await expect(
      svc.buildEinnahmenExport('t1', { von: iso(von), bis: iso(bis) }),
    ).resolves.toBeDefined();
  });

  it('Bis vor Von -> BadRequest', async () => {
    const { svc } = makeExportService();
    await expect(
      svc.buildEinnahmenExport('t1', { von: '2026-02-01', bis: '2026-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvoicesController · einnahmen-export Gate (Metadata)', () => {
  it('ist hinter @RequiresFeature(export) + Leitung-only', () => {
    const method = InvoicesController.prototype.einnahmenExport;
    expect(Reflect.getMetadata(REQUIRES_FEATURE_KEY, method)).toBe('export');
    expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual([UserRole.MANAGER, UserRole.OWNER]);
  });
});
