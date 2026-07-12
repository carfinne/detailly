import { VerschnittService } from './verschnitt.service';

/** materialRepo-Mock: `find` fuer forOrder, `createQueryBuilder` fuer aggregat. */
function makeService(over: { zeilen?: any[]; rows?: any[] } = {}) {
  const qb: any = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn().mockResolvedValue(over.rows ?? []);
  const materialRepo: any = {
    find: jest.fn().mockResolvedValue(over.zeilen ?? []),
    createQueryBuilder: jest.fn(() => qb),
  };
  return { svc: new VerschnittService(materialRepo), materialRepo, qb };
}

describe('VerschnittService · forOrder', () => {
  it('mit Planzahl: geplant/verbraucht summiert, Prozent + Bewertung berechnet', async () => {
    const { svc } = makeService({ zeilen: [{ menge: '11', geplantLfm: '10', folienRolleId: null }] });
    const k = await svc.forOrder('t1', 'o1');
    expect(k).toMatchObject({
      orderId: 'o1',
      geplantLfm: 10,
      verbrauchtLfm: 11,
      verschnittLfm: 1,
      verschnittProzent: 10,
      bewertung: 'warnung',
    });
  });

  it('ohne Planzahl (Rollen-Zeile): geplant/Verschnitt null, verbraucht dennoch sichtbar', async () => {
    const { svc } = makeService({ zeilen: [{ menge: '3', geplantLfm: null, folienRolleId: 'r1' }] });
    const k = await svc.forOrder('t1', 'o1');
    expect(k).toMatchObject({
      geplantLfm: null,
      verbrauchtLfm: 3,
      verschnittLfm: null,
      verschnittProzent: null,
      bewertung: null,
    });
  });

  it('keine Folien-Zeilen (nur Stueck-Verbrauch) -> verbraucht 0, geplant null', async () => {
    const { svc } = makeService({ zeilen: [{ menge: '5', geplantLfm: null, folienRolleId: null }] });
    const k = await svc.forOrder('t1', 'o1');
    expect(k).toMatchObject({ geplantLfm: null, verbrauchtLfm: 0, bewertung: null });
  });

  it.each([
    ['10.4', 'gut'],
    ['10.8', 'warnung'],
    ['12', 'kritisch'],
  ])('Bewertungsschwellen: verbraucht %s bei Plan 10 -> %s', async (menge, erwartet) => {
    const { svc } = makeService({ zeilen: [{ menge, geplantLfm: '10', folienRolleId: null }] });
    const k = await svc.forOrder('t1', 'o1');
    expect(k.bewertung).toBe(erwartet);
  });
});

describe('VerschnittService · aggregat', () => {
  it('mappt Produktzeilen, summiert das Tenant-Total und sortiert nach Verschnitt', async () => {
    const { svc } = makeService({
      rows: [
        { productId: 'p1', produktName: '3M 2080', verbraucht: '11', geplant: '10', auftraege: '2' },
        { productId: 'p2', produktName: 'Avery', verbraucht: '5', geplant: null, auftraege: '1' },
      ],
    });
    const agg = await svc.aggregat('t1', '2026-01-01', '2026-12-31');
    // Tenant-Total: verbraucht 16, geplant 10 -> Verschnitt 6 (60 %) -> kritisch.
    expect(agg).toMatchObject({ geplantLfm: 10, verbrauchtLfm: 16, verschnittLfm: 6, bewertung: 'kritisch' });
    // Schlimmster Verschnitt zuerst; Zeile ohne Planzahl ans Ende.
    expect(agg.proProdukt.map((p) => p.productId)).toEqual(['p1', 'p2']);
    expect(agg.proProdukt[0]).toMatchObject({ verschnittProzent: 10, bewertung: 'warnung', auftraege: 2 });
    expect(agg.proProdukt[1]).toMatchObject({ geplantLfm: null, verbrauchtLfm: 5, bewertung: null });
  });

  it('leerer Zeitraum: geplant null, verbraucht 0, keine Produktzeilen', async () => {
    const { svc } = makeService({ rows: [] });
    const agg = await svc.aggregat('t1');
    expect(agg).toMatchObject({ geplantLfm: null, verbrauchtLfm: 0, bewertung: null });
    expect(agg.proProdukt).toEqual([]);
  });
});
