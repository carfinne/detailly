'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Product } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { BestandTab } from '@/components/shop/BestandTab';
import { FolienBibliothekTab } from '@/components/shop/FolienBibliothekTab';
import { VermietungTab } from '@/components/shop/VermietungTab';

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

// Enum->i18n-Key (Rohwert-Fallback via t()). Farb-Map und Zustands-Automat
// (PO_STATUS_COLOR/PO_NEXT) bleiben unuebersetzt – nur die Labels werden lokal
// im Seiten-Namespace gefuehrt.
const PO_STATUS_KEY: Record<string, string> = {
  entwurf: 'shop.poStatus.entwurf',
  eingereicht: 'shop.poStatus.eingereicht',
  freigegeben: 'shop.poStatus.freigegeben',
  bestellt: 'shop.poStatus.bestellt',
  geliefert: 'shop.poStatus.geliefert',
  abgelehnt: 'shop.poStatus.abgelehnt',
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

type ShopTab = 'bestand' | 'folien' | 'einkauf' | 'vermietung';

export default function ShopPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<ShopTab>('bestand');
  const [products, setProducts] = useState<Product[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  // UI-Gating spiegelt die Backend-Guards: Verwaltung/Import Leitung, Buchen
  // zusaetzlich Technician, Vermietung zusaetzlich Empfang.
  const darfVerwalten = !!user && LEITUNG_ROLLEN.includes(user.role);
  const darfBuchen = darfVerwalten || user?.role === 'technician';
  const darfVermieten = darfVerwalten || user?.role === 'receptionist';

  const [prodCreateOpen, setProdCreateOpen] = useState(false);
  const [rentalCreateOpen, setRentalCreateOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const [poOpen, setPoOpen] = useState(false);
  const [poLieferant, setPoLieferant] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // includeInactive: deaktivierte Produkte bleiben erreichbar (Reaktivieren
      // im Bestand-Tab); die Tabs filtern die Anzeige selbst.
      const [p, o] = await Promise.all([
        api.get<Product[]>('/shop/products?includeInactive=true'),
        api.get<PurchaseOrder[]>('/shop/purchase-orders'),
      ]);
      setProducts(p);
      setPos(o);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  /** Kuratierten Folien-Vorlagenkatalog importieren (idempotent, Ergebnis-Toast). */
  async function importFolien() {
    setImportBusy(true);
    try {
      const res = await api.post<{ angelegt: number; uebersprungen: number }>('/shop/products/folien-vorlagen');
      toast(t('shop.folien.importResult', { angelegt: res.angelegt, uebersprungen: res.uebersprungen }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setImportBusy(false);
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
      setModalError(e instanceof Error ? e.message : t('shop.error.save'));
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
      setError(e instanceof Error ? e.message : t('shop.error.statusChange'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('shop.title')}
        subtitle={t('shop.subtitle')}
        action={
          tab === 'bestand' ? (
            darfVerwalten ? (
              <button className="btn-primary" onClick={() => setProdCreateOpen(true)}>
                {t('shop.newProduct')}
              </button>
            ) : undefined
          ) : tab === 'folien' ? (
            darfVerwalten ? (
              <button className="btn-primary" onClick={importFolien} disabled={importBusy}>
                {importBusy && <span className="spinner" />}
                {importBusy ? t('shop.folien.importing') : t('shop.folien.import')}
              </button>
            ) : undefined
          ) : tab === 'einkauf' ? (
            <button className="btn-primary" onClick={() => { setModalError(''); setPoOpen(true); }}>
              {t('shop.newOrder')}
            </button>
          ) : darfVermieten ? (
            <button className="btn-primary" onClick={() => setRentalCreateOpen(true)}>
              {t('shop.rental.new')}
            </button>
          ) : undefined
        }
      />

      <div className="seg-group mb-4">
        <button className={`seg ${tab === 'bestand' ? 'seg-active' : ''}`} onClick={() => setTab('bestand')}>
          {t('shop.tab.bestand')}
        </button>
        <button className={`seg ${tab === 'folien' ? 'seg-active' : ''}`} onClick={() => setTab('folien')}>
          {t('shop.tab.folien')}
        </button>
        <button className={`seg ${tab === 'einkauf' ? 'seg-active' : ''}`} onClick={() => setTab('einkauf')}>
          {t('shop.tab.orders')}
        </button>
        <button className={`seg ${tab === 'vermietung' ? 'seg-active' : ''}`} onClick={() => setTab('vermietung')}>
          {t('shop.tab.vermietung')}
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : tab === 'bestand' ? (
        <BestandTab
          products={products}
          onReload={load}
          darfVerwalten={darfVerwalten}
          darfBuchen={darfBuchen}
          createOpen={prodCreateOpen}
          onCreateClose={() => setProdCreateOpen(false)}
        />
      ) : tab === 'folien' ? (
        <FolienBibliothekTab
          products={products}
          darfVerwalten={darfVerwalten}
          onImport={importFolien}
          importBusy={importBusy}
        />
      ) : tab === 'vermietung' ? (
        <VermietungTab
          products={products}
          darfVermieten={darfVermieten}
          createOpen={rentalCreateOpen}
          onCreateClose={() => setRentalCreateOpen(false)}
        />
      ) : (
        <div className="card">
          {pos.length === 0 ? (
            <Empty text={t('shop.orders.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('shop.col.nummer')}</th>
                    <th>{t('shop.col.lieferant')}</th>
                    <th>{t('shop.col.status')}</th>
                    <th className="text-right">{t('shop.col.summe')}</th>
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
                          {PO_STATUS_KEY[po.status] ? t(PO_STATUS_KEY[po.status]) : po.status}
                        </Badge>
                      </td>
                      <td className="text-right">{eur(po.summe)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {(PO_NEXT[po.status] ?? []).map((s) => (
                            <button
                              key={s}
                              className="link-action text-xs disabled:opacity-50"
                              disabled={busy}
                              onClick={() => poStatus(po.id, s)}
                            >
                              → {PO_STATUS_KEY[s] ? t(PO_STATUS_KEY[s]) : s}
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

      <Modal open={poOpen} onClose={() => setPoOpen(false)} title={t('shop.newOrder')}>
        <form onSubmit={savePo} className="space-y-4">
          <div>
            <label className="label">{t('shop.form.lieferant')}</label>
            <input className="input" value={poLieferant} onChange={(e) => setPoLieferant(e.target.value)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">{t('shop.form.positionen')}</label>
              <button type="button" className="link-action text-sm" onClick={() => setPoItems((p) => [...p, { beschreibung: '', menge: 1, einzelpreis: 0 }])}>
                {t('shop.form.addPosition')}
              </button>
            </div>
            <div className="space-y-2">
              {poItems.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-6" placeholder={t('shop.placeholder.beschreibung')} value={it.beschreibung} onChange={(e) => setPoItems((p) => p.map((x, idx) => (idx === i ? { ...x, beschreibung: e.target.value } : x)))} />
                  <input type="number" className="input col-span-3" placeholder={t('shop.placeholder.menge')} value={it.menge} onChange={(e) => setPoItems((p) => p.map((x, idx) => (idx === i ? { ...x, menge: Number(e.target.value) } : x)))} />
                  <input type="number" step="0.01" className="input col-span-3" placeholder={t('shop.placeholder.preis')} value={it.einzelpreis} onChange={(e) => setPoItems((p) => p.map((x, idx) => (idx === i ? { ...x, einzelpreis: Number(e.target.value) } : x)))} />
                </div>
              ))}
            </div>
          </div>

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPoOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('shop.saving') : t('shop.createOrder')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
