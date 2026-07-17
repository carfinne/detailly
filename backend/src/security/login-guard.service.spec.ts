import { LoginGuardService } from './login-guard.service';
import { buildIpLockSteps, resolveIpFirstTier } from './security.constants';

/**
 * Unit-Tests der In-Memory-Fehlversuchs-Sperre. Reine Logik, kein Nest-Boot /
 * keine DB. Zeit wird ueber ctx.now injiziert -> deterministisch (kein Timer).
 *
 * Loopback-Ausnahme: seit dem Review NUR ueber den echten Socket-Peer
 * (ctx.socketIp), NIE ueber die (XFF-faelschbare) Client-IP.
 */
const MIN = 60 * 1000;
const IP_FIRST = resolveIpFirstTier(); // Default 50 (ENV LOGIN_GUARD_IP_THRESHOLD)

/** Sperrdauer nach genau `k` Fehlversuchen desselben Kontos (frischer Guard). */
function lockMsAfter(k: number): number {
  const g = new LoginGuardService();
  let res = { lockMs: 0 };
  for (let i = 0; i < k; i++) {
    res = g.registerFailure('198.51.100.7', 'a@b.de', { now: 5000 }) as never;
  }
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
    expect(lockMsAfter(7)).toBe(1 * MIN);
    expect(lockMsAfter(11)).toBe(5 * MIN);
    expect(lockMsAfter(14)).toBe(15 * MIN);
  });

  it('deckelt bei 30 min (auch weit ueber 15 Fehlversuchen)', () => {
    expect(lockMsAfter(40)).toBe(30 * MIN);
  });

  it('accountNewTier meldet GENAU an den Stufengrenzen (kein Lockout-Spam)', () => {
    const g = new LoginGuardService();
    const tiers: number[] = [];
    for (let i = 1; i <= 16; i++) {
      const r = g.registerFailure('203.0.113.1', 'z@z.de', { now: 0 });
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
    for (let i = 0; i < 4; i++) g.registerFailure(ip, email, { now: 0 });
    expect(g.isBlocked(ip, email, { now: 0 }).blocked).toBe(false);
    g.registerFailure(ip, email, { now: 0 }); // 5.
    const b = g.isBlocked(ip, email, { now: 0 });
    expect(b.blocked).toBe(true);
    expect(b.retryAfterSec).toBe(60);
  });

  it('Erfolg setzt den Konto-Zaehler zurueck (registerSuccess)', () => {
    const g = new LoginGuardService();
    const ip = '203.0.113.6';
    const email = 'u@v.de';
    for (let i = 0; i < 4; i++) g.registerFailure(ip, email, { now: 10 });
    g.registerSuccess(ip, email);
    const r = g.registerFailure(ip, email, { now: 10 });
    expect(r.accountCount).toBe(1);
    expect(r.lockMs).toBe(0);
  });

  it('gleitendes Fenster: Pause laenger als windowMs setzt den Zaehler zurueck', () => {
    const g = new LoginGuardService();
    const ip = '203.0.113.7';
    const email = 'w@x.de';
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) g.registerFailure(ip, email, { now: t0 });
    const spaeter = t0 + 30 * MIN + 1; // > windowMs
    const r = g.registerFailure(ip, email, { now: spaeter });
    expect(r.accountCount).toBe(1); // zurueckgesetzt
  });
});

describe('LoginGuardService – Loopback-Ausnahme NUR ueber den Socket-Peer (FIX 1)', () => {
  it('echter Loopback-Socket + Loopback-Client wird nie gezaehlt/gesperrt', () => {
    const g = new LoginGuardService();
    const ctx = { now: 0, socketIp: '127.0.0.1' };
    for (let i = 0; i < 50; i++) {
      g.registerFailure('127.0.0.1', 'x@y.de', ctx);
      g.registerFailure('::1', 'x@y.de', { now: 0, socketIp: '::1' });
      g.registerFailure('::ffff:127.0.0.1', 'x@y.de', { now: 0, socketIp: '::ffff:127.0.0.1' });
    }
    expect(g.isBlocked('127.0.0.1', 'x@y.de', ctx).blocked).toBe(false);
    expect(g.registerFailure('127.0.0.1', 'x@y.de', ctx).counted).toBe(false);
  });

  it('gespooftes X-Forwarded-For: 127.0.0.1 bei NICHT-loopback-Socket wird gezaehlt UND fuehrt zur Sperre', () => {
    const g = new LoginGuardService();
    // Angreifer setzt XFF=127.0.0.1, der echte Socket-Peer ist aber public.
    const ctx = { now: 0, socketIp: '203.0.113.99' };
    for (let i = 0; i < 4; i++) {
      expect(g.registerFailure('127.0.0.1', 'opfer@x.de', ctx).counted).toBe(true);
    }
    expect(g.isBlocked('127.0.0.1', 'opfer@x.de', ctx).blocked).toBe(false);
    g.registerFailure('127.0.0.1', 'opfer@x.de', ctx); // 5. -> Sperre
    expect(g.isBlocked('127.0.0.1', 'opfer@x.de', ctx).blocked).toBe(true);
  });

  it('Same-Host-Proxy (Socket loopback) zaehlt echte Remote-Clients (Client-IP != loopback) normal', () => {
    const g = new LoginGuardService();
    const ctx = { now: 0, socketIp: '127.0.0.1' }; // Proxy laeuft auf demselben Host
    const r = g.registerFailure('203.0.113.5', 'remote@x.de', ctx);
    expect(r.counted).toBe(true);
    expect(r.accountCount).toBe(1);
  });

  it('leere/fehlende Client-IP wird nie gezaehlt', () => {
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
      for (let i = 0; i < 4; i++) g.registerFailure(ip, `mitarbeiter${acc}@firma.de`, { now });
    }
    expect(g.isBlocked(ip, 'mitarbeiter0@firma.de', { now }).blocked).toBe(false);
    // 24 IP-Fehler < IP-Schwelle (Default 50) -> kein kollektiver NAT-Lockout.
    expect(g.isBlocked(ip, 'neuer.kollege@firma.de', { now }).blocked).toBe(false);
  });

  it(`reiner IP-Zaehler greift erst bei der (ENV-)Schwelle ${IP_FIRST} – Stuffing`, () => {
    const g = new LoginGuardService();
    const ip = '192.0.2.77';
    const now = 3000;
    // IP_FIRST-1 Fehlversuche ueber viele Konten (je <= 3, nie die Konto-Schwelle 5).
    let n = 0;
    const proKonto = 3;
    for (let acc = 0; n < IP_FIRST - 1; acc++) {
      for (let i = 0; i < proKonto && n < IP_FIRST - 1; i++) {
        g.registerFailure(ip, `c${acc}@x.de`, { now });
        n++;
      }
    }
    // Knapp unter der Schwelle: frisches Konto -> rein IP-getrieben, noch frei.
    expect(g.isBlocked(ip, 'frisch@x.de', { now }).blocked).toBe(false);
    // Der Schwellen-te IP-Fehler (Konto weiterhin unter 5) sperrt die IP.
    g.registerFailure(ip, 'letztes@x.de', { now });
    expect(g.isBlocked(ip, 'frisch@x.de', { now }).blocked).toBe(true);
  });
});

describe('LoginGuardService – NAT-Freischaltung: Erfolg dekrementiert den IP-Zaehler (FIX 2)', () => {
  it('ein erfolgreicher Login senkt den reinen IP-Zaehler um 1 (nicht auf 0)', () => {
    const g = new LoginGuardService();
    const ip = '192.0.2.90';
    const now = 500;
    // Konto A sammelt 3 Fehlversuche -> IP-Zaehler = 3.
    for (let i = 0; i < 3; i++) g.registerFailure(ip, 'a@firma.de', { now });
    // Erfolgreicher Login von Konto A -> Konto-Reset + IP-Zaehler 3 -> 2.
    g.registerSuccess(ip, 'a@firma.de');
    // Naechster Fehlversuch eines ANDEREN Kontos: IP-Zaehler 2 -> 3 (nicht 4).
    const r = g.registerFailure(ip, 'b@firma.de', { now });
    expect(r.ipCount).toBe(3);
  });

  it('wiederholte Erfolge halten einen Shared-IP-Betrieb unter der IP-Schwelle', () => {
    const g = new LoginGuardService();
    const ip = '192.0.2.91';
    const now = 700;
    // Betrieb erzeugt knapp unter der Schwelle Fehlversuche ...
    for (let i = 0; i < IP_FIRST - 2; i++) g.registerFailure(ip, `n${i}@firma.de`, { now });
    // ... zwei erfolgreiche Logins entlasten den IP-Zaehler wieder.
    g.registerSuccess(ip, 'ok1@firma.de');
    g.registerSuccess(ip, 'ok2@firma.de');
    // Zwei weitere Vertipper erreichen die Schwelle jetzt NICHT (dekrementiert).
    g.registerFailure(ip, 'x1@firma.de', { now });
    const r = g.registerFailure(ip, 'x2@firma.de', { now });
    expect(r.ipCount).toBeLessThan(IP_FIRST);
    expect(g.isBlocked(ip, 'frisch@firma.de', { now }).blocked).toBe(false);
  });
});

describe('buildIpLockSteps – skaliert konsistent mit der Erststufe', () => {
  it('Default-Erststufe erzeugt 4 absteigende Stufen b/2b/3b/5b', () => {
    const steps = buildIpLockSteps(50);
    expect(steps.map((s) => s.fails)).toEqual([250, 150, 100, 50]);
  });

  it('respektiert die Untergrenze (nie unter 10)', () => {
    const steps = buildIpLockSteps(1);
    expect(steps[steps.length - 1].fails).toBe(10);
  });
});
