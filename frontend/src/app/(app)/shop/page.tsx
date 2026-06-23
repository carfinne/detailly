'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Product } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

interface PurchaseOrderItem {
  beschreibung: string;
  menge: number;
  einzelpreis: number;
}
interface PurchaseOrder {
  id: string;
  nummer: string;
  lieferant?: string;
  status: string;
  summe: number;
  items?: PurchaseOrderItem[];
}

const PO_STATUS_LABEL: Record<string, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  freigegeben: 'Freigegeben',
  bestellt: 'Bestellt',
  geliefert: 'Geliefert',
  abgelehnt: 'Abgelehnt',
};
const PO_STATUS_COLOR: Record<string, string> = {
  entwurf: 'badge-neutral',
  eingereicht: 'badge-caution',
  freigegeben: 'badge-info',
  bestellt: 'badge-copper',
  geliefert: 'badge-positive',
  abgelehnt: 'badge-danger',
};
const PO_NEXT: Record<string, string[]> = {
  entwurf: ['eingereicht'],
  eingereicht: ['freigegeben', 'abgelehnt'],
  freigegeben: ['bestellt'],
  bestellt: ['geliefert'],
  geliefert: [],
  abgelehnt: [],
};

const PROD_LEER = {
  name: '',
  sku: '',
  kategorie: '',
  einkaufspreis: '',
  verkaufspreis: '',
  bestand: '',
  mindestbestand: '',
  einheit: '',
};

export default function ShopPage() {
  const [tab, setTab] = useState<'produkte' | 'bestellungen'>('produkte');
  const [products, setProducts] = useState<Product[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState(PROD_LEER);

  const [poOpen, setPoOpen] = useState(false);
  const [poLieferant, setPoLieferant] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        api.get<Product[]>('/shop/products'),
        api.get<PurchaseOrder[]>('/shop/purchase-orders'),
      ]);
      setProducts(p);
      setPos(o);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { name: prodForm.name };
      if (prodForm.sku) payload.sku = prodForm.sku;
      if (prodForm.kategorie) payload.kategorie = prodForm.kategorie;
      if (prodForm.einkaufspreis) payload.einkaufspreis = Number(prodForm.einkaufspreis);
      if (prodForm.verkaufspreis) payload.verkaufspreis = Number(prodForm.verkaufspreis);
      if (prodForm.bestand) payload.bestand = Number(prodForm.bestand);
      if (prodForm.mindestbestand) payload.mindestbestand = Number(prodForm.mindestbestand);
      if (prodForm.einheit) payload.einheit = prodForm.einheit;
      await api.post('/shop/products', payload);
      setProdOpen(false);
      setProdForm(PROD_LEER);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function savePo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        items: poItems
          .filter((it) => it.beschreibung.trim())
          .map((it) => ({ beschreibung: it.beschreibung, menge: Number(it.menge), einzelpreis: Number(it.einzelpreis) })),
      };
      if (poLieferant) payload.lieferant = poLieferant;
      await api.post('/shop/purchase-orders', payload);
      setPoOpen(false);
      setPoLieferant('');
      setPoItems([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function poStatus(id: string, status: string) {
    setBusy(true);
    try {
      await api.patch(`/shop/purchase-orders/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Statuswechsel fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Shop & Lager"
        subtitle="Produkte, Bestand und Bestellfreigaben"
        action={
          tab === 'produkte' ? (
            <button className="btn-primary" onClick={() => { setProdForm(PROD_LEER); setProdOpen(true); }}>
              Neues Produkt
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setPoOpen(true)}>
              Neue Bestellung
            </button>
          )
        }
      />

      <div className="mb-4 flex gap-2">
        <button className={tab === 'produkte' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('produkte')}>
          Produkte
        </button>
        <button className={tab === 'bestellungen' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('bestellungen')}>
          Bestellungen
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : tab === 'produkte' ? (
        <div className="card">
          {products.length === 0 ? (
            <Empty text="Keine Produkte." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>SKU</th>
                    <th className="text-right">Bestand</th>
                    <th className="text-right">VK</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = Number(p.bestand) <= Number(p.mindestbestand);
                    return (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td>{p.sku}</td>
                        <td className="text-right">
                          {p.bestand} {p.einheit}
                        </td>
                        <td className="text-right">{eur(p.verkaufspreis)}</td>
                        <td className="text-right">
                          {low && <Badge className="badge-danger">Unter Mindestbestand</Badge>}
                          {p.istVermietbar && <Badge className="ml-1 badge-info">Vermietbar</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          {pos.length === 0 ? (
            <Empty text="Keine Bestellungen." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nummer</th>
                    <th>Lieferant</th>
                    <th>Status</th>
                    <th className="text-right">Summe</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id}>
                      <td className="font-medium">{po.nummer}</td>
                      <td>{po.lieferant || '–'}</td>
                      <td>
                        <Badge className={PO_STATUS_COLOR[po.status]}>
                          {PO_STATUS_LABEL[po.status] ?? po.status}
                        </Badge>
                      </td>
                      <td className="text-right">{eur(po.summe)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {(PO_NEXT[po.status] ?? []).map((s) => (
                            <button
                              key={s}
                              className="text-xs text-copper hover:underline disabled:opacity-50"
                              disabled={busy}
                              onClick={() => poStatus(po.id, s)}
                            >
                              → {PO_STATUS_LABEL[s] ?? s}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={prodOpen} onClose={() => setProdOpen(false)} title="Neues Produkt">
        <form onSubmit={saveProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input" value={prodForm.sku} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kategorie</label>
              <input className="input" value={prodForm.kategorie} onChange={(e) => setProdForm({ ...prodForm, kategorie: e.target.value })} />
            </div>
            <div>
              <label className="label">Einheit</label>
              <input className="input" value={prodForm.einheit} onChange={(e) => setProdForm({ ...prodForm, einheit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Einkaufspreis</label>
              <input type="number" step="0.01" className="input" value={prodForm.einkaufspreis} onChange={(e) => setProdForm({ ...prodForm, einkaufspreis: e.target.value })} />
            </div>
            <div>
              <label className="label">Verkaufspreis</label>
              <input type="number" step="0.01" className="input" value={prodForm.verkaufspreis} onChange={(e) => setProdForm({ ...prodForm, verkaufspreis: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Bestand</label>
              <input type="number" step="0.01" className="input" value={prodForm.bestand} onChange={(e) => setProdForm({ ...prodForm, bestand: e.target.value })} />
            </div>
            <div>
              <label className="label">Mindestbestand</label>
              <input type="number" step="0.01" className="input" value={prodForm.mindestbestand} onChange={(e) => setProdForm({ ...prodForm, mindestbestand: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setProdOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={poOpen} onClose={() => setPoOpen(false)} title="Neue Bestellung">
        <form onSubmit={savePo} className="space-y-4">
          <div>
            <label className="label">Lieferant</label>
            <input className="input" value={poLieferant} onChange={(e) => setPoLieferant(e.target.value)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Positionen</label>
              <button type="button" className="text-sm text-copper hover:underline" onClick={() => setPoItems((p) => [...p, { beschreibung: '', menge: 1, einzelpreis: 0 }])}>
                + Position
              </button>
            </div>
            <div className="space-y-2">
              {poItems.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-6" placeholder="Beschreibung" value={it.beschreibung} onChange={(e) => setPoItems((p) => p.map((x, idx) => (idx === i ? { ...x, beschreibung: e.target.value } : x)))} />
                  <input type="number" className="input col-span-3" placeholder="Menge" value={it.menge} onChange={(e) => setPoItems((p) => p.map((x, idx) => (idx === i ? { ...x, menge: Number(e.target.value) } : x)))} />
                  <input type="number" step="0.01" className="input col-span-3" placeholder="Preis" value={it.einzelpreis} onChange={(e) => setPoItems((p) => p.map((x, idx) => (idx === i ? { ...x, einzelpreis: Number(e.target.value) } : x)))} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPoOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Speichern…' : 'Bestellung anlegen'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
