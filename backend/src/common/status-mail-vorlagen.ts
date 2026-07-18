/**
 * Editierbare Vorlagen fuer die automatischen Status-Mails an den Endkunden
 * (Welle 3-A). Landet als Objekt im verschluesselten JSON `tenant.settings`
 * (Muster: bewertung/steuer/mahnwesen) – KEIN Schema-Change. Fehlt der Block oder
 * ein Feld, liefern die resolve*-Funktionen leere Strings; der Aufrufer
 * (orders.service) faellt dann auf die heutigen fest verdrahteten Default-Texte
 * zurueck -> Altbestand bleibt unveraendert.
 *
 * Je kuratiertem Status (bestaetigt / in_arbeit / abholbereit) ist Betreff UND
 * Text getrennt pflegbar. Beide unterstuetzen die Platzhalter {auftragsnummer},
 * {betrieb}, {fahrzeug} und {status}; ersetzt wird SERVERSEITIG beim Versand
 * (ersetzeStatusMailPlatzhalter, single-pass -> kein Re-Ersetzen injizierter
 * Platzhalter-Tokens). Der Versand-Ausloeser (Review-before-send /
 * kundenmailStatus-Schalter) bleibt unberuehrt – NUR der Text ist konfigurierbar.
 */

/** Kuratierte Status, fuer die eine Status-Mail verschickt wird (Reihenfolge = Ablauf). */
export const STATUS_MAIL_STATUS = ['bestaetigt', 'in_arbeit', 'abholbereit'] as const;
export type StatusMailStatus = (typeof STATUS_MAIL_STATUS)[number];

/** Maximallaengen (spiegeln die DTO-@MaxLength-Grenzen). */
export const STATUS_MAIL_BETREFF_MAX = 200;
export const STATUS_MAIL_TEXT_MAX = 2000;

/** Menschlich lesbares deutsches Status-Label fuer den {status}-Platzhalter. */
export const STATUS_MAIL_LABEL: Record<StatusMailStatus, string> = {
  bestaetigt: 'bestätigt',
  in_arbeit: 'in Arbeit',
  abholbereit: 'abholbereit',
};

/** Eine einzelne Vorlage (Betreff + Fliesstext). Leer = heutigen Default nutzen. */
export interface StatusMailVorlage {
  betreff: string;
  text: string;
}
/** Aufgeloeste Vorlagen je Status (settings.statusMailVorlagen). */
export type StatusMailVorlagenConfig = Record<StatusMailStatus, StatusMailVorlage>;

/** Betreiber-Defaults = keine Vorlagen (jeder Status faellt auf den Default-Text zurueck). */
export const STATUS_MAIL_VORLAGEN_DEFAULTS: StatusMailVorlagenConfig = {
  bestaetigt: { betreff: '', text: '' },
  in_arbeit: { betreff: '', text: '' },
  abholbereit: { betreff: '', text: '' },
};

function toStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function resolveEine(raw: unknown): StatusMailVorlage {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    betreff: toStr(o.betreff, STATUS_MAIL_BETREFF_MAX),
    text: toStr(o.text, STATUS_MAIL_TEXT_MAX),
  };
}

/**
 * Liest die Vorlagen DEFENSIV aus dem Rohwert (tenant.settings.statusMailVorlagen).
 * Fehlende/ungueltige Felder fallen auf leere Strings zurueck; wirft NIE (Lese-Pfad,
 * auch fuer Altbestand robust). Laengen werden gekappt (Backstop zur DTO-Pruefung).
 */
export function resolveStatusMailVorlagen(raw: unknown): StatusMailVorlagenConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    bestaetigt: resolveEine(o.bestaetigt),
    in_arbeit: resolveEine(o.in_arbeit),
    abholbereit: resolveEine(o.abholbereit),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface StatusMailVorlagePatch {
  betreff?: string;
  text?: string;
}
export type StatusMailVorlagenPatch = Partial<Record<StatusMailStatus, StatusMailVorlagePatch>>;

function mergeEine(base: StatusMailVorlage, patch?: StatusMailVorlagePatch): StatusMailVorlage {
  return {
    betreff: patch?.betreff !== undefined ? toStr(patch.betreff, STATUS_MAIL_BETREFF_MAX) : base.betreff,
    text: patch?.text !== undefined ? toStr(patch.text, STATUS_MAIL_TEXT_MAX) : base.text,
  };
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Status/Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeStatusMailVorlagen(
  base: StatusMailVorlagenConfig,
  patch: StatusMailVorlagenPatch,
): StatusMailVorlagenConfig {
  return {
    bestaetigt: mergeEine(base.bestaetigt, patch.bestaetigt),
    in_arbeit: mergeEine(base.in_arbeit, patch.in_arbeit),
    abholbereit: mergeEine(base.abholbereit, patch.abholbereit),
  };
}

/** Werte fuer die Platzhalter-Ersetzung (alle bereits als Klartext-String). */
export interface StatusMailPlatzhalter {
  auftragsnummer: string;
  betrieb: string;
  fahrzeug: string;
  status: string;
}

/**
 * Ersetzt die unterstuetzten Platzhalter in EINEM Durchlauf. Der Single-Pass ist
 * bewusst: ein eingesetzter Wert (z. B. ein Betriebsname mit "{fahrzeug}") wird so
 * NICHT ein zweites Mal als Platzhalter interpretiert. Unbekannte {…}-Tokens
 * bleiben unveraendert stehen.
 */
export function ersetzeStatusMailPlatzhalter(vorlage: string, werte: StatusMailPlatzhalter): string {
  return vorlage.replace(/\{(auftragsnummer|betrieb|fahrzeug|status)\}/g, (_m, key: string) => {
    const w = werte[key as keyof StatusMailPlatzhalter];
    return typeof w === 'string' ? w : '';
  });
}

/** true, wenn die Vorlage tatsaechlich gepflegt ist (Betreff ODER Text nicht leer). */
export function hatStatusMailVorlage(v: StatusMailVorlage): boolean {
  return v.betreff.trim() !== '' || v.text.trim() !== '';
}
