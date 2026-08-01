import { DashboardService } from './dashboard.service';
import { UserRole } from '../users/entities/user.entity';

/**
 * Onboarding-Setup-Flags im Dashboard (`stats()` -> Basis-Objekt fuer JEDE Rolle):
 *  - `oeffentlichesProfilAktiv` = settings.mitgliedProfil.zeigen === true
 *    (Opt-in fuer das oeffentliche Profil/Verzeichnis; der Auffindbarkeits-Hebel).
 *  - `steuerGesetzt` = settings.steuer.entschiedenAm ist gesetzt (der Betrieb hat
 *    die §19-Entscheidung EINMAL bewusst gespeichert, nicht nur der Default).
 *
 * Diese Flags sind NICHT geldsensibel und muessen daher fuer alle Rollen (auch den
 * Techniker) korrekt geliefert werden. Geprueft wird ausserdem die Tenant-Isolation
 * (Lookup ueber die PK `id` = tenantId aus dem Token).
 */

// Minimaler chainbarer QueryBuilder-Mock (fuer die uebrigen Aggregate irrelevant –
// hier zaehlt nur, dass stats() durchlaeuft und das Basis-Objekt liefert).
function chainQb() {
  const qb: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'innerJoin', 'groupBy', 'orderBy', 'limit', 'take']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawOne = jest.fn().mockResolvedValue({ summe: '0', anzahl: '0' });
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return qb;
}

// Baut den Service mit einem Tenant-Repo, dessen `settings` frei setzbar sind.
function buildService(settings: Record<string, unknown>) {
  const orderRepo: any = {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => chainQb()),
  };
  const apptRepo: any = { count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]) };
  const customerRepo: any = { count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]) };
  const vehicleRepo: any = { find: jest.fn().mockResolvedValue([]) };
  const invoiceRepo: any = { createQueryBuilder: jest.fn(() => chainQb()) };
  const productRepo: any = { createQueryBuilder: jest.fn(() => chainQb()) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 't1', settings }) };

  const svc = new DashboardService(
    orderRepo, apptRepo, customerRepo, vehicleRepo, invoiceRepo, productRepo, tenantRepo,
  );
  return { svc, tenantRepo };
}

describe('DashboardService · Onboarding-Setup-Flags', () => {
  it('oeffentliches Profil AKTIV (zeigen=true) -> oeffentlichesProfilAktiv=true', async () => {
    const { svc } = buildService({ mitgliedProfil: { zeigen: true } });
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.oeffentlichesProfilAktiv).toBe(true);
  });

  it('oeffentliches Profil INAKTIV (zeigen=false) -> oeffentlichesProfilAktiv=false', async () => {
    const { svc } = buildService({ mitgliedProfil: { zeigen: false } });
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.oeffentlichesProfilAktiv).toBe(false);
  });

  it('kein mitgliedProfil-Block (Altbestand) -> oeffentlichesProfilAktiv=false', async () => {
    const { svc } = buildService({});
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.oeffentlichesProfilAktiv).toBe(false);
  });

  it('Steuer bewusst gesetzt (entschiedenAm gesetzt) -> steuerGesetzt=true', async () => {
    const { svc } = buildService({ steuer: { kleinunternehmer: false, entschiedenAm: '2026-08-01T10:00:00.000Z' } });
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.steuerGesetzt).toBe(true);
  });

  it('Steuer NUR im Default (entschiedenAm fehlt) -> steuerGesetzt=false', async () => {
    // Ein gespeichertes kleinunternehmer=false OHNE entschiedenAm bleibt "nicht
    // bewusst gesetzt" – genau der Fall, den das additive Signal ehrlich abgrenzt.
    const { svc } = buildService({ steuer: { kleinunternehmer: false } });
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.steuerGesetzt).toBe(false);
  });

  it('kein steuer-Block (Altbestand) -> steuerGesetzt=false', async () => {
    const { svc } = buildService({});
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.steuerGesetzt).toBe(false);
  });

  it('Flags werden auch dem TECHNICIAN geliefert (nicht geldsensibel)', async () => {
    const { svc } = buildService({ mitgliedProfil: { zeigen: true }, steuer: { entschiedenAm: '2026-08-01T10:00:00.000Z' } });
    const res = (await svc.stats('t1', UserRole.TECHNICIAN)) as Record<string, unknown>;
    expect(res).toHaveProperty('oeffentlichesProfilAktiv', true);
    expect(res).toHaveProperty('steuerGesetzt', true);
  });

  it('ist tenant-gescoped: Lookup ueber die PK id (= tenantId aus dem Token)', async () => {
    const { svc, tenantRepo } = buildService({});
    await svc.stats('mandant-y', UserRole.OWNER);
    expect(tenantRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'mandant-y' }) }),
    );
  });

  it('unbekannter Tenant (findOne -> null) -> beide Flags false, kein Throw', async () => {
    const { svc, tenantRepo } = buildService({});
    tenantRepo.findOne.mockResolvedValueOnce(null);
    const res = (await svc.stats('t-unknown', UserRole.OWNER)) as Record<string, unknown>;
    expect(res.oeffentlichesProfilAktiv).toBe(false);
    expect(res.steuerGesetzt).toBe(false);
  });
});
