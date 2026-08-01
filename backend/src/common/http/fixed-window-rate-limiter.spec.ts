import { FixedWindowRateLimiter, createRateLimitMiddleware } from './fixed-window-rate-limiter';

describe('FixedWindowRateLimiter', () => {
  it('erlaubt bis zum Limit und blockt danach', () => {
    let t = 1000;
    const lim = new FixedWindowRateLimiter(3, 60_000, 10000, () => t);
    expect(lim.hit('ip')).toBe(true);
    expect(lim.hit('ip')).toBe(true);
    expect(lim.hit('ip')).toBe(true);
    expect(lim.hit('ip')).toBe(false); // 4. Anfrage im selben Fenster -> blockiert
    expect(lim.hit('ip')).toBe(false);
  });

  it('setzt nach Ablauf des Fensters zurueck', () => {
    let t = 0;
    const lim = new FixedWindowRateLimiter(1, 60_000, 10000, () => t);
    expect(lim.hit('ip')).toBe(true);
    expect(lim.hit('ip')).toBe(false);
    t += 60_000; // Fenster abgelaufen
    expect(lim.hit('ip')).toBe(true);
  });

  it('zaehlt je Schluessel (IP) getrennt', () => {
    let t = 0;
    const lim = new FixedWindowRateLimiter(1, 60_000, 10000, () => t);
    expect(lim.hit('ip-a')).toBe(true);
    expect(lim.hit('ip-b')).toBe(true);
    expect(lim.hit('ip-a')).toBe(false);
  });

  it('haelt den eigenen Speicher beschraenkt (kein unbegrenzter Vektor)', () => {
    let t = 0;
    const maxKeys = 100;
    const lim = new FixedWindowRateLimiter(5, 60_000, maxKeys, () => t);
    // Zehntausend verschiedene IPs (der Memory-DoS-Vektor gegen den Limiter selbst).
    for (let i = 0; i < 10000; i++) lim.hit(`ip-${i}`);
    expect(lim.size).toBeLessThanOrEqual(maxKeys);
  });

  it('fegt abgelaufene Fenster beim Aufraeumen (Speicher schrumpft wieder)', () => {
    let t = 0;
    const maxKeys = 50;
    const lim = new FixedWindowRateLimiter(1, 1000, maxKeys, () => t);
    for (let i = 0; i < 50; i++) lim.hit(`ip-${i}`); // fuellt bis ans Maximum
    t += 5000; // alle Fenster abgelaufen
    lim.hit('spaeter'); // loest das Aufraeumen (Sweep) aus
    expect(lim.size).toBeLessThanOrEqual(maxKeys);
  });
});

describe('createRateLimitMiddleware', () => {
  function fakeRes() {
    return {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
  }

  it('ruft next() bis zum Limit und antwortet danach mit 429 + Retry-After', () => {
    let t = 0;
    const mw = createRateLimitMiddleware({ limit: 2, windowMs: 60_000, now: () => t });
    const req = { ip: '1.2.3.4' } as any;

    const next1 = jest.fn();
    mw(req, fakeRes(), next1);
    expect(next1).toHaveBeenCalled();

    const next2 = jest.fn();
    mw(req, fakeRes(), next2);
    expect(next2).toHaveBeenCalled();

    // 3. Anfrage im Fenster -> geblockt.
    const res3 = fakeRes();
    const next3 = jest.fn();
    mw(req, res3, next3);
    expect(next3).not.toHaveBeenCalled();
    expect(res3.status).toHaveBeenCalledWith(429);
    expect(res3.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
  });

  it('trennt nach IP (eine geblockte IP sperrt keine andere)', () => {
    let t = 0;
    const mw = createRateLimitMiddleware({ limit: 1, windowMs: 60_000, now: () => t });

    const nextA = jest.fn();
    mw({ ip: 'a' } as any, fakeRes(), nextA);
    expect(nextA).toHaveBeenCalled();

    const resA2 = fakeRes();
    mw({ ip: 'a' } as any, resA2, jest.fn());
    expect(resA2.status).toHaveBeenCalledWith(429);

    // Andere IP ist unberuehrt.
    const nextB = jest.fn();
    mw({ ip: 'b' } as any, fakeRes(), nextB);
    expect(nextB).toHaveBeenCalled();
  });
});
