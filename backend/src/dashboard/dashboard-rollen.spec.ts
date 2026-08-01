import { DashboardService } from './dashboard.service';
import { UserRole } from '../users/entities/user.entity';

/**
 * Rollen-Gating der Dashboard-Kennzahlen (Chef-Zahlen-Leak).
 *
 * Der Befund: JEDE Rolle bekam Monatsumsatz, 6-Monats-Trend, offene Rechnungen
 * und umsatzstaerkste Leistungen — auch der Techniker. Diese Tests nageln fest:
 *  - TECHNICIAN erhaelt KEIN einziges Geld-Feld (weder Umsatz noch offene Posten)
 *    UND es wird dafuer gar nicht erst eine Rechnungs-/Umsatz-Query abgesetzt.
 *  - RECEPTIONIST erhaelt die offenen Forderungen (Debitoren-Arbeitsliste),
 *    aber KEIN Umsatz/Trend/Top-Leistungen/Angebote.
 *  - OWNER (Leitung) bekommt weiterhin alle Kennzahlen.
 *
 * Geprueft wird die Antwortstruktur EXPLIZIT (Feld an/abwesend), damit eine
 * spaetere Regression — etwa ein versehentlich wieder eingefuehrtes Umsatzfeld —
 * auffaellt und nicht an einem blossen "ist definiert" vorbeirutscht.
 */

// Chainbarer QueryBuilder-Mock (deckt getRawOne/getRawMany/getManyAndCount ab).
function chainQb(resolves: {
  rawOne?: unknown;
  rawMany?: unknown[];
  manyAndCount?: [unknown[], number];
} = {}) {
  const qb: any = {};
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'innerJoin',
    'groupBy',
    'orderBy',
    'limit',
    'take',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawOne = jest.fn().mockResolvedValue(resolves.rawOne ?? { summe: '250', anzahl: '4' });
  qb.getRawMany = jest
    .fn()
    .mockResolvedValue(resolves.rawMany ?? [{ name: 'Politur', umsatz: '500', anzahl: '3' }]);
  qb.getManyAndCount = jest.fn().mockResolvedValue(resolves.manyAndCount ?? [[], 0]);
  return qb;
}

function buildService() {
  const orderRepo: any = {
    count: jest.fn().mockResolvedValue(5),
    find: jest.fn().mockResolvedValue([]),
    // Nur topLeistungen nutzt den QueryBuilder des orderRepo.
    createQueryBuilder: jest.fn(() => chainQb()),
  };
  const apptRepo: any = {
    count: jest.fn().mockResolvedValue(2),
    find: jest.fn().mockResolvedValue([]),
  };
  const customerRepo: any = {
    count: jest.fn().mockResolvedValue(10),
    find: jest.fn().mockResolvedValue([]),
  };
  const vehicleRepo: any = { find: jest.fn().mockResolvedValue([]) };
  // Alle Rechnungs-/Umsatz-Aggregate laufen ueber invoiceRepo.createQueryBuilder.
  const invoiceRepo: any = { createQueryBuilder: jest.fn(() => chainQb()) };
  const productRepo: any = { createQueryBuilder: jest.fn(() => chainQb()) };

  const svc = new DashboardService(orderRepo, apptRepo, customerRepo, vehicleRepo, invoiceRepo, productRepo);
  return { svc, orderRepo, apptRepo, customerRepo, vehicleRepo, invoiceRepo, productRepo };
}

// Erwartete Feldgruppen im Response.
const BASIS_FELDER = [
  'offeneAuftraege',
  'termineHeute',
  'kundenGesamt',
  'offeneAuftragsListe',
  'kommendeTermine',
  'termineHeuteListe',
  'niedrigerBestand',
];
const OFFENE_POSTEN_FELDER = ['offeneRechnungenSumme', 'offeneRechnungenAnzahl'];
const GELD_FELDER = [
  'umsatzBezahlt',
  'umsatzMonat',
  'umsatzVormonat',
  'umsatzDeltaProzent',
  'umsatzTrend',
  'topLeistungen',
  'offeneAngeboteSumme',
  'offeneAngeboteAnzahl',
];

describe('DashboardService · Rollen-Gating der Geld-Kennzahlen', () => {
  it('TECHNICIAN: nur operative Basis-Kennzahlen, KEIN Geld-Feld', async () => {
    const { svc, invoiceRepo, orderRepo } = buildService();
    const res = (await svc.stats('t1', UserRole.TECHNICIAN)) as Record<string, unknown>;

    for (const k of BASIS_FELDER) expect(res).toHaveProperty(k);
    for (const k of [...OFFENE_POSTEN_FELDER, ...GELD_FELDER]) expect(res).not.toHaveProperty(k);

    // Beweis "gar nicht erst berechnet": keine Rechnungs-/Umsatz-Aggregate.
    expect(invoiceRepo.createQueryBuilder).not.toHaveBeenCalled();
    // topLeistungen ist das einzige orderRepo-QueryBuilder-Aggregat -> auch nicht.
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('RECEPTIONIST: offene Forderungen ja, Umsatz/Trend/Top/Angebote NEIN', async () => {
    const { svc, orderRepo } = buildService();
    const res = (await svc.stats('t1', UserRole.RECEPTIONIST)) as Record<string, unknown>;

    for (const k of BASIS_FELDER) expect(res).toHaveProperty(k);
    for (const k of OFFENE_POSTEN_FELDER) expect(res).toHaveProperty(k);
    expect(typeof res.offeneRechnungenSumme).toBe('number');
    expect(typeof res.offeneRechnungenAnzahl).toBe('number');

    // KEINE Umsatz-Kennzahlen (weder Feld noch Berechnung).
    for (const k of GELD_FELDER) expect(res).not.toHaveProperty(k);
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled(); // topLeistungen
  });

  it('OWNER: erhaelt weiterhin alle Kennzahlen (Struktur explizit geprueft)', async () => {
    const { svc, orderRepo } = buildService();
    const res = (await svc.stats('t1', UserRole.OWNER)) as Record<string, unknown>;

    for (const k of [...BASIS_FELDER, ...OFFENE_POSTEN_FELDER, ...GELD_FELDER]) {
      expect(res).toHaveProperty(k);
    }
    // Typen/Form explizit — nicht nur "ist definiert".
    expect(typeof res.umsatzBezahlt).toBe('number');
    expect(typeof res.umsatzMonat).toBe('number');
    expect(typeof res.offeneRechnungenSumme).toBe('number');
    expect(Array.isArray(res.umsatzTrend)).toBe(true);
    expect(Array.isArray(res.topLeistungen)).toBe(true);
    // umsatzstaerkste Leistung durchgereicht (topLeistungen wirklich berechnet).
    expect(orderRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('OWNER: MANAGER wird identisch behandelt (Leitung)', async () => {
    const { svc } = buildService();
    const res = (await svc.stats('t1', UserRole.MANAGER)) as Record<string, unknown>;
    for (const k of GELD_FELDER) expect(res).toHaveProperty(k);
  });

  it('bleibt strikt tenant-gescoped (tenantId in jeder Basis-Query)', async () => {
    const { svc, orderRepo, apptRepo, customerRepo } = buildService();
    await svc.stats('mandant-x', UserRole.TECHNICIAN);

    expect(orderRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'mandant-x' }) }),
    );
    expect(apptRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'mandant-x' }) }),
    );
    expect(customerRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'mandant-x' }) }),
    );
  });
});
