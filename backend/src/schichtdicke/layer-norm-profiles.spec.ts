import {
  bauteilStatistik,
  bewerteBauteil,
  bewerteWert,
  DEFAULT_NORM_PROFILE_KEY,
  istAuffaellig,
  punktMittelUm,
  resolveNormProfil,
  SchichtPunkt,
} from './layer-norm-profiles';

/**
 * Sichert die geschaeftskritische Ampel-Logik ab: exakte Grenzwerte, konservative
 * Band-Zuordnung (Grenzwert -> niedrigeres Band), Kunststoff-Sonderfall,
 * unbemessene Bauteile, Profil-Fallback und die Repraesentativwert-Bildung
 * (Max der Punkt-Mittel).
 */
describe('layer-norm-profiles – Ampel/Auffaelligkeit', () => {
  describe('bewerteWert (serienlack_stahl, Default)', () => {
    // Konvention: 80/150/250 gehoeren zum NIEDRIGEREN Band, Eskalation strikt darueber.
    it.each([
      [0, 'duenn'],
      [79, 'duenn'],
      [80, 'normal'], // exakt auf 80 -> normal (nicht mehr duenn)
      [120, 'normal'],
      [150, 'normal'], // exakt auf 150 -> normal (nicht erhoeht)
      [151, 'erhoeht'],
      [200, 'erhoeht'],
      [250, 'erhoeht'], // exakt auf 250 -> erhoeht (nicht verdacht)
      [251, 'verdacht'],
      [400, 'verdacht'],
    ])('%i µm -> %s', (wert, status) => {
      expect(bewerteWert(wert as number)).toBe(status);
    });

    it('unbekannter Profilschluessel faellt auf das Default-Profil zurueck', () => {
      expect(resolveNormProfil('gibt-es-nicht').key).toBe(DEFAULT_NORM_PROFILE_KEY);
      expect(bewerteWert(300, 'gibt-es-nicht')).toBe('verdacht');
      expect(bewerteWert(300, null)).toBe('verdacht');
    });
  });

  describe('bewerteBauteil', () => {
    it('Kunststoff-Bauteil (Stoßfänger) ist NIE Verdacht, sondern nicht_metall', () => {
      // Selbst ein extrem hoher Wert bleibt informativ (magn.-induktiv unzuverlaessig).
      expect(bewerteBauteil('stossfaenger_vorne', 800)).toBe('nicht_metall');
      expect(bewerteBauteil('stossfaenger_hinten', 120)).toBe('nicht_metall');
      expect(istAuffaellig(bewerteBauteil('stossfaenger_vorne', 800))).toBe(false);
    });

    it('Metall-Bauteil ohne Messwert -> unbemessen', () => {
      expect(bewerteBauteil('tuer_vl', null)).toBe('unbemessen');
      expect(bewerteBauteil('tuer_vl', undefined)).toBe('unbemessen');
    });

    it('Metall-Bauteil mit Verdachtswert -> verdacht + auffaellig', () => {
      const status = bewerteBauteil('tuer_vl', 320);
      expect(status).toBe('verdacht');
      expect(istAuffaellig(status)).toBe(true);
    });

    it('nur verdacht gilt als auffaellig (normal/erhoeht/duenn nicht)', () => {
      expect(istAuffaellig(bewerteBauteil('tuer_vl', 120))).toBe(false); // normal
      expect(istAuffaellig(bewerteBauteil('tuer_vl', 200))).toBe(false); // erhoeht
      expect(istAuffaellig(bewerteBauteil('tuer_vl', 50))).toBe(false); // duenn
    });
  });

  describe('Aggregation', () => {
    it('punktMittelUm bildet den Mittelwert; leere Messreihe -> null', () => {
      expect(punktMittelUm([{ wertUm: 100 }, { wertUm: 140 }])).toBe(120);
      expect(punktMittelUm([])).toBeNull();
      expect(punktMittelUm(undefined)).toBeNull();
    });

    it('bauteilStatistik: min/mean/max ueber alle Messungen, repraesentativ = Max der Punkt-Mittel', () => {
      const punkte: SchichtPunkt[] = [
        { partId: 'tuer_vl', readings: [{ wertUm: 100 }, { wertUm: 140 }] }, // Mittel 120
        { partId: 'tuer_vl', readings: [{ wertUm: 300 }, { wertUm: 320 }] }, // Mittel 310
      ];
      const stat = bauteilStatistik(punkte)!;
      expect(stat.count).toBe(4);
      expect(stat.punkte).toBe(2);
      expect(stat.minUm).toBe(100);
      expect(stat.maxUm).toBe(320);
      expect(stat.meanUm).toBe(215);
      expect(stat.repraesentativUm).toBe(310); // Max(120, 310)
    });

    it('bauteilStatistik: keine Messwerte -> null (unbemessen)', () => {
      expect(bauteilStatistik([])).toBeNull();
      expect(bauteilStatistik([{ partId: 'tuer_vl', readings: [] }])).toBeNull();
    });

    it('lokaler Spachtel-Punkt hebt die Bauteil-Bewertung auf verdacht', () => {
      // Ein durchgehend hoher Einzelpunkt (Repraesentativwert = Max der Punkt-Mittel)
      // flaggt das Bauteil, auch wenn andere Punkte normal sind.
      const punkte: SchichtPunkt[] = [
        { partId: 'tuer_vl', readings: [{ wertUm: 120 }] },
        { partId: 'tuer_vl', readings: [{ wertUm: 410 }, { wertUm: 390 }] }, // Mittel 400
      ];
      const stat = bauteilStatistik(punkte)!;
      const status = bewerteBauteil('tuer_vl', stat.repraesentativUm);
      expect(status).toBe('verdacht');
    });

    it('ungueltige/negative Messwerte werden ignoriert', () => {
      const stat = bauteilStatistik([
        { partId: 'tuer_vl', readings: [{ wertUm: 100 }, { wertUm: -5 }, { wertUm: NaN as any }] },
      ])!;
      expect(stat.count).toBe(1);
      expect(stat.meanUm).toBe(100);
    });
  });
});
