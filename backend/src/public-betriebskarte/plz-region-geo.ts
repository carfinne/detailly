// ===========================================================================
// PLZ-Leitregion -> grobe Karten-Koordinate (Zentroid) fuer die OEFFENTLICHE
// Betriebskarte. Bewusst DATENSPARSAM: es wird NIE die volle PLZ verarbeitet,
// nur die 2-stellige Leitregion; die Koordinate ist der (grobe) Regions-Zentroid
// im selben viewBox wie die Landing-Silhouette (0 0 600 800), damit das Frontend
// die Punkte ohne eigene PLZ-Tabelle direkt plotten kann.
//
// Rein/serverseitig (keine DB, kein PII). Unbekannte Region -> null (Punkt faellt
// weg, kein Crash). Werte gespiegelt aus der Landing-Silhouette (Leitstadt-Anker).
// ===========================================================================

/** viewBox der Silhouette (muss zum Frontend-Umriss passen). */
export const KARTE_VB_W = 600;
export const KARTE_VB_H = 800;

/** Grobe Koordinate je 2-stelliger PLZ-Leitregion (Zentroid der Leitstadt). */
export const PLZ_REGION_ZENTROID: Record<string, { x: number; y: number }> = {
  '01': { x: 469, y: 414 }, // Dresden
  '02': { x: 516, y: 404 }, // Bautzen/Goerlitz
  '03': { x: 499, y: 350 }, // Cottbus
  '04': { x: 397, y: 387 }, // Leipzig
  '06': { x: 376, y: 375 }, // Halle/Dessau
  '07': { x: 357, y: 429 }, // Gera/Jena
  '08': { x: 395, y: 455 }, // Zwickau/Plauen
  '09': { x: 426, y: 433 }, // Chemnitz
  '10': { x: 449, y: 279 }, // Berlin
  '12': { x: 455, y: 287 }, // Berlin
  '13': { x: 447, y: 272 }, // Berlin
  '14': { x: 435, y: 292 }, // Berlin/Potsdam
  '15': { x: 511, y: 297 }, // Frankfurt (Oder)
  '16': { x: 461, y: 247 }, // Brandenburg Nord/Prenzlau
  '17': { x: 444, y: 188 }, // Neubrandenburg/Stralsund
  '18': { x: 385, y: 140 }, // Rostock
  '19': { x: 347, y: 181 }, // Schwerin
  '20': { x: 273, y: 187 }, // Hamburg
  '21': { x: 281, y: 182 }, // Hamburg Ost
  '22': { x: 266, y: 193 }, // Hamburg West
  '23': { x: 310, y: 160 }, // Luebeck
  '24': { x: 281, y: 119 }, // Kiel
  '25': { x: 232, y: 139 }, // Husum/Itzehoe
  '26': { x: 160, y: 220 }, // Oldenburg/Emden
  '27': { x: 200, y: 189 }, // Bremerhaven/Cuxhaven
  '28': { x: 212, y: 231 }, // Bremen
  '29': { x: 295, y: 216 }, // Lueneburg/Celle
  '30': { x: 260, y: 295 }, // Hannover
  '31': { x: 268, y: 310 }, // Hildesheim/Hameln
  '32': { x: 206, y: 319 }, // Herford/Minden
  '33': { x: 206, y: 337 }, // Bielefeld/Paderborn
  '34': { x: 248, y: 390 }, // Kassel
  '35': { x: 210, y: 436 }, // Marburg/Giessen
  '36': { x: 257, y: 459 }, // Fulda
  '37': { x: 271, y: 370 }, // Goettingen
  '38': { x: 301, y: 304 }, // Braunschweig
  '39': { x: 359, y: 316 }, // Magdeburg
  '40': { x: 107, y: 397 }, // Duesseldorf
  '41': { x: 88, y: 401 }, //  Moenchengladbach
  '42': { x: 127, y: 395 }, // Wuppertal
  '44': { x: 142, y: 372 }, // Dortmund
  '45': { x: 119, y: 377 }, // Essen
  '46': { x: 100, y: 369 }, // Oberhausen/Wesel
  '47': { x: 97, y: 387 }, //  Duisburg/Krefeld
  '48': { x: 151, y: 332 }, // Muenster
  '49': { x: 173, y: 303 }, // Osnabrueck
  '50': { x: 114, y: 421 }, // Koeln
  '51': { x: 122, y: 427 }, // Koeln/Leverkusen
  '52': { x: 70, y: 438 }, //  Aachen
  '53': { x: 123, y: 442 }, // Bonn
  '54': { x: 99, y: 531 }, //  Trier
  '55': { x: 184, y: 508 }, // Mainz
  '56': { x: 149, y: 476 }, // Koblenz
  '57': { x: 171, y: 429 }, // Siegen
  '58': { x: 142, y: 386 }, // Hagen
  '59': { x: 165, y: 364 }, // Hamm/Soest
  '60': { x: 203, y: 497 }, // Frankfurt am Main
  '61': { x: 200, y: 483 }, // Bad Homburg/Friedberg
  '63': { x: 216, y: 498 }, // Offenbach/Hanau/Aschaffenburg
  '64': { x: 204, y: 520 }, // Darmstadt
  '65': { x: 183, y: 501 }, // Wiesbaden
  '66': { x: 118, y: 576 }, // Saarbruecken
  '67': { x: 158, y: 558 }, // Kaiserslautern/Ludwigshafen
  '68': { x: 194, y: 554 }, // Mannheim
  '69': { x: 205, y: 562 }, // Heidelberg
  '70': { x: 229, y: 616 }, // Stuttgart
  '71': { x: 238, y: 624 }, // Ludwigsburg
  '72': { x: 220, y: 626 }, // Reutlingen/Tuebingen
  '73': { x: 243, y: 610 }, // Esslingen/Goeppingen/Aalen
  '74': { x: 233, y: 585 }, // Heilbronn
  '75': { x: 206, y: 608 }, // Pforzheim
  '76': { x: 191, y: 597 }, // Karlsruhe
  '77': { x: 167, y: 646 }, // Offenburg
  '78': { x: 206, y: 697 }, // Villingen/Konstanz
  '79': { x: 162, y: 689 }, // Freiburg
  '80': { x: 354, y: 673 }, // Muenchen
  '81': { x: 361, y: 678 }, // Muenchen
  '82': { x: 345, y: 682 }, // Starnberg/Muenchen West
  '83': { x: 372, y: 686 }, // Rosenheim/Muenchen Suedost
  '84': { x: 378, y: 660 }, // Landshut
  '85': { x: 346, y: 663 }, // Freising/Muenchen Nord
  '86': { x: 321, y: 655 }, // Augsburg
  '87': { x: 290, y: 712 }, // Kempten
  '88': { x: 254, y: 708 }, // Ravensburg/Friedrichshafen
  '89': { x: 274, y: 652 }, // Ulm
  '90': { x: 328, y: 556 }, // Nuernberg
  '91': { x: 336, y: 563 }, // Erlangen/Ansbach
  '92': { x: 373, y: 553 }, // Weiden/Amberg
  '93': { x: 383, y: 597 }, // Regensburg
  '94': { x: 440, y: 634 }, // Passau/Deggendorf
  '95': { x: 362, y: 508 }, // Bayreuth/Hof
  '96': { x: 321, y: 517 }, // Bamberg/Coburg
  '97': { x: 271, y: 527 }, // Wuerzburg/Schweinfurt
  '98': { x: 310, y: 454 }, // Suhl
  '99': { x: 328, y: 420 }, // Erfurt
};

/**
 * Grobe Leitregion aus einer PLZ: die ersten 2 Ziffern, aber NUR wenn die PLZ mit
 * (mindestens) 2 Ziffern beginnt – sonst null. Bewusst datensparsam: es verlaesst
 * NIE die volle PLZ das Backend, nur die 2-stellige Leitregion.
 */
export function plzRegionAusPostalCode(postalCode: string | null | undefined): string | null {
  const treffer = /^(\d{2})/.exec((postalCode ?? '').trim());
  return treffer ? treffer[1] : null;
}

/** Zentroid-Koordinate zu einer Leitregion oder null (unbekannte Region). */
export function koordinateFuerRegion(region: string | null): { x: number; y: number } | null {
  if (!region) return null;
  return PLZ_REGION_ZENTROID[region] ?? null;
}
