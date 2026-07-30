// Leichte Vergleichs-/Filterhilfen fuer die Marke-/Modell-Eingabehilfe.
// Bewusst OHNE die (grosse) kuratierte Modellliste — die liegt in
// `fahrzeug-modelle.ts` und wird separat (lazy) geladen. Dieses Modul bleibt
// winzig und darf im Haupt-Bundle liegen, damit die Historien-Vorschlaege
// sofort funktionieren, noch bevor die Datenliste nachgeladen ist.

/**
 * Vergleichsform fuer tolerantes Matching:
 *  - Gross/Kleinschreibung egal
 *  - Diakritika entfernt: "Skoda" matcht "Skoda" mit Hatschek, "Citroen" matcht "Citroen" mit Trema
 *  - Leerzeichen, Binde-/Unterstriche und Punkte raus:
 *    "mercedes" matcht so "Mercedes-Benz" (-> "mercedesbenz", enthaelt "mercedes")
 */
export function vergleichsform(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_.]+/g, '');
}

/**
 * Filtert + sortiert Kandidaten gegen eine Eingabe. Rang:
 *  0 = exakter Treffer, 1 = Praefix-Treffer, 2 = Teiltreffer.
 * Bei Gleichstand bleibt die Eingabereihenfolge erhalten (stabil) — so bleibt
 * z. B. die Haeufigkeitssortierung der Historie sichtbar. Leere Eingabe gibt die
 * ersten `limit` Kandidaten unveraendert zurueck.
 */
export function rankFilter(kandidaten: string[], query: string, limit: number): string[] {
  const q = vergleichsform(query);
  if (!q) return kandidaten.slice(0, limit);
  const treffer: { wert: string; score: number; idx: number }[] = [];
  kandidaten.forEach((wert, idx) => {
    const v = vergleichsform(wert);
    if (!v.includes(q)) return;
    const score = v === q ? 0 : v.startsWith(q) ? 1 : 2;
    treffer.push({ wert, score, idx });
  });
  treffer.sort((a, b) => a.score - b.score || a.idx - b.idx);
  return treffer.slice(0, limit).map((tr) => tr.wert);
}
