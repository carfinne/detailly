import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  AUSLASTUNG_ZIEL_DEFAULT,
  STEUER_TERMINE_MAX,
  ZIELE_DEFAULTS,
  mergeZiele,
  resolveZiele,
} from './ziele';
import { ZieleDto } from '../tenants/dto/update-tenant-settings.dto';

/**
 * Ziele & Erinnerungen (Welle 1): defensive Aufloesung + Teil-Update-Merge des
 * settings.ziele-Blocks, plus die DTO-Validierung (Prozent-Grenzen, max. 12
 * Termine, Pflichtfelder je Termin). Deckt den settings-Roundtrip ab wie die
 * uebrigen common/*.spec.ts (mitglied-profil/impressum).
 */
describe('ziele · resolve (defensiv)', () => {
  it('faellt fuer fehlenden/kaputten Block auf sichere Defaults zurueck', () => {
    expect(resolveZiele(undefined)).toEqual(ZIELE_DEFAULTS);
    expect(resolveZiele(null)).toEqual(ZIELE_DEFAULTS);
    expect(resolveZiele('quatsch')).toEqual(ZIELE_DEFAULTS);
    expect(resolveZiele({}).auslastungZielProzent).toBe(AUSLASTUNG_ZIEL_DEFAULT);
  });

  it('klammert das Auslastungsziel auf [50..100] und rundet', () => {
    expect(resolveZiele({ auslastungZielProzent: 10 }).auslastungZielProzent).toBe(50);
    expect(resolveZiele({ auslastungZielProzent: 250 }).auslastungZielProzent).toBe(100);
    expect(resolveZiele({ auslastungZielProzent: 87.6 }).auslastungZielProzent).toBe(88);
    expect(resolveZiele({ auslastungZielProzent: 'x' }).auslastungZielProzent).toBe(90);
  });

  it('Schalter sind strikt boolean-true (kein truthy-Cast)', () => {
    expect(resolveZiele({ auslastungAktiv: 'true', par19WarnungAktiv: 1 })).toMatchObject({
      auslastungAktiv: false,
      par19WarnungAktiv: false,
    });
    expect(resolveZiele({ auslastungAktiv: true, par19WarnungAktiv: true })).toMatchObject({
      auslastungAktiv: true,
      par19WarnungAktiv: true,
    });
  });

  it('liest Steuer-Termine, trimmt/kappt Laengen und setzt Default aktiv=true', () => {
    const r = resolveZiele({
      steuerTermine: [
        { art: '  USt-Voranmeldung  ', datum: '01-10', wiederkehrend: true },
        { art: 'ESt', datum: '2026-06-30', aktiv: false },
      ],
    });
    expect(r.steuerTermine).toHaveLength(2);
    expect(r.steuerTermine[0]).toEqual({
      art: 'USt-Voranmeldung',
      datum: '01-10',
      wiederkehrend: true,
      aktiv: true,
    });
    expect(r.steuerTermine[1].aktiv).toBe(false);
    expect(r.steuerTermine[1].wiederkehrend).toBe(false);
  });

  it('verwirft komplett leere Termine und kappt die Liste auf 12', () => {
    const viele = Array.from({ length: 20 }, (_, i) => ({ art: `T${i}`, datum: '01-01' }));
    const r = resolveZiele({ steuerTermine: [{ art: '', datum: '' }, ...viele] });
    expect(r.steuerTermine).toHaveLength(STEUER_TERMINE_MAX);
    expect(r.steuerTermine[0].art).toBe('T0'); // leerer Eintrag wurde entfernt
  });
});

describe('ziele · merge (Teil-Update)', () => {
  const base = resolveZiele({
    auslastungAktiv: true,
    auslastungZielProzent: 80,
    par19WarnungAktiv: true,
    steuerTermine: [{ art: 'USt', datum: '01-10', wiederkehrend: true }],
  });

  it('laesst nicht angegebene Felder unveraendert', () => {
    const merged = mergeZiele(base, { auslastungZielProzent: 95 });
    expect(merged).toEqual({ ...base, auslastungZielProzent: 95 });
  });

  it('ersetzt die Termin-Liste als Ganzes (Listen-Editor)', () => {
    const merged = mergeZiele(base, { steuerTermine: [{ art: 'ESt', datum: '2026-06-30' }] });
    expect(merged.steuerTermine).toHaveLength(1);
    expect(merged.steuerTermine[0].art).toBe('ESt');
    expect(merged.auslastungAktiv).toBe(true); // unangetastet
  });

  it('leere Termin-Liste loescht alle Termine', () => {
    expect(mergeZiele(base, { steuerTermine: [] }).steuerTermine).toHaveLength(0);
  });

  it('kann Schalter einzeln abschalten', () => {
    expect(mergeZiele(base, { par19WarnungAktiv: false }).par19WarnungAktiv).toBe(false);
    expect(mergeZiele(base, { par19WarnungAktiv: false }).auslastungAktiv).toBe(true);
  });

  it('roundtrip: resolve(merge(...)) ist stabil', () => {
    const merged = mergeZiele(base, { auslastungZielProzent: 70 });
    expect(resolveZiele(merged)).toEqual(merged);
  });
});

async function invalidProps(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('ZieleDto · Validierung', () => {
  it('akzeptiert ein gueltiges vollstaendiges Objekt', async () => {
    const errors = await validate(
      plainToInstance(ZieleDto, {
        auslastungAktiv: true,
        auslastungZielProzent: 90,
        par19WarnungAktiv: true,
        steuerTermine: [{ art: 'USt-Voranmeldung', datum: '01-10', wiederkehrend: true, aktiv: true }],
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('lehnt ein Auslastungsziel ausserhalb 50..100 ab', async () => {
    expect(await invalidProps(plainToInstance(ZieleDto, { auslastungZielProzent: 49 }))).toContain(
      'auslastungZielProzent',
    );
    expect(await invalidProps(plainToInstance(ZieleDto, { auslastungZielProzent: 101 }))).toContain(
      'auslastungZielProzent',
    );
  });

  it('lehnt mehr als 12 Steuer-Termine ab', async () => {
    const termine = Array.from({ length: 13 }, () => ({ art: 'USt', datum: '01-10' }));
    expect(await invalidProps(plainToInstance(ZieleDto, { steuerTermine: termine }))).toContain(
      'steuerTermine',
    );
  });

  it('lehnt einen Termin ohne Pflichtfelder (art/datum) ab', async () => {
    const errors = await validate(
      plainToInstance(ZieleDto, { steuerTermine: [{ wiederkehrend: true }] }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('leeres Objekt ist gueltig (alles optional)', async () => {
    expect(await validate(plainToInstance(ZieleDto, {}))).toHaveLength(0);
  });
});
