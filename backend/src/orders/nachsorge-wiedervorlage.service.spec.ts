import { Logger } from '@nestjs/common';
import { NachsorgeWiedervorlageService } from './nachsorge-wiedervorlage.service';

/**
 * Unit-Tests fuer den Nachsorge-Wiedervorlage-Job (Welle 2-B, Teil 2). orderRepo +
 * tenantRepo gemockt (keine DB, kein Timer). Kernaussagen:
 *  - "genau EINE Erinnerung": konditionaler Claim (nachsorgeErinnertAm IS NULL)
 *  - verlorener Claim (affected=0) zaehlt NICHT
 *  - strikte Tenant-Isolation (Lade- + Claim-Query tragen tenantId)
 *  - Fehler isolieren, kein Throw
 *  - KEIN Mailversand: der Service hat keinerlei Mail-Abhaengigkeit (Review-before-send)
 */
describe('NachsorgeWiedervorlageService.runOnce', () => {
  const NOW = new Date('2026-07-14T09:00:00.000Z');

  let tenantRepo: { find: jest.Mock };
  let orderRepo: { find: jest.Mock; update: jest.Mock };
  let svc: NachsorgeWiedervorlageService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    tenantRepo = { find: jest.fn().mockResolvedValue([{ id: 't1' }]) };
    orderRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    svc = new NachsorgeWiedervorlageService(orderRepo as any, tenantRepo as any);
  });

  it('faellige Wiedervorlage -> GENAU EINE Erinnerung (konditionaler Claim)', async () => {
    const r = await svc.runOnce(NOW);
    expect(r).toEqual({ tenants: 1, geprueft: 1, erinnert: 1, fehler: 0 });
    expect(orderRepo.update).toHaveBeenCalledTimes(1);
    const [krit, patch] = orderRepo.update.mock.calls[0];
    // Claim NUR wenn noch nicht erinnert (IS NULL) + tenant-scoped.
    expect(krit).toMatchObject({ id: 'o1', tenantId: 't1' });
    expect(krit.nachsorgeErinnertAm).toBeDefined(); // IsNull()-Bedingung
    expect(patch.nachsorgeErinnertAm).toBe(NOW);
  });

  it('verlorener Claim (affected=0) -> KEINE Erinnerung gezaehlt (Idempotenz/parallel)', async () => {
    orderRepo.update.mockResolvedValue({ affected: 0 });
    const r = await svc.runOnce(NOW);
    expect(orderRepo.update).toHaveBeenCalledTimes(1);
    expect(r.erinnert).toBe(0);
  });

  it('Tenant-Isolation: Lade-Query filtert auf tenantId + noch offen/nicht erledigt', async () => {
    await svc.runOnce(NOW);
    const where = orderRepo.find.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    // nachsorgeErinnertAm IS NULL + nachsorgeErledigtAm IS NULL (nur wirklich faellige).
    expect(where.nachsorgeErinnertAm).toBeDefined();
    expect(where.nachsorgeErledigtAm).toBeDefined();
    expect(where.nachsorgeAm).toBeDefined(); // LessThanOrEqual(now)
  });

  it('mehrere Betriebe: jeder wird tenant-scoped abgearbeitet', async () => {
    tenantRepo.find.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    orderRepo.find.mockImplementation((q: any) =>
      Promise.resolve(q.where.tenantId === 't1' ? [{ id: 'o1' }] : [{ id: 'o2' }]),
    );
    const r = await svc.runOnce(NOW);
    expect(r).toMatchObject({ tenants: 2, geprueft: 2, erinnert: 2 });
    expect(orderRepo.find.mock.calls[0][0].where.tenantId).toBe('t1');
    expect(orderRepo.find.mock.calls[1][0].where.tenantId).toBe('t2');
  });

  it('Claim-Fehler stoppt den Lauf nicht (Fehler gezaehlt)', async () => {
    orderRepo.find.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
    orderRepo.update
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockResolvedValueOnce({ affected: 1 });
    const r = await svc.runOnce(NOW);
    expect(orderRepo.update).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ geprueft: 2, erinnert: 1, fehler: 1 });
  });

  it('Fehler beim Laden der Betriebsliste -> leeres Ergebnis, kein Throw', async () => {
    tenantRepo.find.mockRejectedValue(new Error('db down'));
    await expect(svc.runOnce(NOW)).resolves.toMatchObject({ tenants: 0, erinnert: 0 });
    expect(orderRepo.update).not.toHaveBeenCalled();
  });

  it('KEIN Auto-Versand: der Job hat keine Mail-Abhaengigkeit (nur orderRepo + tenantRepo)', () => {
    // Strukturbeweis: der Konstruktor nimmt exakt zwei Repositories. Es gibt keinen
    // MailService -> strukturell kann NICHTS an den Endkunden gehen (der Betrieb
    // stoesst Termin/Anfrage selbst aus der In-App-Liste an).
    expect(NachsorgeWiedervorlageService.length).toBe(2);
  });
});
