/**
 * Oeffentliches Mitglieds-Profil je Betrieb (Opt-in fuer die Mitgliederliste auf
 * detailly.de). KEIN Schema-Change: liegt im verschluesselten JSON
 * `tenant.settings` unter dem Key `mitgliedProfil` (Muster: steuer/mahnwesen/
 * kalkulation). DSGVO- und ehrlichkeitskonform: NUR wenn der Betrieb `zeigen`
 * aktiv setzt (Default false), erscheint er ueberhaupt oeffentlich – jederzeit
 * widerrufbar.
 *
 * Bewusst PII-ARM: nur zur Veroeffentlichung gedachte Felder (Stadt, kurze
 * Selbstbeschreibung, Webseite). KEINE Adresse/E-Mail/Telefon – die stehen zwar
 * anderswo im Tenant, gehoeren aber nicht auf die oeffentliche Startseite.
 *
 * Rueckwaertskompatibel: fehlt der Block, liefert resolveMitgliedProfil die
 * Defaults (zeigen=false) -> ein Bestandsbetrieb erscheint nie ungefragt.
 */

/** Maximallaengen (Server erzwingt sie im DTO; resolve/merge kappen defensiv). */
export const MITGLIED_STADT_MAX = 80;
export const MITGLIED_KURZBESCHREIBUNG_MAX = 160;
export const MITGLIED_WEBSEITE_MAX = 200;

/** Erlaubtes Webseiten-Schema (nur http/https – kein javascript:/data: o. ae.). */
const WEBSEITE_SCHEMA_REGEX = /^https?:\/\/\S+$/i;

/** Aufgeloestes Mitglieds-Profil (tenant.settings.mitgliedProfil). */
export interface MitgliedProfilConfig {
  /** Opt-in: nur bei true erscheint der Betrieb oeffentlich. Default false. */
  zeigen: boolean;
  /** Ort/Stadt fuer die oeffentliche Karte (optional). */
  stadt: string;
  /** Kurze Selbstbeschreibung (max. 160 Zeichen, optional). */
  kurzbeschreibung: string;
  /** Eigene Webseite (nur http/https; leer, falls unsicher/leer). */
  webseite: string;
}

/** Betreiber-Defaults = kein oeffentlicher Auftritt (Opt-in aus). */
export const MITGLIED_PROFIL_DEFAULTS: MitgliedProfilConfig = {
  zeigen: false,
  stadt: '',
  kurzbeschreibung: '',
  webseite: '',
};

function toStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Gibt die Webseite NUR zurueck, wenn sie ein sicheres http/https-Schema hat –
 * andernfalls leer. Defensiver Backstop, damit auf der oeffentlichen Karte nie
 * ein gefaehrliches Schema (javascript:/data:) als klickbarer Link landet, selbst
 * wenn wider Erwarten ein Altwert ohne Schema gespeichert waere.
 */
function safeWebseite(v: unknown, max: number): string {
  const s = toStr(v, max);
  return WEBSEITE_SCHEMA_REGEX.test(s) ? s : '';
}

/**
 * Liest das Mitglieds-Profil DEFENSIV aus dem Rohwert
 * (tenant.settings.mitgliedProfil). Fehlende/ungueltige Keys fallen je Feld auf
 * die Defaults zurueck; wirft NIE (Lese-Pfad, auch fuer Altbestand robust).
 */
export function resolveMitgliedProfil(raw: unknown): MitgliedProfilConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    zeigen: o.zeigen === true,
    stadt: toStr(o.stadt, MITGLIED_STADT_MAX),
    kurzbeschreibung: toStr(o.kurzbeschreibung, MITGLIED_KURZBESCHREIBUNG_MAX),
    webseite: safeWebseite(o.webseite, MITGLIED_WEBSEITE_MAX),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface MitgliedProfilPatch {
  zeigen?: boolean;
  stadt?: string;
  kurzbeschreibung?: string;
  webseite?: string;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update. Leere
 * Strings loeschen den jeweiligen Wert (Feld leeren). Die Webseite wird auf ein
 * sicheres Schema geprueft (unsicher/leer -> leer).
 */
export function mergeMitgliedProfil(
  base: MitgliedProfilConfig,
  patch: MitgliedProfilPatch,
): MitgliedProfilConfig {
  return {
    zeigen: typeof patch.zeigen === 'boolean' ? patch.zeigen : base.zeigen,
    stadt: patch.stadt !== undefined ? toStr(patch.stadt, MITGLIED_STADT_MAX) : base.stadt,
    kurzbeschreibung:
      patch.kurzbeschreibung !== undefined
        ? toStr(patch.kurzbeschreibung, MITGLIED_KURZBESCHREIBUNG_MAX)
        : base.kurzbeschreibung,
    webseite:
      patch.webseite !== undefined
        ? // Leerer String loescht bewusst (kein Schema-Check auf ''); sonst pruefen.
          patch.webseite.trim() === ''
          ? ''
          : safeWebseite(patch.webseite, MITGLIED_WEBSEITE_MAX)
        : base.webseite,
  };
}

/**
 * Bildet aus dem Firmennamen eine 1–2-Buchstaben-Initiale fuer die oeffentliche
 * Karte (Monogramm-Fallback, wenn kein Logo vorliegt). Nimmt die Anfangs-
 * buchstaben der ersten beiden Woerter; faellt auf '•' zurueck, falls nichts
 * Brauchbares uebrig bleibt.
 */
export function initialeAusName(name: string): string {
  const woerter = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9ÄÖÜäöü]/.test(w));
  if (woerter.length === 0) return '•';
  const buchstaben = woerter.slice(0, 2).map((w) => w[0].toUpperCase());
  return buchstaben.join('');
}
