import {
  KM_PRO_X,
  KM_PRO_Y,
  distanzKmZwischenRegionen,
  regionenImUmkreis,
} from './geraete-umkreis';

// Ankerregionen (aus PLZ_REGION_ZENTROID):
//  20 = Hamburg, 22 = Hamburg-West (~10 km), 28 = Bremen (~80 km),
//  80 = Muenchen (~540 km).

describe('geraete-umkreis · Kalibrierung', () => {
  it('kalibriert Karten-Einheiten grob auf km (~1.07 / ~1.10)', () => {
    expect(KM_PRO_X).toBeCloseTo(640 / 600, 5);
    expect(KM_PRO_Y).toBeCloseTo(876 / 800, 5);
  });
});

describe('geraete-umkreis · distanzKmZwischenRegionen', () => {
  it('Distanz einer Region zu sich selbst ist 0', () => {
    expect(distanzKmZwischenRegionen('20', '20')).toBe(0);
  });

  it('nahe Nachbarn sind deutlich naeher als ferne Regionen', () => {
    const hhWest = distanzKmZwischenRegionen('20', '22')!;
    const muenchen = distanzKmZwischenRegionen('20', '80')!;
    expect(hhWest).toBeLessThan(30);
    expect(muenchen).toBeGreaterThan(400);
    expect(hhWest).toBeLessThan(muenchen);
  });

  it('unbekannte/ungueltige Region -> null', () => {
    expect(distanzKmZwischenRegionen('20', 'zz')).toBeNull();
    expect(distanzKmZwischenRegionen('xx', '20')).toBeNull();
  });
});

describe('geraete-umkreis · regionenImUmkreis', () => {
  it('radius 0 -> nur die eigene Region', () => {
    expect(regionenImUmkreis('20', 0)).toEqual(['20']);
  });

  it('50 km um Hamburg enthaelt Nachbarn, NICHT Bremen/Muenchen', () => {
    const nah = regionenImUmkreis('20', 50);
    expect(nah).toContain('20'); // eigene Region immer dabei
    expect(nah).toContain('21'); // Hamburg-Ost
    expect(nah).toContain('22'); // Hamburg-West
    expect(nah).not.toContain('28'); // Bremen (~80 km) noch draussen
    expect(nah).not.toContain('80'); // Muenchen (~540 km) klar draussen
  });

  it('100 km um Hamburg zieht Bremen HINEIN, Muenchen bleibt DRAUSSEN', () => {
    const mittel = regionenImUmkreis('20', 100);
    expect(mittel).toContain('28'); // Bremen jetzt drin
    expect(mittel).not.toContain('80'); // Muenchen weiterhin ausgeschlossen
  });

  it('groesserer Radius ist eine Obermenge des kleineren (monoton)', () => {
    const r50 = new Set(regionenImUmkreis('20', 50));
    const r100 = regionenImUmkreis('20', 100);
    for (const region of r50) expect(r100).toContain(region);
    expect(r100.length).toBeGreaterThanOrEqual(r50.size);
  });

  it('selbst der groesste Radius (200 km) schliesst Muenchen von Hamburg aus', () => {
    expect(regionenImUmkreis('20', 200)).not.toContain('80');
  });

  it('unbekanntes Zentrum -> die Region selbst bleibt als exakter Filter (nie leer)', () => {
    expect(regionenImUmkreis('xx', 100)).toEqual(['xx']);
  });
});
