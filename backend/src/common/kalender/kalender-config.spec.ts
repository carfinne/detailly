import {
  KALENDER_DEFAULTS,
  mergeKalender,
  resolveKalender,
  SLOT_DAUER_MIN_MAX,
  SLOT_DAUER_MIN_MIN,
  UMSATZ_ZIEL_WOCHE_MAX,
} from './kalender-config';

describe('resolveKalender (defensives Lesen)', () => {
  it('undefined/null/Nicht-Objekt -> Defaults', () => {
    for (const raw of [undefined, null, 42, 'x', []]) {
      expect(resolveKalender(raw as unknown)).toEqual(KALENDER_DEFAULTS);
    }
  });

  it('leeres Objekt -> Defaults (Mo–Fr 08–18 aktiv, Sa/So inaktiv, warnen, 30/0)', () => {
    const c = resolveKalender({});
    expect(c.konfliktverhalten).toBe('warnen');
    expect(c.standortKonflikt).toBe(false);
    expect(c.slotDauerMin).toBe(30);
    expect(c.pufferMin).toBe(0);
    expect(c.arbeitszeiten.mo).toEqual({ von: '08:00', bis: '18:00', aktiv: true });
    expect(c.arbeitszeiten.sa).toEqual({ von: '08:00', bis: '18:00', aktiv: false });
    expect(c.arbeitszeiten.so.aktiv).toBe(false);
  });

  it('konfliktverhalten: nur "blockieren" wird uebernommen, sonst warnen', () => {
    expect(resolveKalender({ konfliktverhalten: 'blockieren' }).konfliktverhalten).toBe('blockieren');
    expect(resolveKalender({ konfliktverhalten: 'quatsch' }).konfliktverhalten).toBe('warnen');
  });

  it('klammert slotDauerMin/pufferMin in ihre Bereiche', () => {
    expect(resolveKalender({ slotDauerMin: 1 }).slotDauerMin).toBe(SLOT_DAUER_MIN_MIN);
    expect(resolveKalender({ slotDauerMin: 99999 }).slotDauerMin).toBe(SLOT_DAUER_MIN_MAX);
    expect(resolveKalender({ pufferMin: -10 }).pufferMin).toBe(0);
    // numerische Strings defensiv akzeptiert
    expect(resolveKalender({ slotDauerMin: '45' }).slotDauerMin).toBe(45);
  });

  it('umsatzZielWoche: Default null, klammert 0..1 Mio (Cent-genau), Junk -> null', () => {
    expect(resolveKalender({}).umsatzZielWoche).toBeNull();
    expect(resolveKalender({ umsatzZielWoche: 5000 }).umsatzZielWoche).toBe(5000);
    expect(resolveKalender({ umsatzZielWoche: 2499.999 }).umsatzZielWoche).toBe(2500);
    expect(resolveKalender({ umsatzZielWoche: 2_000_000 }).umsatzZielWoche).toBe(
      UMSATZ_ZIEL_WOCHE_MAX,
    );
    expect(resolveKalender({ umsatzZielWoche: -5 }).umsatzZielWoche).toBe(0);
    expect(resolveKalender({ umsatzZielWoche: 'abc' }).umsatzZielWoche).toBeNull();
    expect(resolveKalender({ umsatzZielWoche: null }).umsatzZielWoche).toBeNull();
  });

  it('ungueltige Uhrzeiten -> Default-Fenster, gueltige werden uebernommen', () => {
    const c = resolveKalender({
      arbeitszeiten: {
        mo: { von: '25:99', bis: '17:30', aktiv: false },
        di: { von: '09:15', bis: '20:00', aktiv: true },
      },
    });
    expect(c.arbeitszeiten.mo).toEqual({ von: '08:00', bis: '17:30', aktiv: false });
    expect(c.arbeitszeiten.di).toEqual({ von: '09:15', bis: '20:00', aktiv: true });
    // nicht angegebene Tage bleiben auf Default
    expect(c.arbeitszeiten.fr).toEqual({ von: '08:00', bis: '18:00', aktiv: true });
  });
});

describe('mergeKalender (Teil-Update)', () => {
  it('ueberlagert nur angegebene Felder, Rest bleibt', () => {
    const base = resolveKalender({});
    const merged = mergeKalender(base, { konfliktverhalten: 'blockieren', standortKonflikt: true });
    expect(merged.konfliktverhalten).toBe('blockieren');
    expect(merged.standortKonflikt).toBe(true);
    expect(merged.slotDauerMin).toBe(30); // unveraendert
    expect(merged.arbeitszeiten).toEqual(base.arbeitszeiten);
  });

  it('leeres Patch aendert nichts', () => {
    const base = resolveKalender({ slotDauerMin: 60, pufferMin: 15 });
    expect(mergeKalender(base, {})).toEqual(base);
  });

  it('arbeitszeiten: nur der angegebene Tag/das angegebene Feld aendert sich', () => {
    const base = resolveKalender({});
    const merged = mergeKalender(base, { arbeitszeiten: { sa: { aktiv: true } } });
    expect(merged.arbeitszeiten.sa).toEqual({ von: '08:00', bis: '18:00', aktiv: true });
    // andere Tage unveraendert
    expect(merged.arbeitszeiten.mo).toEqual(base.arbeitszeiten.mo);
  });

  it('klammert neue Zahlenwerte, ignoriert ungueltige Uhrzeit im Patch', () => {
    const base = resolveKalender({});
    const merged = mergeKalender(base, {
      slotDauerMin: 99999,
      arbeitszeiten: { mo: { von: 'abc', bis: '19:00' } },
    });
    expect(merged.slotDauerMin).toBe(SLOT_DAUER_MIN_MAX);
    expect(merged.arbeitszeiten.mo).toEqual({ von: '08:00', bis: '19:00', aktiv: true });
  });

  it('umsatzZielWoche: Zahl setzt geklammert, null loescht, weglassen laesst unveraendert', () => {
    const base = resolveKalender({ umsatzZielWoche: 5000 });
    expect(mergeKalender(base, { umsatzZielWoche: 2_000_000 }).umsatzZielWoche).toBe(
      UMSATZ_ZIEL_WOCHE_MAX,
    );
    expect(mergeKalender(base, { umsatzZielWoche: -1 }).umsatzZielWoche).toBe(0);
    expect(mergeKalender(base, { umsatzZielWoche: null }).umsatzZielWoche).toBeNull();
    expect(mergeKalender(base, { pufferMin: 5 }).umsatzZielWoche).toBe(5000);
    // NaN/ungueltig faellt auf den Bestandswert zurueck (kein stilles Loeschen).
    expect(mergeKalender(base, { umsatzZielWoche: Number.NaN }).umsatzZielWoche).toBe(5000);
  });
});
