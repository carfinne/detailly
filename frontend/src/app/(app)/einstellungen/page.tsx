'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, absoluteApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/labels';
import { applyBranche, BETRIEBSTYP_META, type Betriebstyp } from '@/lib/branche';
import { PageHeader, Loading, ErrorBox, SectionCard } from '@/components/ui';

// Stammdaten-Profil (flach) – passt zum Backend GET/PATCH /tenants/me.
interface TenantProfile {
  name: string; betriebstyp: Betriebstyp;
  email: string; phone: string; street: string; postalCode: string; city: string; country: string;
  steuernummer: string; ustId: string; iban: string; bic: string; bankname: string;
  datevBeraterNr: string; datevMandantNr: string; datevSkr: string;
  datevErloeskonto19: string; datevErloeskonto7: string; datevErloeskonto0: string; datevDebitorSammelkonto: string;
  sevdeskConfigured: boolean; sevdeskTokenHint: string;
}
const LEER: TenantProfile = {
  name: '', betriebstyp: 'komplett',
  email: '', phone: '', street: '', postalCode: '', city: '', country: 'DE',
  steuernummer: '', ustId: '', iban: '', bic: '', bankname: '',
  datevBeraterNr: '', datevMandantNr: '', datevSkr: '03',
  datevErloeskonto19: '8400', datevErloeskonto7: '8300', datevErloeskonto0: '8195', datevDebitorSammelkonto: '1400',
  sevdeskConfigured: false, sevdeskTokenHint: '',
};

const DARF_BETRIEB = ['owner', 'platform_admin'];
type Tab = 'darstellung' | 'profil' | 'betrieb';

export default function EinstellungenPage() {
  const { user } = useAuth();
  const istInhaber = !!user && DARF_BETRIEB.includes(user.role);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'darstellung', label: 'Darstellung' },
    { key: 'profil', label: 'Profil' },
    ...(istInhaber ? [{ key: 'betrieb' as Tab, label: 'Betrieb' }] : []),
  ];
  const [tab, setTab] = useState<Tab>('darstellung');

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Darstellung, Profil und – als Inhaber – die Betriebsdaten." />

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-850 p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'}`}>
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
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
        theme === t
          ? 'border-copper/60 bg-copper-soft text-copper'
          : 'border-ink-700 bg-ink-800/40 text-chrome-300 hover:border-ink-600 hover:text-chrome-50'
      }`}
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
  const { user } = useAuth();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '–';
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function changePw() {
    if (!user?.email) return;
    setBusy(true);
    try { await api.post('/auth/password-reset/request', { email: user.email }); } catch { /* immer 204 / keine Enumeration */ }
    setSent(true);
    setBusy(false);
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-4 border-b border-ink-700/50 py-2.5 last:border-0">
      <span className="text-sm text-chrome-500">{label}</span>
      <span className="text-sm font-medium text-chrome-100">{value}</span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <SectionCard title="Mein Profil" subtitle="Deine Kontodaten.">
        <Row label="Name" value={name} />
        <Row label="E-Mail" value={user?.email ?? '–'} />
        <Row label="Rolle" value={user ? ROLE_LABEL[user.role] ?? user.role : '–'} />
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
    if (!window.confirm('Neuen Abo-Link erzeugen? Der bisherige Link wird dann ungültig.')) return;
    setBusy(true);
    try { const r = await api.post<{ token: string; path: string }>('/calendar/regenerate'); setPath(r.path); } catch { /* ignore */ } finally { setBusy(false); }
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
          <button type="button" className="text-sm text-danger hover:underline disabled:opacity-50" onClick={regenerate} disabled={busy}>
            {busy ? 'Erzeuge…' : 'Link neu generieren (alten ungültig machen)'}
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
function Betrieb() {
  const [form, setForm] = useState<TenantProfile>(LEER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gespeichert, setGespeichert] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; companyName?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api.get<TenantProfile>('/tenants/me'); setForm({ ...LEER, ...data }); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Stammdaten konnten nicht geladen werden'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function set<K extends keyof TenantProfile>(key: K, value: string) { setForm((f) => ({ ...f, [key]: value })); setGespeichert(false); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setGespeichert(false);
    try {
      const { sevdeskConfigured, sevdeskTokenHint, ...editable } = form;
      const payload: Record<string, unknown> = { ...editable };
      if (tokenInput.trim()) payload.sevdeskApiToken = tokenInput.trim();
      const data = await api.patch<TenantProfile>('/tenants/me', payload);
      setForm({ ...LEER, ...data }); setTokenInput(''); setTestResult(null); setGespeichert(true);
      applyBranche(data.betriebstyp); // Branchen-Look sofort umschalten
    } catch (err) { setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
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

  return (
    <div className="space-y-5">
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
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  aktivTyp
                    ? 'border-copper/60 bg-copper-soft'
                    : 'border-ink-700 bg-ink-800/40 hover:border-ink-600'
                }`}
              >
                <span
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-lg ring-1 ring-white/10"
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
        </div>
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
              onChange={(e) => { setTokenInput(e.target.value); setGespeichert(false); }}
              placeholder={form.sevdeskConfigured ? `Hinterlegt (${form.sevdeskTokenHint}) – zum Ändern neuen Token eingeben` : 'sevDesk-API-Token einfügen'} />
            <p className="help mt-1.5">Zu finden in sevDesk unter Einstellungen → Benutzer → API-Token. Wird verschlüsselt gespeichert und nie wieder angezeigt.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-ghost btn-sm" disabled={!form.sevdeskConfigured || testing} onClick={testSevdesk} title="Testet den gespeicherten Token">{testing ? 'Teste…' : 'Verbindung testen'}</button>
            {form.sevdeskConfigured && (<button type="button" className="text-sm text-danger hover:underline disabled:opacity-50" onClick={removeSevdesk} disabled={saving}>Token entfernen</button>)}
            {testResult && (<span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${testResult.ok ? 'border-positive/30 bg-positive-soft text-positive' : 'border-danger/30 bg-danger-soft text-danger'}`}>{testResult.message}{testResult.companyName ? ` (${testResult.companyName})` : ''}</span>)}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />Speichern…</>) : 'Speichern'}
        </button>
        {gespeichert && (
          <span className="flex items-center gap-1.5 rounded-lg border border-copper/30 bg-copper-soft px-3 py-1.5 text-sm font-medium text-copper">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Gespeichert
          </span>
        )}
      </div>
        </form>
      )}
    </div>
  );
}
