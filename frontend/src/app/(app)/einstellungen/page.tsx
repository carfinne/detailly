'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorBox, SectionCard } from '@/components/ui';

// Stammdaten-Profil (flach) – passt zum Backend GET/PATCH /tenants/me.
interface TenantProfile {
  name: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  steuernummer: string;
  ustId: string;
  iban: string;
  bic: string;
  bankname: string;
  datevBeraterNr: string;
  datevMandantNr: string;
  datevSkr: string;
  datevErloeskonto19: string;
  datevErloeskonto7: string;
  datevErloeskonto0: string;
  datevDebitorSammelkonto: string;
  // sevDesk: nur Anzeige-Status (Token wird nie zurückgegeben).
  sevdeskConfigured: boolean;
  sevdeskTokenHint: string;
}

const LEER: TenantProfile = {
  name: '', email: '', phone: '', street: '', postalCode: '', city: '', country: 'DE',
  steuernummer: '', ustId: '', iban: '', bic: '', bankname: '',
  datevBeraterNr: '', datevMandantNr: '', datevSkr: '03',
  datevErloeskonto19: '8400', datevErloeskonto7: '8300', datevErloeskonto0: '8195',
  datevDebitorSammelkonto: '1400',
  sevdeskConfigured: false, sevdeskTokenHint: '',
};

const DARF_BEARBEITEN = ['franchise_owner', 'super_admin'];

export default function EinstellungenPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<TenantProfile>(LEER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gespeichert, setGespeichert] = useState(false);
  // sevDesk: Token-Eingabe (write-only) + Verbindungstest.
  const [tokenInput, setTokenInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; companyName?: string } | null>(null);

  const erlaubt = !!user && DARF_BEARBEITEN.includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TenantProfile>('/tenants/me');
      setForm({ ...LEER, ...data });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stammdaten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (erlaubt) load();
    else setLoading(false);
  }, [erlaubt, load]);

  function set<K extends keyof TenantProfile>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setGespeichert(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setGespeichert(false);
    try {
      // Read-only-Felder (sevDesk-Status) NICHT mitsenden (forbidNonWhitelisted).
      // Token nur senden, wenn der Inhaber etwas eingegeben hat.
      const { sevdeskConfigured, sevdeskTokenHint, ...editable } = form;
      const payload: Record<string, unknown> = { ...editable };
      if (tokenInput.trim()) payload.sevdeskApiToken = tokenInput.trim();
      const data = await api.patch<TenantProfile>('/tenants/me', payload);
      setForm({ ...LEER, ...data });
      setTokenInput('');
      setTestResult(null);
      setGespeichert(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function testSevdesk() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post<{ ok: boolean; message: string; companyName?: string }>(
        '/tenants/me/sevdesk/test',
      );
      setTestResult(r);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test fehlgeschlagen' });
    } finally {
      setTesting(false);
    }
  }

  async function removeSevdesk() {
    setSaving(true);
    setError('');
    try {
      const data = await api.patch<TenantProfile>('/tenants/me', { sevdeskApiToken: '' });
      setForm({ ...LEER, ...data });
      setTokenInput('');
      setTestResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  if (!erlaubt && !loading) {
    return (
      <>
        <PageHeader title="Betriebsdaten" subtitle="Stammdaten für Rechnungen (§14 UStG)" />
        <ErrorBox message="Nur der Betriebsinhaber kann die Stammdaten bearbeiten." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Betriebsdaten"
        subtitle="Diese Angaben erscheinen auf Angeboten und Rechnungen (§14 UStG)."
      />

      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && <ErrorBox message={error} />}

          <SectionCard title="Betrieb & Anschrift" subtitle="Name und Adresse des Betriebs">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field sm:col-span-2">
                <label className="label" htmlFor="name">Betriebsname</label>
                <input id="name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="email">E-Mail</label>
                <input id="email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="phone">Telefon</label>
                <input id="phone" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div className="field sm:col-span-2">
                <label className="label" htmlFor="street">Straße &amp; Hausnummer</label>
                <input id="street" className="input" value={form.street} onChange={(e) => set('street', e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="postalCode">PLZ</label>
                <input id="postalCode" className="input" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="city">Ort</label>
                <input id="city" className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Steuer (§14 UStG)" subtitle="Steuernummer oder USt-IdNr. ist auf Rechnungen Pflicht.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="steuernummer">Steuernummer</label>
                <input id="steuernummer" className="input" value={form.steuernummer} onChange={(e) => set('steuernummer', e.target.value)} placeholder="z. B. 12/345/67890" />
              </div>
              <div className="field">
                <label className="label" htmlFor="ustId">USt-IdNr.</label>
                <input id="ustId" className="input" value={form.ustId} onChange={(e) => set('ustId', e.target.value)} placeholder="z. B. DE123456789" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Bankverbindung" subtitle="Erscheint im Fuß der Rechnung.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field sm:col-span-2">
                <label className="label" htmlFor="bankname">Bank</label>
                <input id="bankname" className="input" value={form.bankname} onChange={(e) => set('bankname', e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="iban">IBAN</label>
                <input id="iban" className="input" value={form.iban} onChange={(e) => set('iban', e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="bic">BIC</label>
                <input id="bic" className="input" value={form.bic} onChange={(e) => set('bic', e.target.value)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="DATEV / Buchhaltung"
            subtitle="Für den DATEV-Buchungsstapel-Export. Berater- und Mandantennummer bekommst du von deinem Steuerberater; die Konten sind mit SKR03-Standardwerten vorbelegt."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="datevBeraterNr">Berater-Nr.</label>
                <input id="datevBeraterNr" className="input" value={form.datevBeraterNr} onChange={(e) => set('datevBeraterNr', e.target.value)} placeholder="z. B. 1001" />
              </div>
              <div className="field">
                <label className="label" htmlFor="datevMandantNr">Mandanten-Nr.</label>
                <input id="datevMandantNr" className="input" value={form.datevMandantNr} onChange={(e) => set('datevMandantNr', e.target.value)} placeholder="z. B. 456" />
              </div>
              <div className="field">
                <label className="label" htmlFor="datevSkr">Kontenrahmen (SKR)</label>
                <input id="datevSkr" className="input" value={form.datevSkr} onChange={(e) => set('datevSkr', e.target.value)} placeholder="03" />
              </div>
              <div className="field">
                <label className="label" htmlFor="datevDebitorSammelkonto">Debitoren-Sammelkonto</label>
                <input id="datevDebitorSammelkonto" className="input" value={form.datevDebitorSammelkonto} onChange={(e) => set('datevDebitorSammelkonto', e.target.value)} placeholder="1400" />
              </div>
              <div className="field">
                <label className="label" htmlFor="datevErloeskonto19">Erlöskonto 19 %</label>
                <input id="datevErloeskonto19" className="input" value={form.datevErloeskonto19} onChange={(e) => set('datevErloeskonto19', e.target.value)} placeholder="8400" />
              </div>
              <div className="field">
                <label className="label" htmlFor="datevErloeskonto7">Erlöskonto 7 %</label>
                <input id="datevErloeskonto7" className="input" value={form.datevErloeskonto7} onChange={(e) => set('datevErloeskonto7', e.target.value)} placeholder="8300" />
              </div>
              <div className="field">
                <label className="label" htmlFor="datevErloeskonto0">Erlöskonto steuerfrei / §19</label>
                <input id="datevErloeskonto0" className="input" value={form.datevErloeskonto0} onChange={(e) => set('datevErloeskonto0', e.target.value)} placeholder="8195" />
              </div>
            </div>
            <p className="help mt-3">
              Hinweis: Vor dem ersten echten DATEV-Import bitte einmal mit deinem Steuerberater bzw. dem
              kostenlosen DATEV-Prüfprogramm gegenprüfen.
            </p>
          </SectionCard>

          <SectionCard
            title="sevDesk-Anbindung"
            subtitle="Optional: gestellte Rechnungen automatisch an dein sevDesk-Konto übergeben."
          >
            <div className="space-y-4">
              <div className="field">
                <label className="label" htmlFor="sevdeskApiToken">API-Token</label>
                <input
                  id="sevdeskApiToken"
                  type="password"
                  autoComplete="off"
                  className="input"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setGespeichert(false);
                  }}
                  placeholder={
                    form.sevdeskConfigured
                      ? `Hinterlegt (${form.sevdeskTokenHint}) – zum Ändern neuen Token eingeben`
                      : 'sevDesk-API-Token einfügen'
                  }
                />
                <p className="help mt-1.5">
                  Zu finden in sevDesk unter Einstellungen → Benutzer → API-Token. Wird verschlüsselt
                  gespeichert und nie wieder angezeigt. Speichern mit leerem Feld bei hinterlegtem Token
                  ändert nichts; zum Deaktivieren „Token entfernen".
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={!form.sevdeskConfigured || testing}
                  onClick={testSevdesk}
                  title="Testet den gespeicherten Token"
                >
                  {testing ? 'Teste…' : 'Verbindung testen'}
                </button>
                {form.sevdeskConfigured && (
                  <button
                    type="button"
                    className="text-sm text-danger hover:underline disabled:opacity-50"
                    onClick={removeSevdesk}
                    disabled={saving}
                  >
                    Token entfernen
                  </button>
                )}
                {testResult && (
                  <span
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                      testResult.ok
                        ? 'border-positive/30 bg-positive-soft text-positive'
                        : 'border-danger/30 bg-danger-soft text-danger'
                    }`}
                  >
                    {testResult.message}
                    {testResult.companyName ? ` (${testResult.companyName})` : ''}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
                  Speichern…
                </>
              ) : (
                'Speichern'
              )}
            </button>
            {gespeichert && (
              <span className="flex items-center gap-1.5 rounded-lg border border-copper/30 bg-copper-soft px-3 py-1.5 text-sm font-medium text-copper">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Gespeichert
              </span>
            )}
          </div>
        </form>
      )}
    </>
  );
}
