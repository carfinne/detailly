import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die Termin-Plausibilitaet (ende > start) in create und update.
 * Optionale Fremdschluessel werden nicht gesetzt -> assertRefs greift nicht auf
 * die (leeren) Repos zu.
 */

const USER: AuthUser = { id: 'u1', email: 'op@betrieb.de', role: 'owner', tenantId: 't1' } as AuthUser;

const START = '2026-07-01T10:00:00.000Z';
const ENDE = '2026-07-01T11:00:00.000Z';

function makeSvc() {
  const saved: any[] = [];
  const repo: any = {
    // Bestand fuer update: start 10:00, ende 11:00.
    findOne: jest.fn(async () => ({
      id: 'a1',
      tenantId: 't1',
      start: new Date(START),
      ende: new Date(ENDE),
    })),
  };
  // create/update speichern jetzt in einer Transaktion (Doppelbuchungs-Schutz):
  // Manager mit Tenant-Settings-Read (-> Defaults), create + save.
  const manager: any = {
    findOne: jest.fn(async () => null), // Tenant-Settings fehlen -> Defaults
    create: jest.fn((_entity: any, data: any) => ({ ...data })),
    save: jest.fn(async (obj: any) => {
      saved.push(obj);
      return { id: 'a1', ...obj };
    }),
  };
  const dataSource: any = { transaction: jest.fn(async (cb: (m: any) => Promise<any>) => cb(manager)) };
  const empty = {};
  const svc = new AppointmentsService(
    repo,
    empty as any,
    empty as any,
    empty as any,
    empty as any,
    empty as any,
    dataSource,
    empty as any, // Tenant-Repo (nur vom Umsatz-Aggregat genutzt)
  );
  return { svc, saved };
}

describe('AppointmentsService - Termin-Plausibilitaet (ende > start)', () => {
  it('create: gueltiger Zeitraum wird gespeichert', async () => {
    const { svc, saved } = makeSvc();
    await svc.create(USER, { titel: 'T', start: START, ende: ENDE } as any);
    expect(saved).toHaveLength(1);
  });

  it('create: ende == start -> BadRequest, kein Save', async () => {
    const { svc, saved } = makeSvc();
    await expect(svc.create(USER, { titel: 'T', start: START, ende: START } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(saved).toHaveLength(0);
  });

  it('create: ende < start -> BadRequest', async () => {
    const { svc } = makeSvc();
    await expect(svc.create(USER, { titel: 'T', start: ENDE, ende: START } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('update: Teil-Update auf ende < bestehender start -> BadRequest, kein Save', async () => {
    const { svc, saved } = makeSvc();
    // Bestand start 10:00; neues ende 09:00 -> ende < start.
    await expect(
      svc.update(USER, 'a1', { ende: '2026-07-01T09:00:00.000Z' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  it('update: gueltiges Teil-Update wird gespeichert', async () => {
    const { svc, saved } = makeSvc();
    await svc.update(USER, 'a1', { ende: '2026-07-01T12:00:00.000Z' } as any);
    expect(saved).toHaveLength(1);
  });
});
