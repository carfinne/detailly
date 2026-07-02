'use client';

// Marktplatz-Pflege (Detailly-Team): Haendler + Produkte kuratieren und die
// Affiliate-Statistik sehen. Backend ist auf Plattform-Rollen begrenzt
// (Analyst read-only – die Pflege-Endpunkte lehnen ihn ab).

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { MarketplaceDealer, MarketplaceProduct } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

type Tab = 'produkte' | 'haendler' | 'statistik';

interface Stats {
  gesamt: number;
  letzte30Tage: number;
  topProdukte: { name: string; haendler: string; klicks: number }[];
  topHaendler: { name: string; klicks: number }[];
}

const PROD_LEER = { dealerId: '', name: '', kategorie: '', preis: '', preisHinweis: '', bildUrl: '', affiliateUrl: '', beschreibung: '', aktiv: true };
const DEALER_LEER = { name: '', beschreibung: '', logoUrl: '', webseite: '', aktiv: true };

export default function PlattformMarktplatzPage() {
  const [tab, setTab] = useState<Tab>('produkte');
  const [produkte, setProdukte] = useState<MarketplaceProduct[]>([]);
  const [haendler, setHaendler] = useState<MarketplaceDealer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Produkt-Modal
  const [prodOpen, setProdOpen] = useState(false);
  const [prodEditId, setProdEditId] = useState<string | null>(null);
  const [prod, setProd] = useState(PROD_LEER);

  // Haendler-Modal
  const [dealerOpen, setDealerOpen] = useState(false);
  const [dealerEditId, setDealerEditId] = useState<string | null>(null);
  const [dealer, setDealer] = useState(DEALER_LEER);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, s] = await Promise.all([
        api.get<MarketplaceProduct[]>('/platform/marketplace/products'),
        api.get<MarketplaceDealer[]>('/platform/marketplace/dealers'),
        api.get<Stats>('/platform/marketplace/stats'),
      ]);
      setProdukte(p);
      setHaendler(d);
      setStats(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Marktplatz-Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dealerName = (id: string) => haendler.find((d) => d.id === id)?.name ?? '—';

  function openProdukt(p?: MarketplaceProduct) {
    setProdEditId(p?.id ?? null);
    setProd(
      p
        ? {
            dealerId: p.dealerId, name: p.name, kategorie: p.kategorie,
            preis: p.preis != null ? String(p.preis) : '', preisHinweis: p.preisHinweis ?? '',
            bildUrl: p.bildUrl ?? '', affiliateUrl: p.affiliateUrl ?? '',
            beschreibung: p.beschreibung ?? '', aktiv: p.aktiv !== false,
          }
        : PROD_LEER,
    );
    setProdOpen(true);
  }

  async function saveProdukt(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        dealerId: prod.dealerId,
        name: prod.name.trim(),
        kategorie: prod.kategorie.trim(),
        affiliateUrl: prod.affiliateUrl.trim(),
        aktiv: prod.aktiv,
      };
      if (prod.preis.trim() !== '') payload.preis = Number(prod.preis);
      if (prod.preisHinweis.trim()) payload.preisHinweis = prod.preisHinweis.trim();
      if (prod.bildUrl.trim()) payload.bildUrl = prod.bildUrl.trim();
      if (prod.beschreibung.trim()) payload.beschreibung = prod.beschreibung.trim();
      if (prodEditId) await api.patch(`/platform/marketplace/products/${prodEditId}`, payload);
      else await api.post('/platform/marketplace/products', payload);
      setProdOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  function openDealer(d?: MarketplaceDealer) {
    setDealerEditId(d?.id ?? null);
    setDealer(
      d
        ? { name: d.name, beschreibung: d.beschreibung ?? '', logoUrl: d.logoUrl ?? '', webseite: d.webseite ?? '', aktiv: d.aktiv !== false }
        : DEALER_LEER,
    );
    setDealerOpen(true);
  }

  async function saveDealer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { name: dealer.name.trim(), aktiv: dealer.aktiv };
      if (dealer.beschreibung.trim()) payload.beschreibung = dealer.beschreibung.trim();
      if (dealer.logoUrl.trim()) payload.logoUrl = dealer.logoUrl.trim();
      if (dealer.webseite.trim()) payload.webseite = dealer.webseite.trim();
      if (dealerEditId) await api.patch(`/platform/marketplace/dealers/${dealerEditId}`, payload);
      else await api.post('/platform/marketplace/dealers', payload);
      setDealerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'produkte', label: 'Produkte' },
    { key: 'haendler', label: 'Händler' },
    { key: 'statistik', label: 'Statistik' },
  ];

  const kategorien = Array.from(new Set(produkte.map((p) => p.kategorie)));

  return (
    <div>
      <PageHeader
        title="Marktplatz-Pflege"
        subtitle="Händler und Produkte kuratieren – der Verdienst läuft über die Affiliate-Links."
        action={
          tab === 'haendler' ? (
            <button className="btn-primary" onClick={() => openDealer()}>Neuer Händler</button>
          ) : (
            <button className="btn-primary" onClick={() => openProdukt()} disabled={haendler.length === 0}>
              Neues Produkt
            </button>
          )
        }
      />
      {error && <ErrorBox message={error} />}

      <div className="mb-4 flex rounded-xl border border-ink-700 bg-ink-850 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : tab === 'produkte' ? (
        <div className="card">
          {produkte.length === 0 ? (
            <Empty
              text={haendler.length === 0 ? 'Lege zuerst einen Händler an.' : 'Noch keine Produkte.'}
              action={
                haendler.length === 0 ? (
                  <button className="btn-ghost btn-sm" onClick={() => { setTab('haendler'); openDealer(); }}>Händler anlegen</button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produkt</th><th>Händler</th><th>Kategorie</th>
                    <th className="text-right">Preis</th><th className="text-right">Klicks</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {produkte.map((p) => (
                    <tr key={p.id} className={p.aktiv === false ? 'opacity-60' : undefined}>
                      <td className="font-medium">{p.name}</td>
                      <td>{dealerName(p.dealerId)}</td>
                      <td>{p.kategorie}</td>
                      <td className="text-right tabular-nums">{p.preis != null ? eur(p.preis) : '–'}</td>
                      <td className="text-right tabular-nums">{p.klicks ?? 0}</td>
                      <td>
                        {p.aktiv === false ? <Badge className="badge-neutral">Inaktiv</Badge> : <Badge className="badge-positive">Aktiv</Badge>}
                      </td>
                      <td className="text-right">
                        <button className="text-copper hover:underline" onClick={() => openProdukt(p)}>Bearbeiten</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'haendler' ? (
        <div className="card">
          {haendler.length === 0 ? (
            <Empty text="Noch keine Händler. Leg den ersten Partner an." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Händler</th><th>Webseite</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {haendler.map((d) => (
                    <tr key={d.id} className={d.aktiv === false ? 'opacity-60' : undefined}>
                      <td className="font-medium">{d.name}</td>
                      <td className="text-chrome-400">{d.webseite || '–'}</td>
                      <td>
                        {d.aktiv === false ? <Badge className="badge-neutral">Inaktiv</Badge> : <Badge className="badge-positive">Aktiv</Badge>}
                      </td>
                      <td className="text-right">
                        <button className="text-copper hover:underline" onClick={() => openDealer(d)}>Bearbeiten</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:max-w-md">
            <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-chrome-500">Klicks gesamt</p>
              <p className="mt-1 font-display text-xl font-bold text-chrome-50">{stats?.gesamt ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-chrome-500">Letzte 30 Tage</p>
              <p className="mt-1 font-display text-xl font-bold text-copper">{stats?.letzte30Tage ?? 0}</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top-Produkte" subtitle="Nach Klicks">
              {!stats || stats.topProdukte.length === 0 ? (
                <Empty text="Noch keine Klicks." />
              ) : (
                <ul className="divide-y divide-ink-700/50">
                  {stats.topProdukte.map((p, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-chrome-100">
                        <span className="mr-2 text-chrome-500">{i + 1}.</span>{p.name}
                        <span className="ml-2 text-xs text-chrome-500">{p.haendler}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-chrome-200">{p.klicks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Top-Händler" subtitle="Nach Klicks">
              {!stats || stats.topHaendler.length === 0 ? (
                <Empty text="Noch keine Klicks." />
              ) : (
                <ul className="divide-y divide-ink-700/50">
                  {stats.topHaendler.map((d, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-chrome-100">
                        <span className="mr-2 text-chrome-500">{i + 1}.</span>{d.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-chrome-200">{d.klicks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* Produkt-Modal */}
      <Modal open={prodOpen} onClose={() => setProdOpen(false)} title={prodEditId ? 'Produkt bearbeiten' : 'Neues Produkt'}>
        <form onSubmit={saveProdukt} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Händler</label>
              <select className="input" value={prod.dealerId} onChange={(e) => setProd({ ...prod, dealerId: e.target.value })} required>
                <option value="">– wählen –</option>
                {haendler.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Kategorie</label>
              <input className="input" list="mp-kategorien" value={prod.kategorie} onChange={(e) => setProd({ ...prod, kategorie: e.target.value })} placeholder="z. B. Folien" required />
              <datalist id="mp-kategorien">
                {kategorien.map((k) => <option key={k} value={k} />)}
              </datalist>
            </div>
          </div>
          <div className="field">
            <label className="label">Produktname</label>
            <input className="input" value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} maxLength={150} required />
          </div>
          <div className="field">
            <label className="label">Affiliate-Link (https://…)</label>
            <input type="url" className="input" value={prod.affiliateUrl} onChange={(e) => setProd({ ...prod, affiliateUrl: e.target.value })} placeholder="https://haendler.de/produkt?aff=detailly" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="field">
              <label className="label">Preis (€)</label>
              <input type="number" step="0.01" min="0" className="input" value={prod.preis} onChange={(e) => setProd({ ...prod, preis: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Preis-Zusatz</label>
              <input className="input" value={prod.preisHinweis} onChange={(e) => setProd({ ...prod, preisHinweis: e.target.value })} placeholder="ab / pro Rolle" />
            </div>
            <div className="field">
              <label className="label">Bild-URL</label>
              <input type="url" className="input" value={prod.bildUrl} onChange={(e) => setProd({ ...prod, bildUrl: e.target.value })} placeholder="https://…" />
            </div>
          </div>
          <div className="field">
            <label className="label">Beschreibung <span className="text-chrome-600">(optional)</span></label>
            <textarea className="input min-h-[70px] resize-y" value={prod.beschreibung} onChange={(e) => setProd({ ...prod, beschreibung: e.target.value })} maxLength={2000} />
          </div>
          {prodEditId && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
              <input type="checkbox" className="h-4 w-4 accent-copper" checked={prod.aktiv} onChange={(e) => setProd({ ...prod, aktiv: e.target.checked })} />
              Im Marktplatz sichtbar
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setProdOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </Modal>

      {/* Haendler-Modal */}
      <Modal open={dealerOpen} onClose={() => setDealerOpen(false)} title={dealerEditId ? 'Händler bearbeiten' : 'Neuer Händler'}>
        <form onSubmit={saveDealer} className="space-y-4">
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={dealer.name} onChange={(e) => setDealer({ ...dealer, name: e.target.value })} maxLength={120} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Webseite</label>
              <input type="url" className="input" value={dealer.webseite} onChange={(e) => setDealer({ ...dealer, webseite: e.target.value })} placeholder="https://…" />
            </div>
            <div className="field">
              <label className="label">Logo-URL</label>
              <input type="url" className="input" value={dealer.logoUrl} onChange={(e) => setDealer({ ...dealer, logoUrl: e.target.value })} placeholder="https://…" />
            </div>
          </div>
          <div className="field">
            <label className="label">Beschreibung <span className="text-chrome-600">(optional)</span></label>
            <textarea className="input min-h-[70px] resize-y" value={dealer.beschreibung} onChange={(e) => setDealer({ ...dealer, beschreibung: e.target.value })} maxLength={2000} />
          </div>
          {dealerEditId && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
              <input type="checkbox" className="h-4 w-4 accent-copper" checked={dealer.aktiv} onChange={(e) => setDealer({ ...dealer, aktiv: e.target.checked })} />
              Aktiv (Produkte sichtbar)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDealerOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
