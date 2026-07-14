/**
 * Endkunden-Kommunikation je Betrieb (Kern-Feature, KEIN Tarif-Gate). Landet als
 * Objekt im verschluesselten JSON `tenant.settings` – KEIN Schema-Change (Muster:
 * steuer/impressum/mahnwesen/ziele). Fehlt der Block, liefern die resolve*-Funktionen
 * sichere Defaults (alles AUS), sodass Altbestand unveraendert bleibt.
 *
 * Zwei Teilbereiche:
 *  - `kundenkommunikation`: Termin-Erinnerung an den Endkunden (24 h vorher).
 *    Opt-IN (Default AUS) – ein automatischer Kunden-Kanal, der bewusst pro Betrieb
 *    eingeschaltet wird (Review-before-send-Hausregel: automatische Kunden-Mails
 *    brauchen einen bewussten Schalter mit klarer UI).
 *  - `bewertung`: Bewertungs-Bitte, die an die bestehende Abschluss-Statusmail
 *    ("Fahrzeug abholbereit", OrderStatus.FERTIG) angehaengt wird – nur wenn aktiv
 *    UND eine Google-URL hinterlegt ist. Kein neuer Kanal: die Bitte reitet auf der
 *    ohnehin verschickten Status-Mail mit.
 */

// --- Feature 1: Termin-Erinnerung ------------------------------------------

/** Grenzen der Vorlaufzeit (Stunden) fuer die Termin-Erinnerung. */
export const STUNDEN_VORLAUF_MIN = 1;
export const STUNDEN_VORLAUF_MAX = 168; // 7 Tage
export const STUNDEN_VORLAUF_DEFAULT = 24;

/** Aufgeloeste Kundenkommunikations-Konfiguration je Betrieb (settings.kundenkommunikation). */
export interface KundenkommunikationConfig {
  /** Automatische Termin-Erinnerung an den Endkunden aktiv? (Opt-in, Default false.) */
  terminErinnerungAktiv: boolean;
  /** Vorlaufzeit in Stunden (Default 24), geklammert auf [1..168]. */
  stundenVorlauf: number;
}

/** Betreiber-Defaults = heutiges Verhalten (Erinnerung AUS, 24 h Vorlauf). */
export const KUNDENKOMMUNIKATION_DEFAULTS: KundenkommunikationConfig = {
  terminErinnerungAktiv: false,
  stundenVorlauf: STUNDEN_VORLAUF_DEFAULT,
};

/** Klammert die Vorlaufzeit defensiv auf [1..168]; leer/ungueltig -> Default. */
function clampVorlauf(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return STUNDEN_VORLAUF_DEFAULT;
  return Math.min(STUNDEN_VORLAUF_MAX, Math.max(STUNDEN_VORLAUF_MIN, n));
}

/**
 * Liest die Kundenkommunikations-Konfiguration DEFENSIV aus dem Rohwert
 * (tenant.settings.kundenkommunikation). Fehlende/ungueltige Keys fallen je Feld
 * auf die Defaults zurueck; wirft NIE (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveKundenkommunikation(raw: unknown): KundenkommunikationConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    terminErinnerungAktiv: o.terminErinnerungAktiv === true,
    stundenVorlauf:
      o.stundenVorlauf === undefined ? STUNDEN_VORLAUF_DEFAULT : clampVorlauf(o.stundenVorlauf),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface KundenkommunikationPatch {
  terminErinnerungAktiv?: boolean;
  stundenVorlauf?: number;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeKundenkommunikation(
  base: KundenkommunikationConfig,
  patch: KundenkommunikationPatch,
): KundenkommunikationConfig {
  return {
    terminErinnerungAktiv:
      typeof patch.terminErinnerungAktiv === 'boolean'
        ? patch.terminErinnerungAktiv
        : base.terminErinnerungAktiv,
    stundenVorlauf:
      patch.stundenVorlauf !== undefined ? clampVorlauf(patch.stundenVorlauf) : base.stundenVorlauf,
  };
}

// --- Feature 2: Bewertungs-Bitte -------------------------------------------

/** Maximale Laengen fuer die Bewertungs-Felder. */
export const BEWERTUNG_URL_MAX = 300;
export const BEWERTUNG_TEXT_MAX = 300;

/** Aufgeloeste Bewertungs-Konfiguration je Betrieb (settings.bewertung). */
export interface BewertungConfig {
  /** Bewertungs-Bitte an die Abschluss-Statusmail anhaengen? (Opt-in, Default false.) */
  aktiv: boolean;
  /** Google-(o. ae.)Bewertungs-URL. Leer = keine Bitte (auch bei aktiv). Nur https. */
  googleUrl: string;
  /** Optionaler eigener Einladungstext; leer = Standard-Text. */
  text: string;
}

/** Betreiber-Defaults = keine Bewertungs-Bitte. */
export const BEWERTUNG_DEFAULTS: BewertungConfig = {
  aktiv: false,
  googleUrl: '',
  text: '',
};

function toStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Nur sichere https-URLs durchlassen (kein javascript:/data: o. ae. – die URL
 * landet als Link in einer Kunden-Mail). Alles andere -> leer (= keine Bitte).
 */
function safeHttpsUrl(v: unknown): string {
  const s = toStr(v, BEWERTUNG_URL_MAX);
  return /^https:\/\/\S+$/.test(s) ? s : '';
}

/**
 * Liest die Bewertungs-Konfiguration DEFENSIV aus dem Rohwert (tenant.settings.bewertung).
 * Fehlende/ungueltige Keys fallen je Feld auf die Defaults zurueck; wirft NIE.
 */
export function resolveBewertung(raw: unknown): BewertungConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    aktiv: o.aktiv === true,
    googleUrl: safeHttpsUrl(o.googleUrl),
    text: toStr(o.text, BEWERTUNG_TEXT_MAX),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface BewertungPatch {
  aktiv?: boolean;
  googleUrl?: string;
  text?: string;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update. URL/Text
 * werden normalisiert (URL auf sicheres https geprueft, sonst geleert).
 */
export function mergeBewertung(base: BewertungConfig, patch: BewertungPatch): BewertungConfig {
  return {
    aktiv: typeof patch.aktiv === 'boolean' ? patch.aktiv : base.aktiv,
    googleUrl: patch.googleUrl !== undefined ? safeHttpsUrl(patch.googleUrl) : base.googleUrl,
    text: patch.text !== undefined ? toStr(patch.text, BEWERTUNG_TEXT_MAX) : base.text,
  };
}
