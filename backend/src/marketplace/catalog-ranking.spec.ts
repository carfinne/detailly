import {
  bestandStatus,
  berechneRankingScore,
  RANKING_GEWICHTE,
} from './catalog-ranking.util';

/**
 * Reiner, dependency-freier Kern des Katalog-Rankings (PR4): deterministisch,
 * ohne DB. Prueft die Bestands-Ableitung und die Monotonie jedes Ranking-Signals.
 */

describe('bestandStatus · Ableitung aus dem Rohbestand', () => {
  it.each([
    [null, 'verfuegbar'], // unbekannt/unbegrenzt (Affiliate/beim Haendler)
    [undefined, 'verfuegbar'],
    [0, 'ausverkauft'],
    [1, 'wenig'],
    [3, 'wenig'], // Schwelle inklusive
    [4, 'verfuegbar'],
    [999, 'verfuegbar'],
    [-2, 'ausverkauft'], // defensiv: negativ wie 0
  ])('bestand=%s -> %s', (bestand, erwartet) => {
    expect(bestandStatus(bestand as number | null)).toBe(erwartet);
  });
});

describe('berechneRankingScore · Signale wirken monoton', () => {
  // Fester Referenz-Zeitpunkt -> Recency ist deterministisch.
  const NOW = new Date('2026-01-15T12:00:00Z').getTime();
  const frisch = new Date('2026-01-15T00:00:00Z'); // ~0.5 Tage alt
  const basis = {
    klicks: 0,
    verkauft: 0,
    bewertungSchnitt: 0,
    bewertungAnzahl: 0,
    istHighlight: false,
    createdAt: frisch,
  };

  it('mehr Verkaeufe -> hoeherer Score', () => {
    const wenig = berechneRankingScore({ ...basis, verkauft: 1 }, NOW);
    const viel = berechneRankingScore({ ...basis, verkauft: 20 }, NOW);
    expect(viel).toBeGreaterThan(wenig);
  });

  it('bessere Bewertung (Schnitt x Anzahl) -> hoeherer Score', () => {
    const schwach = berechneRankingScore({ ...basis, bewertungSchnitt: 3, bewertungAnzahl: 1 }, NOW);
    const stark = berechneRankingScore({ ...basis, bewertungSchnitt: 5, bewertungAnzahl: 20 }, NOW);
    expect(stark).toBeGreaterThan(schwach);
  });

  it('mehr Klicks -> hoeherer Score', () => {
    const a = berechneRankingScore({ ...basis, klicks: 5 }, NOW);
    const b = berechneRankingScore({ ...basis, klicks: 500 }, NOW);
    expect(b).toBeGreaterThan(a);
  });

  it('frischer -> hoeherer Score (Recency)', () => {
    const alt = berechneRankingScore({ ...basis, createdAt: new Date('2024-01-01') }, NOW);
    const neu = berechneRankingScore({ ...basis, createdAt: frisch }, NOW);
    expect(neu).toBeGreaterThan(alt);
  });

  it('Highlight gibt genau den Pin-Bonus gegenueber sonst identischem Produkt', () => {
    const ohne = berechneRankingScore({ ...basis }, NOW);
    const mit = berechneRankingScore({ ...basis, istHighlight: true }, NOW);
    expect(mit - ohne).toBeCloseTo(RANKING_GEWICHTE.highlight, 3);
  });

  it('robust gegen fehlende/NaN-Rohdaten (kein NaN im Score)', () => {
    const score = berechneRankingScore(
      { bewertungSchnitt: undefined, bewertungAnzahl: null, klicks: undefined, createdAt: null },
      NOW,
    );
    expect(Number.isFinite(score)).toBe(true);
  });
});
