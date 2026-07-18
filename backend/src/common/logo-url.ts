/**
 * Zentrale Whitelist fuer OEFFENTLICH ausgelieferte Betriebs-Logos ("Dein Look").
 *
 * EINE geprüfte Quelle fuer ALLE oeffentlichen Egress-Stellen (Auftrags-Tracking,
 * Uebergabe-Mappe Web + PDF, oeffentliche Mitgliederliste, Buchungsportal), damit
 * das Verhalten konsistent und durchgaengig XSS-sicher ist.
 *
 * Zugelassen sind AUSSCHLIESSLICH:
 *  - echte absolute http(s)-URLs (extern gehostetes Logo), sowie
 *  - selbst hochgeladene Logos als data:-URL, aber NUR validierte Raster-Subtypes
 *    (png / jpeg / webp, base64). KEIN SVG (`data:image/svg+xml` waere im <img>
 *    bzw. inline script-faehig -> XSS), kein `data:text/html`, kein `javascript:`,
 *    nichts anderes.
 *
 * Der Upload (`TenantsService.setLogo`) erzwingt per Magic-Byte-Pruefung bereits
 * genau diese Formate; diese Funktion ist die zweite, AUSGABESEITIGE Verteidigung
 * (Defense-in-Depth) und zugleich der Filter fuer evtl. extern gesetzte
 * http(s)-Logos. Liefert die unveraenderte, sichere URL oder `null`.
 */
export function sanitizeLogoUrl(url?: string | null): string | null {
  const s = (url ?? '').trim();
  if (/^https?:\/\/\S+$/i.test(s)) return s;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(s)) return s;
  return null;
}
