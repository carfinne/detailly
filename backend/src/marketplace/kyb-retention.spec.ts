import { LessThan, Not } from 'typeorm';
import { KybRetentionService, KYB_RETENTION_DAYS } from './kyb-retention.service';

/**
 * Welle 5 (DSGVO): der Retention-Job loescht die Gewerbeanmeldung abgelehnter
 * Bewerbungen 90 Tage nach der Ablehnung. Reiner Unit-Test mit Repo-/KYB-Mocks.
 */
describe('KybRetentionService.runRetention', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const makeSvc = (faellige: any[]) => {
    const dealerRepo: any = {
      find: jest.fn().mockResolvedValue(faellige),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const kyb: any = { loescheDokument: jest.fn().mockResolvedValue(undefined) };
    return { svc: new KybRetentionService(dealerRepo, kyb), dealerRepo, kyb };
  };

  it('loescht Datei + nullt Dokument-Spalten NUR fuer abgelehnte, abgelaufene Bewerbungen', async () => {
    const { svc, dealerRepo, kyb } = makeSvc([
      { id: 'd1', gewerbeanmeldungDatei: '/private-uploads/kyb/a.pdf.enc' },
      { id: 'd2', gewerbeanmeldungDatei: '/private-uploads/kyb/b.jpg.enc' },
    ]);
    const now = new Date('2026-07-13T12:00:00.000Z');
    const cutoff = new Date(now.getTime() - KYB_RETENTION_DAYS * DAY_MS);

    const bereinigt = await svc.runRetention(now);

    expect(bereinigt).toBe(2);
    // Nur abgelehnt + abgelaufen + noch mit Datei.
    expect(dealerRepo.find).toHaveBeenCalledWith({
      where: {
        status: 'abgelehnt',
        abgelehntAm: LessThan(cutoff),
        gewerbeanmeldungDatei: Not(null),
      },
    });
    expect(kyb.loescheDokument).toHaveBeenCalledWith('/private-uploads/kyb/a.pdf.enc');
    expect(kyb.loescheDokument).toHaveBeenCalledWith('/private-uploads/kyb/b.jpg.enc');
    expect(dealerRepo.update).toHaveBeenCalledWith('d1', {
      gewerbeanmeldungDatei: null,
      dokumentHash: null,
      kybErgebnis: null,
    });
    expect(dealerRepo.update).toHaveBeenCalledTimes(2);
  });

  it('keine faelligen -> nichts geloescht, 0 zurueck', async () => {
    const { svc, dealerRepo, kyb } = makeSvc([]);
    expect(await svc.runRetention(new Date())).toBe(0);
    expect(kyb.loescheDokument).not.toHaveBeenCalled();
    expect(dealerRepo.update).not.toHaveBeenCalled();
  });

  it('faengt DB-Fehler ab und wirft nicht (Timer-Lauf darf nie brechen)', async () => {
    const dealerRepo: any = { find: jest.fn().mockRejectedValue(new Error('db weg')) };
    const kyb: any = { loescheDokument: jest.fn() };
    const svc = new KybRetentionService(dealerRepo, kyb);
    await expect(svc.runRetention(new Date())).resolves.toBe(0);
  });
});
