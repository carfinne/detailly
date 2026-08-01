/**
 * Steuer-Konstanten + Steuer-Einstellungen je Betrieb (Welle 1: §19 UStG).
 *
 * Deutscher Regel-Mehrwertsteuersatz (19 %) – zentral, damit Auftrags-Kalkulation
 * (OrdersService) und die automatische Auftrags-Anlage aus Online-Anfragen
 * (BookingRequestsService, T-004) garantiert mit demselben Satz rechnen.
 *
 * Zusaetzlich (Welle 1): der Settings-Block `tenant.settings.steuer` mit
 * Kleinunternehmer-Regelung (§ 19 UStG), Standard-MwSt-Satz fuer NEUE Belege
 * und Rechtsform-/Registerangaben (§ 35a GewO / § 14 UStG-Pflichtangaben auf
 * Geschaeftsbriefen). KEIN Schema-Change: liegt im verschluesselten JSON
 * `tenant.settings` (Muster: mahnwesen/kalkulation/kalender).
 *
 * Rueckwaertskompatibel: fehlt der Block, liefert resolveSteuer die Defaults
 * (Regelbesteuerung, 19 %) -> heutiges Verhalten bleibt unveraendert.
 */
export const MWST_SATZ = 0.19;

/** Rechtsformen (Auswahl im Settings-Formular; steuert die PDF-Fusszeile). */
export const RECHTSFORMEN = [
  'einzelunternehmen',
  'gbr',
  'ug',
  'gmbh',
  'ohg',
  'kg',
  'gmbh_co_kg',
  'freiberufler',
  'sonstige',
] as const;
export type Rechtsform = (typeof RECHTSFORMEN)[number];

/** Rechtsformen mit Handelsregister-Pflichtangaben (Registergericht/-nummer, Vertretung). */
export const REGISTER_RECHTSFORMEN: readonly Rechtsform[] = ['ug', 'gmbh', 'gmbh_co_kg'];

/** Anzeige-Label je Rechtsform (fuer die PDF-Fusszeile; Backend rendert deutsch). */
export const RECHTSFORM_LABEL: Record<Rechtsform, string> = {
  einzelunternehmen: 'Einzelunternehmen',
  gbr: 'GbR',
  ug: 'UG (haftungsbeschränkt)',
  gmbh: 'GmbH',
  ohg: 'OHG',
  kg: 'KG',
  gmbh_co_kg: 'GmbH & Co. KG',
  freiberufler: 'Freiberufler',
  sonstige: '',
};

/** Default-Befreiungshinweis auf Belegen von Kleinunternehmern (§ 19 UStG). */
export const KLEINUNTERNEHMER_HINWEIS_DEFAULT =
  'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG.';

/** Erlaubte Standard-MwSt-Saetze fuer NEUE Belege (Vorwahl, nicht Belegebene). */
export const STANDARD_MWST_SAETZE = [19, 0] as const;

/** Steuer-Einstellungen je Betrieb (tenant.settings.steuer), aufgeloest. */
export interface SteuerConfig {
  /** Kleinunternehmer nach § 19 UStG: erzwingt 0 % auf NEUEN Belegen. */
  kleinunternehmer: boolean;
  /** Vorwahl des MwSt-Satzes fuer NEUE Belege (19 oder 0). Belegebene bleibt 19/7/0. */
  standardMwstSatz: 19 | 0;
  /** Befreiungshinweis auf Belegen (leer -> Default-Text). */
  kleinunternehmerHinweis: string;
  /** Rechtsform des Betriebs (steuert die PDF-Fusszeile). */
  rechtsform: Rechtsform;
  /** Registergericht (z. B. "Amtsgericht Berlin-Charlottenburg"), nur Kapitalgesellschaften. */
  registergericht: string;
  /** Registernummer (z. B. "HRB 123456"). */
  registernummer: string;
  /** Vertretungsberechtigte (Geschaeftsfuehrer) bzw. Inhaber-Name. */
  vertretungsberechtigte: string;
  /**
   * ISO-Zeitstempel der ERSTEN bewussten §19-Entscheidung (Kleinunternehmer ja/
   * nein) – SERVERSEITIG gesetzt, nie ein Client-Wert. `null`, solange der Betrieb
   * die Steuer-Einstellung noch NIE bewusst gespeichert hat (reiner Default).
   * Additives Signal (Muster: mitgliedProfil.zugestimmtAm): loest das Problem, dass
   * ein Default-`false` sonst nicht von einem bewusst gewaehlten `false`
   * (Regelbesteuerung) unterscheidbar waere. Wird gesetzt, sobald das Steuer-
   * Formular mit einer §19-Wahl gespeichert wird; bleibt danach der frueheste
   * Zeitpunkt (kein Ueberschreiben). NIE ein §14-Pflichtfeld – reine Onboarding-/
   * Statusinformation.
   */
  entschiedenAm: string | null;
}

/** Betreiber-Defaults = heutiges Verhalten (Regelbesteuerung, 19 %). */
export const STEUER_DEFAULTS: SteuerConfig = {
  kleinunternehmer: false,
  standardMwstSatz: 19,
  kleinunternehmerHinweis: KLEINUNTERNEHMER_HINWEIS_DEFAULT,
  rechtsform: 'einzelunternehmen',
  registergericht: '',
  registernummer: '',
  vertretungsberechtigte: '',
  // Noch KEINE bewusste §19-Entscheidung getroffen (nur der Default gilt).
  entschiedenAm: null,
};

function toStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Liest die Steuer-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.steuer). Fehlende/ungueltige Keys fallen je Feld auf die
 * Defaults zurueck; wirft NIE (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveSteuer(raw: unknown): SteuerConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const D = STEUER_DEFAULTS;
  const satz = Number(o.standardMwstSatz);
  const rechtsform = RECHTSFORMEN.includes(o.rechtsform as Rechtsform)
    ? (o.rechtsform as Rechtsform)
    : D.rechtsform;
  return {
    kleinunternehmer: o.kleinunternehmer === true,
    standardMwstSatz: satz === 0 ? 0 : 19,
    kleinunternehmerHinweis: toStr(o.kleinunternehmerHinweis, 300) || D.kleinunternehmerHinweis,
    rechtsform,
    registergericht: toStr(o.registergericht, 120),
    registernummer: toStr(o.registernummer, 40),
    vertretungsberechtigte: toStr(o.vertretungsberechtigte, 200),
    // Nur ein nicht-leerer String zaehlt als Nachweis einer bewussten Entscheidung;
    // fehlt/leer -> null (Altbestand ohne Block bleibt "noch nicht entschieden").
    entschiedenAm:
      typeof o.entschiedenAm === 'string' && o.entschiedenAm.trim() !== ''
        ? o.entschiedenAm
        : null,
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface SteuerPatch {
  kleinunternehmer?: boolean;
  standardMwstSatz?: number;
  kleinunternehmerHinweis?: string;
  rechtsform?: Rechtsform;
  registergericht?: string;
  registernummer?: string;
  vertretungsberechtigte?: string;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update. Leerer
 * String beim Hinweis setzt zurueck auf den Default-Text (setOrDelete-Idee);
 * leere Register-/Vertretungsfelder loeschen den Wert.
 *
 * `entschiedenAm` (Nachweis der bewussten §19-Wahl) wird SERVERSEITIG gefuehrt
 * (nie aus dem Patch): sobald der Patch die Kleinunternehmer-Entscheidung
 * EXPLIZIT enthaelt (`patch.kleinunternehmer !== undefined` – so sendet das
 * Steuer-Formular bei jedem Speichern), wird der frueheste Zeitpunkt festgehalten
 * (`base.entschiedenAm ?? nowIso`). Ein Patch OHNE §19-Feld (z. B. nur Rechtsform)
 * markiert die Entscheidung bewusst NICHT – ein Default-`false` bleibt so ehrlich
 * von einem bewusst gewaehlten `false` unterscheidbar. `nowIso` ist in Tests
 * injizierbar.
 */
export function mergeSteuer(
  base: SteuerConfig,
  patch: SteuerPatch,
  nowIso: string = new Date().toISOString(),
): SteuerConfig {
  const str = (v: unknown, prev: string, max: number): string =>
    typeof v === 'string' ? v.trim().slice(0, max) : prev;
  const satz =
    patch.standardMwstSatz !== undefined
      ? Number(patch.standardMwstSatz) === 0
        ? 0
        : 19
      : base.standardMwstSatz;
  return {
    kleinunternehmer:
      typeof patch.kleinunternehmer === 'boolean' ? patch.kleinunternehmer : base.kleinunternehmer,
    standardMwstSatz: satz,
    kleinunternehmerHinweis:
      patch.kleinunternehmerHinweis !== undefined
        ? toStr(patch.kleinunternehmerHinweis, 300) || KLEINUNTERNEHMER_HINWEIS_DEFAULT
        : base.kleinunternehmerHinweis,
    rechtsform: RECHTSFORMEN.includes(patch.rechtsform as Rechtsform)
      ? (patch.rechtsform as Rechtsform)
      : base.rechtsform,
    registergericht: str(patch.registergericht, base.registergericht, 120),
    registernummer: str(patch.registernummer, base.registernummer, 40),
    vertretungsberechtigte: str(patch.vertretungsberechtigte, base.vertretungsberechtigte, 200),
    // Erste bewusste §19-Wahl stempelt den Zeitpunkt; danach unveraendert (frueheste
    // Entscheidung). Ohne §19-Feld im Patch bleibt der bisherige Stand erhalten.
    entschiedenAm:
      patch.kleinunternehmer !== undefined ? base.entschiedenAm ?? nowIso : base.entschiedenAm,
  };
}
