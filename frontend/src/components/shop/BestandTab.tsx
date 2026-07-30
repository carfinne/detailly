'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur, datumZeit } from '@/lib/format';
import { toNum } from '@/lib/lfm-rechner';
import type { Product, StockMovement } from '@/lib/types';
import { Badge, ConfirmDialog, Empty, ErrorBox, Loading, Modal, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { useT } from '@/lib/i18n';
import { SlideOver } from './SlideOver';

// Buchungsarten -> i18n-Keys (Rohwert-Fallback via t(), Muster PO_STATUS_KEY).
const MOVEMENT_KEY: Record<string, string> = {
  zugang: 'shop.movement.zugang',
  abgang: 'shop.movement.abgang',
  inventur: 'shop.movement.inventur',
};

const PROD_LEER = {
  name: '',
  sku: '',
  kategorie: '',
  einheit: '',
  einkaufspreis: '',
  verkaufspreis: '',
  bestand: '',
  mindestbestand: '',
  istVermietbar: false,
  mietpreisProTag: '',
  hersteller: '',
  serie: '',
  farbcode: '',
  finish: '',
  breiteCm: '',
};
type ProdForm = typeof PROD_LEER;

function formAusProdukt(p: Product): ProdForm {
  return {
    name: p.name ?? '',
    sku: p.sku ?? '',
    kategorie: p.kategorie ?? '',
    einheit: p.einheit ?? '',
    einkaufspreis: p.einkaufspreis != null ? String(p.einkaufspreis) : '',
    verkaufspreis: p.verkaufspreis != null ? String(p.verkaufspreis) : '',
    bestand: '',
    mindestbestand: p.mindestbestand != null ? String(p.mindestbestand) : '',
    istVermietbar: !!p.istVermietbar,
    mietpreisProTag: p.mietpreisProTag != null ? String(p.mietpreisProTag) : '',
    hersteller: p.hersteller ?? '',
    serie: p.serie ?? '',
    farbcode: p.farbcode ?? '',
    finish: p.finish ?? '',
    breiteCm: p.breiteCm != null ? String(p.breiteCm) : '',
  };
}

/**
 * Tab "Bestand": Produktliste mit Low-Stock-/Inaktiv-Filter, Bestandsbuchung
 * (Zugang/Abgang/Inventur), Bewegungshistorie als Slide-over sowie Produkt
 * bearbeiten/deaktivieren. Rollen: Buchen inkl. Technician, Verwaltung Leitung
 * (spiegelt die Backend-Guards).
 */
export function BestandTab({
  products,
  onReload,
  darfVerwalten,
  darfBuchen,
  createOpen,
  onCreateClose,
}: {
  products: Product[];
  onReload: () => Promise<void>;
  darfVerwalten: boolean;
  darfBuchen: boolean;
  createOpen: boolean;
  onCreateClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [lowOnly, setLowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  // Buchen-Dialog
  const [bookFor, setBookFor] = useState<Product | null>(null);
  const [bookTyp, setBookTyp] = useState<'zugang' | 'abgang' | 'inventur'>('zugang');
  const [bookMenge, setBookMenge] = useState('');
  const [bookGrund, setBookGrund] = useState('');

  // Historie-Slide-over
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);

  // Produkt-Modal (neu über createOpen-Prop, bearbeiten über edit-State)
  const [edit, setEdit] = useState<Product | null>(null);
  const [form, setForm] = useState<ProdForm>(PROD_LEER);
  const [deactivate, setDeactivate] = useState<Product | null>(null);

  // Neues Produkt: Formular frisch aufsetzen, sobald die Seite das Modal öffnet.
  useEffect(() => {
    if (createOpen) {
      setEdit(null);
      setForm(PROD_LEER);
      setModalError('');
    }
  }, [createOpen]);

  // Historie nachladen, sobald ein Produkt gewählt ist (animierter Ladezustand).
  useEffect(() => {
    if (!historyFor) return;
    let aktiv = true;
    setMovements(null);
    api
      .get<StockMovement[]>(`/shop/movements?productId=${historyFor.id}`)
      .then((m) => {
        if (aktiv) setMovements(m);
      })
      .catch(() => {
        if (aktiv) setMovements([]);
      });
    return () => {
      aktiv = false;
    };
  }, [historyFor]);

  const sichtbar = products.filter((p) => {
    if (!showInactive && p.aktiv === false) return false;
    if (lowOnly && toNum(p.bestand) > toNum(p.mindestbestand)) return false;
    return true;
  });

  const modalOpen = createOpen || edit !== null;
  const istFolie = form.kategorie.trim().toLowerCase() === 'folie';

  function openEdit(p: Product) {
    setForm(formAusProdukt(p));
    setEdit(p);
    setModalError('');
  }

  function closeModal() {
    setEdit(null);
    if (createOpen) onCreateClose();
  }

  function openBook(p: Product) {
    setBookFor(p);
    setBookTyp('zugang');
    setBookMenge('');
    setBookGrund('');
    setModalError('');
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, istVermietbar: form.istVermietbar };
      if (form.sku) payload.sku = form.sku;
      if (form.kategorie) payload.kategorie = form.kategorie;
      if (form.einheit) payload.einheit = form.einheit;
      if (form.einkaufspreis) payload.einkaufspreis = Number(form.einkaufspreis);
      if (form.verkaufspreis) payload.verkaufspreis = Number(form.verkaufspreis);
      if (form.mindestbestand) payload.mindestbestand = Number(form.mindestbestand);
      if (form.istVermietbar && form.mietpreisProTag) payload.mietpreisProTag = Number(form.mietpreisProTag);
      if (istFolie) {
        if (form.hersteller) payload.hersteller = form.hersteller;
        if (form.serie) payload.serie = form.serie;
        if (form.farbcode) payload.farbcode = form.farbcode;
        if (form.finish) payload.finish = form.finish;
        if (form.breiteCm) payload.breiteCm = Number(form.breiteCm);
      }
      if (edit) {
        // Bestand wird bewusst NICHT über das Formular geändert – dafür gibt es
        // die nachvollziehbare Bestandsbuchung (Zugang/Abgang/Inventur).
        await api.patch(`/shop/products/${edit.id}`, payload);
      } else {
        if (form.bestand) payload.bestand = Number(form.bestand);
        await api.post('/shop/products', payload);
      }
      toast(t('shop.toast.saved'));
      closeModal();
      await onReload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('shop.error.save'));
    } finally {
      setBusy(false);
    }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!bookFor) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { typ: bookTyp, menge: Number(bookMenge) };
      if (bookGrund.trim()) payload.grund = bookGrund.trim();
      await api.post(`/shop/products/${bookFor.id}/movements`, payload);
      toast(t('shop.toast.booked'));
      setBookFor(null);
      await onReload();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('shop.error.save'));
    } finally {
      setBusy(false);
    }
  }

  async function doDeactivate() {
    if (!deactivate) return;
    setBusy(true);
    try {
      await api.delete(`/shop/products/${deactivate.id}`);
      toast(t('shop.toast.deactivated'), { variant: 'copper' });
      setDeactivate(null);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setDeactivate(null);
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(p: Product) {
    setBusy(true);
    try {
      await api.patch(`/shop/products/${p.id}`, { aktiv: true });
      toast(t('shop.toast.reactivated'));
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {error && <ErrorBox message={error} className="mb-4" />}

      {/* Filterzeile */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-300">
          <input type="checkbox" className="accent-copper" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          {t('shop.filter.lowStock')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-300">
          <input type="checkbox" className="accent-copper" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t('shop.filter.showInactive')}
        </label>
      </div>

      <div className="card">
        {sichtbar.length === 0 ? (
          <Empty text={t('shop.products.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('shop.col.product')}</th>
                  <th>{t('shop.col.sku')}</th>
                  <th className="text-end">{t('shop.col.stock')}</th>
                  <th className="text-end">{t('shop.col.vk')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((p) => {
                  const low = toNum(p.bestand) <= toNum(p.mindestbestand);
                  const inaktiv = p.aktiv === false;
                  return (
                    <tr key={p.id} className={inaktiv ? 'opacity-60' : ''}>
                      <td className="font-medium">
                        {p.name}
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {inaktiv && <Badge className="badge-neutral">{t('shop.badge.inactive')}</Badge>}
                          {low && !inaktiv && <Badge className="badge-danger">{t('shop.badge.belowMin')}</Badge>}
                          {p.istVermietbar && <Badge className="badge-info">{t('shop.badge.rentable')}</Badge>}
                        </span>
                      </td>
                      <td>{p.sku}</td>
                      <td className="text-end tabular-nums">
                        {p.bestand} {p.einheit}
                      </td>
                      <td className="text-end tabular-nums">{eur(p.verkaufspreis)}</td>
                      <td className="text-end">
                        {/* Haeufigste Tagesaktion (Bestand buchen) bleibt als direkter
                            Button in der Zeile; die uebrigen Aktionen buendelt das
                            projektweite ActionMenu (⋯) – ruhigere, konsistente Liste. */}
                        <div className="flex items-center justify-end gap-2">
                          {darfBuchen && !inaktiv && (
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => openBook(p)}
                            >
                              {t('shop.action.book')}
                            </button>
                          )}
                          <ActionMenu
                            label={t('shop.actionsFor', { name: p.name })}
                            items={[
                              { key: 'history', label: t('shop.action.history'), onSelect: () => setHistoryFor(p) },
                              ...(darfVerwalten
                                ? [
                                    { key: 'edit', label: t('shop.action.edit'), onSelect: () => openEdit(p) },
                                    inaktiv
                                      ? {
                                          key: 'reactivate',
                                          label: t('shop.action.reactivate'),
                                          disabled: busy,
                                          onSelect: () => reactivate(p),
                                        }
                                      : {
                                          key: 'deactivate',
                                          label: t('shop.action.deactivate'),
                                          danger: true,
                                          disabled: busy,
                                          onSelect: () => setDeactivate(p),
                                        },
                                  ]
                                : []),
                            ] satisfies ActionMenuItem[]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Produkt neu/bearbeiten */}
      <Modal open={modalOpen} onClose={closeModal} title={edit ? t('shop.editProduct') : t('shop.newProduct')}>
        <form onSubmit={saveProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('shop.form.name')}</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">{t('shop.form.sku')}</label>
              <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('shop.form.kategorie')}</label>
              <input className="input" value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })} list="shop-kategorien" />
              <datalist id="shop-kategorien">
                <option value="folie" />
              </datalist>
            </div>
            <div>
              <label className="label">{t('shop.form.einheit')}</label>
              <input className="input" value={form.einheit} onChange={(e) => setForm({ ...form, einheit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('shop.form.einkaufspreis')}</label>
              <input type="number" step="0.01" className="input" value={form.einkaufspreis} onChange={(e) => setForm({ ...form, einkaufspreis: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('shop.form.verkaufspreis')}</label>
              <input type="number" step="0.01" className="input" value={form.verkaufspreis} onChange={(e) => setForm({ ...form, verkaufspreis: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!edit && (
              <div>
                <label className="label">{t('shop.form.bestand')}</label>
                <input type="number" step="0.01" className="input" value={form.bestand} onChange={(e) => setForm({ ...form, bestand: e.target.value })} />
              </div>
            )}
            <div>
              <label className="label">{t('shop.form.mindestbestand')}</label>
              <input type="number" step="0.01" className="input" value={form.mindestbestand} onChange={(e) => setForm({ ...form, mindestbestand: e.target.value })} />
            </div>
          </div>

          {/* Vermietung */}
          <div className="grid grid-cols-2 items-end gap-3">
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-chrome-300">
              <input
                type="checkbox"
                className="accent-copper"
                checked={form.istVermietbar}
                onChange={(e) => setForm({ ...form, istVermietbar: e.target.checked })}
              />
              {t('shop.form.istVermietbar')}
            </label>
            {form.istVermietbar && (
              <div className="animate-fade-in">
                <label className="label">{t('shop.form.mietpreisProTag')}</label>
                <input type="number" step="0.01" className="input" value={form.mietpreisProTag} onChange={(e) => setForm({ ...form, mietpreisProTag: e.target.value })} />
              </div>
            )}
          </div>

          {/* Folien-Attribute nur bei kategorie=folie */}
          {istFolie && (
            <div className="animate-fade-in space-y-3 rounded-xl border border-ink-700/70 bg-ink-900/40 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('shop.form.hersteller')}</label>
                  <input className="input" value={form.hersteller} onChange={(e) => setForm({ ...form, hersteller: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('shop.form.serie')}</label>
                  <input className="input" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">{t('shop.form.farbcode')}</label>
                  <input className="input" value={form.farbcode} onChange={(e) => setForm({ ...form, farbcode: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('shop.form.finish')}</label>
                  <input className="input" value={form.finish} onChange={(e) => setForm({ ...form, finish: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('shop.form.breiteCm')}</label>
                  <input type="number" step="1" min="1" max="500" className="input" value={form.breiteCm} onChange={(e) => setForm({ ...form, breiteCm: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={closeModal}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('shop.saving') : t('common.save')}</button>
          </div>
        </form>
      </Modal>

      {/* Bestand buchen */}
      <Modal
        open={bookFor !== null}
        onClose={() => setBookFor(null)}
        title={t('shop.book.title', { name: bookFor?.name ?? '' })}
        size="sm"
      >
        <form onSubmit={book} className="space-y-4">
          <p className="text-sm text-chrome-400">
            {t('shop.book.current', { menge: String(bookFor?.bestand ?? 0), einheit: bookFor?.einheit ?? '' })}
          </p>
          <div>
            <label className="label">{t('shop.book.typ')}</label>
            <div className="seg-group">
              {(['zugang', 'abgang', 'inventur'] as const).map((typ) => (
                <button
                  key={typ}
                  type="button"
                  className={`seg ${bookTyp === typ ? 'seg-active' : ''}`}
                  onClick={() => setBookTyp(typ)}
                >
                  {t(`shop.book.${typ}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{bookTyp === 'inventur' ? t('shop.book.mengeInventur') : t('shop.book.menge')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={bookMenge}
              onChange={(e) => setBookMenge(e.target.value)}
              required
              autoFocus
            />
            {bookTyp === 'inventur' && (
              <p className="mt-1.5 animate-fade-in text-xs text-caution">{t('shop.book.inventurHint')}</p>
            )}
          </div>
          <div>
            <label className="label">{t('shop.book.notiz')}</label>
            <input className="input" value={bookGrund} onChange={(e) => setBookGrund(e.target.value)} />
          </div>

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setBookFor(null)}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={busy || !bookMenge}>
              {busy && <span className="spinner" />}
              {t('shop.book.submit')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bewegungshistorie */}
      <SlideOver
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title={t('shop.history.title', { name: historyFor?.name ?? '' })}
        subtitle={historyFor?.sku || undefined}
      >
        {movements === null ? (
          <Loading />
        ) : movements.length === 0 ? (
          <p className="text-sm text-chrome-500">{t('shop.history.empty')}</p>
        ) : (
          <div className="space-y-2">
            {movements.map((m) => {
              const menge = toNum(m.menge);
              const vorzeichen = m.typ === 'zugang' ? '+' : m.typ === 'abgang' ? '−' : '=';
              const farbe = m.typ === 'zugang' ? 'text-positive' : m.typ === 'abgang' ? 'text-danger' : 'text-chrome-300';
              return (
                <div key={m.id} className="animate-fade-in rounded-xl border border-ink-700/70 bg-ink-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-chrome-200">
                      {MOVEMENT_KEY[m.typ] ? t(MOVEMENT_KEY[m.typ]) : m.typ}
                    </span>
                    <span className={`font-display text-sm font-semibold tabular-nums ${farbe}`}>
                      {vorzeichen} {menge.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-chrome-500">
                    <span className="truncate">{m.grund || ''}</span>
                    <span className="shrink-0">{datumZeit(m.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SlideOver>

      {/* Produkt deaktivieren */}
      <ConfirmDialog
        open={deactivate !== null}
        title={t('shop.deactivate.title')}
        message={t('shop.deactivate.message', { name: deactivate?.name ?? '' })}
        confirmLabel={t('shop.action.deactivate')}
        variant="neutral"
        busy={busy}
        onConfirm={doDeactivate}
        onCancel={() => setDeactivate(null)}
      />
    </div>
  );
}
