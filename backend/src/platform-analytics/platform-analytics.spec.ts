import {
  PlatformAnalyticsService,
  trialAuslaufGrenze,
  berlinTageBisAblauf,
  istTrialAuslaufend,
  istTrialAbgelaufen,
} from './platform-analytics.service';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { berlinWallToUtc, berlinYMDvonInstant } from '../kassenbuch/kassenbuch-zeit';

function qb(opts: { rawOne?: any; rawMany?: any }) {
  const o: any = {};
  for (const m of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit']) {
    o[m] = () => o;
  }
  o.getRawOne = jest.fn().mockResolvedValue(opts.rawOne);
  o.getRawMany = jest.fn().mockResolvedValue(opts.rawMany ?? []);
  return o;
}

function makeService(repos: any = {}) {
  const def = () => ({ count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn() });
  const svc = new PlatformAnalyticsService(
    repos.tenant ?? def(),
    repos.sub ?? def(),
    repos.plan ?? def(),
    repos.order ?? def(),
    repos.invoice ?? def(),
  );
  return { svc };
}

/** Berliner Wanduhr-Datum (Mittags, DST-sicher) fuer stabile Kalendertag-Tests. */
function berlinTagMittags(offsetTage: number): Date {
  const h = berlinYMDvonInstant(new Date());
  return berlinWallToUtc(h.y, h.m, h.day + offsetTage, 12, 0, 0, 0);
}

describe('PlatformAnalyticsService', () => {
  it('aboUebersicht: ALLE Status (inkl. pilot/pastDue/suspended), MRR, Tarife', async () => {
    const sub: any = {
      count: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          ({ active: 10, trial: 5, canceled: 2, pilot: 3, past_due: 1, suspended: 4 } as any)[where.status] ?? 0,
        ),
      ),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(qb({ rawOne: { mrr: '490' } }))
        .mockReturnValueOnce(qb({ rawMany: [{ name: 'Pro', anzahl: '6' }, { name: 'Starter', anzahl: '4' }] })),
    };
    const { svc } = makeService({ sub });
    const r = await svc.aboUebersicht();
    expect(r).toEqual({
      aktiv: 10, testphase: 5, gekuendigt: 2, pilot: 3, pastDue: 1, suspended: 4, mrr: 490,
      tarife: [{ name: 'Pro', anzahl: 6 }, { name: 'Starter', anzahl: 4 }],
    });
  });

  it('nutzung: Auftraege/Rechnungen gesamt + bezahlter Umsatz aller Betriebe', async () => {
    const order: any = { count: jest.fn().mockResolvedValue(1900), createQueryBuilder: jest.fn() };
    const invoice: any = { count: jest.fn().mockResolvedValue(1500), createQueryBuilder: jest.fn().mockReturnValue(qb({ rawOne: { summe: '412000' } })) };
    const { svc } = makeService({ order, invoice });
    const r = await svc.nutzung();
    expect(r).toEqual({ auftraege: 1900, rechnungen: 1500, umsatzGesamt: 412000 });
  });

  it('betriebsAktivitaet: Top-Betriebe + inaktive (kein Auftrag in 30 Tagen)', async () => {
    const order: any = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(qb({ rawMany: [{ tenantId: 't1', anzahl: '50' }] })) // Top
        .mockReturnValueOnce(qb({ rawMany: [{ tenantId: 't1' }] })), // aktiv (30 Tage)
    };
    const tenant: any = {
      find: jest.fn().mockResolvedValue([{ id: 't1', name: 'Muster GmbH' }, { id: 't2', name: 'Stiller Betrieb' }]),
    };
    const { svc } = makeService({ order, tenant });
    const r = await svc.betriebsAktivitaet();
    expect(r.topBetriebe).toEqual([{ name: 'Muster GmbH', auftraege: 50 }]);
    expect(r.inaktivAnzahl).toBe(1); // t2 hatte keinen Auftrag in 30 Tagen
    expect(r.inaktivBetriebe).toEqual([{ name: 'Stiller Betrieb' }]);
  });

  describe('zahlungenUndBindung (Zahlungs-/Bindungssicht)', () => {
    const morgen = berlinTagMittags(1);
    const letztenMonat = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
    const periodEnde = new Date('2026-08-15T00:00:00.000Z');
    const gekuendigtAm = new Date('2026-08-03T09:00:00.000Z');

    function makeSub() {
      // Reihenfolge im Promise.all: count/QB abwechselnd je Sicht.
      return {
        count: jest
          .fn()
          .mockResolvedValueOnce(2) // Zahlungsprobleme
          .mockResolvedValueOnce(1) // Tests laufen aus
          .mockResolvedValueOnce(1) // Tests abgelaufen
          .mockResolvedValueOnce(1) // Kuendigung zum Laufzeitende
          .mockResolvedValueOnce(1), // Kuendigung diesen Monat
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(
            qb({
              rawMany: [
                { name: 'Alpha GmbH', status: 'past_due', currentPeriodEnd: periodEnde, canceledAt: null },
                { name: 'Beta KG', status: 'suspended', currentPeriodEnd: null, canceledAt: gekuendigtAm },
              ],
            }),
          )
          .mockReturnValueOnce(qb({ rawMany: [{ name: 'Gamma UG', trialEndsAt: morgen }] }))
          .mockReturnValueOnce(qb({ rawMany: [{ name: 'Delta e.K.', trialEndsAt: letztenMonat }] }))
          .mockReturnValueOnce(qb({ rawMany: [{ name: 'Epsilon GmbH', currentPeriodEnd: periodEnde }] }))
          .mockReturnValueOnce(qb({ rawMany: [{ name: 'Zeta AG', canceledAt: gekuendigtAm }] })),
      };
    }

    it('PAST_DUE und SUSPENDED landen beide in Zahlungsprobleme (mit „seit")', async () => {
      const { svc } = makeService({ sub: makeSub() });
      const r = await svc.zahlungenUndBindung();
      expect(r.zahlungsprobleme.anzahl).toBe(2);
      const stat = r.zahlungsprobleme.betriebe.map((b) => b.status).sort();
      expect(stat).toEqual(['past_due', 'suspended']);
      // „seit" = currentPeriodEnd, sonst canceledAt (Fallback).
      const alpha = r.zahlungsprobleme.betriebe.find((b) => b.name === 'Alpha GmbH');
      const beta = r.zahlungsprobleme.betriebe.find((b) => b.name === 'Beta KG');
      expect(alpha?.seit).toBe(periodEnde.toISOString());
      expect(beta?.seit).toBe(gekuendigtAm.toISOString());
    });

    it('Trial mit trialEndsAt morgen erscheint in „Tests laufen aus" (noch 1 Tag)', async () => {
      const { svc } = makeService({ sub: makeSub() });
      const r = await svc.zahlungenUndBindung();
      expect(r.testsLaufenAus.anzahl).toBe(1);
      expect(r.testsLaufenAus.betriebe).toHaveLength(1);
      expect(r.testsLaufenAus.betriebe[0].name).toBe('Gamma UG');
      expect(r.testsLaufenAus.betriebe[0].tageUebrig).toBe(1);
    });

    it('Trial mit trialEndsAt letzten Monat erscheint in „Tests abgelaufen"', async () => {
      const { svc } = makeService({ sub: makeSub() });
      const r = await svc.zahlungenUndBindung();
      expect(r.testsAbgelaufen.anzahl).toBe(1);
      expect(r.testsAbgelaufen.betriebe[0].name).toBe('Delta e.K.');
      expect(r.testsAbgelaufen.betriebe[0].ablauf).toBe(letztenMonat.toISOString());
    });

    it('Kuendigungen: zum Laufzeitende und diesen Monat getrennt gezaehlt', async () => {
      const { svc } = makeService({ sub: makeSub() });
      const r = await svc.zahlungenUndBindung();
      expect(r.kuendigungenZumEnde.anzahl).toBe(1);
      expect(r.kuendigungenZumEnde.betriebe[0]).toEqual({ name: 'Epsilon GmbH', datum: periodEnde.toISOString() });
      expect(r.kuendigungenDiesenMonat.anzahl).toBe(1);
      expect(r.kuendigungenDiesenMonat.betriebe[0]).toEqual({ name: 'Zeta AG', datum: gekuendigtAm.toISOString() });
    });

    it('gibt KEINE Endkundendaten aus (nur Betriebs-/Abo-Felder)', async () => {
      const { svc } = makeService({ sub: makeSub() });
      const r = await svc.zahlungenUndBindung();
      // Erlaubte Feldnamen pro Listeneintrag – nichts darueber hinaus.
      const erlaubt = new Set(['name', 'status', 'seit', 'ablauf', 'tageUebrig', 'datum']);
      const alleZeilen = [
        ...r.zahlungsprobleme.betriebe,
        ...r.testsLaufenAus.betriebe,
        ...r.testsAbgelaufen.betriebe,
        ...r.kuendigungenZumEnde.betriebe,
        ...r.kuendigungenDiesenMonat.betriebe,
      ];
      for (const zeile of alleZeilen) {
        for (const key of Object.keys(zeile)) expect(erlaubt.has(key)).toBe(true);
      }
      // Keine verraeterischen Endkunden-/Fahrzeug-Begriffe in der Antwort.
      const json = JSON.stringify(r).toLowerCase();
      for (const verboten of ['kennzeichen', 'kunde', 'fahrzeug', 'plate', 'vin', 'email', 'telefon']) {
        expect(json).not.toContain(verboten);
      }
    });
  });

  describe('Zeit-/Fenster-Logik (Europe/Berlin, reine Funktionen)', () => {
    const jetzt = new Date();

    it('trialAuslaufGrenze liegt in der Zukunft (~7 Tage)', () => {
      const grenze = trialAuslaufGrenze(jetzt);
      expect(grenze.getTime()).toBeGreaterThan(jetzt.getTime());
      const tage = (grenze.getTime() - jetzt.getTime()) / 86_400_000;
      expect(tage).toBeGreaterThan(6);
      expect(tage).toBeLessThan(9);
    });

    it('berlinTageBisAblauf: morgen = 1, heute = 0', () => {
      expect(berlinTageBisAblauf(berlinTagMittags(1), jetzt)).toBe(1);
      expect(berlinTageBisAblauf(berlinTagMittags(0), jetzt)).toBe(0);
    });

    it('istTrialAuslaufend: morgen ja, letzter Monat nein', () => {
      expect(istTrialAuslaufend(berlinTagMittags(1), jetzt)).toBe(true);
      expect(istTrialAuslaufend(new Date(Date.now() - 32 * 864e5), jetzt)).toBe(false);
    });

    it('istTrialAbgelaufen: letzter Monat ja, morgen nein', () => {
      expect(istTrialAbgelaufen(new Date(Date.now() - 32 * 864e5), jetzt)).toBe(true);
      expect(istTrialAbgelaufen(berlinTagMittags(1), jetzt)).toBe(false);
    });
  });
});
