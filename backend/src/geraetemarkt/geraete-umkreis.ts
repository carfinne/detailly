// ===========================================================================
// Grobe Umkreissuche fuer die Nachbarschaftshilfe (feat/nachbarschaftshilfe).
// ---------------------------------------------------------------------------
// Wiederverwendet die vorhandene Zentroid-Tabelle der oeffentlichen Betriebskarte
// (PLZ_REGION_ZENTROID): je 2-stelliger Leitregion eine grobe Koordinate im
// Karten-Koordinatensystem der Silhouette (viewBox 600 x 800), NICHT in km.
//
// KALIBRIERUNG auf km: Deutschland misst rund 640 km in der Breite und 876 km in
// der Hoehe. Die viewBox ist 600 breit und 800 hoch. Also entspricht 1 x-Einheit
// ~ 640/600 km und 1 y-Einheit ~ 876/800 km. Aus x/y-Differenzen wird darueber
// eine grobe euklidische Distanz in km geschaetzt.
//
// EHRLICHKEIT: Das ist ein UNGEFAEHRER Umkreis auf REGIONS-Ebene, KEIN
// kilometergenauer Radius. Eine Leitregion ist selbst 50-100 km gross, und der
// Zentroid ist nur der Leitstadt-Anker. Die Oberflaeche muss das entsprechend
// beschriften („ungefaehr", „in deiner Region und Umgebung").
//
// FOLGE-TICKET fuer echte km-Genauigkeit: Es braeuchte eine PLZ-Koordinatentabelle
// (5-stellig, mit Geokoordinaten) statt der 2-stelligen Regions-Zentroide. Die
// Datenquelle/Lizenz (z. B. OpenPLZ/Geonames/amtliche Daten) ist eine
// Inhaber-Entscheidung und wird hier BEWUSST NICHT eingefuehrt.
//
// DATENSPARSAMKEIT: Rein serverseitig. Es wird ausschliesslich mit der
// 2-stelligen Leitregion gerechnet; nach aussen bleibt weiterhin NUR die
// 2-stellige Region sichtbar – die Umkreisberechnung erzeugt KEIN neues Datenleck.
// ===========================================================================

import { PLZ_REGION_ZENTROID, KARTE_VB_W, KARTE_VB_H } from '../public-betriebskarte/plz-region-geo';

/** km je x-Einheit (~1.067) bzw. y-Einheit (~1.095) der Karten-viewBox. */
export const KM_PRO_X = 640 / KARTE_VB_W;
export const KM_PRO_Y = 876 / KARTE_VB_H;

/**
 * Grobe km-Distanz zwischen zwei Leitregionen (Zentroid-zu-Zentroid). Liefert
 * null, wenn eine der Regionen keinen Zentroid hat (unbekannte/ungueltige Region).
 */
export function distanzKmZwischenRegionen(a: string, b: string): number | null {
  const pa = PLZ_REGION_ZENTROID[a];
  const pb = PLZ_REGION_ZENTROID[b];
  if (!pa || !pb) return null;
  const dx = (pa.x - pb.x) * KM_PRO_X;
  const dy = (pa.y - pb.y) * KM_PRO_Y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Alle Leitregionen im (groben) Umkreis um `zentrum` bis einschliesslich
 * `radiusKm` – IMMER inklusive der Zentrums-Region selbst.
 *  - radiusKm <= 0        -> nur die eigene Region ([zentrum]).
 *  - unbekanntes Zentrum  -> [zentrum] (die Region bleibt als exakter Filter gueltig).
 * Rueckgabe ist NIE leer -> sicher fuer ein `IN (:...regionen)` (kein Leer-IN).
 */
export function regionenImUmkreis(zentrum: string, radiusKm: number): string[] {
  if (!PLZ_REGION_ZENTROID[zentrum]) return [zentrum];
  if (radiusKm <= 0) return [zentrum];
  const treffer: string[] = [];
  for (const region of Object.keys(PLZ_REGION_ZENTROID)) {
    const d = distanzKmZwischenRegionen(zentrum, region);
    if (d !== null && d <= radiusKm) treffer.push(region);
  }
  return treffer.length ? treffer : [zentrum];
}
