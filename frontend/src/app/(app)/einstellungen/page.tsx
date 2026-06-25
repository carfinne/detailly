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
}

const LEER: TenantProfile = {
  name: '', email: '', phone: '', street: '', postalCode: '', city: '', country: 'DE',
  steuernummer: '', ustId: '', iban: '', bic: '', bankname: '',
};

const DARF_BEARBEITEN = ['franchise_owner', 'super_admin'];

export default function EinstellungenPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<TenantProfile>(LEER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gespeichert, setGespeichert] = useState(false);

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
      const data = await api.patch<TenantProfile>('/tenants/me', form);
      setForm({ ...LEER, ...data });
      setGespeichert(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
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
