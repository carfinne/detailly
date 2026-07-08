'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, absoluteApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/labels';
import { applyBranche, BETRIEBSTYP_META, type Betriebstyp } from '@/lib/branche';
import { INHABER_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import { PageHeader, Loading, ErrorBox, SectionCard, Row, ConfirmDialog, useToast } from '@/components/ui';

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
};

type Tab = 'darstellung' | 'profil' | 'betrieb';

export default function EinstellungenPage() {
  const { user } = useAuth();
  const istInhaber = !!user && INHABER_ROLLEN.includes(user.role);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'darstellung', label: 'Darstellung' },
    { key: 'profil', label: 'Profil' },
    ...(istInhaber ? [{ key: 'betrieb' as Tab, label: 'Betrieb' }] : []),
  ];
  const [tab, setTab] = useState<Tab>('darstellung');

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Darstellung, Profil und – als Inhaber – die Betriebsdaten." />

      <div className="seg-group mb-5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`seg ${tab === t.key ? 'seg-active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'darstellung' && <Darstellung />}
      {tab === 'profil' && <Profil />}
      {tab === 'betrieb' && istInhaber && <Betrieb />}
    </>
  );
}

// ---------------------------------------------------------------------------
function Darstellung() {
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
  function chooseTheme(t: 'dark' | 'light') {
    setTheme(t);
    try { localStorage.setItem('detailly_theme', t); } catch { /* ignore */ }
    const d = document.documentElement;
    if (t === 'light') d.setAttribute('data-theme', 'light');
    else d.removeAttribute('data-theme');
  }
  const themeBtn = (t: 'dark' | 'light', label: string) => (
    <button
      onClick={() => chooseTheme(t)}
      className={`choice px-4 py-2 text-sm font-medium ${theme === t ? 'choice-active' : ''}`}
    >
      {label}
    </button>
  );
  return (
    <div className="max-w-2xl space-y-5">
      <SectionCard title="Erscheinungsbild" subtitle="Wie Detailly für dich aussieht.">
        <label className="label mb-1.5 block">Farbschema</label>
        <div className="flex gap-2">
          {themeBtn('dark', 'Dunkel')}
          {themeBtn('light', 'Hell')}
        </div>
        <p className="help mt-2">Gilt nur auf diesem Gerät und in diesem Browser.</p>
      </SectionCard>

      <SectionCard title="Bewegung" subtitle="Animationen reduzieren – ruhiger und schonender.">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm text-chrome-200">Animationen reduzieren</span>
          <input type="checkbox" className="h-5 w-5 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40" checked={reduce} onChange={(e) => toggle(e.target.checked)} />
        </label>
        <p className="help mt-2">Diese Einstellung gilt nur auf diesem Gerät und in diesem Browser.</p>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Profil() {
  const { user, refresh } = useAuth();
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
      toast('Gespeichert');
    } catch (err) { setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen'); }
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
      <SectionCard title="Mein Profil" subtitle="Name und Telefonnummer kannst du selbst pflegen.">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ErrorBox message={error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label className="label" htmlFor="profilVorname">Vorname</label><input id="profilVorname" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
            <div className="field"><label className="label" htmlFor="profilNachname">Nachname</label><input id="profilNachname" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
            <div className="field sm:col-span-2"><label className="label" htmlFor="profilTelefon">Telefon (optional)</label><input id="profilTelefon" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (<><span className="spinner" />Speichern…</>) : 'Speichern'}
            </button>
          </div>
        </form>
        <div className="mt-5 border-t border-ink-700/50 pt-2">
          <Row label="E-Mail" value={user?.email ?? '–'} />
          <Row label="Rolle" value={user ? ROLE_LABEL[user.role] ?? user.role : '–'} />
        </div>
        <p className="help mt-2">E-Mail-Adresse und Rolle ändert die Betriebsleitung über die Mitarbeiter-Verwaltung.</p>
      </SectionCard>

      <SectionCard title="Passwort" subtitle="Passwort über einen sicheren Link per E-Mail ändern.">
        {sent ? (
          <div className="flex items-center gap-2 rounded-xl border border-positive/30 bg-positive-soft px-3 py-2.5 text-sm text-positive">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Wir haben dir eine E-Mail zum Zurücksetzen geschickt.
          </div>
        ) : (
          <button className="btn-ghost" onClick={changePw} disabled={busy}>{busy ? 'Sende…' : 'Passwort ändern'}</button>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
function KalenderAbo() {
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
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => copy(url, k)}>{copied === k ? 'Kopiert ✓' : 'Kopieren'}</button>
      </div>
    </div>
  );

  return (
    <SectionCard title="Kalender-Abo (Apple / Google)" subtitle="Alle Termine automatisch im eigenen Kalender – über einen geheimen Abo-Link, der sich selbst aktualisiert.">
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <UrlRow label="Apple Kalender (webcal)" url={webcalUrl} k="apple" />
          <UrlRow label="Google / andere (https)" url={httpsUrl} k="google" />
          <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-3 text-xs leading-relaxed text-chrome-400">
            <p><span className="font-semibold text-chrome-200">Apple Kalender:</span> Ablage → „Neues Kalenderabo…" → den webcal-Link einfügen.</p>
            <p className="mt-1"><span className="font-semibold text-chrome-200">Google Kalender:</span> Andere Kalender → „Per URL hinzufügen" → den https-Link einfügen.</p>
            <p className="mt-2 text-chrome-500">Der Link ist geheim und gewährt Lesezugriff auf die Termine – nur an Vertraute weitergeben.</p>
          </div>
          <button type="button" className="link-danger text-sm disabled:opacity-50" onClick={() => setConfirmRegen(true)} disabled={busy}>
            {busy ? 'Erzeuge…' : 'Link neu generieren (alten ungültig machen)'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRegen}
        title="Kalender-Link neu erzeugen"
        message="Es wird ein neuer geheimer Abo-Link erzeugt. Der bisherige Link wird dadurch ungültig – bestehende Kalender-Abos müssen mit dem neuen Link neu eingerichtet werden."
        confirmLabel="Neu erzeugen"
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
  const t = useT();

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
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TenantProfile>('/tenants/me');
      apply(data);
      setError('');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Stammdaten konnten nicht geladen werden'); }
    finally { setLoading(false); }
  }, [apply]);
  useEffect(() => { load(); }, [load]);

  function set<K extends keyof TenantProfile>(key: K, value: string) { setForm((f) => ({ ...f, [key]: value })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Mahnfristen felduebergreifend spiegeln (Backend: streng aufsteigend, 1..365).
    if (hasMahnwesen) {
      const fr = [toIntOr(mahnForm.erinnerung, NaN), toIntOr(mahnForm.mahnung1, NaN), toIntOr(mahnForm.mahnung2, NaN)];
      if (!fr.every((n) => Number.isInteger(n) && n >= 1 && n <= 365)) {
        setError('Mahnfristen müssen ganze Zahlen zwischen 1 und 365 Tagen sein.'); return;
      }
      if (!(fr[0] < fr[1] && fr[1] < fr[2])) {
        setError('Mahnfristen müssen aufsteigend sein (Erinnerung < 1. Mahnung < 2. Mahnung).'); return;
      }
    }
    // Mail-Versand spiegeln: nur bei aktivem eigenem Versand sind Host/Port/From Pflicht.
    if (hasMailConfig && mailForm.enabled) {
      const port = toIntOr(mailForm.port, NaN);
      if (!mailForm.host.trim()) { setError('Für den eigenen Mail-Versand ist ein SMTP-Host erforderlich.'); return; }
      if (!Number.isInteger(port) || port < 1 || port > 65535) { setError('Der SMTP-Port muss zwischen 1 und 65535 liegen.'); return; }
      if (!EMAIL_RE.test(mailForm.fromEmail.trim())) { setError('Bitte eine gültige Absender-Adresse (From) angeben.'); return; }
    }
    setSaving(true);
    try {
      const { sevdeskConfigured, sevdeskTokenHint, mailConfig, mahnwesen, kalkulation, ...editable } = form;
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
      const data = await api.patch<TenantProfile>('/tenants/me', payload);
      apply(data); setTokenInput(''); setTestResult(null);
      toast('Gespeichert');
      applyBranche(data.betriebstyp); // Branchen-Look sofort umschalten
    } catch (err) { setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  async function runTestMail() {
    setTestingMail(true); setMailTestResult(null);
    try {
      const r = await api.post<{ ok: boolean; message: string }>('/tenants/me/mail/test');
      setMailTestResult(r);
      if (r.ok) toast(r.message, { variant: 'positive' });
    } catch (err) {
      setMailTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test fehlgeschlagen' });
    } finally { setTestingMail(false); setConfirmTestMail(false); }
  }
  async function testSevdesk() {
    setTesting(true); setTestResult(null);
    try { const r = await api.post<{ ok: boolean; message: string; companyName?: string }>('/tenants/me/sevdesk/test'); setTestResult(r); }
    catch (err) { setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test fehlgeschlagen' }); }
    finally { setTesting(false); }
  }
  async function removeSevdesk() {
    setSaving(true); setError('');
    try { const data = await api.patch<TenantProfile>('/tenants/me', { sevdeskApiToken: '' }); setForm({ ...LEER, ...data }); setTokenInput(''); setTestResult(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen'); }
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
      <SectionCard title="Verwaltung" subtitle="Direkt zu den betrieblichen Bereichen.">
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink href="/mitarbeiter/" title="Mitarbeiter & Rollen" text="Team anlegen, Rollen und Zugänge verwalten." />
          <QuickLink href="/standorte/" title="Standorte" text="Filialen pflegen und standortübergreifend auswerten." />
          <QuickLink href="/leistungen/" title="Leistungen & Preise" text="Eigenen Leistungskatalog und Preise pflegen." />
          <QuickLink href="/abo/" title="Abo & Tarif" text="Detailly-Tarif einsehen und verwalten." />
        </div>
      </SectionCard>

      <KalenderAbo />
      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
      {error && <ErrorBox message={error} />}

      <SectionCard
        title="Betriebstyp & Branchen-Look"
        subtitle="Bestimmt Akzentfarbe, Kalkulations-Katalog und typspezifische Optionen."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(BETRIEBSTYP_META) as Betriebstyp[]).map((typ) => {
            const meta = BETRIEBSTYP_META[typ];
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
                    {meta.label}
                  </span>
                  <span className="block text-xs text-chrome-500">{meta.beschreibung}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="help mt-3">
          Der Look (Akzentfarbe) wechselt nach dem Speichern sofort für alle Mitarbeiter des Betriebs.
        </p>
      </SectionCard>

      <SectionCard title="Betrieb & Anschrift" subtitle="Name und Adresse des Betriebs">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2"><label className="label" htmlFor="name">Betriebsname</label><input id="name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
          <div className="field"><label className="label" htmlFor="email">E-Mail</label><input id="email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="phone">Telefon</label><input id="phone" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field sm:col-span-2"><label className="label" htmlFor="street">Straße &amp; Hausnummer</label><input id="street" className="input" value={form.street} onChange={(e) => set('street', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="postalCode">PLZ</label><input id="postalCode" className="input" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="city">Ort</label><input id="city" className="input" value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="country">Land</label><input id="country" className="input" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="DE" /></div>
        </div>
        <p className="help mt-3">§14 UStG: Name, Anschrift und Steuernummer <span className="text-chrome-300">oder</span> USt-IdNr. sind Pflichtangaben für gültige Rechnungen.</p>
      </SectionCard>

      <SectionCard title="Steuer (§14 UStG)" subtitle="Steuernummer oder USt-IdNr. ist auf Rechnungen Pflicht.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label className="label" htmlFor="steuernummer">Steuernummer</label><input id="steuernummer" className="input" value={form.steuernummer} onChange={(e) => set('steuernummer', e.target.value)} placeholder="z. B. 12/345/67890" /></div>
          <div className="field"><label className="label" htmlFor="ustId">USt-IdNr.</label><input id="ustId" className="input" value={form.ustId} onChange={(e) => set('ustId', e.target.value)} placeholder="z. B. DE123456789" /></div>
        </div>
      </SectionCard>

      <SectionCard title="Bankverbindung" subtitle="Erscheint im Fuß der Rechnung.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2"><label className="label" htmlFor="bankname">Bank</label><input id="bankname" className="input" value={form.bankname} onChange={(e) => set('bankname', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="iban">IBAN</label><input id="iban" className="input" value={form.iban} onChange={(e) => set('iban', e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="bic">BIC</label><input id="bic" className="input" value={form.bic} onChange={(e) => set('bic', e.target.value)} /></div>
        </div>
      </SectionCard>

      <SectionCard title="Rechnungsstellung" subtitle="Standardwerte für neue Rechnungen – bestehende Belege bleiben unverändert.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="rechnungZahlungszielTage">Zahlungsziel (Tage)</label>
            <input id="rechnungZahlungszielTage" className="input" inputMode="numeric" maxLength={3}
              value={form.rechnungZahlungszielTage}
              onChange={(e) => set('rechnungZahlungszielTage', e.target.value.replace(/\D/g, ''))}
              placeholder="14" />
            <p className="help mt-1.5">Leer lassen = 14 Tage.</p>
          </div>
          <div className="field sm:col-span-2">
            <label className="label" htmlFor="rechnungPaymentLink">Zahlungslink</label>
            <input id="rechnungPaymentLink" type="url" className="input" maxLength={300}
              pattern="https://\S+"
              value={form.rechnungPaymentLink}
              onChange={(e) => set('rechnungPaymentLink', e.target.value)}
              placeholder="https://paypal.me/dein-betrieb" />
            <p className="help mt-1.5">
              Eigener PayPal.me- oder Stripe-Payment-Link. Erscheint als „Online bezahlen"-Button auf der
              öffentlichen Belegseite – Zahlungen gehen direkt an euch, nie über Detailly. Muss mit https:// beginnen.
            </p>
          </div>
          <div className="field sm:col-span-2">
            <label className="label" htmlFor="rechnungFusstext">Fußtext auf Belegen</label>
            <textarea id="rechnungFusstext" className="textarea" rows={2} maxLength={300}
              value={form.rechnungFusstext}
              onChange={(e) => set('rechnungFusstext', e.target.value)}
              placeholder="z. B. Vielen Dank für Ihren Auftrag! Es gelten unsere AGB." />
            <p className="help mt-1.5">Erscheint in der Fußzeile von Angebots- und Rechnungs-PDFs.</p>
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

      <SectionCard title="Mahnwesen" subtitle="Fristen und Gebühren für Zahlungserinnerungen und Mahnungen.">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">Automatisch mahnen</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                Automatische Mahnungen – sonst mahnst du manuell im Mahn-Cockpit.
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={mahnForm.autoMahnen}
              onChange={(e) => setMahnForm((f) => ({ ...f, autoMahnen: e.target.checked }))} />
          </label>

          <div>
            <label className="label mb-1.5 block">Fristen (Tage nach Fälligkeit)</label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="field">
                <label className="label" htmlFor="fristErinnerung">Erinnerung</label>
                <input id="fristErinnerung" className="input" inputMode="numeric" maxLength={3} value={mahnForm.erinnerung}
                  onChange={(e) => setMahnForm((f) => ({ ...f, erinnerung: e.target.value.replace(/\D/g, '') }))} placeholder="7" />
              </div>
              <div className="field">
                <label className="label" htmlFor="fristMahnung1">1. Mahnung</label>
                <input id="fristMahnung1" className="input" inputMode="numeric" maxLength={3} value={mahnForm.mahnung1}
                  onChange={(e) => setMahnForm((f) => ({ ...f, mahnung1: e.target.value.replace(/\D/g, '') }))} placeholder="14" />
              </div>
              <div className="field">
                <label className="label" htmlFor="fristMahnung2">2. Mahnung</label>
                <input id="fristMahnung2" className="input" inputMode="numeric" maxLength={3} value={mahnForm.mahnung2}
                  onChange={(e) => setMahnForm((f) => ({ ...f, mahnung2: e.target.value.replace(/\D/g, '') }))} placeholder="28" />
              </div>
            </div>
            <p className="help mt-1.5">Streng aufsteigend: Erinnerung &lt; 1. Mahnung &lt; 2. Mahnung (jeweils 1–365 Tage).</p>
          </div>

          <div>
            <label className="label mb-1.5 block">Mahngebühren (€)</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="gebuehr1">1. Mahnung</label>
                <input id="gebuehr1" className="input" inputMode="decimal" maxLength={6} value={mahnForm.gebuehr1}
                  onChange={(e) => setMahnForm((f) => ({ ...f, gebuehr1: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="0" />
              </div>
              <div className="field">
                <label className="label" htmlFor="gebuehr2">2. Mahnung</label>
                <input id="gebuehr2" className="input" inputMode="decimal" maxLength={6} value={mahnForm.gebuehr2}
                  onChange={(e) => setMahnForm((f) => ({ ...f, gebuehr2: e.target.value.replace(/[^\d.,]/g, '') }))} placeholder="0" />
              </div>
            </div>
            <p className="help mt-1.5">0 bis 999 € je Stufe. Erscheint als zusätzliche Position auf der Mahnung.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Kunden-Benachrichtigungen" subtitle="Automatische E-Mails an Kunden – jederzeit abschaltbar.">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">Status-Mails zum Auftrag</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                Kunden mit E-Mail-Adresse erhalten bei wichtigen Statuswechseln automatisch eine Nachricht mit Link zur Auftragsverfolgung.
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={form.kundenmailStatus !== '0'}
              onChange={(e) => set('kundenmailStatus', e.target.checked ? '1' : '0')} />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">Terminbestätigung</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                Kunden erhalten eine Bestätigungs-Mail, wenn ihre Online-Terminanfrage angenommen wird.
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={form.kundenmailTerminbestaetigung !== '0'}
              onChange={(e) => set('kundenmailTerminbestaetigung', e.target.checked ? '1' : '0')} />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Mail-Versand (eigener Absender)" subtitle="Optional: Kunden- und Beleg-Mails über den eigenen SMTP-Server und Absender verschicken.">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm text-chrome-200">Eigenen Absender nutzen</span>
              <span className="mt-0.5 block text-xs text-chrome-500">
                Ohne aktive Konfiguration versendet Detailly weiter unter der Standard-Adresse.
              </span>
            </span>
            <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={mailForm.enabled}
              onChange={(e) => setMailForm((f) => ({ ...f, enabled: e.target.checked }))} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field sm:col-span-2">
              <label className="label" htmlFor="mailHost">SMTP-Host</label>
              <input id="mailHost" className="input" autoComplete="off" value={mailForm.host}
                onChange={(e) => setMailForm((f) => ({ ...f, host: e.target.value }))} placeholder="z. B. smtp.dein-provider.de" />
            </div>
            <div className="field">
              <label className="label" htmlFor="mailPort">Port</label>
              <input id="mailPort" className="input" inputMode="numeric" maxLength={5} value={mailForm.port}
                onChange={(e) => setMailForm((f) => ({ ...f, port: e.target.value.replace(/\D/g, '') }))} placeholder="587" />
            </div>
            <div className="field">
              <label className="label">Verschlüsselung</label>
              <div className="seg-group">
                <button type="button" className={`seg ${!mailForm.secure ? 'seg-active' : ''}`}
                  onClick={() => setMailForm((f) => ({ ...f, secure: false }))}>STARTTLS (587)</button>
                <button type="button" className={`seg ${mailForm.secure ? 'seg-active' : ''}`}
                  onClick={() => setMailForm((f) => ({ ...f, secure: true }))}>SSL/TLS (465)</button>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="mailUser">Benutzer</label>
              <input id="mailUser" className="input" autoComplete="off" value={mailForm.user}
                onChange={(e) => setMailForm((f) => ({ ...f, user: e.target.value }))} placeholder="Anmeldename am Mailserver" />
            </div>
            <div className="field">
              <label className="label" htmlFor="mailPass">Passwort</label>
              <input id="mailPass" type="password" autoComplete="new-password" className="input" value={mailPass}
                onChange={(e) => setMailPass(e.target.value)}
                placeholder={mailPassSet ? `Hinterlegt (${form.mailConfig.passHint || '••••••••'}) – zum Ändern neues Passwort eingeben` : 'SMTP-Passwort eingeben'} />
              <p className="help mt-1.5">Leer lassen = unverändert. Wird verschlüsselt gespeichert und nie wieder angezeigt.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="mailFromEmail">Absender-Adresse (From)</label>
              <input id="mailFromEmail" type="email" className="input" value={mailForm.fromEmail}
                onChange={(e) => setMailForm((f) => ({ ...f, fromEmail: e.target.value }))} placeholder="rechnung@dein-betrieb.de" />
            </div>
            <div className="field">
              <label className="label" htmlFor="mailFromName">Absender-Name</label>
              <input id="mailFromName" className="input" maxLength={120} value={mailForm.fromName}
                onChange={(e) => setMailForm((f) => ({ ...f, fromName: e.target.value }))} placeholder="z. B. dein Betriebsname" />
            </div>
          </div>

          <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-3 text-xs leading-relaxed text-chrome-400">
            Die Test-Mail geht an die hinterlegte Absender-Adresse und prüft die <span className="font-semibold text-chrome-200">zuletzt gespeicherte</span> Konfiguration. Änderungen also zuerst speichern, dann testen.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost btn-sm" disabled={!form.mailConfig.enabled || testingMail}
              onClick={() => setConfirmTestMail(true)} title={form.mailConfig.enabled ? 'Sendet eine Test-Mail an die Absender-Adresse' : 'Erst „Eigenen Absender nutzen" aktivieren und speichern'}>
              {testingMail ? (<><span className="spinner" />Sende…</>) : 'Test-Mail senden'}
            </button>
            {mailTestResult && (
              <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${mailTestResult.ok ? 'border-positive/30 bg-positive-soft text-positive' : 'border-danger/30 bg-danger-soft text-danger'}`}>{mailTestResult.message}</span>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="DATEV / Buchhaltung" subtitle="Für den DATEV-Buchungsstapel-Export. Berater-/Mandantennummer vom Steuerberater; Konten mit SKR03-Standardwerten vorbelegt.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label className="label" htmlFor="datevBeraterNr">Berater-Nr.</label><input id="datevBeraterNr" className="input" value={form.datevBeraterNr} onChange={(e) => set('datevBeraterNr', e.target.value)} placeholder="z. B. 1001" /></div>
          <div className="field"><label className="label" htmlFor="datevMandantNr">Mandanten-Nr.</label><input id="datevMandantNr" className="input" value={form.datevMandantNr} onChange={(e) => set('datevMandantNr', e.target.value)} placeholder="z. B. 456" /></div>
          <div className="field"><label className="label" htmlFor="datevSkr">Kontenrahmen (SKR)</label><input id="datevSkr" className="input" value={form.datevSkr} onChange={(e) => set('datevSkr', e.target.value)} placeholder="03" /></div>
          <div className="field"><label className="label" htmlFor="datevDebitorSammelkonto">Debitoren-Sammelkonto</label><input id="datevDebitorSammelkonto" className="input" value={form.datevDebitorSammelkonto} onChange={(e) => set('datevDebitorSammelkonto', e.target.value)} placeholder="1400" /></div>
          <div className="field"><label className="label" htmlFor="datevErloeskonto19">Erlöskonto 19 %</label><input id="datevErloeskonto19" className="input" value={form.datevErloeskonto19} onChange={(e) => set('datevErloeskonto19', e.target.value)} placeholder="8400" /></div>
          <div className="field"><label className="label" htmlFor="datevErloeskonto7">Erlöskonto 7 %</label><input id="datevErloeskonto7" className="input" value={form.datevErloeskonto7} onChange={(e) => set('datevErloeskonto7', e.target.value)} placeholder="8300" /></div>
          <div className="field"><label className="label" htmlFor="datevErloeskonto0">Erlöskonto steuerfrei / §19</label><input id="datevErloeskonto0" className="input" value={form.datevErloeskonto0} onChange={(e) => set('datevErloeskonto0', e.target.value)} placeholder="8195" /></div>
        </div>
        <p className="help mt-3">Hinweis: Vor dem ersten echten DATEV-Import bitte mit dem Steuerberater bzw. dem kostenlosen DATEV-Prüfprogramm gegenprüfen.</p>
      </SectionCard>

      <SectionCard title="sevDesk-Anbindung" subtitle="Optional: gestellte Rechnungen automatisch an dein sevDesk-Konto übergeben.">
        <div className="space-y-4">
          <div className="field">
            <label className="label" htmlFor="sevdeskApiToken">API-Token</label>
            <input id="sevdeskApiToken" type="password" autoComplete="off" className="input" value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={form.sevdeskConfigured ? `Hinterlegt (${form.sevdeskTokenHint}) – zum Ändern neuen Token eingeben` : 'sevDesk-API-Token einfügen'} />
            <p className="help mt-1.5">Zu finden in sevDesk unter Einstellungen → Benutzer → API-Token. Wird verschlüsselt gespeichert und nie wieder angezeigt.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost btn-sm" disabled={!form.sevdeskConfigured || testing} onClick={testSevdesk} title="Testet den gespeicherten Token">{testing ? 'Teste…' : 'Verbindung testen'}</button>
            {form.sevdeskConfigured && (<button type="button" className="link-danger text-sm disabled:opacity-50" onClick={removeSevdesk} disabled={saving}>Token entfernen</button>)}
            {testResult && (<span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${testResult.ok ? 'border-positive/30 bg-positive-soft text-positive' : 'border-danger/30 bg-danger-soft text-danger'}`}>{testResult.message}{testResult.companyName ? ` (${testResult.companyName})` : ''}</span>)}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (<><span className="spinner" />Speichern…</>) : 'Speichern'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmTestMail}
        title="Test-Mail senden"
        message={
          <>
            Es wird eine Test-E-Mail an die hinterlegte Absender-Adresse
            {form.mailConfig.fromEmail ? (<> (<span className="font-medium text-chrome-200">{form.mailConfig.fromEmail}</span>)</>) : ''} verschickt.
            Geprüft wird die zuletzt gespeicherte SMTP-Konfiguration.
          </>
        }
        confirmLabel="Test-Mail senden"
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
