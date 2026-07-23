/**
 * Einzige Quelle fuer die in den Health-Antworten gemeldete App-Version.
 *
 * `npm run start:prod` (bzw. jeder npm-Start) setzt npm_package_version aus der
 * package.json; ein direkter `node dist/main`-Start faellt auf die feste Version
 * zurueck. BEWUSST nur die Version – keine weiteren Interna (Host, Pfade, ENV).
 */
export const APP_VERSION = process.env.npm_package_version || '0.1.0';

/**
 * Timeout fuer den Readiness-DB-Ping. Ohne Timeout wuerde `ready()` bei einem
 * Netz-Blackhole (DB-Host antwortet gar nicht, statt sofort abzulehnen) haengen,
 * statt schnell 503 zu liefern und den LB die Instanz aus der Rotation nehmen zu
 * lassen. 2s ist grosszuegig fuer ein `SELECT 1` und trotzdem klar unter den
 * ueblichen LB-/Proxy-Timeouts.
 */
export const READY_DB_TIMEOUT_MS = 2000;

/**
 * Eigener, grosszuegiger Rate-Limit fuer den Readiness-Endpunkt (je IP).
 * Anders als die Liveness (kein DB-Zugriff, `@SkipThrottle`) fasst `ready()` pro
 * Request die DB an -> darf NICHT voellig ungedrosselt sein (sonst koennte ein
 * Angreifer den Connection-Pool unter Druck setzen). 120/min liegt weit ueber
 * typischen LB-Ping-Frequenzen (<= ~12/min), begrenzt aber Missbrauch.
 * Die IP-Sperr-Ausnahme (main.ts) bleibt unberuehrt -> legitime LB-Pings sperren nie.
 */
export const READY_THROTTLE_LIMIT = 120;
export const READY_THROTTLE_TTL_MS = 60_000;
