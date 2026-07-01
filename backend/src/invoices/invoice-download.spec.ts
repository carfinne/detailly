import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from './entities/invoice.entity';

/**
 * Tests fuer den oeffentlichen Beleg-Download per Token. Reine Unit-Tests mit
 * gemockten Repositories (kein DB-Zugriff).
 */
function makeService(over: { invoice?: any; findOneImpl?: any; tenant?: any } = {}) {
  const repo: any = {
    findOne: over.findOneImpl
      ? jest.fn().mockImplementation(over.findOneImpl)
      : jest.fn().mockResolvedValue(over.invoice ?? null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue({}) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const pdf: any = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')) };
  const svc = new InvoicesService(
    repo, // Invoice
    {} as any, // InvoiceItem
    {} as any, // Order
    customerRepo, // Customer
    tenantRepo, // Tenant
    { log: jest.fn() } as any, // audit
    {} as any, // sevdesk
    pdf, // InvoicePdfService
    {} as any, // mail
    {} as any, // accExport
  );
  return { svc, repo, tenantRepo, pdf };
}

const VALID = 'a'.repeat(48);
const USER: any = { id: 'u1', tenantId: 't1' };

describe('InvoicesService · Download-Token erzeugen', () => {
  it('offener Beleg ohne Token -> erzeugt 48-Hex, tenant-scoped gespeichert', async () => {
    const { svc, repo } = makeService({ invoice: { id: 'i1', status: InvoiceStatus.OFFEN, downloadToken: null } });
    const res = await svc.getOrCreateDownloadToken(USER, 'i1');
    expect(res.token).toMatch(/^[a-f0-9]{48}$/);
    expect(repo.update).toHaveBeenCalledWith({ id: 'i1', tenantId: 't1' }, { downloadToken: res.token });
  });

  it('vorhandenes Token wird zurueckgegeben (kein Neuschreiben)', async () => {
    const { svc, repo } = makeService({ invoice: { id: 'i1', status: InvoiceStatus.BEZAHLT, downloadToken: VALID } });
    const res = await svc.getOrCreateDownloadToken(USER, 'i1');
    expect(res.token).toBe(VALID);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('Entwurf kann NICHT geteilt werden -> 400', async () => {
    const { svc } = makeService({ invoice: { id: 'i1', status: InvoiceStatus.ENTWURF, downloadToken: null } });
    await expect(svc.getOrCreateDownloadToken(USER, 'i1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('storniert kann NICHT geteilt werden -> 400', async () => {
    const { svc } = makeService({ invoice: { id: 'i1', status: InvoiceStatus.STORNIERT, downloadToken: null } });
    await expect(svc.getOrCreateDownloadToken(USER, 'i1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unbekannter Beleg -> 404', async () => {
    const { svc } = makeService({ invoice: null });
    await expect(svc.getOrCreateDownloadToken(USER, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('regenerate erzeugt neues Token tenant-scoped', async () => {
    const { svc, repo } = makeService({ invoice: { id: 'i1', status: InvoiceStatus.OFFEN } });
    const res = await svc.regenerateDownloadToken(USER, 'i1');
    expect(res.token).toMatch(/^[a-f0-9]{48}$/);
    expect(repo.update).toHaveBeenCalledWith({ id: 'i1', tenantId: 't1' }, { downloadToken: res.token });
  });

  it('regenerate fuer Entwurf/Storno -> 400 (Konsistenz mit getOrCreate)', async () => {
    const { svc } = makeService({ invoice: { id: 'i1', status: InvoiceStatus.STORNIERT } });
    await expect(svc.regenerateDownloadToken(USER, 'i1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvoicesService · oeffentlicher Zugriff per Token', () => {
  it.each(['', 'abc', 'ZZZ', 'short', '../x'])('unplausibles Token "%s" -> 404 ohne DB', async (bad) => {
    const { svc, repo } = makeService();
    await expect(svc.downloadMetaByToken(bad)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('unbekanntes Token -> 404', async () => {
    const { svc } = makeService({ invoice: null });
    await expect(svc.downloadMetaByToken(VALID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([InvoiceStatus.ENTWURF, InvoiceStatus.STORNIERT])('Status %s ist nicht oeffentlich -> 404', async (status) => {
    const { svc } = makeService({ invoice: { id: 'i1', tenantId: 't1', status, nummer: 'RE-1', art: 'rechnung', brutto: 119, datum: new Date() } });
    await expect(svc.downloadMetaByToken(VALID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('offener Beleg -> Meta (Betrieb, Nummer, Brutto), keine sensiblen Felder', async () => {
    const { svc } = makeService({
      invoice: { id: 'i1', tenantId: 't1', status: InvoiceStatus.OFFEN, nummer: 'RE-2026-0007', art: 'rechnung', brutto: '119.00', datum: new Date(Date.UTC(2026, 5, 1)) },
      tenant: { id: 't1', name: 'Muster GmbH' },
    });
    const meta = await svc.downloadMetaByToken(VALID);
    expect(meta.betrieb).toBe('Muster GmbH');
    expect(meta.nummer).toBe('RE-2026-0007');
    expect(meta.status).toBe('offen');
    expect(meta.brutto).toBe(119);
    for (const verboten of ['customerId', 'hinweis', 'empfaengerName', 'downloadToken', 'items']) {
      expect(meta as unknown as Record<string, unknown>).not.toHaveProperty(verboten);
    }
  });

  it('buildPdfByToken liefert PDF fuer offenen Beleg', async () => {
    // findOne wird zweimal genutzt: 1) Token-Aufloesung 2) loadContext in buildPdf.
    const findOneImpl = (opts: any) => {
      if (opts?.where?.downloadToken) {
        return Promise.resolve({ id: 'i1', tenantId: 't1', status: InvoiceStatus.OFFEN, nummer: 'RE-1', art: 'rechnung', brutto: 119, datum: new Date() });
      }
      return Promise.resolve({ id: 'i1', tenantId: 't1', nummer: 'RE-1', items: [] });
    };
    const { svc, pdf } = makeService({ findOneImpl, tenant: { id: 't1', name: 'X' } });
    const res = await svc.buildPdfByToken(VALID);
    expect(res.nummer).toBe('RE-1');
    expect(Buffer.isBuffer(res.buffer)).toBe(true);
    expect(pdf.render).toHaveBeenCalledTimes(1);
  });

  it('buildPdfByToken mit unplausiblem Token -> 404 (kein PDF-Rendering)', async () => {
    const { svc, pdf } = makeService();
    await expect(svc.buildPdfByToken('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(pdf.render).not.toHaveBeenCalled();
  });
});
