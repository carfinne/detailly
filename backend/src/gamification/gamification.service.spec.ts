import { GamificationService, buildTrack, SCHWELLEN } from './gamification.service';

/** Chainbarer QueryBuilder-Mock: alle Chain-Methoden geben sich selbst zurueck. */
function makeQb(rawOne?: any, rawMany?: any) {
  const qb: any = {};
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
    'limit',
    'innerJoin',
  ]) {
    qb[m] = () => qb;
  }
  qb.getRawOne = jest.fn().mockResolvedValue(rawOne);
  qb.getRawMany = jest.fn().mockResolvedValue(rawMany ?? []);
  return qb;
}

describe('buildTrack', () => {
  it('errechnet erreichte Stufe + Fortschritt zur naechsten', () => {
    const t = buildTrack('auftraege', 60, SCHWELLEN.auftraege); // Schwellen 10/50/100/...
    expect(t.stufeIndex).toBe(1); // 50 erreicht, 100 noch nicht
    expect(t.naechsteSchwelle).toBe(100);
    expect(t.fortschrittProzent).toBe(60); // 60 / 100
    expect(t.erreicht).toBe(true);
  });

  it('noch keine Stufe erreicht -> stufeIndex -1, Fortschritt zur ersten Schwelle', () => {
    const t = buildTrack('kunden', 4, SCHWELLEN.kunden); // erste Schwelle 10
    expect(t.stufeIndex).toBe(-1);
    expect(t.naechsteSchwelle).toBe(10);
    expect(t.fortschrittProzent).toBe(40);
    expect(t.erreicht).toBe(false);
  });

  it('hoechste Stufe erreicht -> naechsteSchwelle null, Fortschritt 100', () => {
    const t = buildTrack('jubilaeum', 12, SCHWELLEN.jubilaeum); // hoechste 10
    expect(t.stufeIndex).toBe(SCHWELLEN.jubilaeum.length - 1);
    expect(t.naechsteSchwelle).toBeNull();
    expect(t.fortschrittProzent).toBe(100);
  });
});

describe('GamificationService · achievements', () => {
  it('baut alle Tracks + Leistung des Monats aus tenant-gefilterten Aggregaten', async () => {
    const orderRepo: any = {
      count: jest.fn().mockResolvedValue(120), // Gesamt-Auftraege (nicht storniert)
      createQueryBuilder: jest
        .fn()
        // 1) Kategorie-Zaehlung (GROUP BY serviceType)
        .mockReturnValueOnce(
          makeQb(undefined, [
            { serviceType: 'folierung', anzahl: '70' },
            { serviceType: 'aufbereitung', anzahl: '40' },
            { serviceType: 'ppf', anzahl: '10' },
          ]),
        )
        // 2) Leistung des Monats (LIMIT 1)
        .mockReturnValueOnce(makeQb({ name: 'Keramikversiegelung', anzahl: '8', umsatz: '2400' }))
        // 3) Top-Kategorie des Monats (LIMIT 1)
        .mockReturnValueOnce(makeQb({ kategorie: 'folierung', anzahl: '9' })),
    };
    const invoiceRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb({ summe: '75000' })),
    };
    const customerRepo: any = { count: jest.fn().mockResolvedValue(55) };
    const userRepo: any = {};
    const tenantRepo: any = {
      findOne: jest.fn().mockResolvedValue({
        name: 'Glanzwerk',
        createdAt: new Date(Date.now() - 400 * 86_400_000), // > 1 Jahr alt
      }),
    };

    const svc = new GamificationService(orderRepo, invoiceRepo, customerRepo, userRepo, tenantRepo);
    const res = await svc.achievements('t1');

    const byKey = Object.fromEntries(res.tracks.map((t) => [t.key, t]));
    expect(byKey.auftraege.wert).toBe(120);
    expect(byKey.auftraege.stufeIndex).toBe(2); // 100 erreicht, 250 noch nicht
    expect(byKey.umsatz.wert).toBe(75000);
    expect(byKey.umsatz.stufeIndex).toBe(1); // 50k erreicht
    expect(byKey.kunden.wert).toBe(55);
    expect(byKey.folierung.wert).toBe(70);
    expect(byKey.aufbereitung.wert).toBe(40);
    expect(byKey.ppf.wert).toBe(10);
    expect(byKey.jubilaeum.wert).toBe(1); // ~400 Tage -> 1 Jahr

    expect(res.leistungDesMonats).toEqual({ name: 'Keramikversiegelung', anzahl: 8, umsatz: 2400 });
    expect(res.topKategorieMonat).toEqual({ kategorie: 'folierung', anzahl: 9 });
    expect(res.betriebsalterTage).toBeGreaterThanOrEqual(399);
  });

  it('leerer Betrieb: alle Werte 0, keine Leistung des Monats, kein Jubilaeum', async () => {
    const orderRepo: any = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(makeQb(undefined, []))
        .mockReturnValueOnce(makeQb(undefined))
        .mockReturnValueOnce(makeQb(undefined)),
    };
    const invoiceRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(makeQb({ summe: '0' })) };
    const customerRepo: any = { count: jest.fn().mockResolvedValue(0) };
    const tenantRepo: any = {
      findOne: jest.fn().mockResolvedValue({ name: 'Neu', createdAt: new Date() }),
    };

    const svc = new GamificationService(orderRepo, invoiceRepo, customerRepo, {} as any, tenantRepo);
    const res = await svc.achievements('t1');

    expect(res.tracks.every((t) => t.wert === 0)).toBe(true);
    expect(res.tracks.every((t) => t.stufeIndex === -1)).toBe(true);
    expect(res.leistungDesMonats).toBeNull();
    expect(res.topKategorieMonat).toBeNull();
  });
});

describe('GamificationService · leaderboard', () => {
  it('rankt zugeordnete Mitarbeiter (Anzahl, Tie-Break Umsatz) und weist Nicht-Zugeordnete separat aus', async () => {
    const rows = [
      { userId: 'u1', anzahl: '5', umsatz: '5000' },
      { userId: 'u2', anzahl: '5', umsatz: '9000' }, // gleiche Anzahl, hoeherer Umsatz -> Rang 1
      { userId: 'u3', anzahl: '2', umsatz: '1000' },
      { userId: null, anzahl: '3', umsatz: '1500' }, // nicht zugeordnet
    ];
    const orderRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(makeQb(undefined, rows)) };
    const userRepo: any = {
      find: jest.fn().mockResolvedValue([
        { id: 'u1', firstName: 'Anna', lastName: 'Berg', isActive: true },
        { id: 'u2', firstName: 'Ben', lastName: 'Kraus', isActive: true },
        // u3 fehlt -> ehemaliger Mitarbeiter
      ]),
    };

    const svc = new GamificationService(orderRepo, {} as any, {} as any, userRepo, {} as any);
    const res = await svc.leaderboard('t1', 'jahr');

    expect(res.zeitraum).toBe('jahr');
    expect(res.eintraege.map((e) => [e.rang, e.name])).toEqual([
      [1, 'Ben Kraus'],
      [2, 'Anna Berg'],
      [3, 'Ehemaliger Mitarbeiter'],
    ]);
    expect(res.eintraege[0].umsatz).toBe(9000);
    expect(res.eintraege[2].aktiv).toBe(false);
    expect(res.nichtZugeordnet).toEqual({ anzahlAuftraege: 3, umsatz: 1500 });
  });

  it('ungueltiger Zeitraum faellt auf "monat" zurueck; keine User-Abfrage ohne Zuordnungen', async () => {
    const orderRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(makeQb(undefined, [])) };
    const userRepo: any = { find: jest.fn() };

    const svc = new GamificationService(orderRepo, {} as any, {} as any, userRepo, {} as any);
    const res = await svc.leaderboard('t1', 'quatsch');

    expect(res.zeitraum).toBe('monat');
    expect(res.eintraege).toEqual([]);
    expect(res.nichtZugeordnet).toEqual({ anzahlAuftraege: 0, umsatz: 0 });
    expect(userRepo.find).not.toHaveBeenCalled();
  });
});

describe('GamificationService · wrapped', () => {
  it('aggregiert Jahres-Kennzahlen + staerksten Monat aus eigenen Daten', async () => {
    const orderRepo: any = {
      count: jest.fn().mockResolvedValue(48),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(makeQb({ name: 'Vollfolierung', anzahl: '12' })) // Top-Leistung
        .mockReturnValueOnce(makeQb({ kategorie: 'ppf', anzahl: '20' })), // Top-Kategorie
    };
    // Total-Umsatz + 12 Monatswerte: der 1. Aufruf ist das Jahr, danach die Monate.
    let call = 0;
    const invoiceRepo: any = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        call += 1;
        // call 1 = Jahressumme (30000); Monat 3 (call 4) = 8000 als Maximum.
        const summe = call === 1 ? '30000' : call === 4 ? '8000' : '1000';
        return makeQb({ summe });
      }),
    };
    const customerRepo: any = { count: jest.fn().mockResolvedValue(17) };
    const tenantRepo: any = { findOne: jest.fn().mockResolvedValue({ name: 'Glanzwerk' }) };

    const svc = new GamificationService(orderRepo, invoiceRepo, customerRepo, {} as any, tenantRepo);
    const res = await svc.wrapped('t1', 2026);

    expect(res.jahr).toBe(2026);
    expect(res.betriebsname).toBe('Glanzwerk');
    expect(res.anzahlAuftraege).toBe(48);
    expect(res.umsatz).toBe(30000);
    expect(res.topLeistung).toEqual({ name: 'Vollfolierung', anzahl: 12 });
    expect(res.topKategorie).toBe('ppf');
    expect(res.neueKunden).toBe(17);
    expect(res.staerksterMonat?.umsatz).toBe(8000);
  });
});
