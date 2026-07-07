import {
  mapMarkerToDamageItemFields,
  inspectionClientUuid,
  itemClientUuid,
  ART_FALLBACK,
  SCHWEREGRAD_FALLBACK,
} from './intake-marker-mapping';

/**
 * DB-freie Regressionstests fuer die Intake->Inspection-Feldabbildung.
 * Deckt die verbindlichen REVIEW-§3-Korrekturen ab:
 *  (a) alle Zielwerte explizit (positionMode='2d', origin='neu', status='offen'),
 *  (b) art/schweregrad gegen die Enums validiert, unbekannte -> Fallback + Protokoll.
 */
describe('mapMarkerToDamageItemFields', () => {
  const gueltigerMarker = {
    id: 'm1',
    ansicht: 'links',
    x: 42,
    y: 17,
    zone: 'tuer_vl',
    art: 'kratzer',
    schweregrad: 'leicht',
    notiz: 'Streifer',
  };

  it('setzt ALLE Zielwerte explizit (REVIEW §3a)', () => {
    const f = mapMarkerToDamageItemFields(gueltigerMarker);
    expect(f.positionMode).toBe('2d');
    expect(f.origin).toBe('neu');
    expect(f.status).toBe('offen');
  });

  it('uebernimmt gueltige art/schweregrad 1:1 ohne Mapping', () => {
    const f = mapMarkerToDamageItemFields(gueltigerMarker);
    expect(f.art).toBe('kratzer');
    expect(f.schweregrad).toBe('leicht');
    expect(f.wurdeGemappt).toBe(false);
    // Bestehende Notiz bleibt unveraendert, kein Protokoll angehaengt.
    expect(f.notiz).toBe('Streifer');
  });

  it('bildet Position + Ansicht + zone korrekt ab', () => {
    const f = mapMarkerToDamageItemFields(gueltigerMarker);
    expect(f.ansicht2d).toBe('links');
    expect(f.x2d).toBe(42);
    expect(f.y2d).toBe(17);
    expect(f.partId).toBe('tuer_vl');
    expect(f.partLabel).toBe('tuer_vl');
  });

  it('mappt unbekannte art auf Fallback und protokolliert das Original (REVIEW §3b)', () => {
    const f = mapMarkerToDamageItemFields({ ...gueltigerMarker, art: 'kaputt' });
    expect(f.art).toBe(ART_FALLBACK); // 'sonstiges'
    expect(f.wurdeGemappt).toBe(true);
    expect(f.notiz).toContain('Original-Art: "kaputt"');
    // bestehende Notiz bleibt erhalten (mit " | " getrennt).
    expect(f.notiz).toContain('Streifer');
  });

  it('mappt unbekannten schweregrad auf Fallback und protokolliert das Original', () => {
    const f = mapMarkerToDamageItemFields({ ...gueltigerMarker, schweregrad: 'extrem' });
    expect(f.schweregrad).toBe(SCHWEREGRAD_FALLBACK); // 'mittel'
    expect(f.wurdeGemappt).toBe(true);
    expect(f.notiz).toContain('Original-Schweregrad: "extrem"');
  });

  it('setzt partId auf "unbekannt", wenn keine zone vorhanden', () => {
    const { zone, ...ohneZone } = gueltigerMarker;
    void zone;
    const f = mapMarkerToDamageItemFields(ohneZone as typeof gueltigerMarker);
    expect(f.partId).toBe('unbekannt');
    expect(f.partLabel).toBeNull();
  });

  it('setzt notiz auf null, wenn weder Notiz noch Protokoll vorhanden', () => {
    const f = mapMarkerToDamageItemFields({ ...gueltigerMarker, notiz: undefined });
    expect(f.notiz).toBeNull();
  });

  it('protokolliert beide Fallbacks zugleich, auch ohne bestehende Notiz', () => {
    const f = mapMarkerToDamageItemFields({
      ...gueltigerMarker,
      art: 'xx',
      schweregrad: 'yy',
      notiz: undefined,
    });
    expect(f.art).toBe(ART_FALLBACK);
    expect(f.schweregrad).toBe(SCHWEREGRAD_FALLBACK);
    expect(f.notiz).toContain('Original-Art: "xx"');
    expect(f.notiz).toContain('Original-Schweregrad: "yy"');
  });
});

describe('Idempotenz-Schluessel', () => {
  it('inspectionClientUuid ist deterministisch aus der Intake-id', () => {
    expect(inspectionClientUuid('abc')).toBe('intake:abc');
  });

  it('itemClientUuid nimmt IMMER den Array-Index auf und haengt die Marker-id an', () => {
    expect(itemClientUuid('abc', 0, 'm1')).toBe('intake:abc:0_m1');
    expect(itemClientUuid('abc', 3, 'm7')).toBe('intake:abc:3_m7');
  });

  it('itemClientUuid faellt ohne Marker-id auf reinen Index zurueck', () => {
    expect(itemClientUuid('abc', 0)).toBe('intake:abc:0');
    expect(itemClientUuid('abc', 1)).toBe('intake:abc:1');
  });

  it('id-lose Marker auf gleicher Position kollidieren NICHT (Index unterscheidet)', () => {
    // Zwei id-lose Marker mit identischer Ansicht+Position bekommen dank Index
    // verschiedene Schluessel -> kein stiller Datenverlust beim Re-Run.
    const a = itemClientUuid('abc', 0);
    const b = itemClientUuid('abc', 1);
    expect(a).not.toBe(b);
  });
});
