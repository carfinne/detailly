import { LessThan, Not } from 'typeorm';
import { BookingRetentionService } from './booking-retention.service';
import { BookingRequestStatus } from './entities/booking-request.entity';
import { RETENTION_DAYS } from './public-booking.service';

/**
 * B3: der periodische Retention-Job loescht abgelaufene, NICHT angenommene Anfragen
 * (Housekeeping-GC ueber alle Betriebe). Reiner Unit-Test mit gemocktem Repository.
 */
describe('BookingRetentionService.runRetention', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const makeSvc = (deleteImpl: jest.Mock) => {
    const repo = { delete: deleteImpl };
    return new BookingRetentionService(repo as any);
  };

  it('loescht Anfragen aelter als RETENTION_DAYS, ausser angenommene', async () => {
    const del = jest.fn().mockResolvedValue({ affected: 3 });
    const svc = makeSvc(del);
    const now = new Date('2026-07-09T12:00:00.000Z');
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);

    const geloescht = await svc.runRetention(now);

    expect(geloescht).toBe(3);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith({
      status: Not(BookingRequestStatus.ANGENOMMEN),
      createdAt: LessThan(cutoff),
    });
  });

  it('faengt DB-Fehler ab und wirft nicht (Timer-Lauf darf nie brechen)', async () => {
    const del = jest.fn().mockRejectedValue(new Error('db weg'));
    const svc = makeSvc(del);

    await expect(svc.runRetention(new Date())).resolves.toBe(0);
  });
});
