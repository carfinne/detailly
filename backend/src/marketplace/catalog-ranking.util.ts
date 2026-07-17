/**
 * Katalog-Ranking + Bestands-Ableitung (Marktplatz-Ausbau PR4).
 *
 * BEWUSST dependency-frei und rein (keine DB, kein Zustand): der Score wird
 * on-the-fly im catalog() aus bereits geladenen Rohdaten berechnet (kein
 * denormalisiertes Feld, kein Cron). So bleibt die Formel an EINER Stelle,
 * ist deterministisch testbar und leicht nachvollziehbar.
 */

/** Abgeleiteter, frontend-tauglicher Verfuegbarkeits-Status (nie der Rohbestand). */
export type BestandStatus = 'verfuegbar' | 'wenig' | 'ausverkauft';

/** Schwelle: <= WENIG_SCHWELLE (aber > 0) Stueck -> "nur noch wenige". */
export const WENIG_SCHWELLE = 3;

/**
 * Leitet den Anzeige-Status aus dem Rohbestand ab. Semantik laut Entity:
 *  - null  = unbekannt/unbegrenzt (Affiliate/beim Haendler) -> "verfuegbar"
 *  - 0     = ausverkauft
 *  - 1..3  = nur noch wenige
 *  - > 3   = verfuegbar
 * Der Rohbestand selbst wird im Katalog NICHT ausgeliefert (nur der Status).
 */
export function bestandStatus(bestand: number | null | undefined): BestandStatus {
  if (bestand == null) return 'verfuegbar'; // unbekannt/unbegrenzt
  if (bestand <= 0) return 'ausverkauft';
  if (bestand <= WENIG_SCHWELLE) return 'wenig';
  return 'verfuegbar';
}

/** Roh-Signale je Produkt fuer den Ranking-Score (alles bereits geladen). */
export interface RankingInput {
  /** Denormalisierter Affiliate-Klick-Zaehler. */
  klicks?: number | null;
  /** Summe verkaufter Einheiten (aus marketplace_order_items aggregiert). */
  verkauft?: number | null;
  /** Denormalisierter Bewertungs-Schnitt (0..5). */
  bewertungSchnitt?: number | null;
  /** Anzahl aktiver Bewertungen. */
  bewertungAnzahl?: number | null;
  /** Redaktionelle Hervorhebung durch den Betreiber. */
  istHighlight?: boolean | null;
  /** Anlagezeitpunkt (Recency-Signal). */
  createdAt?: Date | string | null;
}

/**
 * Gewichte des Ranking-Scores. Bewusst so gewaehlt, dass jedes Signal fuer sich
 * monoton wirkt (mehr Verkaeufe/bessere Bewertung/mehr Klicks/frischer/Highlight
 * => hoeher) und ein redaktionelles Highlight einen spuerbaren, aber NICHT
 * absoluten Schub bekommt (starke organische Signale koennen es ueberholen).
 */
export const RANKING_GEWICHTE = {
  verkauf: 10, // je verkaufte Einheit
  bewertung: 4, // je (Schnitt * Anzahl)-Punkt  -> Qualitaet x Volumen
  klick: 1, // je Affiliate-Klick
  recency: 5, // max. Frische-Bonus (frisch ~ +5, sehr alt ~ 0)
  highlight: 50, // redaktioneller Pin
} as const;

/** Halbwertsbreite der Recency-Abklingkurve in Tagen. */
export const RECENCY_TAGE = 30;

/** Recency in (0, 1]: frisch ~ 1, aelter -> gegen 0 (glatt, ohne harte Kante). */
function recency(createdAt: RankingInput['createdAt'], now: number): number {
  const t = createdAt ? new Date(createdAt).getTime() : NaN;
  const ageTage = Number.isFinite(t) ? Math.max(0, (now - t) / 86_400_000) : 3650;
  return 1 / (1 + ageTage / RECENCY_TAGE);
}

/**
 * Berechnet den Ranking-Score eines Produkts. `now` ist injizierbar, damit der
 * Recency-Anteil in Tests deterministisch bleibt. Auf 3 Nachkommastellen
 * gerundet (kein Float-Rauschen bei Gleichstand-Vergleichen).
 */
export function berechneRankingScore(p: RankingInput, now: number = Date.now()): number {
  const verkauft = Number(p.verkauft) || 0;
  const klicks = Number(p.klicks) || 0;
  const bewertung = (Number(p.bewertungSchnitt) || 0) * (Number(p.bewertungAnzahl) || 0);
  const score =
    RANKING_GEWICHTE.verkauf * verkauft +
    RANKING_GEWICHTE.bewertung * bewertung +
    RANKING_GEWICHTE.klick * klicks +
    RANKING_GEWICHTE.recency * recency(p.createdAt, now) +
    (p.istHighlight ? RANKING_GEWICHTE.highlight : 0);
  return Math.round(score * 1000) / 1000;
}
