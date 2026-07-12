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

// Betriebseigener Mail-Absender – Lese-Sicht (spiegelt MailConfigView im Backend).
// Enthaelt NIE das Passwort: passSet zeigt nur, OB eines hinterlegt ist, passHint
// ist eine reine Maske. Geschrieben wird write-only ueber mailConfig.pass.
interface MailConfigView {
  enabled: boolean; host: string; port: number; secure: boolean;
  user: string; fromEmail: string; fromName: string;
  passSet: boolean; passHint: string;
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
// Speichern der Arbeitszeiten schaltet den Slot-Picker des Portals frei.
type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
const WOCHENTAGE: Wochentag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
interface Arbeitszeit { von: string; bis: string; aktiv: boolean; }
interface KalenderSettings {
  arbeitszeiten: Record<Wochentag, Arbeitszeit>;
  slotDauerMin: number;
  pufferMin: number;
}
interface BuchungSettings { vorlaufMinStunden: number; vorlaufMaxTage: number; }
function defaultArbeitszeiten(): Record<Wochentag, Arbeitszeit> {
  const wt = (aktiv: boolean): Arbeitszeit => ({ von: '08:00', bis: '18:00', aktiv });
  return { mo: wt(true), di: wt(true), mi: wt(true), do: wt(true), fr: wt(true), sa: wt(false), so: wt(false) };
}
const KALENDER_DEFAULTS: KalenderSettings = { arbeitszeiten: defaultArbeitszeiten(), slotDauerMin: 30, pufferMin: 0 };
const BUCHUNG_DEFAULTS: BuchungSettings = { vorlaufMinStunden: 24, vorlaufMaxTage: 60 };

// Stammdaten-Profil (flach) – passt zum Backend GET/PATCH /tenants/me.
interface TenantProfile {
  name: string; betriebstyp: Betriebstyp;
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
  sevdeskConfigured: boolean; sevdeskTokenHint: string;
  // Mail-Versand (eigenes SMTP) + Mahnwesen: verschachtelte Objekte. Gleiche
  // Backward-Compat-Logik wie oben – nur mitschreiben, wenn das GET sie lieferte.
  mailConfig: MailConfigView;
  mahnwesen: MahnwesenConfig;
  // EUR/qm-Basissaetze der 3D-Sofortkalkulation. Gleiche Backward-Compat-Logik:
  // nur mitschreiben, wenn das GET den Block lieferte (hasKalkulation).
  kalkulation: KalkulationConfig;
  // Kalender & Online-Buchung (W2): Arbeitszeiten + Slot-Raster (kalender) und
  // Portal-Vorlauf (buchung). Gleiche Backward-Compat-Logik wie oben.
  kalender: KalenderSettings;
  buchung: BuchungSettings;
}
const LEER: TenantProfile = {
  name: '', betriebstyp: 'komplett',
  email: '', phone: '', street: '', postalCode: '', city: '', country: 'DE',
  steuernummer: '', ustId: '', iban: '', bic: '', bankname: '',
  datevBeraterNr: '', datevMandantNr: '', datevSkr: '03',
  datevErloeskonto19: '8400', datevErloeskonto7: '8300', datevErloeskonto0: '8195', datevDebitorSammelkonto: '1400',
  rechnungZahlungszielTage: '', rechnungFusstext: '',
  rechnungPaymentLink: '',
  kundenmailStatus: '1', kundenmailTerminbestaetigung: '1',
  sevdeskConfigured: false, sevdeskTokenHint: '',
  mailConfig: MAIL_DEFAULTS,
  mahnwesen: MAHN_DEFAULTS,
  kalkulation: KALK_DEFAULTS,
  kalender: KALENDER_DEFAULTS,
  buchung: BUCHUNG_DEFAULTS,
};

type Tab = 'darstellung' | 'profil' | 'betrieb' | 'audit';

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
      {tab === 'audit' && zeigeAudit && <AuditLogPanel />}
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
    </div>
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
const NEUE_SETTINGS_KEYS = ['rechnungPaymentLink', 'kundenmailStatus', 'kundenmailTerminbestaetigung'] as const;

// Editierbare Form der Mail-/Mahn-Bloecke: Zahlen als String, damit Felder waehrend
// der Eingabe leerbar bleiben (Parsing/Validierung erst beim Speichern).
interface MailForm { enabled: boolean; host: string; port: string; secure: boolean; user: string; fromEmail: string; fromName: string; }
interface MahnForm { autoMahnen: boolean; erinnerung: string; mahnung1: string; mahnung2: string; gebuehr1: string; gebuehr2: string; }
// EUR/qm-Saetze als String, damit Felder waehrend der Eingabe leerbar bleiben.
interface KalkForm { folierung: string; ppf: string; aufbereitung: string; }
const MAIL_FORM_LEER: MailForm = { enabled: false, host: '', port: '587', secure: false, user: '', fromEmail: '', fromName: '' };
const MAHN_FORM_LEER: MahnForm = { autoMahnen: false, erinnerung: '7', mahnung1: '14', mahnung2: '28', gebuehr1: '0', gebuehr2: '0' };
const KALK_FORM_LEER: KalkForm = { folierung: '60', ppf: '130', aufbereitung: '25' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toIntOr = (s: string, def: number) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : def; };
const toEuro = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0; };

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
  // Mail-Versand (eigenes SMTP): editierbare Form + write-only-Passwort separat.
  const [mailForm, setMailForm] = useState<MailForm>(MAIL_FORM_LEER);
  const [mailPass, setMailPass] = useState('');
  const [mailPassSet, setMailPassSet] = useState(false);
  const [hasMailConfig, setHasMailConfig] = useState(true);
  const [confirmTestMail, setConfirmTestMail] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [mailTestResult, setMailTestResult] = useState<{ ok: boolean; message: string } | null>(null);
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
  const [hasKalender, setHasKalender] = useState(true);
  const [hasBuchung, setHasBuchung] = useState(true);
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
      user: mc.user, fromEmail: mc.fromEmail, fromName: mc.fromName,
    });
    setMailPassSet(mc.passSet ?? false);
    setMailPass('');
    setMailTestResult(null);
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
    setHasBuchung(data.buchung !== undefined);
    const bu = data.buchung ?? BUCHUNG_DEFAULTS;
    setVorlaufMinForm(String(bu.vorlaufMinStunden ?? BUCHUNG_DEFAULTS.vorlaufMinStunden));
    setVorlaufMaxForm(String(bu.vorlaufMaxTage ?? BUCHUNG_DEFAULTS.vorlaufMaxTage));
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
    // Mail-Versand spiegeln: nur bei aktivem eigenem Versand sind Host/Port/From Pflicht.
    if (hasMailConfig && mailForm.enabled) {
      const port = toIntOr(mailForm.port, NaN);
      if (!mailForm.host.trim()) { setError(t('settings.error.mailHostRequired')); return; }
      if (!Number.isInteger(port) || port < 1 || port > 65535) { setError(t('settings.error.mailPortRange')); return; }
      if (!EMAIL_RE.test(mailForm.fromEmail.trim())) { setError(t('settings.error.mailFromInvalid')); return; }
    }
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
    setSaving(true);
    try {
      const { sevdeskConfigured, sevdeskTokenHint, mailConfig, mahnwesen, kalkulation, kalender, buchung, ...editable } = form;
      const payload: Record<string, unknown> = { ...editable };
      // Neue Keys nur senden, wenn das Backend sie kennt (s. NEUE_SETTINGS_KEYS).
      for (const k of NEUE_SETTINGS_KEYS) {
        if (!bekannteKeys.includes(k)) delete payload[k];
      }
      if (tokenInput.trim()) payload.sevdeskApiToken = tokenInput.trim();
      // Mahnwesen als verschachteltes Teil-Objekt (nur wenn Backend es kennt).
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
        };
        if (mailPass) mc.pass = mailPass;
        payload.mailConfig = mc;
      }
      // Kalkulation (EUR/qm) als top-level Block – nur wenn Backend ihn kennt.
      if (hasKalkulation) {
        payload.kalkulation = {
          folierungProQm: toEuro(kalkForm.folierung),
          ppfProQm: toEuro(kalkForm.ppf),
          aufbereitungProQm: toEuro(kalkForm.aufbereitung),
        };
      }
      // Kalender & Online-Buchung (W2): Teil-Update – konfliktverhalten/
      // standortKonflikt werden hier bewusst NICHT angefasst (bleiben erhalten).
      // Das Speichern der Arbeitszeiten schaltet den Slot-Picker des Portals frei.
      if (hasKalender) {
        payload.kalender = {
          arbeitszeiten: azForm,
          slotDauerMin: toIntOr(slotDauerForm, 30),
          pufferMin: toIntOr(pufferForm, 0),
        };
      }
      if (hasBuchung) {
        payload.buchung = {
          vorlaufMinStunden: toIntOr(vorlaufMinForm, 24),
          vorlaufMaxTage: toIntOr(vorlaufMaxForm, 60),
        };
      }
      const data = await api.patch<TenantProfile>('/tenants/me', payload);
      apply(data); setTokenInput(''); setTestResult(null);
      toast(t('settings.toast.saved'));
      applyBranche(data.betriebstyp); // Branchen-Look sofort umschalten
    } catch (err) { setError(err instanceof Error ? err.message : t('settings.error.saveFailed')); }
    finally { setSaving(false); }
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

  const QuickLink = ({ href, title, text }: { href: string; title: string; text: string }) => (
    <Link href={href} className="choice flex flex-col gap-0.5 p-4">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-chrome-100">
        {title}
        <span aria-hidden className="text-chrome-500">→</span>
      </span>
      <span className="text-xs text-chrome-500">{text}</span>
    </Link>
  );

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
        <form onSubmit={onSubmit} className="space-y-5">
      {error && <ErrorBox message={error} />}

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
                className={`choice flex items-start gap-3 p-3.5 text-left ${aktivTyp ? 'choice-active' : ''}`}
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

      <SectionCard title={t('settings.tax.title')} subtitle={t('settings.tax.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label className="label" htmlFor="steuernummer">{t('settings.tax.steuernummer')}</label><input id="steuernummer" className="input" value={form.steuernummer} onChange={(e) => set('steuernummer', e.target.value)} placeholder={t('settings.tax.steuernummerPlaceholder')} /></div>
          <div className="field"><label className="label" htmlFor="ustId">{t('settings.tax.ustId')}</label><input id="ustId" className="input" value={form.ustId} onChange={(e) => set('ustId', e.target.value)} placeholder={t('settings.tax.ustIdPlaceholder')} /></div>
        </div>
      </SectionCard>

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

      <SectionCard title={t('settings.notify.title')} subtitle={t('settings.notify.subtitle')}>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">{t('settings.notify.status')}</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                {t('settings.notify.statusHint')}
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={form.kundenmailStatus !== '0'}
              onChange={(e) => set('kundenmailStatus', e.target.checked ? '1' : '0')} />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">{t('settings.notify.appointment')}</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                {t('settings.notify.appointmentHint')}
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={form.kundenmailTerminbestaetigung !== '0'}
              onChange={(e) => set('kundenmailTerminbestaetigung', e.target.checked ? '1' : '0')} />
          </label>
        </div>
      </SectionCard>

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
          </div>

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

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (<><span className="spinner" />{t('settings.saving')}</>) : t('common.save')}
        </button>
      </div>

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
        </form>
      )}
    </div>
  );
}
