'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, absoluteApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_KEY } from '@/lib/labels';
import { applyBranche, BETRIEBSTYP_META, BETRIEBSTYP_LABEL_KEY, type Betriebstyp } from '@/lib/branche';
import { INHABER_ROLLEN, LEITUNG_ROLLEN } from '@/lib/rollen';
import { useHasFeature, useEntitlements } from '@/lib/entitlements';
import { useT } from '@/lib/i18n';
import { PageHeader, Loading, ErrorBox, SectionCard, Row, ConfirmDialog, useToast } from '@/components/ui';
import { AuditLogPanel } from '@/components/AuditLogPanel';
import { MfaSection } from '@/components/MfaSection';
import type { BenachrichtigungenPrefs } from '@/lib/types';

// Ampel-Status eines Domain-Checks (spiegelt CheckStatus im Backend).
type CheckStatus = 'gruen' | 'gelb' | 'rot' | 'ungeprueft';
// Ein einzutragender DNS-Eintrag (SPF-Vorlage bzw. exakter DKIM-Eintrag).
interface DnsRecordSpec { type: string; host: string; value: string; }
interface DnsRecords { spf: DnsRecordSpec; dkim: DnsRecordSpec; }
interface DomainCheck { verifiziert: boolean; geprueftAm: string; spf: CheckStatus; dkim: CheckStatus; mx: CheckStatus; }
// Einzel-Check-Ergebnis der Live-Verifikation (Ampel + Klartext-Hinweis).
interface DomainCheckResult { status: CheckStatus; message: string; found?: string; }
interface VerifyResult {
  overall: CheckStatus;
  spf: DomainCheckResult; dkim: DomainCheckResult; mx: DomainCheckResult;
  geprueftAm: string; dnsRecords: DnsRecords;
}
// Betriebseigener Mail-Absender – Lese-Sicht (spiegelt MailConfigView im Backend).
// Enthaelt NIE das Passwort/den privaten DKIM-Schluessel: passSet zeigt nur, OB
// eines hinterlegt ist; dkim.publicKey ist unbedenklich (steht ohnehin im DNS).
interface MailConfigView {
  enabled: boolean; host: string; port: number; secure: boolean;
  user: string; fromEmail: string; fromName: string;
  passSet: boolean; passHint: string;
  domain: string;
  dkim: { selector: string; publicKey: string; configured: boolean };
  domainCheck: DomainCheck;
  dnsRecords: DnsRecords | null;
}
// Mahnwesen-Konfiguration (spiegelt MahnwesenConfig im Backend). Fristen als
// Tage nach Faelligkeit (ganzzahlig, streng aufsteigend), Gebuehren in EUR.
interface MahnwesenConfig {
  autoMahnen: boolean;
  fristen: { erinnerung: number; mahnung1: number; mahnung2: number };
  gebuehr: { mahnung1: number; mahnung2: number };
}
// Backend-Defaults gespiegelt (mail-config.ts / mahnwesen-config.ts), damit die
// Formulare auch dann sinnvoll vorbelegt sind, wenn das GET die Bloecke (noch)
// nicht liefert.
const MAIL_DEFAULTS: MailConfigView = {
  enabled: false, host: '', port: 587, secure: false,
  user: '', fromEmail: '', fromName: '', passSet: false, passHint: '',
  domain: '', dkim: { selector: '', publicKey: '', configured: false },
  domainCheck: { verifiziert: false, geprueftAm: '', spf: 'ungeprueft', dkim: 'ungeprueft', mx: 'ungeprueft' },
  dnsRecords: null,
};
// Ampel-Farben je Check-Status (Domain-Verifikation). Nutzt bestehende Tokens.
const AMPEL_CLASS: Record<CheckStatus, string> = {
  gruen: 'border-positive/30 bg-positive-soft text-positive',
  gelb: 'border-caution/30 bg-caution-soft text-caution',
  rot: 'border-danger/30 bg-danger-soft text-danger',
  ungeprueft: 'border-ink-600 bg-ink-800 text-chrome-400',
};
const MAHN_DEFAULTS: MahnwesenConfig = {
  autoMahnen: false,
  fristen: { erinnerung: 7, mahnung1: 14, mahnung2: 28 },
  gebuehr: { mahnung1: 0, mahnung2: 0 },
};
// EUR/qm-Basissaetze der 3D-Sofortkalkulation (Block `kalkulation`, top-level in
// GET/PATCH /tenants/me). Defaults spiegeln die Konstanten aus lib/flaechen-preise;
// das Backend liefert dieselben Startwerte.
interface KalkulationConfig { folierungProQm: number; ppfProQm: number; aufbereitungProQm: number; }
const KALK_DEFAULTS: KalkulationConfig = { folierungProQm: 60, ppfProQm: 130, aufbereitungProQm: 25 };

// Kalender & Online-Buchung (Kalender 2.0 W2): Arbeitszeiten je Wochentag
// (Block `kalender`) + Vorlauf des Buchungsportals (Block `buchung`). Erst das
// Speichern der Arbeitszeiten schaltet den Slot-Picker des Portals frei. Der
// Chef-Layer ergaenzt hier das Wochen-Umsatzziel (nur Anzeige/Editor; Anzeige
// der Zahlen selbst laeuft ueber GET /appointments/umsatz, Leitung + Feature).
type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
const WOCHENTAGE: Wochentag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
interface Arbeitszeit { von: string; bis: string; aktiv: boolean; }
interface KalenderSettings {
  arbeitszeiten: Record<Wochentag, Arbeitszeit>;
  slotDauerMin: number;
  pufferMin: number;
  /** Wochen-Umsatzziel des Chef-Layers (€ brutto); null/fehlt = kein Ziel. */
  umsatzZielWoche?: number | null;
}
type BuchungModus = 'anfrage' | 'verbindlich';
interface BuchungSettings { vorlaufMinStunden: number; vorlaufMaxTage: number; modus: BuchungModus; }
function defaultArbeitszeiten(): Record<Wochentag, Arbeitszeit> {
  const wt = (aktiv: boolean): Arbeitszeit => ({ von: '08:00', bis: '18:00', aktiv });
  return { mo: wt(true), di: wt(true), mi: wt(true), do: wt(true), fr: wt(true), sa: wt(false), so: wt(false) };
}
const KALENDER_DEFAULTS: KalenderSettings = { arbeitszeiten: defaultArbeitszeiten(), slotDauerMin: 30, pufferMin: 0 };
const BUCHUNG_DEFAULTS: BuchungSettings = { vorlaufMinStunden: 24, vorlaufMaxTage: 60, modus: 'anfrage' };

// Steuer-Einstellungen (Block `steuer`, §19 UStG). Spiegelt den Backend-
// SteuerConfig (common/steuer.ts). Defaults = Regelbesteuerung, 19 %.
interface SteuerConfig {
  kleinunternehmer: boolean;
  standardMwstSatz: number;
  kleinunternehmerHinweis: string;
  rechtsform: string;
  registergericht: string;
  registernummer: string;
  vertretungsberechtigte: string;
}
const KLEINUNTERNEHMER_HINWEIS_DEFAULT = 'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG.';
const STEUER_DEFAULTS: SteuerConfig = {
  kleinunternehmer: false,
  standardMwstSatz: 19,
  kleinunternehmerHinweis: KLEINUNTERNEHMER_HINWEIS_DEFAULT,
  rechtsform: 'einzelunternehmen',
  registergericht: '',
  registernummer: '',
  vertretungsberechtigte: '',
};
// Rechtsformen (Auswahl) + welche Handelsregister-Angaben verlangen.
const RECHTSFORMEN = [
  'einzelunternehmen', 'gbr', 'ug', 'gmbh', 'ohg', 'kg', 'gmbh_co_kg', 'freiberufler', 'sonstige',
] as const;
const REGISTER_RECHTSFORMEN = ['ug', 'gmbh', 'gmbh_co_kg'];

// Impressum-Zusatzblock (settings.impressum) – optionale Sekundaerangaben. Die
// Pflichtangaben stammen aus den bestehenden Feldern (Adresse/Kontakt/steuer/ustId).
interface ImpressumConfig { berufshaftpflicht: string; aufsichtsbehoerde: string; }
const IMPRESSUM_DEFAULTS: ImpressumConfig = { berufshaftpflicht: '', aufsichtsbehoerde: '' };

/** Pflichtangaben-Check je Rechtsform – spiegelt backend/common/impressum.pruefeImpressum. */
function pruefeImpressumFE(v: {
  firmenname: string; strasse: string; plz: string; ort: string;
  telefon: string; email: string; rechtsform: string;
  vertretungsberechtigte: string; registergericht: string; registernummer: string; ustId: string;
}): { fehlend: string[]; ustWarnung: boolean } {
  const leer = (s: string) => !s || !s.trim();
  const fehlend: string[] = [];
  if (leer(v.firmenname)) fehlend.push('firmenname');
  if (leer(v.strasse)) fehlend.push('strasse');
  if (leer(v.plz)) fehlend.push('plz');
  if (leer(v.ort)) fehlend.push('ort');
  if (leer(v.telefon)) fehlend.push('telefon');
  if (leer(v.email)) fehlend.push('email');
  if (leer(v.vertretungsberechtigte)) fehlend.push('vertretungsberechtigte');
  const reg = REGISTER_RECHTSFORMEN.includes(v.rechtsform);
  if (reg) {
    if (leer(v.registergericht)) fehlend.push('registergericht');
    if (leer(v.registernummer)) fehlend.push('registernummer');
  }
  return { fehlend, ustWarnung: reg && leer(v.ustId) };
}
/** 'DE'/leer -> 'Deutschland' (Impressum ist deutsch); sonst der eingetragene Wert. */
function landLabelFE(land: string): string {
  const l = (land ?? '').trim();
  return !l || l.toUpperCase() === 'DE' ? 'Deutschland' : l;
}
/** i18n-Key des Labels der vertretungsberechtigten Person je Rechtsform. */
function vertretungLabelKey(rechtsform: string): string {
  if (rechtsform === 'gbr') return 'settings.impressum.vertretung.gbr';
  if (rechtsform === 'einzelunternehmen' || rechtsform === 'freiberufler') return 'settings.impressum.vertretung.inhaber';
  return 'settings.impressum.vertretung.vertreter';
}

// Oeffentliches Mitglieds-Profil (Block `mitgliedProfil`, Opt-in Mitgliederliste).
// Spiegelt den Backend-MitgliedProfilConfig (common/mitglied-profil.ts).
interface MitgliedProfilConfig {
  zeigen: boolean;
  stadt: string;
  kurzbeschreibung: string;
  webseite: string;
}
const MITGLIED_DEFAULTS: MitgliedProfilConfig = { zeigen: false, stadt: '', kurzbeschreibung: '', webseite: '' };
const MITGLIED_WEBSEITE_RE = /^https?:\/\/\S+$/;
/** 1–2-Buchstaben-Monogramm aus dem Firmennamen (Vorschau, wie im Backend). */
function mitgliedInitiale(name: string): string {
  const w = (name ?? '').trim().split(/\s+/).filter((x) => /[A-Za-z0-9ÄÖÜäöü]/.test(x));
  if (!w.length) return '•';
  return w.slice(0, 2).map((x) => x[0].toUpperCase()).join('');
}

// Ziele & Erinnerungen (Block `ziele`, Welle 1). Spiegelt den Backend-ZieleConfig
// (common/ziele.ts). Reine In-App-Erinnerungen – kein Mail-Versand.
// `id`: stabile, inhaltsunabhaengige Kennung fuer die Nudge-/Snooze-Zuordnung.
interface SteuerTermin { id: string; art: string; datum: string; wiederkehrend: boolean; aktiv: boolean; }
/** Dependency-freie, stabile Kennung fuer einen neuen Steuer-Termin. */
function neueTerminId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* randomUUID nicht verfuegbar -> Fallback */ }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
interface ZieleConfig {
  auslastungAktiv: boolean;
  auslastungZielProzent: number;
  par19WarnungAktiv: boolean;
  steuerTermine: SteuerTermin[];
}
const ZIELE_DEFAULTS: ZieleConfig = {
  auslastungAktiv: false,
  auslastungZielProzent: 90,
  par19WarnungAktiv: false,
  steuerTermine: [],
};
const ZIELE_TERMINE_MAX = 12;
// Datum: wiederkehrend MM-TT (01..12 / 01..31) oder einmalig JJJJ-MM-TT.
const DATUM_REC_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATUM_ONCE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Kundenkommunikation (Blocks `kundenkommunikation` + `bewertung`). Spiegelt das
// Backend (common/kundenkommunikation.ts). Beides Opt-in (Default aus) – Review-
// before-send: automatische Kunden-Mails brauchen einen bewussten Schalter.
interface KundenkommunikationConfig { terminErinnerungAktiv: boolean; stundenVorlauf: number; }
const KK_DEFAULTS: KundenkommunikationConfig = { terminErinnerungAktiv: false, stundenVorlauf: 24 };
const KK_VORLAUF_MIN = 1;
const KK_VORLAUF_MAX = 168;

// Nachfass-Konfiguration (Block `nachfass`, Welle 2-B, Teil 1). Spiegelt
// backend/common/umsatz-erinnerungen.ts. Reine In-App-Vorschlagsliste – KEIN
// Auto-Versand an den Kunden.
interface NachfassConfig { tageOffen: number; }
const NACHFASS_DEFAULTS: NachfassConfig = { tageOffen: 7 };
const NACHFASS_TAGE_MIN = 1;
const NACHFASS_TAGE_MAX = 90;
interface BewertungConfig { aktiv: boolean; googleUrl: string; text: string; }
const BEW_DEFAULTS: BewertungConfig = { aktiv: false, googleUrl: '', text: '' };
const BEW_URL_RE = /^https:\/\/\S+$/;

// Editierbare Status-Mail-Vorlagen (Block `statusMailVorlagen`, Welle 3-A). Je
// kuratiertem Status Betreff + Text mit Platzhaltern. Leere Felder => heutiger
// Default-Text (Backend: resolveStatusMailVorlagen/orders.service). Spiegelt
// backend/common/status-mail-vorlagen.ts.
type StatusMailKey = 'bestaetigt' | 'in_arbeit' | 'abholbereit';
const STATUS_MAIL_KEYS: StatusMailKey[] = ['bestaetigt', 'in_arbeit', 'abholbereit'];
interface StatusMailVorlageForm { betreff: string; text: string; }
type StatusMailForm = Record<StatusMailKey, StatusMailVorlageForm>;
const STATUS_MAIL_FORM_LEER: StatusMailForm = {
  bestaetigt: { betreff: '', text: '' },
  in_arbeit: { betreff: '', text: '' },
  abholbereit: { betreff: '', text: '' },
};
const STATUS_MAIL_BETREFF_MAX = 200;
const STATUS_MAIL_TEXT_MAX = 2000;
// Verfuegbare Platzhalter (Anzeige als Hilfe; Ersetzung passiert serverseitig).
const STATUS_MAIL_PLATZHALTER = ['{auftragsnummer}', '{betrieb}', '{fahrzeug}', '{status}'];

// Stammdaten-Profil (flach) – passt zum Backend GET/PATCH /tenants/me.
interface TenantProfile {
  name: string; betriebstyp: Betriebstyp;
  // "Dein Look": selbst hinterlegtes Logo (data:-URL bzw. null) + eigene
  // Akzentfarbe (3-/6-stelliges Hex mit `#`; leer = Branchen-Standard). Das Logo
  // wird ueber POST/DELETE /tenants/me/logo gepflegt und NIE im PATCH mitgesendet
  // (aus payload destrukturiert); die Akzentfarbe faehrt im normalen PATCH-Flow mit.
  logoUrl: string | null;
  akzentfarbe: string;
  // Slug des eigenen Betriebs (read-only) – fuer die "Öffentliche Ansicht"-Links
  // (Impressum/Buchung). Wird NIE im PATCH mitgesendet (aus payload destrukturiert).
  slug?: string;
  email: string; phone: string; street: string; postalCode: string; city: string; country: string;
  steuernummer: string; ustId: string; iban: string; bic: string; bankname: string;
  datevBeraterNr: string; datevMandantNr: string; datevSkr: string;
  datevErloeskonto19: string; datevErloeskonto7: string; datevErloeskonto0: string; datevDebitorSammelkonto: string;
  rechnungZahlungszielTage: string; rechnungFusstext: string;
  // Zahlungslink + Kunden-Mails: Werte als String ('1'/'0'/'' – Settings-Muster
  // des Backends). Ältere Backends (ohne P3-2/P3-4) liefern die Felder noch
  // nicht: der { ...LEER, ...data }-Merge zeigt dann die Defaults an, und beim
  // Speichern werden NUR die Keys zurückgesendet, die das GET geliefert hat –
  // sonst lehnt forbidNonWhitelisted den ganzen PATCH mit 400 ab (siehe
  // NEUE_SETTINGS_KEYS in Betrieb()).
  rechnungPaymentLink: string;
  kundenmailStatus: string; kundenmailTerminbestaetigung: string;
  // 2FA-Pflicht fuer Betriebs-Rollen: '1' = an, '0' = aus (Owner-Policy).
  mfaPflicht: string;
  sevdeskConfigured: boolean; sevdeskTokenHint: string;
  // Mail-Versand (eigenes SMTP) + Mahnwesen: verschachtelte Objekte. Gleiche
  // Backward-Compat-Logik wie oben – nur mitschreiben, wenn das GET sie lieferte.
  mailConfig: MailConfigView;
  mahnwesen: MahnwesenConfig;
  // EUR/qm-Basissaetze der 3D-Sofortkalkulation. Gleiche Backward-Compat-Logik:
  // nur mitschreiben, wenn das GET den Block lieferte (hasKalkulation).
  kalkulation: KalkulationConfig;
  // Kalender & Online-Buchung (W2): Arbeitszeiten + Slot-Raster (kalender, inkl.
  // Wochen-Umsatzziel des Chef-Layers) und Portal-Vorlauf (buchung). Gleiche
  // Backward-Compat-Logik wie oben.
  kalender: KalenderSettings;
  buchung: BuchungSettings;
  // Steuer-Einstellungen (§19 UStG): nur mitschreiben, wenn das GET den Block
  // lieferte (hasSteuer). Sonst wuerde ein aelteres Backend den PATCH ablehnen.
  steuer: SteuerConfig;
  // Impressum-Zusatzblock (optional): Berufshaftpflicht + Aufsichtsbehoerde. Gleiche
  // Backward-Compat-Logik (hasImpressum) – nur mitschreiben, wenn das GET ihn lieferte.
  impressum: ImpressumConfig;
  // Oeffentliches Mitglieds-Profil (Opt-in Mitgliederliste): gleiche Backward-
  // Compat-Logik – nur mitschreiben, wenn das GET den Block lieferte (hasMitglied).
  mitgliedProfil: MitgliedProfilConfig;
  // Ziele & Erinnerungen (Welle 1): Auslastungsziel, §19-Warnungs-Schalter,
  // Steuer-Termine. Eigener Tab (Ziele); Betrieb-Tab fasst den Block nie an.
  ziele: ZieleConfig;
  // Kundenkommunikation (Feature 1/2): Termin-Erinnerung + Bewertungs-Bitte.
  // Eigener Tab (Kundenkommunikation); der Betrieb-Tab fasst diese Bloecke nie an.
  kundenkommunikation: KundenkommunikationConfig;
  bewertung: BewertungConfig;
  // Editierbare Status-Mail-Vorlagen (Welle 3-A): je Status Betreff + Text. Nur
  // mitschreiben, wenn das GET den Block lieferte (hasStatusMail, Backward-Compat).
  statusMailVorlagen: StatusMailForm;
  // Nachfass (Welle 2-B): Tage bis nachfassreif. Eigener Abschnitt im
  // Kundenkommunikation-Tab; nur mitschreiben, wenn das GET den Block lieferte.
  nachfass: NachfassConfig;
}
const LEER: TenantProfile = {
  name: '', betriebstyp: 'komplett',
  logoUrl: null, akzentfarbe: '',
  email: '', phone: '', street: '', postalCode: '', city: '', country: 'DE',
  steuernummer: '', ustId: '', iban: '', bic: '', bankname: '',
  datevBeraterNr: '', datevMandantNr: '', datevSkr: '03',
  datevErloeskonto19: '8400', datevErloeskonto7: '8300', datevErloeskonto0: '8195', datevDebitorSammelkonto: '1400',
  rechnungZahlungszielTage: '', rechnungFusstext: '',
  rechnungPaymentLink: '',
  kundenmailStatus: '1', kundenmailTerminbestaetigung: '1',
  mfaPflicht: '0',
  sevdeskConfigured: false, sevdeskTokenHint: '',
  mailConfig: MAIL_DEFAULTS,
  mahnwesen: MAHN_DEFAULTS,
  kalkulation: KALK_DEFAULTS,
  kalender: KALENDER_DEFAULTS,
  buchung: BUCHUNG_DEFAULTS,
  steuer: STEUER_DEFAULTS,
  impressum: IMPRESSUM_DEFAULTS,
  mitgliedProfil: MITGLIED_DEFAULTS,
  ziele: ZIELE_DEFAULTS,
  kundenkommunikation: KK_DEFAULTS,
  bewertung: BEW_DEFAULTS,
  statusMailVorlagen: STATUS_MAIL_FORM_LEER,
  nachfass: NACHFASS_DEFAULTS,
};

type Tab = 'darstellung' | 'profil' | 'betrieb' | 'kundenkommunikation' | 'ziele' | 'audit';

export default function EinstellungenPage() {
  const { user } = useAuth();
  const t = useT();
  const hasFeature = useHasFeature();
  const istInhaber = !!user && INHABER_ROLLEN.includes(user.role);
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);
  // Audit-Log-Tab: nur mit Tarif-Feature `audit` UND Leitungsrolle sichtbar –
  // spiegelt exakt die frühere Nav-Gating-Kombination (feature + LEITUNG_ROLLEN),
  // damit der Umzug keine Rechte verschiebt und kein toter 403-Tab entsteht.
  const zeigeAudit = istLeitung && hasFeature('audit');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'darstellung', label: t('settings.tab.appearance') },
    { key: 'profil', label: t('settings.tab.profile') },
    ...(istInhaber ? [{ key: 'betrieb' as Tab, label: t('settings.tab.business') }] : []),
    ...(istInhaber ? [{ key: 'kundenkommunikation' as Tab, label: t('settings.tab.customerComm') }] : []),
    ...(istInhaber ? [{ key: 'ziele' as Tab, label: t('settings.tab.goals') }] : []),
    ...(zeigeAudit ? [{ key: 'audit' as Tab, label: t('settings.tab.audit') }] : []),
  ];
  const [tab, setTab] = useState<Tab>('darstellung');

  // Query-Param-Initialisierung (z. B. Weiterleitung von /audit -> ?tab=audit).
  // Statisch-export-sicher: `window` erst nach dem Mount lesen, damit Prerender
  // und Hydration denselben Start-Tab zeigen (kein Mismatch). Der Ziel-Tab wird
  // angewandt, sobald er verfügbar ist – der Audit-Tab hängt an den Entitlements
  // und erscheint u. U. erst nach deren Laden. `urlAngewandt` verhindert, dass
  // eine spätere Verfügbarkeits-Änderung eine vom Nutzer getroffene Wahl kippt.
  const urlAngewandt = useRef(false);
  const tabKeys = tabs.map((tb) => tb.key).join(',');
  useEffect(() => {
    if (urlAngewandt.current) return;
    let gewuenscht: string | null = null;
    try { gewuenscht = new URLSearchParams(window.location.search).get('tab'); } catch { /* ignore */ }
    if (!gewuenscht) { urlAngewandt.current = true; return; }
    if (tabKeys.split(',').includes(gewuenscht)) {
      setTab(gewuenscht as Tab);
      urlAngewandt.current = true;
    }
  }, [tabKeys]);

  function waehleTab(key: Tab) {
    urlAngewandt.current = true; // Nutzer-Wahl hat Vorrang vor dem Query-Param
    setTab(key);
  }

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="seg-group mb-5">
        {tabs.map((tabItem) => (
          <button key={tabItem.key} onClick={() => waehleTab(tabItem.key)}
            className={`seg ${tab === tabItem.key ? 'seg-active' : ''}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'darstellung' && <Darstellung />}
      {tab === 'profil' && <Profil />}
      {tab === 'betrieb' && istInhaber && <Betrieb />}
      {tab === 'kundenkommunikation' && istInhaber && <Kundenkommunikation />}
      {tab === 'ziele' && istInhaber && <Ziele />}
      {tab === 'audit' && zeigeAudit && <AuditLogPanel />}

      {/* Additiver „Über/Version"-Fuß – Version zur Build-Zeit aus package.json. */}
      <div className="mt-10 border-t border-ink-700/50 pt-4 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-chrome-500">
          {t('settings.about.title')}
        </p>
        <p className="mt-1 text-sm text-chrome-400">
          Detailly · {t('settings.about.version', { v: process.env.NEXT_PUBLIC_APP_VERSION ?? '' })}
        </p>
        <Link href="/changelog" className="link-action mt-2 inline-block text-sm">
          {t('settings.about.changelog')} →
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
function Darstellung() {
  const t = useT();
  const [reduce, setReduce] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    try {
      setReduce(localStorage.getItem('detailly_reduce_motion') === '1');
      setTheme(localStorage.getItem('detailly_theme') === 'light' ? 'light' : 'dark');
    } catch { /* ignore */ }
  }, []);
  function toggle(v: boolean) {
    setReduce(v);
    try { localStorage.setItem('detailly_reduce_motion', v ? '1' : '0'); } catch { /* ignore */ }
    document.documentElement.classList.toggle('dl-reduce-motion', v);
  }
  function chooseTheme(mode: 'dark' | 'light') {
    setTheme(mode);
    try { localStorage.setItem('detailly_theme', mode); } catch { /* ignore */ }
    const d = document.documentElement;
    if (mode === 'light') d.setAttribute('data-theme', 'light');
    else d.removeAttribute('data-theme');
  }
  const themeBtn = (mode: 'dark' | 'light', label: string) => (
    <button
      onClick={() => chooseTheme(mode)}
      className={`choice px-4 py-2 text-sm font-medium ${theme === mode ? 'choice-active' : ''}`}
    >
      {label}
    </button>
  );
  return (
    <div className="max-w-2xl space-y-5">
      <SectionCard title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
        <label className="label mb-1.5 block">{t('settings.appearance.colorScheme')}</label>
        <div className="flex gap-2">
          {themeBtn('dark', t('settings.appearance.dark'))}
          {themeBtn('light', t('settings.appearance.light'))}
        </div>
        <p className="help mt-2">{t('settings.appearance.deviceOnly')}</p>
      </SectionCard>

      <SectionCard title={t('settings.motion.title')} subtitle={t('settings.motion.subtitle')}>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm text-chrome-200">{t('settings.motion.reduce')}</span>
          <input type="checkbox" className="h-5 w-5 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40" checked={reduce} onChange={(e) => toggle(e.target.checked)} />
        </label>
        <p className="help mt-2">{t('settings.motion.deviceOnly')}</p>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Profil() {
  const { user, refresh } = useAuth();
  const t = useT();
  const toast = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setPhone(user?.phone ?? '');
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.patch('/auth/me', { firstName, lastName, phone });
      await refresh(); // Topbar/Anzeigen sofort aktualisieren
      toast(t('settings.toast.saved'));
    } catch (err) { setError(err instanceof Error ? err.message : t('settings.error.saveFailed')); }
    finally { setSaving(false); }
  }

  async function changePw() {
    if (!user?.email) return;
    setBusy(true);
    try { await api.post('/auth/password-reset/request', { email: user.email }); } catch { /* immer 204 / keine Enumeration */ }
    setSent(true);
    setBusy(false);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <SectionCard title={t('settings.profile.title')} subtitle={t('settings.profile.subtitle')}>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ErrorBox message={error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label className="label" htmlFor="profilVorname">{t('settings.profile.firstName')}</label><input id="profilVorname" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
            <div className="field"><label className="label" htmlFor="profilNachname">{t('settings.profile.lastName')}</label><input id="profilNachname" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
            <div className="field sm:col-span-2"><label className="label" htmlFor="profilTelefon">{t('settings.profile.phone')}</label><input id="profilTelefon" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (<><span className="spinner" />{t('settings.saving')}</>) : t('common.save')}
            </button>
          </div>
        </form>
        <div className="mt-5 border-t border-ink-700/50 pt-2">
          <Row label={t('settings.profile.email')} value={user?.email ?? '–'} />
          <Row label={t('settings.profile.role')} value={user ? t(ROLE_KEY[user.role] ?? user.role) : '–'} />
        </div>
        <p className="help mt-2">{t('settings.profile.emailRoleHint')}</p>
      </SectionCard>

      <SectionCard title={t('settings.password.title')} subtitle={t('settings.password.subtitle')}>
        {sent ? (
          <div className="flex items-center gap-2 rounded-xl border border-positive/30 bg-positive-soft px-3 py-2.5 text-sm text-positive">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {t('settings.password.sent')}
          </div>
        ) : (
          <button className="btn-ghost" onClick={changePw} disabled={busy}>{busy ? t('settings.password.sending') : t('settings.password.change')}</button>
        )}
      </SectionCard>

      <MfaSection />

      <BenachrichtigungenSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Benachrichtigungs-Praeferenzen je Nutzer (Welle 3-A, alle Rollen). Steuert,
// welche Glocken-Hinweise der Nutzer sehen will. Default = alles an (kein
// Verhaltensbruch). Owner-Nudges (Ziele/§19/Auslastung) nur fuer Inhaber sichtbar.
const BENACHRICHTIGUNGEN_LEER: BenachrichtigungenPrefs = {
  rechnungenFaellig: true,
  termineHeute: true,
  materialKnapp: true,
  angeboteAngenommen: true,
  angebotNachfassen: true,
  nachsorgeFaellig: true,
  steuerTermine: true,
  auslastung: true,
  par19: true,
};
const BENACHRICHTIGUNG_CATS: { key: keyof BenachrichtigungenPrefs; ownerOnly?: boolean }[] = [
  { key: 'rechnungenFaellig' },
  { key: 'termineHeute' },
  { key: 'materialKnapp' },
  { key: 'angeboteAngenommen' },
  // Welle 2-B: Umsatz-Erinnerungen. Server-seitig rollen-gegated (Verkauf/Leitung);
  // hier fuer alle sichtbar wie 'angeboteAngenommen' (Techniker erhalten den
  // Hinweis ohnehin nie).
  { key: 'angebotNachfassen' },
  { key: 'nachsorgeFaellig' },
  { key: 'steuerTermine', ownerOnly: true },
  { key: 'auslastung', ownerOnly: true },
  { key: 'par19', ownerOnly: true },
];

function BenachrichtigungenSection() {
  const { user, refresh } = useAuth();
  const t = useT();
  const toast = useToast();
  const istInhaber = !!user && INHABER_ROLLEN.includes(user.role);
  const [prefs, setPrefs] = useState<BenachrichtigungenPrefs>(BENACHRICHTIGUNGEN_LEER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Aus /auth/me (useAuth) uebernehmen; fehlender Block -> Default (alles an).
  useEffect(() => {
    if (user?.benachrichtigungen) setPrefs({ ...BENACHRICHTIGUNGEN_LEER, ...user.benachrichtigungen });
  }, [user]);

  const toggle = (k: keyof BenachrichtigungenPrefs, v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.patch('/auth/me/benachrichtigungen', prefs);
      await refresh(); // Glocke sofort aktualisieren
      toast(t('settings.toast.saved'));
    } catch (err) { setError(err instanceof Error ? err.message : t('settings.error.saveFailed')); }
    finally { setSaving(false); }
  }

  const cats = BENACHRICHTIGUNG_CATS.filter((c) => istInhaber || !c.ownerOnly);

  return (
    <SectionCard title={t('settings.benachrichtigungen.title')} subtitle={t('settings.benachrichtigungen.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <p className="help">{t('settings.benachrichtigungen.intro')}</p>
        <div className="space-y-3">
          {cats.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm text-chrome-200">{t(`settings.benachrichtigungen.${c.key}`)}</span>
                <span className="mt-0.5 block text-xs text-chrome-500">{t(`settings.benachrichtigungen.${c.key}Hint`)}</span>
              </span>
              <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                checked={prefs[c.key]} onChange={(e) => toggle(c.key, e.target.checked)} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (<><span className="spinner" />{t('settings.saving')}</>) : t('common.save')}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
function KalenderAbo() {
  const t = useT();
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    api.get<{ token: string; path: string }>('/calendar')
      .then((r) => setPath(r.path)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  const httpsUrl = path ? absoluteApiUrl(path) : '';
  const webcalUrl = httpsUrl.replace(/^https?:/i, 'webcal:');

  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  }
  async function regenerate() {
    setBusy(true);
    try { const r = await api.post<{ token: string; path: string }>('/calendar/regenerate'); setPath(r.path); }
    catch { /* ignore */ }
    finally { setBusy(false); setConfirmRegen(false); }
  }

  const UrlRow = ({ label, url, k }: { label: string; url: string; k: string }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="input flex-1 font-mono text-xs" />
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => copy(url, k)}>{copied === k ? t('settings.calendar.copied') : t('settings.calendar.copy')}</button>
      </div>
    </div>
  );

  return (
    <SectionCard title={t('settings.calendar.title')} subtitle={t('settings.calendar.subtitle')}>
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <UrlRow label={t('settings.calendar.appleLabel')} url={webcalUrl} k="apple" />
          <UrlRow label={t('settings.calendar.googleLabel')} url={httpsUrl} k="google" />
          <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-3 text-xs leading-relaxed text-chrome-400">
            <p><span className="font-semibold text-chrome-200">{t('settings.calendar.appleName')}</span>{t('settings.calendar.appleHelp')}</p>
            <p className="mt-1"><span className="font-semibold text-chrome-200">{t('settings.calendar.googleName')}</span>{t('settings.calendar.googleHelp')}</p>
            <p className="mt-2 text-chrome-500">{t('settings.calendar.secretHint')}</p>
          </div>
          <button type="button" className="link-danger text-sm disabled:opacity-50" onClick={() => setConfirmRegen(true)} disabled={busy}>
            {busy ? t('settings.calendar.regenerating') : t('settings.calendar.regenerate')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRegen}
        title={t('settings.calendar.confirmTitle')}
        message={t('settings.calendar.confirmMsg')}
        confirmLabel={t('settings.calendar.confirmLabel')}
        variant="neutral"
        busy={busy}
        onConfirm={regenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Neue Settings-Keys (P3-2/P3-4): nur mitsenden, wenn das Backend sie im GET
// geliefert hat. Ein aelteres Backend wuerde unbekannte Keys sonst per
// forbidNonWhitelisted mit 400 ablehnen – und damit auch Name/Adresse blocken.
// Kunden-Mail-Schalter (kundenmailStatus/kundenmailTerminbestaetigung) sind aus dem
// Betrieb-Tab in den eigenen Tab „Kundenkommunikation" umgezogen -> hier nicht mehr gelistet.
const NEUE_SETTINGS_KEYS = ['rechnungPaymentLink', 'mfaPflicht', 'akzentfarbe'] as const;

// Unterbereiche des Betrieb-Tabs (Welle 3-A): der frühere Mega-Tab ist in klar
// getrennte Bereiche mit je EIGENEM Speichern-Button gegliedert. Sekundär-
// Navigation als Sprungmarken; jeder Bereich sendet nur seine eigenen Felder.
type Bereich =
  | 'stammdaten'
  | 'steuer'
  | 'rechnung'
  | 'kalender'
  | 'email'
  | 'mahnwesen'
  | 'buchhaltung'
  | 'sicherheit';
const BEREICHE: { key: Bereich; labelKey: string }[] = [
  { key: 'stammdaten', labelKey: 'settings.bereich.stammdaten' },
  { key: 'steuer', labelKey: 'settings.bereich.steuer' },
  { key: 'rechnung', labelKey: 'settings.bereich.rechnung' },
  { key: 'kalender', labelKey: 'settings.bereich.kalender' },
  { key: 'email', labelKey: 'settings.bereich.email' },
  { key: 'mahnwesen', labelKey: 'settings.bereich.mahnwesen' },
  { key: 'buchhaltung', labelKey: 'settings.bereich.buchhaltung' },
  { key: 'sicherheit', labelKey: 'settings.bereich.sicherheit' },
];

// "Dein Look": erlaubte Hex-Akzentfarbe (3-/6-stellig, fuehrendes `#` optional) –
// spiegelt die Backend-DTO-Regel. Leer = Branchen-Standard.
const AKZENT_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// Logo-Upload: erlaubte Raster-Typen + Groessenlimit (spiegelt das Backend).
const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 512 * 1024;
/** Normalisiert eine Hex-Eingabe auf `#rrggbb` (3-stellig expandiert); '' wenn ungueltig. */
function normHex(v: string): string {
  const s = (v ?? '').trim().replace(/^#/, '');
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return '';
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return `#${full.toLowerCase()}`;
}

// Editierbare Form der Mail-/Mahn-Bloecke: Zahlen als String, damit Felder waehrend
// der Eingabe leerbar bleiben (Parsing/Validierung erst beim Speichern).
interface MailForm { enabled: boolean; host: string; port: string; secure: boolean; user: string; fromEmail: string; fromName: string; domain: string; }
interface MahnForm { autoMahnen: boolean; erinnerung: string; mahnung1: string; mahnung2: string; gebuehr1: string; gebuehr2: string; }
// EUR/qm-Saetze als String, damit Felder waehrend der Eingabe leerbar bleiben.
interface KalkForm { folierung: string; ppf: string; aufbereitung: string; }
const MAIL_FORM_LEER: MailForm = { enabled: false, host: '', port: '587', secure: false, user: '', fromEmail: '', fromName: '', domain: '' };
const MAHN_FORM_LEER: MahnForm = { autoMahnen: false, erinnerung: '7', mahnung1: '14', mahnung2: '28', gebuehr1: '0', gebuehr2: '0' };
const KALK_FORM_LEER: KalkForm = { folierung: '60', ppf: '130', aufbereitung: '25' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toIntOr = (s: string, def: number) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : def; };
const toEuro = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0; };

// Ein kopierbares DNS-Feld (Host bzw. Wert) mit „Kopieren"-Button. `active` zeigt
// kurz die „Kopiert"-Bestaetigung. Monospace + break-all, weil DKIM-Werte lang sind.
function CopyField({ label, value, active, onCopy, copyLabel, copiedLabel }: {
  label: string; value: string; active: boolean; onCopy: () => void; copyLabel: string; copiedLabel: string;
}) {
  return (
    <div className="mt-1.5">
      <div className="text-[11px] uppercase tracking-wide text-chrome-500">{label}</div>
      <div className="mt-0.5 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-ink-900/60 px-2 py-1 font-mono text-[11px] text-chrome-200">{value}</code>
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={onCopy}>{active ? copiedLabel : copyLabel}</button>
      </div>
    </div>
  );
}

function Betrieb() {
  const toast = useToast();
  const [form, setForm] = useState<TenantProfile>(LEER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; companyName?: string } | null>(null);
  // Welche der neuen Keys das Backend kennt (siehe NEUE_SETTINGS_KEYS).
  const [bekannteKeys, setBekannteKeys] = useState<string[]>([]);
  // "Dein Look" – Logo: laufender Upload + eigener Fehlerzustand + Entfernen-Dialog.
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Mail-Versand (eigenes SMTP): editierbare Form + write-only-Passwort separat.
  const [mailForm, setMailForm] = useState<MailForm>(MAIL_FORM_LEER);
  const [mailPass, setMailPass] = useState('');
  const [mailPassSet, setMailPassSet] = useState(false);
  const [hasMailConfig, setHasMailConfig] = useState(true);
  const [confirmTestMail, setConfirmTestMail] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [mailTestResult, setMailTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  // Domain-Verifikation (SPF/DKIM/MX): laufender Check + Live-Ergebnis.
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showDnsRecords, setShowDnsRecords] = useState(false);
  // „Kopiert"-Bestaetigung fuer die DNS-Eintraege (kurz sichtbar, dann leer).
  const [copied, setCopied] = useState('');
  // Mahnwesen: editierbare Form (Zahlen als String) + Backend-Kenntnis.
  const [mahnForm, setMahnForm] = useState<MahnForm>(MAHN_FORM_LEER);
  const [hasMahnwesen, setHasMahnwesen] = useState(true);
  // Kalkulation (EUR/qm): editierbare Form + Backend-Kenntnis (Backward-Compat).
  const [kalkForm, setKalkForm] = useState<KalkForm>(KALK_FORM_LEER);
  const [hasKalkulation, setHasKalkulation] = useState(true);
  // Kalender & Online-Buchung (W2): Arbeitszeiten je Wochentag + Slot-Raster +
  // Portal-Vorlauf (Zahlen als String, Settings-Formular-Muster).
  const [azForm, setAzForm] = useState<Record<Wochentag, Arbeitszeit>>(defaultArbeitszeiten());
  const [slotDauerForm, setSlotDauerForm] = useState('30');
  const [pufferForm, setPufferForm] = useState('0');
  const [vorlaufMinForm, setVorlaufMinForm] = useState('24');
  const [vorlaufMaxForm, setVorlaufMaxForm] = useState('60');
  // Rechtlicher Abschluss-Modus der Buchungsseite (§312j): anfrage | verbindlich.
  const [buchungModus, setBuchungModus] = useState<BuchungModus>('anfrage');
  // Wochen-Umsatzziel (Kalender-Chef-Layer): als String, damit das Feld waehrend
  // der Eingabe leerbar bleibt; leer = kein Ziel (null im PATCH).
  const [umsatzZiel, setUmsatzZiel] = useState('');
  const [hasKalender, setHasKalender] = useState(true);
  const [hasBuchung, setHasBuchung] = useState(true);
  // Steuer (§19 UStG): editierbare Form + Backend-Kenntnis (Backward-Compat).
  const [steuerForm, setSteuerForm] = useState<SteuerConfig>(STEUER_DEFAULTS);
  const [hasSteuer, setHasSteuer] = useState(true);
  // Impressum-Zusatzblock (optional): editierbare Form + Backend-Kenntnis.
  const [impressumForm, setImpressumForm] = useState<ImpressumConfig>(IMPRESSUM_DEFAULTS);
  const [hasImpressum, setHasImpressum] = useState(true);
  // Mitglieds-Profil (Opt-in): editierbare Form + Backend-Kenntnis (Backward-Compat).
  const [mitgliedForm, setMitgliedForm] = useState<MitgliedProfilConfig>(MITGLIED_DEFAULTS);
  const [hasMitglied, setHasMitglied] = useState(true);
  // Status-Mail-Vorlagen (Welle 3-A): editierbare Form je Status + Backend-Kenntnis.
  const [statusMailForm, setStatusMailForm] = useState<StatusMailForm>(STATUS_MAIL_FORM_LEER);
  const [hasStatusMail, setHasStatusMail] = useState(true);
  // Sekundaer-Navigation innerhalb des Betrieb-Tabs: jeder Unterbereich hat einen
  // EIGENEN Speichern-Button (sendet nur seine Felder). `savingBereich` markiert,
  // welcher Bereich gerade speichert (nur dessen Button zeigt den Spinner).
  const [bereich, setBereich] = useState<Bereich>('stammdaten');
  const [savingBereich, setSavingBereich] = useState<Bereich | null>(null);
  const t = useT();
  // sevDesk ist an das Feature `export` (Basic+Pro) gekoppelt. Solange die
  // Entitlements nicht `ready` sind, optimistisch anzeigen (sichere Degradation
  // = Vollzugriff) – so sieht ein zahlender Betrieb nie kurz den Upgrade-Hinweis.
  const hasFeature = useHasFeature();
  const { ready: entitlementsReady } = useEntitlements();
  const sevdeskAllowed = !entitlementsReady || hasFeature('export');

  // Uebernimmt eine Profil-Antwort in alle Form-Slices (Laden + nach dem Speichern).
  const apply = useCallback((data: TenantProfile) => {
    setForm({ ...LEER, ...data });
    setBekannteKeys(NEUE_SETTINGS_KEYS.filter((k) => data[k] !== undefined));
    setHasMailConfig(data.mailConfig !== undefined);
    const mc = data.mailConfig ?? MAIL_DEFAULTS;
    setMailForm({
      enabled: mc.enabled, host: mc.host, port: String(mc.port ?? 587), secure: mc.secure,
      user: mc.user, fromEmail: mc.fromEmail, fromName: mc.fromName, domain: mc.domain ?? '',
    });
    setMailPassSet(mc.passSet ?? false);
    setMailPass('');
    setMailTestResult(null);
    // Persistierten Verifikations-Stand nicht als Live-Ergebnis zeigen (der Live-
    // Block erscheint erst nach einem frischen „Domain verifizieren"-Klick).
    setVerifyResult(null);
    setHasMahnwesen(data.mahnwesen !== undefined);
    const mw = data.mahnwesen ?? MAHN_DEFAULTS;
    setMahnForm({
      autoMahnen: mw.autoMahnen,
      erinnerung: String(mw.fristen.erinnerung), mahnung1: String(mw.fristen.mahnung1), mahnung2: String(mw.fristen.mahnung2),
      gebuehr1: String(mw.gebuehr.mahnung1), gebuehr2: String(mw.gebuehr.mahnung2),
    });
    setHasKalkulation(data.kalkulation !== undefined);
    const kk = data.kalkulation ?? KALK_DEFAULTS;
    setKalkForm({
      folierung: String(kk.folierungProQm ?? KALK_DEFAULTS.folierungProQm),
      ppf: String(kk.ppfProQm ?? KALK_DEFAULTS.ppfProQm),
      aufbereitung: String(kk.aufbereitungProQm ?? KALK_DEFAULTS.aufbereitungProQm),
    });
    setHasKalender(data.kalender !== undefined);
    const kal = data.kalender ?? KALENDER_DEFAULTS;
    setAzForm({ ...defaultArbeitszeiten(), ...(kal.arbeitszeiten ?? {}) });
    setSlotDauerForm(String(kal.slotDauerMin ?? KALENDER_DEFAULTS.slotDauerMin));
    setPufferForm(String(kal.pufferMin ?? KALENDER_DEFAULTS.pufferMin));
    const ziel = Number(kal.umsatzZielWoche ?? 0);
    setUmsatzZiel(Number.isFinite(ziel) && ziel > 0 ? String(ziel) : '');
    setHasBuchung(data.buchung !== undefined);
    const bu = data.buchung ?? BUCHUNG_DEFAULTS;
    setVorlaufMinForm(String(bu.vorlaufMinStunden ?? BUCHUNG_DEFAULTS.vorlaufMinStunden));
    setVorlaufMaxForm(String(bu.vorlaufMaxTage ?? BUCHUNG_DEFAULTS.vorlaufMaxTage));
    setBuchungModus(bu.modus === 'verbindlich' ? 'verbindlich' : 'anfrage');
    setHasSteuer(data.steuer !== undefined);
    const st = data.steuer ?? STEUER_DEFAULTS;
    setSteuerForm({
      kleinunternehmer: st.kleinunternehmer ?? false,
      standardMwstSatz: Number(st.standardMwstSatz) === 0 ? 0 : 19,
      kleinunternehmerHinweis: st.kleinunternehmerHinweis || KLEINUNTERNEHMER_HINWEIS_DEFAULT,
      rechtsform: st.rechtsform || 'einzelunternehmen',
      registergericht: st.registergericht ?? '',
      registernummer: st.registernummer ?? '',
      vertretungsberechtigte: st.vertretungsberechtigte ?? '',
    });
    setHasImpressum(data.impressum !== undefined);
    const im = data.impressum ?? IMPRESSUM_DEFAULTS;
    setImpressumForm({
      berufshaftpflicht: im.berufshaftpflicht ?? '',
      aufsichtsbehoerde: im.aufsichtsbehoerde ?? '',
    });
    setHasMitglied(data.mitgliedProfil !== undefined);
    const mp = data.mitgliedProfil ?? MITGLIED_DEFAULTS;
    setMitgliedForm({
      zeigen: mp.zeigen ?? false,
      stadt: mp.stadt ?? '',
      kurzbeschreibung: mp.kurzbeschreibung ?? '',
      webseite: mp.webseite ?? '',
    });
    setHasStatusMail(data.statusMailVorlagen !== undefined);
    const sm = data.statusMailVorlagen ?? STATUS_MAIL_FORM_LEER;
    setStatusMailForm({
      bestaetigt: { betreff: sm.bestaetigt?.betreff ?? '', text: sm.bestaetigt?.text ?? '' },
      in_arbeit: { betreff: sm.in_arbeit?.betreff ?? '', text: sm.in_arbeit?.text ?? '' },
      abholbereit: { betreff: sm.abholbereit?.betreff ?? '', text: sm.abholbereit?.text ?? '' },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TenantProfile>('/tenants/me');
      apply(data);
      setError('');
    }
    catch (e) { setError(e instanceof Error ? e.message : t('settings.error.loadFailed')); }
    finally { setLoading(false); }
  }, [apply, t]);
  useEffect(() => { load(); }, [load]);

  function set<K extends keyof TenantProfile>(key: K, value: string) { setForm((f) => ({ ...f, [key]: value })); }

  // Generischer Speichern-Kern eines Unterbereichs: PATCH nur mit den Feldern des
  // Bereichs (das Backend ist ein Teil-Update). Der animierte Zustand haengt an
  // `savingBereich`, sodass nur der Button des aktiven Bereichs den Spinner zeigt.
  async function persist(
    key: Bereich,
    payload: Record<string, unknown>,
    opts?: { afterApply?: (d: TenantProfile) => void; resetToken?: boolean },
  ) {
    setSavingBereich(key);
    setError('');
    try {
      const data = await api.patch<TenantProfile>('/tenants/me', payload);
      apply(data);
      if (opts?.resetToken) { setTokenInput(''); setTestResult(null); }
      toast(t('settings.toast.saved'));
      opts?.afterApply?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.error.saveFailed'));
    } finally {
      setSavingBereich(null);
    }
  }

  // --- Stammdaten, Marke & Adresse (Branche, Branding, Mitglied, Adresse) ----
  // Das Logo selbst laeuft ueber eigene POST/DELETE-Buttons (nicht im PATCH).
  async function saveStammdaten(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (hasMitglied && mitgliedForm.webseite.trim() && !MITGLIED_WEBSEITE_RE.test(mitgliedForm.webseite.trim())) {
      setError(t('settings.error.mitgliedWebseite')); return;
    }
    // Akzentfarbe spiegeln: leer = Branchen-Standard; sonst 3-/6-stelliges Hex.
    if (bekannteKeys.includes('akzentfarbe') && form.akzentfarbe.trim() && !AKZENT_RE.test(form.akzentfarbe.trim())) {
      setError(t('settings.branding.accentInvalid')); return;
    }
    const payload: Record<string, unknown> = {
      name: form.name, betriebstyp: form.betriebstyp,
      email: form.email, phone: form.phone,
      street: form.street, postalCode: form.postalCode, city: form.city, country: form.country,
    };
    if (bekannteKeys.includes('akzentfarbe')) payload.akzentfarbe = form.akzentfarbe;
    if (hasMitglied) {
      payload.mitgliedProfil = {
        zeigen: mitgliedForm.zeigen,
        stadt: mitgliedForm.stadt.trim(),
        kurzbeschreibung: mitgliedForm.kurzbeschreibung.trim(),
        webseite: mitgliedForm.webseite.trim(),
      };
    }
    await persist('stammdaten', payload, { afterApply: (d) => applyBranche(d.betriebstyp) });
  }

  // --- Steuer & Impressum ----------------------------------------------------
  async function saveSteuer(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const payload: Record<string, unknown> = { steuernummer: form.steuernummer, ustId: form.ustId };
    if (hasSteuer) {
      payload.steuer = {
        kleinunternehmer: steuerForm.kleinunternehmer,
        standardMwstSatz: steuerForm.standardMwstSatz,
        kleinunternehmerHinweis: steuerForm.kleinunternehmerHinweis.trim(),
        rechtsform: steuerForm.rechtsform,
        registergericht: steuerForm.registergericht.trim(),
        registernummer: steuerForm.registernummer.trim(),
        vertretungsberechtigte: steuerForm.vertretungsberechtigte.trim(),
      };
    }
    if (hasImpressum) {
      payload.impressum = {
        berufshaftpflicht: impressumForm.berufshaftpflicht.trim(),
        aufsichtsbehoerde: impressumForm.aufsichtsbehoerde.trim(),
      };
    }
    await persist('steuer', payload);
  }

  // --- Bank & Rechnung -------------------------------------------------------
  async function saveRechnung(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const payload: Record<string, unknown> = {
      bankname: form.bankname, iban: form.iban, bic: form.bic,
      rechnungZahlungszielTage: form.rechnungZahlungszielTage,
      rechnungFusstext: form.rechnungFusstext,
    };
    if (bekannteKeys.includes('rechnungPaymentLink')) payload.rechnungPaymentLink = form.rechnungPaymentLink;
    await persist('rechnung', payload);
  }

  // --- Kalkulation & Kalender ------------------------------------------------
  async function saveKalender(e: React.FormEvent) {
    e.preventDefault(); setError('');
    // Kalender & Online-Buchung spiegeln (Backend: HH:MM + geklammerte Bereiche).
    if (hasKalender) {
      for (const tag of WOCHENTAGE) {
        const az = azForm[tag];
        if (az.aktiv && (!az.von || !az.bis || az.bis <= az.von)) {
          setError(t('settings.error.kalenderZeiten')); return;
        }
      }
      const sd = toIntOr(slotDauerForm, NaN);
      const pf = toIntOr(pufferForm, NaN);
      if (!Number.isInteger(sd) || sd < 5 || sd > 480 || !Number.isInteger(pf) || pf < 0 || pf > 240) {
        setError(t('settings.error.kalenderWerte')); return;
      }
    }
    if (hasBuchung) {
      const vMin = toIntOr(vorlaufMinForm, NaN);
      const vMax = toIntOr(vorlaufMaxForm, NaN);
      if (!Number.isInteger(vMin) || vMin < 0 || vMin > 720 || !Number.isInteger(vMax) || vMax < 1 || vMax > 365) {
        setError(t('settings.error.kalenderWerte')); return;
      }
    }
    const payload: Record<string, unknown> = {};
    if (hasKalkulation) {
      payload.kalkulation = {
        folierungProQm: toEuro(kalkForm.folierung),
        ppfProQm: toEuro(kalkForm.ppf),
        aufbereitungProQm: toEuro(kalkForm.aufbereitung),
      };
    }
    // konfliktverhalten/standortKonflikt bleiben unangetastet (Teil-Update).
    if (hasKalender) {
      const ziel = umsatzZiel.trim() ? toEuro(umsatzZiel) : 0;
      payload.kalender = {
        arbeitszeiten: azForm,
        slotDauerMin: toIntOr(slotDauerForm, 30),
        pufferMin: toIntOr(pufferForm, 0),
        umsatzZielWoche: ziel > 0 ? ziel : null,
      };
    }
    if (hasBuchung) {
      payload.buchung = {
        vorlaufMinStunden: toIntOr(vorlaufMinForm, 24),
        vorlaufMaxTage: toIntOr(vorlaufMaxForm, 60),
        modus: buchungModus,
      };
    }
    await persist('kalender', payload);
  }

  // --- E-Mail-Versand (SMTP/DNS) + Status-Mail-Vorlagen ----------------------
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setError('');
    // Mail-Versand spiegeln: nur bei aktivem eigenem Versand sind Host/Port/From Pflicht.
    if (hasMailConfig && mailForm.enabled) {
      const port = toIntOr(mailForm.port, NaN);
      if (!mailForm.host.trim()) { setError(t('settings.error.mailHostRequired')); return; }
      if (!Number.isInteger(port) || port < 1 || port > 65535) { setError(t('settings.error.mailPortRange')); return; }
      if (!EMAIL_RE.test(mailForm.fromEmail.trim())) { setError(t('settings.error.mailFromInvalid')); return; }
      const domain = mailForm.domain.trim().toLowerCase();
      if (domain && mailForm.fromEmail.trim().toLowerCase().split('@')[1] !== domain) {
        setError(t('settings.error.mailDomainMismatch')); return;
      }
    }
    const payload: Record<string, unknown> = {};
    // Mail-Versand: passSet/passHint NIE zuruecksenden; pass write-only nur, wenn
    // der Nutzer ein neues eingegeben hat (leer = unveraendert).
    if (hasMailConfig) {
      const mc: Record<string, unknown> = {
        enabled: mailForm.enabled,
        host: mailForm.host.trim(),
        port: toIntOr(mailForm.port, 587),
        secure: mailForm.secure,
        user: mailForm.user.trim(),
        fromEmail: mailForm.fromEmail.trim(),
        fromName: mailForm.fromName.trim(),
        domain: mailForm.domain.trim().toLowerCase(),
      };
      if (mailPass) mc.pass = mailPass;
      payload.mailConfig = mc;
    }
    // Status-Mail-Vorlagen als Teil-Objekt (nur wenn das Backend sie kennt). Leere
    // Felder faellt der Versand auf die heutigen Default-Texte zurueck.
    if (hasStatusMail) {
      const vorlage = (k: StatusMailKey) => ({
        betreff: statusMailForm[k].betreff.trim(),
        text: statusMailForm[k].text.trim(),
      });
      payload.statusMailVorlagen = {
        bestaetigt: vorlage('bestaetigt'),
        in_arbeit: vorlage('in_arbeit'),
        abholbereit: vorlage('abholbereit'),
      };
    }
    await persist('email', payload);
  }

  // --- Mahnwesen -------------------------------------------------------------
  async function saveMahnwesen(e: React.FormEvent) {
    e.preventDefault(); setError('');
    // Mahnfristen felduebergreifend spiegeln (Backend: streng aufsteigend, 1..365).
    if (hasMahnwesen) {
      const fr = [toIntOr(mahnForm.erinnerung, NaN), toIntOr(mahnForm.mahnung1, NaN), toIntOr(mahnForm.mahnung2, NaN)];
      if (!fr.every((n) => Number.isInteger(n) && n >= 1 && n <= 365)) {
        setError(t('settings.error.mahnDaysRange')); return;
      }
      if (!(fr[0] < fr[1] && fr[1] < fr[2])) {
        setError(t('settings.error.mahnDaysOrder')); return;
      }
    }
    const payload: Record<string, unknown> = {};
    if (hasMahnwesen) {
      payload.mahnwesen = {
        autoMahnen: mahnForm.autoMahnen,
        fristen: {
          erinnerung: toIntOr(mahnForm.erinnerung, 7),
          mahnung1: toIntOr(mahnForm.mahnung1, 14),
          mahnung2: toIntOr(mahnForm.mahnung2, 28),
        },
        gebuehr: { mahnung1: toEuro(mahnForm.gebuehr1), mahnung2: toEuro(mahnForm.gebuehr2) },
      };
    }
    await persist('mahnwesen', payload);
  }

  // --- DATEV & sevDesk -------------------------------------------------------
  async function saveBuchhaltung(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const payload: Record<string, unknown> = {
      datevBeraterNr: form.datevBeraterNr,
      datevMandantNr: form.datevMandantNr,
      datevSkr: form.datevSkr,
      datevErloeskonto19: form.datevErloeskonto19,
      datevErloeskonto7: form.datevErloeskonto7,
      datevErloeskonto0: form.datevErloeskonto0,
      datevDebitorSammelkonto: form.datevDebitorSammelkonto,
    };
    if (tokenInput.trim()) payload.sevdeskApiToken = tokenInput.trim();
    await persist('buchhaltung', payload, { resetToken: true });
  }

  // --- Sicherheit (2FA-Pflicht fuer Betriebs-Rollen) -------------------------
  async function saveSicherheit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const payload: Record<string, unknown> = {};
    if (bekannteKeys.includes('mfaPflicht')) payload.mfaPflicht = form.mfaPflicht;
    await persist('sicherheit', payload);
  }

  async function runTestMail() {
    setTestingMail(true); setMailTestResult(null);
    try {
      const r = await api.post<{ ok: boolean; message: string }>('/tenants/me/mail/test');
      setMailTestResult(r);
      if (r.ok) toast(r.message, { variant: 'positive' });
    } catch (err) {
      setMailTestResult({ ok: false, message: err instanceof Error ? err.message : t('settings.error.testFailed') });
    } finally { setTestingMail(false); setConfirmTestMail(false); }
  }
  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  }
  // Domain live gegen die DNS-Eintraege pruefen (SPF/DKIM/MX). Ergebnis + der
  // persistierte Status kommen frisch ueber die Profil-Antwort (apply nach reload).
  async function runVerifyDomain() {
    setVerifyingDomain(true); setVerifyResult(null); setError('');
    try {
      const r = await api.post<VerifyResult>('/tenants/me/mail-domain/verifizieren');
      setVerifyResult(r);
      setShowDnsRecords(true);
      // Persistierten Stand + ggf. frisch erzeugten DKIM-Key nachladen.
      const data = await api.get<TenantProfile>('/tenants/me');
      setForm({ ...LEER, ...data });
      if (r.overall === 'gruen') toast(t('settings.maildomain.verifiedToast'), { variant: 'positive' });
    } catch (err) {
      setVerifyResult(null);
      setError(err instanceof Error ? err.message : t('settings.maildomain.verifyFailed'));
    } finally { setVerifyingDomain(false); }
  }
  async function testSevdesk() {
    setTesting(true); setTestResult(null);
    try { const r = await api.post<{ ok: boolean; message: string; companyName?: string }>('/tenants/me/sevdesk/test'); setTestResult(r); }
    catch (err) { setTestResult({ ok: false, message: err instanceof Error ? err.message : t('settings.error.testFailed') }); }
    finally { setTesting(false); }
  }
  async function removeSevdesk() {
    setSaving(true); setError('');
    try { const data = await api.patch<TenantProfile>('/tenants/me', { sevdeskApiToken: '' }); setForm({ ...LEER, ...data }); setTokenInput(''); setTestResult(null); }
    catch (err) { setError(err instanceof Error ? err.message : t('settings.error.removeFailed')); }
    finally { setSaving(false); }
  }

  // "Dein Look" – Logo hochladen: clientseitig Typ/Groesse pruefen (spiegelt das
  // Backend), dann multipart POST. Das Backend liefert das aktualisierte Profil
  // (inkl. neuer data:-Logo-URL) zurueck -> apply() zeigt die Vorschau sofort.
  async function onLogoPick(file: File | null | undefined) {
    setLogoError('');
    if (!file) return;
    if (!LOGO_MIME.includes(file.type)) { setLogoError(t('settings.branding.logoErrorType')); return; }
    if (file.size > LOGO_MAX_BYTES) { setLogoError(t('settings.branding.logoErrorSize')); return; }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const data = await api.postForm<TenantProfile>('/tenants/me/logo', fd);
      apply(data);
      toast(t('settings.branding.logoUploaded'), { variant: 'positive' });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t('settings.branding.logoErrorGeneric'));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = ''; // gleiche Datei erneut waehlbar
    }
  }
  async function removeLogoAction() {
    setLogoError('');
    setUploadingLogo(true);
    try {
      const data = await api.delete<TenantProfile>('/tenants/me/logo');
      apply(data);
      toast(t('settings.branding.logoRemoved'), { variant: 'positive' });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t('settings.branding.logoErrorGeneric'));
    } finally {
      setUploadingLogo(false);
      setConfirmRemoveLogo(false);
    }
  }

  const QuickLink = ({ href, title, text }: { href: string; title: string; text: string }) => (
    <Link href={href} className="choice flex flex-col gap-0.5 p-4">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-chrome-100">
        {title}
        <span aria-hidden className="text-chrome-500">→</span>
      </span>
      <span className="text-xs text-chrome-500">{text}</span>
    </Link>
  );

  // Speichern-Leiste eines Unterbereichs: nur der aktive Bereich zeigt den Spinner;
  // waehrend IRGENDein Bereich speichert, sind alle Buttons gesperrt (Doppelklick-Schutz).
  const SaveBar = ({ area }: { area: Bereich }) => (
    <div className="flex items-center gap-3">
      <button type="submit" className="btn-primary" disabled={savingBereich !== null}>
        {savingBereich === area ? (<><span className="spinner" />{t('settings.saving')}</>) : t('common.save')}
      </button>
    </div>
  );

  // Effektive Akzentfarbe fuer die Vorschau: eigene Farbe (falls gueltig), sonst
  // die Branchen-Standardfarbe des gewaehlten Betriebstyps. Genau der Wert, den
  // auch das Backend liest (resolveTenantAkzent).
  const akzentEffektiv = normHex(form.akzentfarbe) || BETRIEBSTYP_META[form.betriebstyp].akzent;
  const akzentIstEigen = normHex(form.akzentfarbe) !== '';

  return (
    <div className="space-y-5">
      <SectionCard title={t('settings.admin.title')} subtitle={t('settings.admin.subtitle')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink href="/mitarbeiter/" title={t('settings.admin.staffTitle')} text={t('settings.admin.staffText')} />
          <QuickLink href="/standorte/" title={t('settings.admin.locationsTitle')} text={t('settings.admin.locationsText')} />
          <QuickLink href="/leistungen/" title={t('settings.admin.servicesTitle')} text={t('settings.admin.servicesText')} />
          <QuickLink href="/abo/" title={t('settings.admin.subscriptionTitle')} text={t('settings.admin.subscriptionText')} />
        </div>
      </SectionCard>

      <KalenderAbo />
      {loading ? (
        <Loading />
      ) : (
        <>
      {/* Sekundaer-Navigation: Sprungmarken zu den Unterbereichen. Jeder Bereich
          hat einen EIGENEN Speichern-Button und sendet nur seine Felder. */}
      <nav aria-label={t('settings.bereich.navLabel')} className="flex flex-wrap gap-2">
        {BEREICHE.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => { setBereich(b.key); setError(''); }}
            aria-current={bereich === b.key ? 'true' : undefined}
            className={`choice px-3.5 py-2 text-sm font-medium ${bereich === b.key ? 'choice-active' : ''}`}
          >
            {t(b.labelKey)}
          </button>
        ))}
      </nav>

      {error && <ErrorBox message={error} />}

      {bereich === 'stammdaten' && (
      <form onSubmit={saveStammdaten} className="space-y-5 animate-fade-in">

      <SectionCard
        title={t('settings.branche.title')}
        subtitle={t('settings.branche.subtitle')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(BETRIEBSTYP_META) as Betriebstyp[]).map((typ) => {
            const meta = BETRIEBSTYP_META[typ];
            const txt = BETRIEBSTYP_LABEL_KEY[typ];
            const aktivTyp = form.betriebstyp === typ;
            return (
              <button
                key={typ}
                type="button"
                onClick={() => { set('betriebstyp', typ); }}
                aria-pressed={aktivTyp}
                className={`choice flex items-start gap-3 p-3.5 text-start ${aktivTyp ? 'choice-active' : ''}`}
              >
                <span
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-lg ring-1 ring-ink-500"
                  style={{ background: `linear-gradient(135deg, ${meta.akzent}, ${meta.akzent}99)` }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${aktivTyp ? 'text-copper' : 'text-chrome-100'}`}>
                    {t(txt.label)}
                  </span>
                  <span className="block text-xs text-chrome-500">{t(txt.beschreibung)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="help mt-3">
          {t('settings.branche.help')}
        </p>
      </SectionCard>

      <SectionCard title={t('settings.branding.title')} subtitle={t('settings.branding.subtitle')}>
        {/* Logo */}
        <div className="space-y-3">
          <span className="label block">{t('settings.branding.logoLabel')}</span>
          <div className="flex flex-wrap items-center gap-4">
            {/* Vorschau (oder Platzhalter) */}
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-600 bg-ink-850">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt={t('settings.branding.logoLabel')} className="h-full w-full object-contain p-1.5" />
              ) : (
                <span className="px-1 text-center text-[10px] leading-tight text-chrome-500">{t('settings.branding.logoPlaceholder')}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? (<><span className="spinner" />{t('settings.branding.logoUploading')}</>) : t('settings.branding.logoChoose')}
                </button>
                {form.logoUrl && (
                  <button
                    type="button"
                    className="link-danger text-sm disabled:opacity-50"
                    disabled={uploadingLogo}
                    onClick={() => setConfirmRemoveLogo(true)}
                  >
                    {t('settings.branding.logoRemove')}
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onLogoPick(e.target.files?.[0])}
              />
              <p className="help">{t('settings.branding.logoHelp')}</p>
            </div>
          </div>
          {logoError && <ErrorBox message={logoError} />}
        </div>

        {/* Akzentfarbe */}
        <div className="mt-6 space-y-3 border-t border-ink-700/50 pt-5">
          <span className="label block">{t('settings.branding.accentLabel')}</span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label={t('settings.branding.accentLabel')}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink-600 bg-ink-850 p-1"
              value={akzentEffektiv}
              onChange={(e) => set('akzentfarbe', e.target.value)}
            />
            <input
              type="text"
              aria-label={t('settings.branding.accentLabel')}
              className="input w-40 font-mono"
              maxLength={7}
              placeholder="#B5722F"
              value={form.akzentfarbe}
              onChange={(e) => set('akzentfarbe', e.target.value)}
            />
            <button
              type="button"
              className="link-action text-sm disabled:opacity-40"
              disabled={!akzentIstEigen}
              onClick={() => set('akzentfarbe', '')}
            >
              {t('settings.branding.accentReset')}
            </button>
          </div>
          {/* Live-Vorschau: Swatch + Beispiel-Button in der gewaehlten Farbe */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1"
              style={{ color: akzentEffektiv, background: `${akzentEffektiv}1a`, borderColor: `${akzentEffektiv}40` }}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: akzentEffektiv }} aria-hidden />
              {akzentEffektiv}
            </span>
            <span
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
              style={{ background: akzentEffektiv }}
            >
              {t('settings.branding.accentPreviewButton')}
            </span>
          </div>
          <p className="help">{t('settings.branding.accentHelp')}</p>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.mitglied.title')} subtitle={t('settings.mitglied.subtitle')}>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm text-chrome-200">{t('settings.mitglied.toggle')}</span>
            <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.mitglied.toggleHint')}</span>
          </span>
          <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
            checked={mitgliedForm.zeigen}
            onChange={(e) => setMitgliedForm((m) => ({ ...m, zeigen: e.target.checked }))} />
        </label>

        {mitgliedForm.zeigen && (
          <div className="mt-5 space-y-5 border-t border-ink-700/50 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="mitgliedStadt">{t('settings.mitglied.stadt')}</label>
                <input id="mitgliedStadt" className="input" maxLength={80} value={mitgliedForm.stadt}
                  onChange={(e) => setMitgliedForm((m) => ({ ...m, stadt: e.target.value }))}
                  placeholder={t('settings.mitglied.stadtPlaceholder')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="mitgliedWebseite">{t('settings.mitglied.webseite')}</label>
                <input id="mitgliedWebseite" type="url" className="input" maxLength={200} pattern="https?://\S+"
                  value={mitgliedForm.webseite}
                  onChange={(e) => setMitgliedForm((m) => ({ ...m, webseite: e.target.value }))}
                  placeholder={t('settings.mitglied.webseitePlaceholder')} />
                <p className="help mt-1.5">{t('settings.mitglied.webseiteHelp')}</p>
              </div>
              <div className="field sm:col-span-2">
                <label className="label" htmlFor="mitgliedBeschr">{t('settings.mitglied.kurzbeschreibung')}</label>
                <textarea id="mitgliedBeschr" className="textarea" rows={2} maxLength={160}
                  value={mitgliedForm.kurzbeschreibung}
                  onChange={(e) => setMitgliedForm((m) => ({ ...m, kurzbeschreibung: e.target.value }))}
                  placeholder={t('settings.mitglied.kurzbeschreibungPlaceholder')} />
                <p className="help mt-1.5">{t('settings.mitglied.kurzbeschreibungHelp')}</p>
              </div>
            </div>

            {/* Vorschau der oeffentlichen Mitgliedskarte */}
            <div>
              <span className="label mb-1.5 block">{t('settings.mitglied.previewLabel')}</span>
              <div className="card max-w-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-base font-bold text-white ring-1 ring-ink-500"
                    style={{ background: `linear-gradient(135deg, ${BETRIEBSTYP_META[form.betriebstyp].akzent}, ${BETRIEBSTYP_META[form.betriebstyp].akzent}99)` }}
                    aria-hidden>
                    {mitgliedInitiale(form.name)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold text-chrome-50">{form.name || 'Ihr Betrieb'}</h3>
                    {mitgliedForm.stadt.trim() && <p className="truncate text-xs text-chrome-500">{mitgliedForm.stadt}</p>}
                  </div>
                </div>
                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1"
                    style={{ color: BETRIEBSTYP_META[form.betriebstyp].akzent, background: `${BETRIEBSTYP_META[form.betriebstyp].akzent}1a`, borderColor: `${BETRIEBSTYP_META[form.betriebstyp].akzent}40` }}>
                    {t(BETRIEBSTYP_LABEL_KEY[form.betriebstyp].label)}
                  </span>
                </div>
                {mitgliedForm.kurzbeschreibung.trim() && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-chrome-400">{mitgliedForm.kurzbeschreibung}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="help mt-4">{t('settings.mitglied.consent')}</p>
      </SectionCard>

      <SectionCard title={t('settings.address.title')} subtitle={t('settings.address.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2"><label className="label" htmlFor="name">{t('settings.address.name')}</label><input id="name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
          <div className="field"><label className="label" htmlFor="email">{t('settings.address.email')}</label><input id="email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="phone">{t('settings.address.phone')}</label><input id="phone" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field sm:col-span-2"><label className="label" htmlFor="street">{t('settings.address.street')}</label><input id="street" className="input" value={form.street} onChange={(e) => set('street', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="postalCode">{t('settings.address.postalCode')}</label><input id="postalCode" className="input" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="city">{t('settings.address.city')}</label><input id="city" className="input" value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="country">{t('settings.address.country')}</label><input id="country" className="input" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="DE" /></div>
        </div>
        <p className="help mt-3">{t('settings.address.taxHintPre')}<span className="text-chrome-300">{t('settings.address.taxHintOr')}</span>{t('settings.address.taxHintPost')}</p>
      </SectionCard>

      <SaveBar area="stammdaten" />
      </form>
      )}

      {bereich === 'steuer' && (
      <form onSubmit={saveSteuer} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.tax.title')} subtitle={t('settings.tax.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label className="label" htmlFor="steuernummer">{t('settings.tax.steuernummer')}</label><input id="steuernummer" className="input" value={form.steuernummer} onChange={(e) => set('steuernummer', e.target.value)} placeholder={t('settings.tax.steuernummerPlaceholder')} /></div>
          <div className="field"><label className="label" htmlFor="ustId">{t('settings.tax.ustId')}</label><input id="ustId" className="input" value={form.ustId} onChange={(e) => set('ustId', e.target.value)} placeholder={t('settings.tax.ustIdPlaceholder')} /></div>
        </div>

        {/* §19 UStG (Kleinunternehmer) + Rechtsform */}
        <div className="mt-5 space-y-4 border-t border-ink-700/50 pt-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">{t('settings.steuer.kleinunternehmer')}</span>
              <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.steuer.kleinunternehmerHint')}</span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={steuerForm.kleinunternehmer}
              onChange={(e) => setSteuerForm((s) => ({ ...s, kleinunternehmer: e.target.checked }))} />
          </label>

          {steuerForm.kleinunternehmer ? (
            <div className="field">
              <label className="label" htmlFor="steuerHinweis">{t('settings.steuer.hinweisLabel')}</label>
              <textarea id="steuerHinweis" className="textarea" rows={2} maxLength={300}
                value={steuerForm.kleinunternehmerHinweis}
                onChange={(e) => setSteuerForm((s) => ({ ...s, kleinunternehmerHinweis: e.target.value }))}
                placeholder={KLEINUNTERNEHMER_HINWEIS_DEFAULT} />
              <p className="help mt-1.5">{t('settings.steuer.hinweisHelp')}</p>
            </div>
          ) : (
            <div className="field">
              <label className="label mb-1.5 block">{t('settings.steuer.standardSatz')}</label>
              <div className="seg-group">
                <button type="button" className={`seg ${steuerForm.standardMwstSatz === 19 ? 'seg-active' : ''}`}
                  onClick={() => setSteuerForm((s) => ({ ...s, standardMwstSatz: 19 }))}>19 %</button>
                <button type="button" className={`seg ${steuerForm.standardMwstSatz === 0 ? 'seg-active' : ''}`}
                  onClick={() => setSteuerForm((s) => ({ ...s, standardMwstSatz: 0 }))}>0 %</button>
              </div>
              <p className="help mt-1.5">{t('settings.steuer.standardSatzHelp')}</p>
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="rechtsform">{t('settings.steuer.rechtsform')}</label>
            <select id="rechtsform" className="input" value={steuerForm.rechtsform}
              onChange={(e) => setSteuerForm((s) => ({ ...s, rechtsform: e.target.value }))}>
              {RECHTSFORMEN.map((rf) => (
                <option key={rf} value={rf}>{t(`settings.steuer.rechtsform.${rf}`)}</option>
              ))}
            </select>
          </div>

          {REGISTER_RECHTSFORMEN.includes(steuerForm.rechtsform) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="registergericht">{t('settings.steuer.registergericht')}</label>
                <input id="registergericht" className="input" maxLength={120} value={steuerForm.registergericht}
                  onChange={(e) => setSteuerForm((s) => ({ ...s, registergericht: e.target.value }))}
                  placeholder={t('settings.steuer.registergerichtPlaceholder')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="registernummer">{t('settings.steuer.registernummer')}</label>
                <input id="registernummer" className="input" maxLength={40} value={steuerForm.registernummer}
                  onChange={(e) => setSteuerForm((s) => ({ ...s, registernummer: e.target.value }))}
                  placeholder={t('settings.steuer.registernummerPlaceholder')} />
              </div>
              <div className="field sm:col-span-2">
                <label className="label" htmlFor="vertretung">{t('settings.steuer.vertretung')}</label>
                <input id="vertretung" className="input" maxLength={200} value={steuerForm.vertretungsberechtigte}
                  onChange={(e) => setSteuerForm((s) => ({ ...s, vertretungsberechtigte: e.target.value }))}
                  placeholder={t('settings.steuer.vertretungPlaceholder')} />
              </div>
            </div>
          )}

          <p className="help">
            {t('settings.steuer.infoLinkPre')}{' '}
            <Link href="/kleinunternehmer/" className="link-action">{t('settings.steuer.infoLink')}</Link>
            {t('settings.steuer.infoLinkPost')}
          </p>
        </div>
      </SectionCard>

      {/* Impressum-Generator (§ 5 DDG): Pflichtangaben stammen aus den Feldern oben
          (Adresse/Kontakt/Rechtsform/USt-IdNr.). Live-Check + Vorschau + Disclaimer. */}
      <SectionCard title={t('settings.impressum.title')} subtitle={t('settings.impressum.subtitle')}>
        <div className="rounded-lg bg-info-soft px-3.5 py-3 text-xs leading-relaxed text-info ring-1 ring-inset ring-info/20">
          {t('settings.impressum.disclaimer')}
        </div>

        {/* Inhaber/Gesellschafter – bei Kapitalgesellschaften steht das Feld schon
            oben (Steuer/Register), daher hier nur fuer die uebrigen Rechtsformen. */}
        {!REGISTER_RECHTSFORMEN.includes(steuerForm.rechtsform) && (
          <div className="field mt-4">
            <label className="label" htmlFor="impVertretung">{t(vertretungLabelKey(steuerForm.rechtsform))}</label>
            <input id="impVertretung" className="input" maxLength={200}
              value={steuerForm.vertretungsberechtigte}
              onChange={(e) => setSteuerForm((s) => ({ ...s, vertretungsberechtigte: e.target.value }))}
              placeholder={t('settings.impressum.vertretungPlaceholder')} />
            <p className="help mt-1.5">{t('settings.impressum.vertretungHelp')}</p>
          </div>
        )}

        {/* Live-Vollstaendigkeits-Check – NUR fuer den Inhaber, nie fuer Endkunden. */}
        {(() => {
          const check = pruefeImpressumFE({
            firmenname: form.name, strasse: form.street, plz: form.postalCode, ort: form.city,
            telefon: form.phone, email: form.email, rechtsform: steuerForm.rechtsform,
            vertretungsberechtigte: steuerForm.vertretungsberechtigte,
            registergericht: steuerForm.registergericht, registernummer: steuerForm.registernummer,
            ustId: form.ustId,
          });
          if (check.fehlend.length === 0) {
            return (
              <div className="mt-4 rounded-lg bg-positive-soft px-3.5 py-3 text-sm text-positive ring-1 ring-inset ring-positive/20">
                {t('settings.impressum.complete')}
                {check.ustWarnung && (
                  <span className="mt-1 block text-xs text-caution">{t('settings.impressum.ustWarn')}</span>
                )}
              </div>
            );
          }
          return (
            <div className="mt-4 rounded-lg bg-caution-soft px-3.5 py-3 text-sm text-caution ring-1 ring-inset ring-caution/25">
              <p className="font-medium">{t('settings.impressum.incomplete')}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 ps-5 text-xs">
                {check.fehlend.map((f) => (
                  <li key={f}>{t(`settings.impressum.feld.${f}`)}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-chrome-500">{t('settings.impressum.incompleteHint')}</p>
            </div>
          );
        })()}

        {/* Vorschau des generierten Impressums (aus den aktuellen Feldern). */}
        <div className="mt-4">
          <p className="label mb-1.5">{t('settings.impressum.previewTitle')}</p>
          <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-4 text-sm leading-relaxed text-chrome-300">
            <p className="font-semibold text-chrome-100">{t('settings.impressum.previewHeading')}</p>
            <p className="mt-2 text-chrome-200">
              {form.name || <span className="text-chrome-600">{t('settings.impressum.placeholderName')}</span>}
            </p>
            <p>{form.street || '—'}</p>
            <p>{[form.postalCode, form.city].filter(Boolean).join(' ') || '—'}</p>
            <p>{landLabelFE(form.country)}</p>
            {steuerForm.vertretungsberechtigte && (
              <p className="mt-2">
                <span className="text-chrome-500">{t(vertretungLabelKey(steuerForm.rechtsform))}: </span>
                {steuerForm.vertretungsberechtigte}
              </p>
            )}
            {(form.phone || form.email) && (
              <p className="mt-2">
                {form.phone && <span className="block">{t('settings.impressum.previewPhone')}: {form.phone}</span>}
                {form.email && <span className="block">{t('settings.impressum.previewEmail')}: {form.email}</span>}
              </p>
            )}
            {REGISTER_RECHTSFORMEN.includes(steuerForm.rechtsform) &&
              (steuerForm.registergericht || steuerForm.registernummer) && (
                <p className="mt-2">
                  {steuerForm.registergericht && (
                    <span className="block">{t('settings.impressum.previewRegister')}: {steuerForm.registergericht}</span>
                  )}
                  {steuerForm.registernummer && <span className="block">{steuerForm.registernummer}</span>}
                </p>
              )}
            {form.ustId && <p className="mt-2">{t('settings.impressum.previewUstId')}: {form.ustId}</p>}
            {impressumForm.berufshaftpflicht && (
              <p className="mt-2">{t('settings.impressum.berufshaftpflicht')}: {impressumForm.berufshaftpflicht}</p>
            )}
            {impressumForm.aufsichtsbehoerde && (
              <p className="mt-2">{t('settings.impressum.aufsichtsbehoerde')}: {impressumForm.aufsichtsbehoerde}</p>
            )}
          </div>
          {form.slug && (
            <a
              href={`/impressum/betrieb?b=${encodeURIComponent(form.slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-action mt-2 inline-flex items-center gap-1 text-sm"
            >
              {t('settings.impressum.viewLive')}
              <span aria-hidden>↗</span>
            </a>
          )}
        </div>

        {/* Optionale Zusatzangaben (selten noetig) – bewusst eingeklappt/sekundaer. */}
        {hasImpressum && (
          <details className="group mt-4 rounded-lg border border-ink-700/60 bg-ink-800/30 [&_summary]:list-none">
            <summary className="flex cursor-pointer items-center justify-between px-3.5 py-3 text-sm text-chrome-200">
              {t('settings.impressum.optionalTitle')}
              <span aria-hidden className="text-chrome-500 transition-transform group-open:rotate-90">→</span>
            </summary>
            <div className="space-y-4 px-3.5 pb-4">
              <p className="help">{t('settings.impressum.optionalHint')}</p>
              <div className="field">
                <label className="label" htmlFor="berufshaftpflicht">{t('settings.impressum.berufshaftpflicht')}</label>
                <input id="berufshaftpflicht" className="input" maxLength={300}
                  value={impressumForm.berufshaftpflicht}
                  onChange={(e) => setImpressumForm((s) => ({ ...s, berufshaftpflicht: e.target.value }))}
                  placeholder={t('settings.impressum.berufshaftpflichtPlaceholder')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="aufsichtsbehoerde">{t('settings.impressum.aufsichtsbehoerde')}</label>
                <input id="aufsichtsbehoerde" className="input" maxLength={200}
                  value={impressumForm.aufsichtsbehoerde}
                  onChange={(e) => setImpressumForm((s) => ({ ...s, aufsichtsbehoerde: e.target.value }))}
                  placeholder={t('settings.impressum.aufsichtsbehoerdePlaceholder')} />
              </div>
            </div>
          </details>
        )}
      </SectionCard>

      <SaveBar area="steuer" />
      </form>
      )}

      {bereich === 'rechnung' && (
      <form onSubmit={saveRechnung} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.bank.title')} subtitle={t('settings.bank.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2"><label className="label" htmlFor="bankname">{t('settings.bank.bankname')}</label><input id="bankname" className="input" value={form.bankname} onChange={(e) => set('bankname', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="iban">{t('settings.bank.iban')}</label><input id="iban" className="input" value={form.iban} onChange={(e) => set('iban', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="bic">{t('settings.bank.bic')}</label><input id="bic" className="input" value={form.bic} onChange={(e) => set('bic', e.target.value)} /></div>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.invoice.title')} subtitle={t('settings.invoice.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="rechnungZahlungszielTage">{t('settings.invoice.paymentTerm')}</label>
            <input id="rechnungZahlungszielTage" className="input" inputMode="numeric" maxLength={3}
              value={form.rechnungZahlungszielTage}
              onChange={(e) => set('rechnungZahlungszielTage', e.target.value.replace(/\D/g, ''))}
              placeholder="14" />
            <p className="help mt-1.5">{t('settings.invoice.paymentTermHelp')}</p>
          </div>
          <div className="field sm:col-span-2">
            <label className="label" htmlFor="rechnungPaymentLink">{t('settings.invoice.paymentLink')}</label>
            <input id="rechnungPaymentLink" type="url" className="input" maxLength={300}
              pattern="https://\S+"
              value={form.rechnungPaymentLink}
              onChange={(e) => set('rechnungPaymentLink', e.target.value)}
              placeholder={t('settings.invoice.paymentLinkPlaceholder')} />
            <p className="help mt-1.5">
              {t('settings.invoice.paymentLinkHelp')}
            </p>
          </div>
          <div className="field sm:col-span-2">
            <label className="label" htmlFor="rechnungFusstext">{t('settings.invoice.footer')}</label>
            <textarea id="rechnungFusstext" className="textarea" rows={2} maxLength={300}
              value={form.rechnungFusstext}
              onChange={(e) => set('rechnungFusstext', e.target.value)}
              placeholder={t('settings.invoice.footerPlaceholder')} />
            <p className="help mt-1.5">{t('settings.invoice.footerHelp')}</p>
          </div>
        </div>
      </SectionCard>

      <SaveBar area="rechnung" />
      </form>
      )}

      {bereich === 'kalender' && (
      <form onSubmit={saveKalender} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.kalk.title')} subtitle={t('settings.kalk.subtitle')}>
        <label className="label mb-1.5 block">{t('settings.kalk.grouplabel')}</label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="field">
            <label className="label" htmlFor="kalkFolierung">{t('settings.kalk.folierung')}</label>
            <input id="kalkFolierung" className="input" inputMode="decimal" maxLength={7} value={kalkForm.folierung}
              onChange={(e) => setKalkForm((f) => ({ ...f, folierung: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="60" />
          </div>
          <div className="field">
            <label className="label" htmlFor="kalkPpf">{t('settings.kalk.ppf')}</label>
            <input id="kalkPpf" className="input" inputMode="decimal" maxLength={7} value={kalkForm.ppf}
              onChange={(e) => setKalkForm((f) => ({ ...f, ppf: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="130" />
          </div>
          <div className="field">
            <label className="label" htmlFor="kalkAufbereitung">{t('settings.kalk.aufbereitung')}</label>
            <input id="kalkAufbereitung" className="input" inputMode="decimal" maxLength={7} value={kalkForm.aufbereitung}
              onChange={(e) => setKalkForm((f) => ({ ...f, aufbereitung: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="25" />
          </div>
        </div>
        <p className="help mt-3">{t('settings.kalk.help')}</p>
      </SectionCard>

      <SectionCard title={t('settings.kalender.title')} subtitle={t('settings.kalender.subtitle')}>
        <div className="space-y-2">
          {WOCHENTAGE.map((tag) => {
            const az = azForm[tag];
            const setTag = (patch: Partial<Arbeitszeit>) =>
              setAzForm((f) => ({ ...f, [tag]: { ...f[tag], ...patch } }));
            return (
              <div key={tag} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-700/60 bg-ink-800/30 px-3 py-2">
                <label className="flex min-w-[8.5rem] cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                    checked={az.aktiv}
                    onChange={(e) => setTag({ aktiv: e.target.checked })}
                  />
                  <span className={`text-sm font-medium ${az.aktiv ? 'text-chrome-100' : 'text-chrome-500'}`}>
                    {t(`labels.weekday.${tag}`)}
                  </span>
                </label>
                <div className={`flex items-center gap-2 transition-opacity ${az.aktiv ? '' : 'pointer-events-none opacity-40'}`}>
                  <input
                    type="time"
                    className="input !w-auto"
                    value={az.von}
                    disabled={!az.aktiv}
                    aria-label={`${t(`labels.weekday.${tag}`)} ${t('settings.kalender.von')}`}
                    onChange={(e) => setTag({ von: e.target.value })}
                  />
                  <span className="text-chrome-600" aria-hidden="true">–</span>
                  <input
                    type="time"
                    className="input !w-auto"
                    value={az.bis}
                    disabled={!az.aktiv}
                    aria-label={`${t(`labels.weekday.${tag}`)} ${t('settings.kalender.bis')}`}
                    onChange={(e) => setTag({ bis: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label" htmlFor="slotDauerMin">{t('settings.kalender.slotDauer')}</label>
            <input id="slotDauerMin" className="input" inputMode="numeric" maxLength={3} value={slotDauerForm}
              onChange={(e) => setSlotDauerForm(e.target.value.replace(/\D/g, ''))} placeholder="30" />
          </div>
          <div className="field">
            <label className="label" htmlFor="pufferMin">{t('settings.kalender.puffer')}</label>
            <input id="pufferMin" className="input" inputMode="numeric" maxLength={3} value={pufferForm}
              onChange={(e) => setPufferForm(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </div>
          <div className="field">
            <label className="label" htmlFor="vorlaufMinStunden">{t('settings.kalender.vorlaufMin')}</label>
            <input id="vorlaufMinStunden" className="input" inputMode="numeric" maxLength={3} value={vorlaufMinForm}
              onChange={(e) => setVorlaufMinForm(e.target.value.replace(/\D/g, ''))} placeholder="24" />
          </div>
          <div className="field">
            <label className="label" htmlFor="vorlaufMaxTage">{t('settings.kalender.vorlaufMax')}</label>
            <input id="vorlaufMaxTage" className="input" inputMode="numeric" maxLength={3} value={vorlaufMaxForm}
              onChange={(e) => setVorlaufMaxForm(e.target.value.replace(/\D/g, ''))} placeholder="60" />
          </div>
        </div>
        <p className="help mt-3">{t('settings.kalender.hint')}</p>
      </SectionCard>

      {hasBuchung && (
        <SectionCard title={t('settings.buchung.modusTitle')} subtitle={t('settings.buchung.modusSubtitle')}>
          <div className="field">
            <label className="label" htmlFor="buchungModus">{t('settings.buchung.modusLabel')}</label>
            <select
              id="buchungModus"
              className="input"
              value={buchungModus}
              onChange={(e) => setBuchungModus(e.target.value === 'verbindlich' ? 'verbindlich' : 'anfrage')}
            >
              <option value="anfrage">{t('settings.buchung.modusAnfrage')}</option>
              <option value="verbindlich">{t('settings.buchung.modusVerbindlich')}</option>
            </select>
            <p className="help mt-1.5">{t('settings.buchung.modusHelp')}</p>
          </div>

          {buchungModus === 'verbindlich' && (
            <div className="mt-3 rounded-lg bg-caution-soft px-3.5 py-3 text-sm text-caution ring-1 ring-inset ring-caution/25">
              {t('settings.buchung.modusVerbindlichHint')}
            </div>
          )}

          {/* Vollstaendigkeits-Hinweis fuer die Buchungsseite: der Anbieter
              (Vertragspartner) muss dort erkennbar sein – dieselbe Pflichtangaben-
              Pruefung wie im Impressum-Abschnitt, hier auf die Buchungsseite bezogen. */}
          {(() => {
            const check = pruefeImpressumFE({
              firmenname: form.name, strasse: form.street, plz: form.postalCode, ort: form.city,
              telefon: form.phone, email: form.email, rechtsform: steuerForm.rechtsform,
              vertretungsberechtigte: steuerForm.vertretungsberechtigte,
              registergericht: steuerForm.registergericht, registernummer: steuerForm.registernummer,
              ustId: form.ustId,
            });
            if (check.fehlend.length === 0) return null;
            return (
              <div className="mt-3 rounded-lg bg-caution-soft px-3.5 py-3 text-sm text-caution ring-1 ring-inset ring-caution/25">
                {t('settings.buchung.impressumIncomplete')}
              </div>
            );
          })()}
        </SectionCard>
      )}

      {hasKalender && (
        <SectionCard title={t('settings.kalender.umsatzZielTitle')} subtitle={t('settings.kalender.umsatzZielSubtitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="umsatzZielWoche">{t('settings.kalender.umsatzZielLabel')}</label>
              <input id="umsatzZielWoche" className="input" inputMode="decimal" maxLength={9} value={umsatzZiel}
                onChange={(e) => setUmsatzZiel(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="6000" />
            </div>
          </div>
          <p className="help mt-3">{t('settings.kalender.umsatzZielHelp')}</p>
        </SectionCard>
      )}

      <SaveBar area="kalender" />
      </form>
      )}

      {bereich === 'mahnwesen' && (
      <form onSubmit={saveMahnwesen} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.mahn.title')} subtitle={t('settings.mahn.subtitle')}>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">{t('settings.mahn.auto')}</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                {t('settings.mahn.autoHint')}
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={mahnForm.autoMahnen}
              onChange={(e) => setMahnForm((f) => ({ ...f, autoMahnen: e.target.checked }))} />
          </label>

          <div>
            <label className="label mb-1.5 block">{t('settings.mahn.deadlines')}</label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="field">
                <label className="label" htmlFor="fristErinnerung">{t('settings.mahn.reminder')}</label>
                <input id="fristErinnerung" className="input" inputMode="numeric" maxLength={3} value={mahnForm.erinnerung}
                  onChange={(e) => setMahnForm((f) => ({ ...f, erinnerung: e.target.value.replace(/\D/g, '') }))} placeholder="7" />
              </div>
              <div className="field">
                <label className="label" htmlFor="fristMahnung1">{t('settings.mahn.dunning1')}</label>
                <input id="fristMahnung1" className="input" inputMode="numeric" maxLength={3} value={mahnForm.mahnung1}
                  onChange={(e) => setMahnForm((f) => ({ ...f, mahnung1: e.target.value.replace(/\D/g, '') }))} placeholder="14" />
              </div>
              <div className="field">
                <label className="label" htmlFor="fristMahnung2">{t('settings.mahn.dunning2')}</label>
                <input id="fristMahnung2" className="input" inputMode="numeric" maxLength={3} value={mahnForm.mahnung2}
                  onChange={(e) => setMahnForm((f) => ({ ...f, mahnung2: e.target.value.replace(/\D/g, '') }))} placeholder="28" />
              </div>
            </div>
            <p className="help mt-1.5">{t('settings.mahn.deadlinesHelp')}</p>
          </div>

          <div>
            <label className="label mb-1.5 block">{t('settings.mahn.fees')}</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="gebuehr1">{t('settings.mahn.dunning1')}</label>
                <input id="gebuehr1" className="input" inputMode="decimal" maxLength={6} value={mahnForm.gebuehr1}
                  onChange={(e) => setMahnForm((f) => ({ ...f, gebuehr1: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="0" />
              </div>
              <div className="field">
                <label className="label" htmlFor="gebuehr2">{t('settings.mahn.dunning2')}</label>
                <input id="gebuehr2" className="input" inputMode="decimal" maxLength={6} value={mahnForm.gebuehr2}
                  onChange={(e) => setMahnForm((f) => ({ ...f, gebuehr2: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="0" />
              </div>
            </div>
            <p className="help mt-1.5">{t('settings.mahn.feesHelp')}</p>
          </div>
        </div>
      </SectionCard>

      <SaveBar area="mahnwesen" />
      </form>
      )}

      {/* Kunden-Benachrichtigungen sind in den eigenen Tab „Kundenkommunikation" umgezogen
          (Termin-Erinnerung, Bewertungs-Bitte, Status-/Termin-Mails an einem Ort). */}

      {bereich === 'sicherheit' && (
      <form onSubmit={saveSicherheit} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.security.title')} subtitle={t('settings.security.subtitle')}>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm text-chrome-200">{t('settings.security.mfaRequired')}</span>
            <span className="mt-0.5 block text-xs text-chrome-500">
              {t('settings.security.mfaRequiredHint')}
            </span>
          </span>
          <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
            checked={form.mfaPflicht === '1'}
            onChange={(e) => set('mfaPflicht', e.target.checked ? '1' : '0')} />
        </label>
      </SectionCard>

      <SaveBar area="sicherheit" />
      </form>
      )}

      {bereich === 'email' && (
      <form onSubmit={saveEmail} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.mail.title')} subtitle={t('settings.mail.subtitle')}>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">{t('settings.mail.useOwn')}</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                {t('settings.mail.useOwnHint')}
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={mailForm.enabled}
              onChange={(e) => setMailForm((f) => ({ ...f, enabled: e.target.checked }))} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field sm:col-span-2">
              <label className="label" htmlFor="mailHost">{t('settings.mail.host')}</label>
              <input id="mailHost" className="input" autoComplete="off" value={mailForm.host}
                onChange={(e) => setMailForm((f) => ({ ...f, host: e.target.value }))} placeholder={t('settings.mail.hostPlaceholder')} />
            </div>
            <div className="field">
              <label className="label" htmlFor="mailPort">{t('settings.mail.port')}</label>
              <input id="mailPort" className="input" inputMode="numeric" maxLength={5} value={mailForm.port}
                onChange={(e) => setMailForm((f) => ({ ...f, port: e.target.value.replace(/\D/g, '') }))} placeholder="587" />
            </div>
            <div className="field">
              <label className="label">{t('settings.mail.encryption')}</label>
              <div className="seg-group">
                <button type="button" className={`seg ${!mailForm.secure ? 'seg-active' : ''}`}
                  onClick={() => setMailForm((f) => ({ ...f, secure: false }))}>STARTTLS (587)</button>
                <button type="button" className={`seg ${mailForm.secure ? 'seg-active' : ''}`}
                  onClick={() => setMailForm((f) => ({ ...f, secure: true }))}>SSL/TLS (465)</button>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="mailUser">{t('settings.mail.user')}</label>
              <input id="mailUser" className="input" autoComplete="off" value={mailForm.user}
                onChange={(e) => setMailForm((f) => ({ ...f, user: e.target.value }))} placeholder={t('settings.mail.userPlaceholder')} />
            </div>
            <div className="field">
              <label className="label" htmlFor="mailPass">{t('settings.mail.password')}</label>
              <input id="mailPass" type="password" autoComplete="new-password" className="input" value={mailPass}
                onChange={(e) => setMailPass(e.target.value)}
                placeholder={mailPassSet ? t('settings.mail.passwordPlaceholderSet', { hint: form.mailConfig.passHint || '••••••••' }) : t('settings.mail.passwordPlaceholder')} />
              <p className="help mt-1.5">{t('settings.mail.passwordHelp')}</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="mailFromEmail">{t('settings.mail.fromEmail')}</label>
              <input id="mailFromEmail" type="email" className="input" value={mailForm.fromEmail}
                onChange={(e) => setMailForm((f) => ({ ...f, fromEmail: e.target.value }))} placeholder={t('settings.mail.fromEmailPlaceholder')} />
            </div>
            <div className="field">
              <label className="label" htmlFor="mailFromName">{t('settings.mail.fromName')}</label>
              <input id="mailFromName" className="input" maxLength={120} value={mailForm.fromName}
                onChange={(e) => setMailForm((f) => ({ ...f, fromName: e.target.value }))} placeholder={t('settings.mail.fromNamePlaceholder')} />
            </div>
            <div className="field sm:col-span-2">
              <label className="label" htmlFor="mailDomain">{t('settings.maildomain.domain')}</label>
              <input id="mailDomain" className="input" autoComplete="off" value={mailForm.domain}
                onChange={(e) => setMailForm((f) => ({ ...f, domain: e.target.value.trim().toLowerCase() }))}
                placeholder={t('settings.maildomain.domainPlaceholder')} />
              <p className="help mt-1.5">{t('settings.maildomain.domainHelp')}</p>
            </div>
          </div>

          {/* Zustellbarkeit: DNS-Eintraege + Domain-Verifikation (SPF/DKIM/MX). */}
          {form.mailConfig.domain ? (
            <div className="space-y-3 rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-chrome-100">{t('settings.maildomain.title')}</h4>
                <span className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${form.mailConfig.domainCheck.verifiziert ? AMPEL_CLASS.gruen : AMPEL_CLASS.rot}`}>
                  {form.mailConfig.domainCheck.verifiziert ? t('settings.maildomain.badgeVerified') : t('settings.maildomain.badgeUnverified')}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-chrome-400">{t('settings.maildomain.spamHint')}</p>

              {form.mailConfig.dnsRecords && (
                <>
                  <button type="button" className="link-action text-sm" onClick={() => setShowDnsRecords((v) => !v)}>
                    {showDnsRecords ? t('settings.maildomain.hideRecords') : t('settings.maildomain.showRecords')}
                  </button>
                  {showDnsRecords && (
                    <div className="space-y-2">
                      {(['spf', 'dkim'] as const).map((key) => {
                        const rec = form.mailConfig.dnsRecords![key];
                        return (
                          <div key={key} className="rounded-lg border border-ink-700/60 bg-ink-900/30 p-3">
                            <div className="text-sm font-semibold text-chrome-200">{t(`settings.maildomain.record.${key}`)}</div>
                            <CopyField label={`${t('settings.maildomain.recordType')} / ${t('settings.maildomain.recordHost')}`}
                              value={`${rec.type}  ${rec.host}`} active={copied === `${key}-host`}
                              onCopy={() => copy(rec.host, `${key}-host`)}
                              copyLabel={t('settings.maildomain.copy')} copiedLabel={t('settings.maildomain.copied')} />
                            <CopyField label={t('settings.maildomain.recordValue')} value={rec.value} active={copied === `${key}-value`}
                              onCopy={() => copy(rec.value, `${key}-value`)}
                              copyLabel={t('settings.maildomain.copy')} copiedLabel={t('settings.maildomain.copied')} />
                          </div>
                        );
                      })}
                      <p className="text-[11px] leading-relaxed text-chrome-500">{t('settings.maildomain.recordsHint')}</p>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-ghost btn-sm" disabled={verifyingDomain}
                  onClick={runVerifyDomain} title={t('settings.maildomain.verifyTitle')}>
                  {verifyingDomain ? (<><span className="spinner" />{t('settings.maildomain.verifying')}</>) : t('settings.maildomain.verify')}
                </button>
                {form.mailConfig.domainCheck.geprueftAm && !verifyResult && (
                  <span className="text-xs text-chrome-500">
                    {t('settings.maildomain.lastChecked', { date: new Date(form.mailConfig.domainCheck.geprueftAm).toLocaleString() })}
                  </span>
                )}
              </div>

              {verifyResult && (
                <div className="space-y-1.5">
                  {(['spf', 'dkim', 'mx'] as const).map((key) => (
                    <div key={key} className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-sm ${AMPEL_CLASS[verifyResult[key].status]}`}>
                      <span className="font-semibold">{t(`settings.maildomain.check.${key}`)}</span>
                      <span>{verifyResult[key].message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-chrome-500">{t('settings.maildomain.setDomainFirst')}</p>
          )}

          <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-3 text-xs leading-relaxed text-chrome-400">
            {t('settings.mail.testInfoPre')}<span className="font-semibold text-chrome-200">{t('settings.mail.testInfoEmph')}</span>{t('settings.mail.testInfoPost')}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost btn-sm" disabled={!form.mailConfig.enabled || testingMail}
              onClick={() => setConfirmTestMail(true)} title={form.mailConfig.enabled ? t('settings.mail.testTitleOn') : t('settings.mail.testTitleOff')}>
              {testingMail ? (<><span className="spinner" />{t('settings.mail.sending')}</>) : t('settings.mail.testSend')}
            </button>
            {mailTestResult && (
              <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${mailTestResult.ok ? 'border-positive/30 bg-positive-soft text-positive' : 'border-danger/30 bg-danger-soft text-danger'}`}>{mailTestResult.message}</span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Editierbare Status-Mail-Vorlagen (Welle 3-A): je Status Betreff + Text mit
          Platzhaltern. Review-before-send bleibt – nur der Text ist konfigurierbar. */}
      {hasStatusMail && (
        <SectionCard title={t('settings.statusmail.title')} subtitle={t('settings.statusmail.subtitle')}>
          <div className="rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info ring-1 ring-inset ring-info/20">
            {t('settings.statusmail.reviewNote')}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-chrome-400">
            <span>{t('settings.statusmail.placeholders')}</span>
            {STATUS_MAIL_PLATZHALTER.map((p) => (
              <code key={p} className="rounded bg-ink-900/60 px-1.5 py-0.5 font-mono text-[11px] text-chrome-200">{p}</code>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            {STATUS_MAIL_KEYS.map((k) => {
              const v = statusMailForm[k];
              const setV = (patch: Partial<StatusMailVorlageForm>) =>
                setStatusMailForm((f) => ({ ...f, [k]: { ...f[k], ...patch } }));
              const gepflegt = v.betreff.trim() !== '' || v.text.trim() !== '';
              return (
                <div key={k} className="rounded-xl border border-ink-700/60 bg-ink-800/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-chrome-100">{t(`settings.statusmail.status.${k}`)}</h4>
                    <button type="button" className="link-action text-xs disabled:opacity-40"
                      disabled={!gepflegt}
                      onClick={() => setV({ betreff: '', text: '' })}>
                      {t('settings.statusmail.reset')}
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="field">
                      <label className="label" htmlFor={`smBetreff-${k}`}>{t('settings.statusmail.subject')}</label>
                      <input id={`smBetreff-${k}`} className="input" maxLength={STATUS_MAIL_BETREFF_MAX}
                        value={v.betreff} onChange={(e) => setV({ betreff: e.target.value })}
                        placeholder={t('settings.statusmail.subjectPlaceholder')} />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`smText-${k}`}>{t('settings.statusmail.body')}</label>
                      <textarea id={`smText-${k}`} className="textarea" rows={4} maxLength={STATUS_MAIL_TEXT_MAX}
                        value={v.text} onChange={(e) => setV({ text: e.target.value })}
                        placeholder={t('settings.statusmail.bodyPlaceholder')} />
                    </div>
                  </div>
                  {!gepflegt && <p className="help mt-2">{t('settings.statusmail.defaultHint')}</p>}
                </div>
              );
            })}
          </div>
          <p className="help mt-3">{t('settings.statusmail.footerHint')}</p>
        </SectionCard>
      )}

      <SaveBar area="email" />
      </form>
      )}

      {bereich === 'buchhaltung' && (
      <form onSubmit={saveBuchhaltung} className="space-y-5 animate-fade-in">
      <SectionCard title={t('settings.datev.title')} subtitle={t('settings.datev.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label className="label" htmlFor="datevBeraterNr">{t('settings.datev.beraterNr')}</label><input id="datevBeraterNr" className="input" value={form.datevBeraterNr} onChange={(e) => set('datevBeraterNr', e.target.value)} placeholder={t('settings.datev.beraterNrPlaceholder')} /></div>
          <div className="field"><label className="label" htmlFor="datevMandantNr">{t('settings.datev.mandantNr')}</label><input id="datevMandantNr" className="input" value={form.datevMandantNr} onChange={(e) => set('datevMandantNr', e.target.value)} placeholder={t('settings.datev.mandantNrPlaceholder')} /></div>
          <div className="field"><label className="label" htmlFor="datevSkr">{t('settings.datev.skr')}</label><input id="datevSkr" className="input" value={form.datevSkr} onChange={(e) => set('datevSkr', e.target.value)} placeholder="03" /></div>
          <div className="field"><label className="label" htmlFor="datevDebitorSammelkonto">{t('settings.datev.debitor')}</label><input id="datevDebitorSammelkonto" className="input" value={form.datevDebitorSammelkonto} onChange={(e) => set('datevDebitorSammelkonto', e.target.value)} placeholder="1400" /></div>
          <div className="field"><label className="label" htmlFor="datevErloeskonto19">{t('settings.datev.erloes19')}</label><input id="datevErloeskonto19" className="input" value={form.datevErloeskonto19} onChange={(e) => set('datevErloeskonto19', e.target.value)} placeholder="8400" /></div>
          <div className="field"><label className="label" htmlFor="datevErloeskonto7">{t('settings.datev.erloes7')}</label><input id="datevErloeskonto7" className="input" value={form.datevErloeskonto7} onChange={(e) => set('datevErloeskonto7', e.target.value)} placeholder="8300" /></div>
          <div className="field"><label className="label" htmlFor="datevErloeskonto0">{t('settings.datev.erloes0')}</label><input id="datevErloeskonto0" className="input" value={form.datevErloeskonto0} onChange={(e) => set('datevErloeskonto0', e.target.value)} placeholder="8195" /></div>
        </div>
        <p className="help mt-3">{t('settings.datev.help')}</p>
      </SectionCard>

      <SectionCard title={t('settings.sevdesk.title')} subtitle={t('settings.sevdesk.subtitle')}>
        {sevdeskAllowed ? (
        <div className="space-y-4">
          <div className="field">
            <label className="label" htmlFor="sevdeskApiToken">{t('settings.sevdesk.apiToken')}</label>
            <input id="sevdeskApiToken" type="password" autoComplete="off" className="input" value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={form.sevdeskConfigured ? t('settings.sevdesk.tokenPlaceholderSet', { hint: form.sevdeskTokenHint }) : t('settings.sevdesk.tokenPlaceholder')} />
            <p className="help mt-1.5">{t('settings.sevdesk.help')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost btn-sm" disabled={!form.sevdeskConfigured || testing} onClick={testSevdesk} title={t('settings.sevdesk.testTitle')}>{testing ? t('settings.sevdesk.testing') : t('settings.sevdesk.test')}</button>
            {form.sevdeskConfigured && (<button type="button" className="link-danger text-sm disabled:opacity-50" onClick={removeSevdesk} disabled={saving}>{t('settings.sevdesk.remove')}</button>)}
            {testResult && (<span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${testResult.ok ? 'border-positive/30 bg-positive-soft text-positive' : 'border-danger/30 bg-danger-soft text-danger'}`}>{testResult.message}{testResult.companyName ? ` (${testResult.companyName})` : ''}</span>)}
          </div>
        </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-chrome-500">{t('settings.sevdesk.upgrade')}</p>
            <Link href="/abo" className="link-action text-sm">{t('common.toSubscription')} →</Link>
          </div>
        )}
      </SectionCard>

      <SaveBar area="buchhaltung" />
      </form>
      )}

      {/* Modale liegen ausserhalb der Bereichs-Formulare -> bereichsunabhaengig sichtbar. */}
      <ConfirmDialog
        open={confirmRemoveLogo}
        title={t('settings.branding.logoRemoveConfirmTitle')}
        message={t('settings.branding.logoRemoveConfirmMsg')}
        confirmLabel={t('settings.branding.logoRemove')}
        variant="danger"
        busy={uploadingLogo}
        onConfirm={removeLogoAction}
        onCancel={() => setConfirmRemoveLogo(false)}
      />

      <ConfirmDialog
        open={confirmTestMail}
        title={t('settings.mail.testSend')}
        message={
          <>
            {t('settings.mail.confirmMsgPre')}
            {form.mailConfig.fromEmail ? (<> (<span className="font-medium text-chrome-200">{form.mailConfig.fromEmail}</span>)</>) : ''}
            {t('settings.mail.confirmMsgPost')}
          </>
        }
        confirmLabel={t('settings.mail.testSend')}
        variant="neutral"
        busy={testingMail}
        onConfirm={runTestMail}
        onCancel={() => setConfirmTestMail(false)}
      />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ziele & Erinnerungen (nur Inhaber). Liest/schreibt settings.ziele ueber den
// bestehenden /tenants/me-Flow. §19-Schalter ist nur bei aktiver Kleinunternehmer-
// Regelung (settings.steuer) sinnvoll – sonst dezent ausgegraut mit Hinweis. Die
// Erinnerungen selbst erscheinen in der Glocke (NotificationBell), nichts geht
// nach aussen (Review-before-send).
function normTermin(tm: SteuerTermin): SteuerTermin {
  return {
    // Altbestand ohne id bekommt hier eine stabile id -> beim naechsten Speichern
    // persistiert; damit bleibt ein gesnoozter Termin nach Editieren gesnoozt.
    id: tm.id?.trim() ? tm.id.trim() : neueTerminId(),
    art: tm.art ?? '',
    datum: tm.datum ?? '',
    wiederkehrend: tm.wiederkehrend ?? false,
    aktiv: tm.aktiv ?? true,
  };
}

// Kundenkommunikation (Feature 1/2/3): Termin-Erinnerung, Bewertungs-Bitte und die
// automatischen Status-/Termin-Mails an einem Ort. Eigenstaendiger Tab (wie Ziele):
// laedt + speichert nur die eigenen Bloecke via PATCH /tenants/me – der Betrieb-Tab
// fasst diese Keys nicht mehr an (kein doppelter Besitzer).
function Kundenkommunikation() {
  const t = useT();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Feature 1: Termin-Erinnerung (Opt-in) + Vorlaufstunden (String fuers Feld).
  const [terminErinnerungAktiv, setTerminErinnerungAktiv] = useState(false);
  const [stundenVorlauf, setStundenVorlauf] = useState('24');
  // Feature 2: Bewertungs-Bitte (Opt-in) + Google-URL + optionaler Text.
  const [bewAktiv, setBewAktiv] = useState(false);
  const [bewUrl, setBewUrl] = useState('');
  const [bewText, setBewText] = useState('');
  // Feature 3 + Terminbestaetigung: bestehende Status-/Termin-Mails (Opt-out, Default an).
  const [statusMails, setStatusMails] = useState(true);
  const [terminBestaetigung, setTerminBestaetigung] = useState(true);
  // Welle 2-B (Teil 1): Nachfass-Schwelle (Tage). String fuers Feld. Backward-compat:
  // nur mitschreiben, wenn das GET den Block lieferte (aelteres Backend ohne nachfass).
  const [nachfassTage, setNachfassTage] = useState('7');
  const [hasNachfass, setHasNachfass] = useState(false);

  const apply = useCallback((data: TenantProfile) => {
    const kk = data.kundenkommunikation ?? KK_DEFAULTS;
    setTerminErinnerungAktiv(kk.terminErinnerungAktiv ?? false);
    setStundenVorlauf(String(kk.stundenVorlauf ?? 24));
    const bew = data.bewertung ?? BEW_DEFAULTS;
    setBewAktiv(bew.aktiv ?? false);
    setBewUrl(bew.googleUrl ?? '');
    setBewText(bew.text ?? '');
    setStatusMails((data.kundenmailStatus ?? '1') !== '0');
    setTerminBestaetigung((data.kundenmailTerminbestaetigung ?? '1') !== '0');
    setHasNachfass(data.nachfass !== undefined);
    setNachfassTage(String((data.nachfass ?? NACHFASS_DEFAULTS).tageOffen ?? 7));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TenantProfile>('/tenants/me');
      apply(data);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : t('settings.error.loadFailed')); }
    finally { setLoading(false); }
  }, [apply, t]);
  useEffect(() => { load(); }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const url = bewUrl.trim();
    // Bewertungs-Link muss (wenn gesetzt) mit https:// beginnen – er landet in einer Kunden-Mail.
    if (url && !BEW_URL_RE.test(url)) { setError(t('settings.kk.error.url')); return; }
    let vorlauf = parseInt(stundenVorlauf, 10);
    if (!Number.isFinite(vorlauf)) vorlauf = 24;
    vorlauf = Math.min(KK_VORLAUF_MAX, Math.max(KK_VORLAUF_MIN, vorlauf));
    let tage = parseInt(nachfassTage, 10);
    if (!Number.isFinite(tage)) tage = NACHFASS_DEFAULTS.tageOffen;
    tage = Math.min(NACHFASS_TAGE_MAX, Math.max(NACHFASS_TAGE_MIN, tage));
    setSaving(true);
    try {
      const data = await api.patch<TenantProfile>('/tenants/me', {
        kundenkommunikation: { terminErinnerungAktiv, stundenVorlauf: vorlauf },
        bewertung: { aktiv: bewAktiv, googleUrl: url, text: bewText.trim() },
        kundenmailStatus: statusMails ? '1' : '0',
        kundenmailTerminbestaetigung: terminBestaetigung ? '1' : '0',
        // Nur mitschreiben, wenn das GET den Block lieferte (forbidNonWhitelisted-safe).
        ...(hasNachfass ? { nachfass: { tageOffen: tage } } : {}),
      });
      apply(data);
      toast(t('settings.toast.saved'));
    } catch (err) { setError(err instanceof Error ? err.message : t('settings.error.saveFailed')); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && <ErrorBox message={error} />}

          <div>
            <h2 className="font-display text-lg font-semibold text-chrome-50">{t('settings.kk.intro.title')}</h2>
            <p className="mt-1 text-sm text-chrome-400">{t('settings.kk.intro.subtitle')}</p>
          </div>

          <div className="rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info ring-1 ring-inset ring-info/20">
            {t('settings.kk.reviewNote')}
          </div>

          {/* Feature 1: Termin-Erinnerung (Opt-in) */}
          <SectionCard title={t('settings.kk.reminder.title')} subtitle={t('settings.kk.reminder.subtitle')}>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm text-chrome-200">{t('settings.kk.reminder.toggle')}</span>
                <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.kk.reminder.toggleHint')}</span>
              </span>
              <input type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                checked={terminErinnerungAktiv} onChange={(e) => setTerminErinnerungAktiv(e.target.checked)} />
            </label>
            {terminErinnerungAktiv && (
              <div className="field mt-4 max-w-[14rem]">
                <label className="label" htmlFor="stundenVorlauf">{t('settings.kk.reminder.hoursLabel')}</label>
                <input id="stundenVorlauf" className="input" type="number" min={KK_VORLAUF_MIN} max={KK_VORLAUF_MAX} step={1} inputMode="numeric"
                  value={stundenVorlauf} onChange={(e) => setStundenVorlauf(e.target.value)} />
                <p className="help mt-1.5">{t('settings.kk.reminder.hoursHelp')}</p>
              </div>
            )}
          </SectionCard>

          {/* Welle 2-B (Teil 1): Angebots-Nachfassen (In-App-Vorschlag, KEIN Auto-Versand) */}
          <SectionCard title={t('settings.kk.nachfass.title')} subtitle={t('settings.kk.nachfass.subtitle')}>
            <div className="field max-w-[14rem]">
              <label className="label" htmlFor="nachfassTage">{t('settings.kk.nachfass.daysLabel')}</label>
              <input id="nachfassTage" className="input" type="number" min={NACHFASS_TAGE_MIN} max={NACHFASS_TAGE_MAX} step={1} inputMode="numeric"
                value={nachfassTage} onChange={(e) => setNachfassTage(e.target.value)} />
              <p className="help mt-1.5">{t('settings.kk.nachfass.daysHelp')}</p>
            </div>
          </SectionCard>

          {/* Feature 2: Bewertungs-Bitte (Opt-in) */}
          <SectionCard title={t('settings.kk.review.title')} subtitle={t('settings.kk.review.subtitle')}>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm text-chrome-200">{t('settings.kk.review.toggle')}</span>
                <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.kk.review.toggleHint')}</span>
              </span>
              <input type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                checked={bewAktiv} onChange={(e) => setBewAktiv(e.target.checked)} />
            </label>
            {bewAktiv && (
              <div className="mt-4 space-y-4">
                <div className="field">
                  <label className="label" htmlFor="bewUrl">{t('settings.kk.review.urlLabel')}</label>
                  <input id="bewUrl" className="input" type="url" inputMode="url" maxLength={300}
                    value={bewUrl} onChange={(e) => setBewUrl(e.target.value)}
                    placeholder={t('settings.kk.review.urlPlaceholder')} />
                  <p className="help mt-1.5">{t('settings.kk.review.urlHelp')}</p>
                </div>
                <div className="field">
                  <label className="label" htmlFor="bewText">{t('settings.kk.review.textLabel')}</label>
                  <input id="bewText" className="input" maxLength={300}
                    value={bewText} onChange={(e) => setBewText(e.target.value)}
                    placeholder={t('settings.kk.review.textPlaceholder')} />
                  <p className="help mt-1.5">{t('settings.kk.review.textHelp')}</p>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Feature 3 + Terminbestaetigung: bestehende automatische Mails (Opt-out) */}
          <SectionCard title={t('settings.notify.title')} subtitle={t('settings.notify.subtitle')}>
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-sm text-chrome-200">{t('settings.notify.status')}</span>
                  <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.notify.statusHint')}</span>
                </span>
                <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                  checked={statusMails} onChange={(e) => setStatusMails(e.target.checked)} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-sm text-chrome-200">{t('settings.notify.appointment')}</span>
                  <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.notify.appointmentHint')}</span>
                </span>
                <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                  checked={terminBestaetigung} onChange={(e) => setTerminBestaetigung(e.target.checked)} />
              </label>
            </div>
          </SectionCard>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (<><span className="spinner" />{t('settings.saving')}</>) : t('common.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Ziele() {
  const t = useT();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auslastungAktiv, setAuslastungAktiv] = useState(false);
  const [zielProzent, setZielProzent] = useState('90');
  const [par19Aktiv, setPar19Aktiv] = useState(false);
  // Kleinunternehmer-Status (aus settings.steuer) – nur lesend, gated den §19-Schalter.
  const [kleinunternehmer, setKleinunternehmer] = useState(false);
  const [termine, setTermine] = useState<SteuerTermin[]>([]);

  const apply = useCallback((data: TenantProfile) => {
    const z = data.ziele ?? ZIELE_DEFAULTS;
    setAuslastungAktiv(z.auslastungAktiv ?? false);
    setZielProzent(String(z.auslastungZielProzent ?? 90));
    setPar19Aktiv(z.par19WarnungAktiv ?? false);
    setTermine(Array.isArray(z.steuerTermine) ? z.steuerTermine.map(normTermin) : []);
    setKleinunternehmer(data.steuer?.kleinunternehmer ?? false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TenantProfile>('/tenants/me');
      apply(data);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : t('settings.error.loadFailed')); }
    finally { setLoading(false); }
  }, [apply, t]);
  useEffect(() => { load(); }, [load]);

  function addTermin() {
    setTermine((ts) => (ts.length >= ZIELE_TERMINE_MAX ? ts : [...ts, { id: neueTerminId(), art: '', datum: '', wiederkehrend: true, aktiv: true }]));
  }
  function updateTermin(i: number, patch: Partial<SteuerTermin>) {
    setTermine((ts) => ts.map((tm, idx) => (idx === i ? { ...tm, ...patch } : tm)));
  }
  function removeTermin(i: number) {
    setTermine((ts) => ts.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Nur befuellte Termine speichern; Datum je nach Modus validieren (spiegelt die
    // client-seitige Nudge-Mathematik: wiederkehrend MM-TT, einmalig JJJJ-MM-TT).
    const cleaned = termine
      .map((tm) => ({ ...tm, art: tm.art.trim(), datum: tm.datum.trim() }))
      .filter((tm) => tm.art || tm.datum);
    for (const tm of cleaned) {
      const ok = tm.wiederkehrend ? DATUM_REC_RE.test(tm.datum) : DATUM_ONCE_RE.test(tm.datum);
      if (!ok) { setError(t('settings.ziele.error.datum')); return; }
    }
    let prozent = parseInt(zielProzent, 10);
    if (!Number.isFinite(prozent)) prozent = 90;
    prozent = Math.min(100, Math.max(50, prozent));
    setSaving(true);
    try {
      const data = await api.patch<TenantProfile>('/tenants/me', {
        ziele: {
          auslastungAktiv,
          auslastungZielProzent: prozent,
          par19WarnungAktiv: par19Aktiv,
          steuerTermine: cleaned,
        },
      });
      apply(data);
      toast(t('settings.toast.saved'));
    } catch (err) { setError(err instanceof Error ? err.message : t('settings.error.saveFailed')); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && <ErrorBox message={error} />}

          <div>
            <h2 className="font-display text-lg font-semibold text-chrome-50">{t('settings.ziele.intro.title')}</h2>
            <p className="mt-1 text-sm text-chrome-400">{t('settings.ziele.intro.subtitle')}</p>
          </div>

          {/* Auslastungsziel (Welle 2): Toggle + Zielprozent. Der Nudge selbst
              erscheint in der Glocke (NotificationBell) und vergleicht die reale
              Wochen-Auslastung der Plantafel mit diesem Ziel. */}
          <SectionCard title={t('settings.ziele.auslastung.title')} subtitle={t('settings.ziele.auslastung.subtitle')}>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm text-chrome-200">{t('settings.ziele.auslastung.toggle')}</span>
                <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.ziele.auslastung.toggleHint')}</span>
              </span>
              <input type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                checked={auslastungAktiv} onChange={(e) => setAuslastungAktiv(e.target.checked)} />
            </label>
            {auslastungAktiv && (
              <div className="field mt-4 max-w-[12rem]">
                <label className="label" htmlFor="auslastungZiel">{t('settings.ziele.auslastung.prozentLabel')}</label>
                <input id="auslastungZiel" className="input" type="number" min={50} max={100} step={1} inputMode="numeric"
                  value={zielProzent} onChange={(e) => setZielProzent(e.target.value)} />
                <p className="help mt-1.5">{t('settings.ziele.auslastung.prozentHelp')}</p>
              </div>
            )}
          </SectionCard>

          {/* §19-Umsatzgrenzen-Warnung – nur sinnvoll bei aktiver Kleinunternehmer-Regelung */}
          <SectionCard title={t('settings.ziele.par19.title')} subtitle={t('settings.ziele.par19.subtitle')}>
            <label className={`flex items-center justify-between gap-4 ${kleinunternehmer ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
              <span className="min-w-0">
                <span className="block text-sm text-chrome-200">{t('settings.ziele.par19.toggle')}</span>
                <span className="mt-0.5 block text-xs text-chrome-500">{t('settings.ziele.par19.toggleHint')}</span>
              </span>
              <input type="checkbox" disabled={!kleinunternehmer}
                className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40 disabled:opacity-50"
                checked={par19Aktiv && kleinunternehmer} onChange={(e) => setPar19Aktiv(e.target.checked)} />
            </label>
            {!kleinunternehmer && (
              <p className="mt-3 rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info ring-1 ring-inset ring-info/20">
                {t('settings.ziele.par19.disabledHint')}
              </p>
            )}
          </SectionCard>

          {/* Steuer-Termine (max 12) – editierbare Liste */}
          <SectionCard title={t('settings.ziele.termine.title')} subtitle={t('settings.ziele.termine.subtitle')}>
            <div className="rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info ring-1 ring-inset ring-info/20">
              {t('settings.ziele.termine.disclaimer')}
            </div>

            {termine.length === 0 ? (
              <p className="mt-4 text-sm text-chrome-500">{t('settings.ziele.termine.empty')}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {termine.map((tm, i) => (
                  <div key={i} className="rounded-xl border border-ink-700/60 bg-ink-800/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="field">
                        <label className="label" htmlFor={`terminArt${i}`}>{t('settings.ziele.termine.artLabel')}</label>
                        <input id={`terminArt${i}`} className="input" maxLength={60} value={tm.art}
                          onChange={(e) => updateTermin(i, { art: e.target.value })}
                          placeholder={t('settings.ziele.termine.artPlaceholder')} />
                      </div>
                      <div className="field">
                        <label className="label" htmlFor={`terminDatum${i}`}>{t('settings.ziele.termine.datumLabel')}</label>
                        <input id={`terminDatum${i}`} className="input" maxLength={10} inputMode="numeric" value={tm.datum}
                          onChange={(e) => updateTermin(i, { datum: e.target.value.replace(/[^\d-]/g, '') })}
                          placeholder={tm.wiederkehrend ? t('settings.ziele.termine.datumPlaceholderRec') : t('settings.ziele.termine.datumPlaceholderOnce')} />
                      </div>
                    </div>
                    <p className="help mt-1.5">{t('settings.ziele.termine.datumHelp')}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
                        <input type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                          checked={tm.wiederkehrend} onChange={(e) => updateTermin(i, { wiederkehrend: e.target.checked })} />
                        {t('settings.ziele.termine.wiederkehrend')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
                        <input type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                          checked={tm.aktiv} onChange={(e) => updateTermin(i, { aktiv: e.target.checked })} />
                        {t('settings.ziele.termine.aktiv')}
                      </label>
                      <button type="button" className="link-danger ms-auto text-sm" onClick={() => removeTermin(i)}>
                        {t('settings.ziele.termine.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="btn-ghost btn-sm" onClick={addTermin} disabled={termine.length >= ZIELE_TERMINE_MAX}>
                {t('settings.ziele.termine.add')}
              </button>
              {termine.length >= ZIELE_TERMINE_MAX && (
                <span className="text-xs text-chrome-500">{t('settings.ziele.termine.max')}</span>
              )}
            </div>
          </SectionCard>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (<><span className="spinner" />{t('settings.saving')}</>) : t('common.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
