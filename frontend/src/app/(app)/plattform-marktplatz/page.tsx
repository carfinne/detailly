'use client';

// Marktplatz-Pflege (Detailly-Team): Haendler + Produkte kuratieren,
// Bestellungen ueberwachen und die Margen-/Affiliate-Auswertung sehen.
// Backend ist auf Plattform-Rollen begrenzt (Analyst read-only – die
// Pflege-Endpunkte lehnen ihn ab).

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { MarketplaceDealer, MarketplaceOrder, MarketplaceOrderStatus, MarketplaceProduct } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

type Tab = 'produkte' | 'haendler' | 'bestellungen' | 'provisionen' | 'statistik';

interface Stats {
  gesamt: number;
  letzte30Tage: number;
  topProdukte: { name: string; haendler: string; klicks: number }[];
  topHaendler: { name: string; klicks: number }[];
}

interface ProvisionReport {
  zeilen: {
    dealerId: string;
    name: string;
    aktiv: boolean;
    provisionSatz: number;
    bestellungen: number;
    umsatz: number;
    provision: number;
    klicks: number;
  }[];
  summe: { bestellungen: number; umsatz: number; provision: number; klicks: number };
}

const ORDER_STATUS: { value: MarketplaceOrderStatus; label: string; badge: string }[] = [
  { value: 'eingegangen', label: 'Eingegangen', badge: 'badge-info' },
  { value: 'bestaetigt', label: 'Bestätigt', badge: 'badge-caution' },
  { value: 'versendet', label: 'Versendet', badge: 'badge-positive' },
  { value: 'storniert', label: 'Storniert', badge: 'badge-danger' },
];

const PROD_LEER = { dealerId: '', name: '', kategorie: '', preis: '', preisHinweis: '', bildUrl: '', affiliateUrl: '', beschreibung: '', bestellbar: false, aktiv: true };
const DEALER_LEER = { name: '', beschreibung: '', logoUrl: '', webseite: '', kontaktEmail: '', provisionSatz: '10', aktiv: true };

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

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [report, setReport] = useState<ProvisionReport | null>(null);
  const [portalLink, setPortalLink] = useState<{ name: string; url: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, s, o, r] = await Promise.all([
        api.get<MarketplaceProduct[]>('/platform/marketplace/products'),
        api.get<MarketplaceDealer[]>('/platform/marketplace/dealers'),
        api.get<Stats>('/platform/marketplace/stats'),
        api.get<MarketplaceOrder[]>('/platform/marketplace/orders'),
        api.get<ProvisionReport>('/platform/marketplace/provisionen'),
      ]);
      setProdukte(p);
      setHaendler(d);
      setStats(s);
      setOrders(o);
      setReport(r);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Marktplatz-Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Neuen Portal-Link ausstellen (invalidiert den alten) und anzeigen. */
  async function portalLinkAusstellen(d: MarketplaceDealer) {
    setError('');
    try {
      const res = await api.post<{ portalPfad: string }>(`/platform/marketplace/dealers/${d.id}/portal-token`);
      setPortalLink({ name: d.name, url: `${window.location.origin}${res.portalPfad}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal-Link konnte nicht erstellt werden');
    }
  }

  async function setOrderStatus(orderId: string, status: MarketplaceOrderStatus) {
    setError('');
    try {
      await api.patch(`/platform/marketplace/orders/${orderId}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status konnte nicht geändert werden');
    }
  }

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
            beschreibung: p.beschreibung ?? '', bestellbar: !!p.bestellbar, aktiv: p.aktiv !== false,
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
        bestellbar: prod.bestellbar,
        aktiv: prod.aktiv,
      };
      if (prod.affiliateUrl.trim()) payload.affiliateUrl = prod.affiliateUrl.trim();
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

  function openDealer(d?: MarketplaceDealer & { kontaktEmail?: string; provisionSatz?: number }) {
    setDealerEditId(d?.id ?? null);
    setDealer(
      d
        ? {
            name: d.name, beschreibung: d.beschreibung ?? '', logoUrl: d.logoUrl ?? '', webseite: d.webseite ?? '',
            kontaktEmail: d.kontaktEmail ?? '', provisionSatz: d.provisionSatz != null ? String(d.provisionSatz) : '10',
            aktiv: d.aktiv !== false,
          }
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
      if (dealer.kontaktEmail.trim()) payload.kontaktEmail = dealer.kontaktEmail.trim();
      if (dealer.provisionSatz.trim() !== '') payload.provisionSatz = Number(dealer.provisionSatz);
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
    { key: 'bestellungen', label: `Bestellungen${orders.filter((o) => o.status === 'eingegangen').length ? ` (${orders.filter((o) => o.status === 'eingegangen').length})` : ''}` },
    { key: 'provisionen', label: 'Provisionen' },
    { key: 'statistik', label: 'Statistik' },
  ];

  const kategorien = Array.from(new Set(produkte.map((p) => p.kategorie)));

  return (
    <div>
      <PageHeader
        title="Marktplatz-Pflege"
        subtitle="Händler, Produkte und Bestellungen – Verdienst über Provisionen je Bestellung plus Affiliate-Klicks."
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
                  <tr><th>Händler</th><th>Webseite</th><th className="text-right">Provision</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {haendler.map((d) => (
                    <tr key={d.id} className={d.aktiv === false ? 'opacity-60' : undefined}>
                      <td className="font-medium">{d.name}</td>
                      <td className="text-chrome-400">{d.webseite || '–'}</td>
                      <td className="text-right tabular-nums">
                        {(d as { provisionSatz?: number }).provisionSatz != null
                          ? `${Number((d as { provisionSatz?: number }).provisionSatz)} %`
                          : '–'}
                      </td>
                      <td>
                        {d.aktiv === false ? <Badge className="badge-neutral">Inaktiv</Badge> : <Badge className="badge-positive">Aktiv</Badge>}
                      </td>
                      <td className="space-x-3 text-right">
                        <button className="text-copper hover:underline" onClick={() => portalLinkAusstellen(d)}>Portal-Link</button>
                        <button className="text-copper hover:underline" onClick={() => openDealer(d)}>Bearbeiten</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'bestellungen' ? (
        <div className="card">
          {orders.length === 0 ? (
            <Empty text="Noch keine Marktplatz-Bestellungen." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nummer</th><th>Datum</th><th>Händler</th><th>Besteller</th>
                    <th className="text-right">Summe</th><th className="text-right">Provision</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className={o.status === 'storniert' ? 'opacity-60' : undefined}>
                      <td className="font-mono text-xs">{o.nummer}</td>
                      <td className="whitespace-nowrap text-chrome-400">
                        {new Date(o.createdAt).toLocaleDateString('de-DE')}
                      </td>
                      <td>{o.haendlerName}</td>
                      <td className="text-chrome-400">{o.lieferFirma || o.kontaktName}</td>
                      <td className="text-right tabular-nums">{eur(Number(o.summeBrutto))}</td>
                      <td className="text-right tabular-nums text-copper">{eur(Number(o.summeProvision))}</td>
                      <td>
                        <select
                          className="input h-8 w-auto py-0 text-xs"
                          value={o.status}
                          onChange={(e) => setOrderStatus(o.id, e.target.value as MarketplaceOrderStatus)}
                          aria-label={`Status von ${o.nummer}`}
                        >
                          {ORDER_STATUS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'provisionen' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Bestellungen', wert: String(report?.summe.bestellungen ?? 0) },
              { label: 'Bestellumsatz', wert: eur(report?.summe.umsatz ?? 0) },
              { label: 'Provision (Marge)', wert: eur(report?.summe.provision ?? 0), copper: true },
              { label: 'Affiliate-Klicks', wert: String(report?.summe.klicks ?? 0) },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-chrome-500">{k.label}</p>
                <p className={`mt-1 font-display text-xl font-bold ${k.copper ? 'text-copper' : 'text-chrome-50'}`}>{k.wert}</p>
              </div>
            ))}
          </div>
          <SectionCard title="Je Händler" subtitle="Stornierte Bestellungen sind ausgenommen">
            {!report || report.zeilen.length === 0 ? (
              <Empty text="Noch keine Händler angelegt." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Händler</th><th className="text-right">Satz</th><th className="text-right">Bestellungen</th>
                      <th className="text-right">Umsatz</th><th className="text-right">Provision</th><th className="text-right">Klicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.zeilen.map((z) => (
                      <tr key={z.dealerId} className={!z.aktiv ? 'opacity-60' : undefined}>
                        <td className="font-medium">{z.name}</td>
                        <td className="text-right tabular-nums">{z.provisionSatz} %</td>
                        <td className="text-right tabular-nums">{z.bestellungen}</td>
                        <td className="text-right tabular-nums">{eur(z.umsatz)}</td>
                        <td className="text-right tabular-nums font-semibold text-copper">{eur(z.provision)}</td>
                        <td className="text-right tabular-nums">{z.klicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
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
            <label className="label">Affiliate-Link <span className="text-chrome-600">(optional bei bestellbaren Produkten)</span></label>
            <input type="url" className="input" value={prod.affiliateUrl} onChange={(e) => setProd({ ...prod, affiliateUrl: e.target.value })} placeholder="https://haendler.de/produkt?aff=detailly" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
            <input type="checkbox" className="h-4 w-4 accent-copper" checked={prod.bestellbar} onChange={(e) => setProd({ ...prod, bestellbar: e.target.checked })} />
            Direkt in der App bestellbar (fester Preis nötig)
          </label>
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
            <div className="field">
              <label className="label">Kontakt-E-Mail <span className="text-chrome-600">(Bestell-Info)</span></label>
              <input type="email" className="input" value={dealer.kontaktEmail} onChange={(e) => setDealer({ ...dealer, kontaktEmail: e.target.value })} placeholder="bestellung@haendler.de" />
            </div>
            <div className="field">
              <label className="label">Provision an Detailly (%)</label>
              <input type="number" step="0.5" min="0" max="100" className="input" value={dealer.provisionSatz} onChange={(e) => setDealer({ ...dealer, provisionSatz: e.target.value })} />
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

      {/* Portal-Link-Anzeige (einmalig nach dem Ausstellen) */}
      <Modal open={portalLink !== null} onClose={() => setPortalLink(null)} title="Händler-Portal-Link">
        {portalLink && (
          <div className="space-y-4">
            <p className="text-sm text-chrome-300">
              Neuer Zugangslink für <strong className="text-chrome-50">{portalLink.name}</strong>. Ein evtl.
              vorheriger Link ist ab sofort ungültig. Bitte sicher an den Händler übermitteln:
            </p>
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-mono text-xs" readOnly value={portalLink.url} onFocus={(e) => e.target.select()} />
              <button
                className="btn-primary btn-sm shrink-0"
                onClick={() => navigator.clipboard?.writeText(portalLink.url).catch(() => undefined)}
              >
                Kopieren
              </button>
            </div>
            <p className="text-xs text-chrome-500">
              Über diesen Link pflegt der Händler seine Produkte und wickelt Bestellungen ab – ohne eigenes Login.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
