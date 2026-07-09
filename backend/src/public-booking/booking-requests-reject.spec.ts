import { BadRequestException } from '@nestjs/common';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestStatus } from './entities/booking-request.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * B3 (DSGVO Art. 17): reject() muss die Kontakt-PII SOFORT nullen – eine abgelehnte
 * Anfrage begruendet keinen Stammdatensatz. Ohne Nullung bliebe Klartext-PII bis zum
 * Retention-Lauf (bzw. bei geringem Volumen faktisch unbefristet) liegen.
 */
describe('BookingRequestsService.reject - PII-Nullung', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: 'owner', tenantId: 't1' } as AuthUser;

  const makeSvc = (req: unknown) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(req),
      save: jest.fn(async (e: Record<string, unknown>) => e),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new BookingRequestsService(
      repo as any,
      {} as any, // dataSource (in reject ungenutzt)
      audit as any,
      {} as any, // subscriptions
      {} as any, // mail
      {} as any, // config
    );
    return { svc, repo, audit };
  };

  it('nullt Name/E-Mail/Telefon/Fahrzeug/Nachricht und setzt Status abgelehnt', async () => {
    const req = {
      id: 'br1',
      tenantId: 't1',
      name: 'Max Muster',
      email: 'max@example.de',
      phone: '0170123',
      serviceName: 'Politur',
      fahrzeug: 'VW Golf',
      nachricht: 'Bitte morgens',
      status: BookingRequestStatus.NEU,
      reference: 'AF-ABCDEF012345',
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
    };
    const { svc, repo } = makeSvc(req);

    const view = await svc.reject(user, 'br1');

    // Persistierte Zeile: PII genullt, Status abgelehnt.
    const gespeichert = repo.save.mock.calls[0][0];
    expect(gespeichert.status).toBe(BookingRequestStatus.ABGELEHNT);
    expect(gespeichert.name).toBe('(abgelehnt)');
    expect(gespeichert.email).toBeNull();
    expect(gespeichert.phone).toBeNull();
    expect(gespeichert.fahrzeug).toBeNull();
    expect(gespeichert.nachricht).toBeNull();
    // serviceName (keine PII) + Referenz bleiben fuer die Betriebs-Uebersicht/Status.
    expect(gespeichert.serviceName).toBe('Politur');
    expect(gespeichert.reference).toBe('AF-ABCDEF012345');

    // Rueckgabe-View traegt keine PII mehr.
    expect(view.email).toBeNull();
    expect(view.phone).toBeNull();
    expect(view.name).toBe('(abgelehnt)');
  });

  it('bereits bearbeitete Anfrage -> 400, kein Save', async () => {
    const { svc, repo } = makeSvc({
      id: 'br2',
      tenantId: 't1',
      name: 'X',
      status: BookingRequestStatus.ABGELEHNT,
      reference: 'AF-000000000000',
      createdAt: new Date(),
    });

    await expect(svc.reject(user, 'br2')).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
