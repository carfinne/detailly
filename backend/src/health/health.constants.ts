/**
 * Einzige Quelle fuer die in den Health-Antworten gemeldete App-Version.
 *
 * `npm run start:prod` (bzw. jeder npm-Start) setzt npm_package_version aus der
 * package.json; ein direkter `node dist/main`-Start faellt auf die feste Version
 * zurueck. BEWUSST nur die Version – keine weiteren Interna (Host, Pfade, ENV).
 */
export const APP_VERSION = process.env.npm_package_version || '0.1.0';
