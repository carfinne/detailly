'use client';

// Materialverbrauch je Auftrag (Lager -> Auftrag). Erfassen senkt den Bestand,
// Loeschen (nur Leitung) bucht ihn zurueck. Jeder kann erfassen; die
// Bestands-Rueckbuchung beim Loeschen ist Leitung vorbehalten.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { OrderMaterial, Product } from '@/lib/types';
import { Loading, Empty } from '@/components/ui';

const LEITUNG = ['super_admin', 'franchise_owner', 'manager'];

const mengeFmt = (n: number) =>
  Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function OrderMaterialCard({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG.includes(user.role);

  const [eintraege, setEintraege] = useState<OrderMaterial[]>([]);
  const [produkte, setProdukte] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [productId, setProductId] = useState('');
  const [menge, setMenge] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        api.get<OrderMaterial[]>(`/order-materials?orderId=${orderId}`),
        api.get<Product[]>('/shop/products'),
      ]);
      setEintraege(m);
      setProdukte(p.filter((x) => x.aktiv !== false));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Material konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function bucheMaterial(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(menge);
    if (!productId || !Number.isFinite(m) || m <= 0) {
      setError('Bitte Produkt und eine Menge größer als 0 wählen.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/order-materials', { orderId, productId, menge: m });
      setMenge('');
      setProductId('');
      await load(); // laedt auch den aktualisierten Bestand der Produkte
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Buchen fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function entfernen(id: string) {
    if (!window.confirm('Materialbuchung löschen? Der Bestand wird zurückgebucht.')) return;
    setBusyId(id);
    try {
      await api.delete(`/order-materials/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Material</h2>
        <span className="text-xs text-chrome-500">Verbrauch senkt den Lagerbestand</span>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Erfassen */}
      <form onSubmit={bucheMaterial} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="label">Produkt</label>
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">– wählen –</option>
            {produkte.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Bestand {mengeFmt(p.bestand)} {p.einheit})
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="label">Menge</label>
          <input type="number" step="0.01" min="0" className="input" value={menge} onChange={(e) => setMenge(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Bucht…' : 'Buchen'}
        </button>
      </form>

      {loading ? (
        <Loading />
      ) : eintraege.length === 0 ? (
        <Empty text="Noch kein Material gebucht." />
      ) : (
        <ul className="divide-y divide-ink-700/50">
          {eintraege.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-chrome-100">{m.produktName}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-chrome-50">
                {mengeFmt(m.menge)} {m.einheit}
              </span>
              {istLeitung && (
                <button
                  className="link-danger shrink-0 text-xs disabled:opacity-50"
                  disabled={busyId === m.id}
                  onClick={() => entfernen(m.id)}
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
