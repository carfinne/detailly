// Leichtgewichtiger, localStorage-gestützter Warenkorb-Speicher (nur Mengen je
// productId). Bewusst OHNE Produkt-Snapshot: die Katalog-Seite löst die vollen
// Produktdaten aus dem geladenen Katalog auf, der Server re-snapshottet Preise
// bei der Bestellung. So können Katalog-, Schnellansicht- und Detailseite
// denselben Korb füttern, obwohl sie getrennte Routen sind.

const KEY = 'detailly.mp.cart';
const MAX = 999;

/** productId -> Menge. */
export type Korb = Record<string, number>;

/** Korb aus dem Speicher lesen (defensiv, ungültige Werte werden verworfen). */
export function loadKorb(): Korb {
  if (typeof window === 'undefined') return {};
  try {
    const roh = window.localStorage.getItem(KEY);
    if (!roh) return {};
    const obj = JSON.parse(roh) as unknown;
    if (!obj || typeof obj !== 'object') return {};
    const out: Korb = {};
    for (const [id, wert] of Object.entries(obj as Record<string, unknown>)) {
      const n = Math.floor(Number(wert));
      if (id && Number.isFinite(n) && n > 0) out[id] = Math.min(MAX, n);
    }
    return out;
  } catch {
    return {};
  }
}

/** Korb in den Speicher schreiben (bei gesperrtem Speicher still ignorieren). */
export function saveKorb(korb: Korb): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(korb));
  } catch {
    /* Speicher gesperrt (z. B. eingebettete Vorschau) -> nur In-Memory */
  }
}

/** Menge eines Produkts verändern; gibt den neuen Korb zurück. */
export function addToKorb(productId: string, delta = 1): Korb {
  const korb = loadKorb();
  const neu = Math.max(0, (korb[productId] ?? 0) + delta);
  if (neu <= 0) delete korb[productId];
  else korb[productId] = Math.min(MAX, neu);
  saveKorb(korb);
  return korb;
}
