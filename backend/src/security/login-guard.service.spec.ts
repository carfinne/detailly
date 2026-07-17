import { LoginGuardService } from './login-guard.service';

/**
 * Unit-Tests der In-Memory-Fehlversuchs-Sperre. Reine Logik, kein Nest-Boot /
 * keine DB. Zeit wird ueber den `now`-Parameter injiziert -> deterministisch
 * (kein echter Timer, keine Flakiness).
 */
const MIN = 60 * 1000;

/** Sperrdauer nach genau `k` Fehlversuchen desselben Kontos (frischer Guard). */
function lockMsAfter(k: number): number {
  const g = new LoginGuardService();
  let res = { lockMs: 0 };
  for (let i = 0; i < k; i++) res = g.registerFailure('198.51.100.7', 'a@b.de', 5000) as never;
  return res.lockMs;
}

describe('LoginGuardService – progressive Konto-Schwellen (5/8/12/15)', () => {
  it('unter 5 Fehlversuchen keine Sperre', () => {
    expect(lockMsAfter(4)).toBe(0);
  });

  it('exakte Grenzfaelle 5/8/12/15 setzen 1/5/15/30 min', () => {
    expect(lockMsAfter(5)).toBe(1 * MIN);
    expect(lockMsAfter(8)).toBe(5 * MIN);
    expect(lockMsAfter(12)).toBe(15 * MIN);
    expect(lockMsAfter(15)).toBe(30 * MIN);
  });

  it('Zwischenwerte bleiben auf der zuvor erreichten Stufe', () => {
    expect(lockMsAfter(7)).toBe(1 * MIN); // 5,6,7 -> 1min
    expect(lockMsAfter(11)).toBe(5 * MIN); // 8..11 -> 5min
    expect(lockMsAfter(14)).toBe(15 * MIN); // 12..14 -> 15min
  });

  it('deckelt bei 30 min (auch weit ueber 15 Fehlversuchen)', () => {
    expect(lockMsAfter(40)).toBe(30 * MIN);
  });

  it('accountNewTier meldet GENAU an den Stufengrenzen (kein Lockout-Spam)', () => {
    const g = new LoginGuardService();
    const tiers: number[] = [];
    for (let i = 1; i <= 16; i++) {
      const r = g.registerFailure('203.0.113.1', 'z@z.de', 0);
      if (r.accountNewTier) tiers.push(i);
    }
    expect(tiers).toEqual([5, 8, 12, 15]);
  });
});

describe('LoginGuardService – Sperre & Entsperrung', () => {
  it('ab dem 5. Fehlversuch ist gesperrt; isBlocked liefert retryAfterSec', () => {
    const g = new LoginGuardService();
    const ip = '203.0.113.5';
    const email = 'opfer@example.com';
    for (let i = 0; i < 4; i++) g.registerFailure(ip, email, 0);
    expect(g.isBlocked(ip, email, 0).blocked).toBe(false);
    g.registerFailure(ip, email, 0); // 5.
    const b = g.isBlocked(ip, email, 0);
    expect(b.blocked).toBe(true);
    expect(b.retryAfterSec).toBe(60);
  });

  it('Erfolg setzt den Konto-Zaehler zurueck (registerSuccess)', () => {
    const g = new LoginGuardService();
    const ip = '203.0.113.6';
    const email = 'u@v.de';
    for (let i = 0; i < 4; i++) g.registerFailure(ip, email, 10);
    g.registerSuccess(ip, email);
    const r = g.registerFailure(ip, email, 10);
    expect(r.accountCount).toBe(1);
    expect(r.lockMs).toBe(0);
  });

  it('gleitendes Fenster: Pause laenger als windowMs setzt den Zaehler zurueck', () => {
    const g = new LoginGuardService();
    const ip = '203.0.113.7';
    const email = 'w@x.de';
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) g.registerFailure(ip, email, t0);
    const spaeter = t0 + 30 * MIN + 1; // > windowMs
    const r = g.registerFailure(ip, email, spaeter);
    expect(r.accountCount).toBe(1); // zurueckgesetzt
  });
});

describe('LoginGuardService – Loopback-Allowlist (nie sperren)', () => {
  it('127.0.0.1 / ::1 / ::ffff:127.0.0.1 werden nie gezaehlt oder gesperrt', () => {
    const g = new LoginGuardService();
    for (let i = 0; i < 50; i++) {
      g.registerFailure('127.0.0.1', 'x@y.de', 0);
      g.registerFailure('::1', 'x@y.de', 0);
      g.registerFailure('::ffff:127.0.0.1', 'x@y.de', 0);
    }
    expect(g.isBlocked('127.0.0.1', 'x@y.de', 0).blocked).toBe(false);
    expect(g.isBlocked('::1', 'x@y.de', 0).blocked).toBe(false);
    expect(g.isBlocked('::ffff:127.0.0.1', 'x@y.de', 0).blocked).toBe(false);
    const r = g.registerFailure('127.0.0.1', 'x@y.de', 0);
    expect(r.counted).toBe(false);
  });

  it('leere/fehlende IP wird nie gezaehlt (Unit-/interne Aufrufe ohne IP)', () => {
    const g = new LoginGuardService();
    expect(g.registerFailure(undefined, 'x@y.de').counted).toBe(false);
    expect(g.registerFailure('', 'x@y.de').counted).toBe(false);
    expect(g.isBlocked(undefined, 'x@y.de').blocked).toBe(false);
  });
});

describe('LoginGuardService – Shared-IP/NAT & Credential-Stuffing', () => {
  it('Shared-IP: mehrere Konten je UNTER der Konto-Schwelle sperren die IP nicht vorschnell', () => {
    const g = new LoginGuardService();
    const ip = '192.0.2.50';
    const now = 2000;
    // 6 verschiedene Konten, je 4 Fehlversuche = 24 IP-Fehler; jedes Konto < 5.
    for (let acc = 0; acc < 6; acc++) {
      for (let i = 0; i < 4; i++) g.registerFailure(ip, `mitarbeiter${acc}@firma.de`, now);
    }
    // Kein Konto gesperrt (je 4 < 5) ...
    expect(g.isBlocked(ip, 'mitarbeiter0@firma.de', now).blocked).toBe(false);
    // ... und ein FRISCHES Konto auf derselben Buero-IP ebenfalls nicht
    // (24 IP-Fehler < 30 IP-Schwelle) -> kein kollektiver NAT-Lockout.
    expect(g.isBlocked(ip, 'neuer.kollege@firma.de', now).blocked).toBe(false);
  });

  it('reiner IP-Zaehler greift erst bei DEUTLICH hoeherer Schwelle (30) – Stuffing', () => {
    const g = new LoginGuardService();
    const ip = '192.0.2.77';
    const now = 3000;
    // 29 Fehlversuche ueber 10 Konten (je <= 3, nie die Konto-Schwelle 5).
    let n = 0;
    for (let acc = 0; acc < 10 && n < 29; acc++) {
      for (let i = 0; i < 3 && n < 29; i++) {
        g.registerFailure(ip, `c${acc}@x.de`, now);
        n++;
      }
    }
    // Bei 29 IP-Fehlern ist die IP noch frei (frisches Konto -> rein IP-getrieben).
    expect(g.isBlocked(ip, 'frisch@x.de', now).blocked).toBe(false);
    // Der 30. IP-Fehler (Konto weiterhin unter der Konto-Schwelle) sperrt die IP.
    g.registerFailure(ip, 'c9@x.de', now);
    expect(g.isBlocked(ip, 'frisch@x.de', now).blocked).toBe(true);
  });
});
