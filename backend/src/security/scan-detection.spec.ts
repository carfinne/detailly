import { shouldCountScan, SCAN_4XX_STATUSES } from './security.constants';

/**
 * Zaehl-Policy des Scan-Signals (Review-Gate PR #218, FIX A). Kernregel: NUR
 * unauthentifizierte 401/404 ausserhalb des Auth-Bereichs zaehlen als scan_4xx.
 * Damit sperrt der ThreatDetectionService nie einen normalen (eingeloggten)
 * Betrieb hinter einer Buero-NAT aus – nur echtes unauth. Enumeration/Probing.
 */
describe('shouldCountScan – nur unauthentifizierte 401/404 zaehlen', () => {
  it('403 zaehlt NIE (RBAC-/Tarif-Denials sind Normalbetrieb) – auch unauth. nicht', () => {
    expect(SCAN_4XX_STATUSES).not.toContain(403);
    expect(shouldCountScan({ status: 403, authenticated: false, path: '/api/v1/orders' })).toBe(false);
    expect(shouldCountScan({ status: 403, authenticated: true, path: '/api/v1/orders' })).toBe(false);
  });

  it('AUTHENTIFIZIERTE 401/404 zaehlen NIE (eingeloggter Nutzer ist kein Scanner)', () => {
    // Szenario Review-Gate (a): 50 authentifizierte 403/404 von einer IP.
    expect(shouldCountScan({ status: 404, authenticated: true, path: '/api/v1/orders/geloescht' })).toBe(false);
    expect(shouldCountScan({ status: 401, authenticated: true, path: '/api/v1/orders' })).toBe(false);
  });

  it('UNAUTH 404 auf eine (unbekannte) API-Route zaehlt (Route-Fuzzing)', () => {
    // Szenario Review-Gate (b): unauth. 404-Serie auf unbekannte Routen.
    expect(shouldCountScan({ status: 404, authenticated: false, path: '/api/v1/wp-admin' })).toBe(true);
  });

  it('UNAUTH 401 auf einer geschuetzten Nicht-Auth-Route zaehlt (Probing ohne Token)', () => {
    expect(shouldCountScan({ status: 401, authenticated: false, path: '/api/v1/orders' })).toBe(true);
  });

  it('UNAUTH 401 im Auth-Bereich zaehlt NICHT (eigenes login_fail-Signal, kein Doppelzaehlen)', () => {
    expect(shouldCountScan({ status: 401, authenticated: false, path: '/api/v1/auth/login' })).toBe(false);
    expect(shouldCountScan({ status: 401, authenticated: false, path: '/api/v1/auth/mfa/verify' })).toBe(false);
  });

  it('andere 4xx (400/429) zaehlen nicht', () => {
    expect(shouldCountScan({ status: 400, authenticated: false, path: '/api/v1/orders' })).toBe(false);
    expect(shouldCountScan({ status: 429, authenticated: false, path: '/api/v1/orders' })).toBe(false);
  });

  it('fehlender Pfad ist unschaedlich (unauth 404 ohne Pfad zaehlt)', () => {
    expect(shouldCountScan({ status: 404, authenticated: false })).toBe(true);
  });
});
