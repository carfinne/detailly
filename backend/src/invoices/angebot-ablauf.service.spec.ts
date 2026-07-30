import { Logger } from '@nestjs/common';
import { AngebotAblaufService } from './angebot-ablauf.service';

/**
 * Tests des Angebots-Ablauf-Jobs (Welle 2-B, Teil 1) mit reinen Mocks (keine DB,
 * kein Timer). Fokus: strikter Tenant-Scope (je Betrieb ein markAbgelaufen-Aufruf
 * mit KORREKTER tenantId), Summierung, Fehler-Isolierung, kein Throw – und dass der
 * Job KEINE Mail-Abhaengigkeit hat (Review-before-send: nichts geht automatisch raus).
 */
describe('AngebotAblaufService.runOnce', () => {
  const NOW = new Date(2026, 6, 7, 10, 0, 0);

  let tenantRepo: { find: jest.Mock };
  let invoices: { markAbgelaufen: jest.Mock };
  let svc: AngebotAblaufService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    tenantRepo = { find: jest.fn() };
    invoices = { markAbgelaufen: jest.fn().mockResolvedValue(0) };
    svc = new AngebotAblaufService(tenantRepo as any, invoices as any);
  });

  it('markiert je Betrieb tenant-scoped und summiert die markierten Angebote', async () => {
    tenantRepo.find.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    invoices.markAbgelaufen.mockImplementation((tid: string) =>
      Promise.resolve(tid === 't1' ? 2 : 1),
    );
    const r = await svc.runOnce(NOW);
    expect(invoices.markAbgelaufen).toHaveBeenCalledTimes(2);
    expect(invoices.markAbgelaufen).toHaveBeenCalledWith('t1', NOW);
    expect(invoices.markAbgelaufen).toHaveBeenCalledWith('t2', NOW);
    expect(r).toMatchObject({ tenants: 2, markiert: 3, fehler: 0 });
  });

  it('idempotenter Folgelauf: markAbgelaufen liefert 0 -> nichts markiert (kein Doppel)', async () => {
    tenantRepo.find.mockResolvedValue([{ id: 't1' }]);
    invoices.markAbgelaufen.mockResolvedValue(0); // bereits abgelaufen -> affected 0
    const r = await svc.runOnce(NOW);
    expect(r).toMatchObject({ tenants: 1, markiert: 0, fehler: 0 });
  });

  it('Fehler bei einem Betrieb stoppt die restlichen nicht (Fehler gezaehlt)', async () => {
    tenantRepo.find.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    invoices.markAbgelaufen
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockResolvedValueOnce(4);
    const r = await svc.runOnce(NOW);
    expect(invoices.markAbgelaufen).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ tenants: 2, markiert: 4, fehler: 1 });
  });

  it('Fehler beim Laden der Betriebsliste -> leeres Ergebnis, kein Throw', async () => {
    tenantRepo.find.mockRejectedValue(new Error('db down'));
    await expect(svc.runOnce(NOW)).resolves.toMatchObject({ tenants: 0, markiert: 0 });
    expect(invoices.markAbgelaufen).not.toHaveBeenCalled();
  });

  it('KEIN Auto-Versand: der Job kennt keinerlei Mail-Abhaengigkeit (nur tenantRepo + invoices)', () => {
    // Strukturbeweis: der Konstruktor nimmt exakt zwei Dependencies (Betriebe +
    // InvoicesService). Es gibt keinen MailService -> es KANN nichts an den
    // Endkunden gehen. Das Nachfassen loest der Betrieb selbst aus.
    expect(AngebotAblaufService.length).toBe(2);
  });
});
