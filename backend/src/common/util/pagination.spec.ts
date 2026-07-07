import { clampPageQuery } from './pagination';

describe('clampPageQuery (T-010)', () => {
  it('Defaults: page 1, limit 50', () => {
    expect(clampPageQuery()).toEqual({ page: 1, limit: 50, skip: 0, take: 50 });
    expect(clampPageQuery({})).toEqual({ page: 1, limit: 50, skip: 0, take: 50 });
  });

  it('limit wird auf max 100 gedeckelt', () => {
    expect(clampPageQuery({ limit: 9999 }).limit).toBe(100);
  });

  it('untere Klammer: limit=0/negativ -> 1 (vorher leere Liste bei customers)', () => {
    expect(clampPageQuery({ limit: 0 }).limit).toBe(1);
    expect(clampPageQuery({ limit: -5 }).limit).toBe(1);
  });

  it('page mindestens 1, skip korrekt', () => {
    expect(clampPageQuery({ page: 0 }).page).toBe(1);
    expect(clampPageQuery({ page: -3 }).skip).toBe(0);
    expect(clampPageQuery({ page: 3, limit: 50 })).toEqual({
      page: 3,
      limit: 50,
      skip: 100,
      take: 50,
    });
  });

  it('NaN (parseInt von Nicht-Zahlen) faellt still auf Defaults zurueck', () => {
    expect(clampPageQuery({ page: NaN, limit: NaN })).toEqual({
      page: 1,
      limit: 50,
      skip: 0,
      take: 50,
    });
  });

  it('krumme Werte werden abgerundet', () => {
    expect(clampPageQuery({ page: 2.7, limit: 10.9 })).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
      take: 10,
    });
  });

  it('abweichende Optionen (z.B. anderes Default-Limit) greifen', () => {
    expect(clampPageQuery({}, { defaultLimit: 25, maxLimit: 200 }).limit).toBe(25);
    expect(clampPageQuery({ limit: 150 }, { maxLimit: 200 }).limit).toBe(150);
  });
});
