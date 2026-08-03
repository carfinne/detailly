import { AppointmentsService } from './appointments.service';
import { AppointmentStatus } from './entities/appointment.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Finding #5: Wird ein Termin nach dem Versand der Erinnerung (erinnerungGesendetAm
 * gesetzt) auf einen SPAETEREN Kalendertag verschoben, muss die Erinnerung erneut
 * greifen -> Marker wird auf null zurueckgesetzt, damit der Scheduler den Termin
 * wieder claimt. Bei einer Verschiebung am SELBEN Tag (nur Stunden) oder nach
 * frueher/in die Vergangenheit bleibt der Marker erhalten (Belaestigungs-Schutz).
 */
const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

const ERINNERT_AM = new Date('2026-07-09T08:00:00'); // Erinnerung wurde bereits versendet
const BESTAND_START = new Date('2026-07-10T09:00:00');
const BESTAND_ENDE = new Date('2026-07-10T10:00:00');

function makeSvc() {
  const saved: any[] = [];
  const apptRepo: any = {
    findOne: jest.fn(async () => ({
      id: 'a1',
      tenantId: 't1',
      titel: 'Keramik-Nachpolitur',
      start: new Date(BESTAND_START),
      ende: new Date(BESTAND_ENDE),
      assignedUserId: null, // ohne Mitarbeiter -> kein Overlap-Query noetig
      locationId: null,
      status: AppointmentStatus.BESTAETIGT,
      erinnerungGesendetAm: new Date(ERINNERT_AM),
    })),
  };
  const manager: any = {
    findOne: jest.fn(async () => ({ id: 't1', settings: {} })), // Konflikt-Settings -> Defaults
    save: jest.fn(async (obj: any) => {
      saved.push(obj);
      return obj;
    }),
  };
  const dataSource: any = {
    transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)),
  };
  const empty = {} as any;
  const svc = new AppointmentsService(
    apptRepo,
    empty, // Order
    empty, // Customer
    empty, // Vehicle
    empty, // User
    empty, // Location
    dataSource,
    empty, // Tenant
  );
  return { svc, saved };
}

describe('AppointmentsService · Termin-Erinnerung nach Verschieben (Finding #5)', () => {
  it('patchTime auf spaeteren Kalendertag -> erinnerungGesendetAm zurueckgesetzt (null)', async () => {
    const { svc, saved } = makeSvc();
    await svc.patchTime(USER, 'a1', {
      start: '2026-07-15T09:00:00',
      ende: '2026-07-15T10:00:00',
    } as any);
    expect(saved).toHaveLength(1);
    expect(saved[0].erinnerungGesendetAm).toBeNull();
  });

  it('patchTime am SELBEN Tag (nur Stunden spaeter) -> Marker bleibt erhalten (keine 2. Erinnerung)', async () => {
    const { svc, saved } = makeSvc();
    await svc.patchTime(USER, 'a1', {
      start: '2026-07-10T15:00:00',
      ende: '2026-07-10T16:00:00',
    } as any);
    expect(saved).toHaveLength(1);
    expect(saved[0].erinnerungGesendetAm).toEqual(ERINNERT_AM);
  });

  it('patchTime auf einen FRUEHEREN Tag -> Marker bleibt erhalten (kein erneutes Erinnern)', async () => {
    const { svc, saved } = makeSvc();
    await svc.patchTime(USER, 'a1', {
      start: '2026-07-08T09:00:00',
      ende: '2026-07-08T10:00:00',
    } as any);
    expect(saved).toHaveLength(1);
    expect(saved[0].erinnerungGesendetAm).toEqual(ERINNERT_AM);
  });

  it('update (Drag im Formular) auf spaeteren Tag -> Marker zurueckgesetzt', async () => {
    const { svc, saved } = makeSvc();
    await svc.update(USER, 'a1', {
      start: '2026-07-20T09:00:00',
      ende: '2026-07-20T10:00:00',
    } as any);
    expect(saved).toHaveLength(1);
    expect(saved[0].erinnerungGesendetAm).toBeNull();
  });
});
