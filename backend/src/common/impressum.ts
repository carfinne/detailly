/**
 * Tenant-Impressum-Generator (Gründer-Tools): erzeugt aus den Stammdaten eines
 * Betriebs ein strukturiertes, PII-freies Impressum nach § 5 DDG und prueft die
 * Vollstaendigkeit je Rechtsform.
 *
 * WICHTIG (RDG-/Verantwortungs-Abgrenzung): Dies ist ein GENERISCHER Generator,
 * KEINE Rechtsberatung. Das erzeugte Impressum ist das Impressum DES BETRIEBS –
 * der Betrieb ist fuer Richtigkeit und Vollstaendigkeit selbst verantwortlich.
 *
 * KEIN Schema-Change: der optionale Zusatzblock liegt (wie steuer/mahnwesen/…) im
 * verschluesselten JSON `tenant.settings.impressum`. Die Pflichtangaben selbst
 * stammen aus vorhandenen Feldern (tenant.name/anschrift/phone/email,
 * settings.steuer.*, settings.ustId) – hier wird NICHTS gedoppelt.
 *
 * Whitelist-Prinzip: `baueImpressum` gibt ausschliesslich die Angaben zurueck, die
 * nach § 5 DDG ohnehin VEROEFFENTLICHT werden muessen. Niemals Steuernummer, IBAN,
 * DATEV, interne IDs oder Kundendaten.
 */
import {
  RECHTSFORM_LABEL,
  REGISTER_RECHTSFORMEN,
  type Rechtsform,
} from './steuer';

/**
 * Optionaler Zusatzblock (settings.impressum). Nur SEKUNDAERE Angaben, die selten
 * gebraucht werden (Aufbereitung/Folierung/PPF sind i. d. R. nicht erlaubnis-/
 * kammerpflichtig). Die Pflichtangaben liegen in den bestehenden Feldern.
 */
export interface ImpressumConfig {
  /** Berufshaftpflichtversicherung inkl. raeuml. Geltungsbereich (§ 2 DL-InfoV). */
  berufshaftpflicht: string;
  /** Zustaendige Aufsichtsbehoerde (nur bei erlaubnispflichtigen Taetigkeiten). */
  aufsichtsbehoerde: string;
}

export const IMPRESSUM_DEFAULTS: ImpressumConfig = {
  berufshaftpflicht: '',
  aufsichtsbehoerde: '',
};

function toStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Liest den optionalen Zusatzblock DEFENSIV aus dem Rohwert (settings.impressum). */
export function resolveImpressum(raw: unknown): ImpressumConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    berufshaftpflicht: toStr(o.berufshaftpflicht, 300),
    aufsichtsbehoerde: toStr(o.aufsichtsbehoerde, 200),
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface ImpressumPatch {
  berufshaftpflicht?: string;
  aufsichtsbehoerde?: string;
}

/** Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration. */
export function mergeImpressum(base: ImpressumConfig, patch: ImpressumPatch): ImpressumConfig {
  const str = (v: unknown, prev: string, max: number): string =>
    typeof v === 'string' ? v.trim().slice(0, max) : prev;
  return {
    berufshaftpflicht: str(patch.berufshaftpflicht, base.berufshaftpflicht, 300),
    aufsichtsbehoerde: str(patch.aufsichtsbehoerde, base.aufsichtsbehoerde, 200),
  };
}

/**
 * Vollstaendige Datenquelle fuer Generator + Vollstaendigkeitspruefung. Wird aus
 * bestehenden Tenant-/Settings-Feldern zusammengesetzt (siehe public-booking.service).
 */
export interface ImpressumQuelle {
  firmenname: string; // tenant.name
  strasse: string; // tenant.street
  plz: string; // tenant.postalCode
  ort: string; // tenant.city
  land: string; // tenant.country ('DE' -> 'Deutschland')
  telefon: string; // tenant.phone
  email: string; // tenant.email
  rechtsform: Rechtsform; // settings.steuer.rechtsform
  vertretungsberechtigte: string; // settings.steuer.vertretungsberechtigte (Inhaber/GF/Gesellschafter)
  registergericht: string; // settings.steuer.registergericht
  registernummer: string; // settings.steuer.registernummer
  ustId: string; // settings.ustId  (NIE steuernummer!)
  berufshaftpflicht: string; // settings.impressum.berufshaftpflicht
  aufsichtsbehoerde: string; // settings.impressum.aufsichtsbehoerde
}

/** Feld-Schluessel der Pflichtangaben (fuer Vollstaendigkeits-Check + i18n-Labels). */
export type ImpressumFeld =
  | 'firmenname'
  | 'strasse'
  | 'plz'
  | 'ort'
  | 'telefon'
  | 'email'
  | 'vertretungsberechtigte'
  | 'registergericht'
  | 'registernummer';

/** Weiche Hinweise (kein Hard-Block der Vollstaendigkeit). */
export type ImpressumWarnung = 'ustId';

export interface ImpressumPruefung {
  vollstaendig: boolean;
  fehlend: ImpressumFeld[];
  warnungen: ImpressumWarnung[];
}

/**
 * Prueft die Impressums-Pflichtangaben je Rechtsform.
 * - ALLE: Firma, Anschrift (Strasse/PLZ/Ort), Telefon, E-Mail, vertretungsber. Person.
 *   (Telefon bewusst Pflicht: fehlende Telefonnummer ist ein klassischer Abmahngrund.)
 * - UG/GmbH/GmbH & Co. KG: zusaetzlich Registergericht + Registernummer (HRB).
 * - USt-IdNr. (§ 27a) ist bei Kapitalgesellschaften nur eine WARNUNG (eine frisch
 *   gegruendete UG hat evtl. noch keine) – niemals die Steuernummer verwenden.
 */
export function pruefeImpressum(q: ImpressumQuelle): ImpressumPruefung {
  const fehlend: ImpressumFeld[] = [];
  const leer = (v: string) => !v || !v.trim();

  if (leer(q.firmenname)) fehlend.push('firmenname');
  if (leer(q.strasse)) fehlend.push('strasse');
  if (leer(q.plz)) fehlend.push('plz');
  if (leer(q.ort)) fehlend.push('ort');
  if (leer(q.telefon)) fehlend.push('telefon');
  if (leer(q.email)) fehlend.push('email');
  if (leer(q.vertretungsberechtigte)) fehlend.push('vertretungsberechtigte');

  const istRegisterform = REGISTER_RECHTSFORMEN.includes(q.rechtsform);
  if (istRegisterform) {
    if (leer(q.registergericht)) fehlend.push('registergericht');
    if (leer(q.registernummer)) fehlend.push('registernummer');
  }

  const warnungen: ImpressumWarnung[] = [];
  if (istRegisterform && leer(q.ustId)) warnungen.push('ustId');

  return { vollstaendig: fehlend.length === 0, fehlend, warnungen };
}

/** Label der vertretungsberechtigten Person je Rechtsform (deutsch, Rechtsbegriff). */
function vertretungLabel(rechtsform: Rechtsform): string {
  if (rechtsform === 'gbr') return 'Gesellschafter';
  if (rechtsform === 'einzelunternehmen' || rechtsform === 'freiberufler') return 'Inhaber/in';
  return 'Vertretungsberechtigte(r)';
}

/** 'DE'/leer -> 'Deutschland'; sonst der eingetragene Wert (Impressum ist deutsch). */
function landLabel(land: string): string {
  const l = (land ?? '').trim();
  if (!l || l.toUpperCase() === 'DE') return 'Deutschland';
  return l;
}

/**
 * Strukturierte, PII-freie Impressum-Ausgabe fuer die oeffentliche Darstellung.
 * Leere Strings = Abschnitt entfaellt in der Anzeige. Enthaelt BEWUSST kein
 * `vollstaendig`-Flag und keine Fehlerliste – Endkunden bekommen nie Warnungen.
 */
export interface ImpressumAusgabe {
  firmenname: string;
  rechtsformLabel: string;
  anschrift: { strasse: string; plzOrt: string; land: string };
  vertretungLabel: string;
  vertretungsberechtigte: string;
  telefon: string;
  email: string;
  registergericht: string;
  registernummer: string;
  ustId: string;
  berufshaftpflicht: string;
  aufsichtsbehoerde: string;
}

/**
 * Baut die oeffentliche Impressum-Ausgabe (Whitelist). Best-effort: fehlende
 * Felder bleiben leer und werden in der Anzeige ausgelassen – der Impressum-Link
 * muss laut § 5 DDG immer erreichbar sein, auch bei (noch) unvollstaendigen Daten.
 */
export function baueImpressum(q: ImpressumQuelle): ImpressumAusgabe {
  const t = (v: string) => (v ?? '').trim();
  const plzOrt = [t(q.plz), t(q.ort)].filter(Boolean).join(' ');
  return {
    firmenname: t(q.firmenname),
    rechtsformLabel: RECHTSFORM_LABEL[q.rechtsform] ?? '',
    anschrift: { strasse: t(q.strasse), plzOrt, land: landLabel(q.land) },
    vertretungLabel: vertretungLabel(q.rechtsform),
    vertretungsberechtigte: t(q.vertretungsberechtigte),
    telefon: t(q.telefon),
    email: t(q.email),
    registergericht: t(q.registergericht),
    registernummer: t(q.registernummer),
    ustId: t(q.ustId),
    berufshaftpflicht: t(q.berufshaftpflicht),
    aufsichtsbehoerde: t(q.aufsichtsbehoerde),
  };
}
