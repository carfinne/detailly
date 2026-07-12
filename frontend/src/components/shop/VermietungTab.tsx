'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { toNum } from '@/lib/lfm-rechner';
import type { Customer, Product, Rental } from '@/lib/types';
import { Badge, Empty, ErrorBox, Loading, Modal, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Rental-Status -> i18n-Key + Badge-Farbe (Rohwert-Fallback via t()).
const RENTAL_STATUS_KEY: Record<string, string> = {
  reserviert: 'shop.rental.status.reserviert',
  aktiv: 'shop.rental.status.aktiv',
  zurueck: 'shop.rental.status.zurueck',
};
const RENTAL_STATUS_COLOR: Record<string, string> = {
  reserviert: 'badge-caution',
  aktiv: 'badge-copper',
  zurueck: 'badge-positive',
};

const FORM_LEER = { productId: '', customerId: '', von: '', bis: '', preis: '' };

/**
 * Tab "Vermietung": Liste aller Vermietungen (Produkt/Kunde/Zeitraum/Status),
 * Anlegen-Dialog (nur istVermietbar-Produkte, Kunde Pflicht laut DTO, 409-
 * Overlap sauber im Modal) und Statuswechsel Übergeben/Rückgabe
 * (PATCH /shop/rentals/:id/status).
 */
export function VermietungTab({
  products,
  darfVermieten,
  createOpen,
  onCreateClose,
}: {
  products: Product[];
  darfVermieten: boolean;
  createOpen: boolean;
  onCreateClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [rentals, setRentals] = useState<Rental[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(FORM_LEER);
  // Preis nur so lange automatisch vorschlagen, wie er nicht manuell editiert wurde.
  const [preisTouched, setPreisTouched] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api.get<Rental[]>('/shop/rentals'),
        api.get<Customer[]>('/customers/select'),
      ]);
      setRentals(r);
      setCustomers(c);
      setError('');
    } catch (e) {
      setRentals([]);
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Dialog frisch aufsetzen, wenn die Seite ihn öffnet.
  useEffect(() => {
    if (createOpen) {
      setForm(FORM_LEER);
      setPreisTouched(false);
      setModalError('');
    }
  }, [createOpen]);

  const produktVon = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const kundeVon = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const vermietbar = useMemo(
    () => products.filter((p) => p.istVermietbar && p.aktiv !== false),
    [products],
  );

  // Preisvorschlag: Tage × Mietpreis/Tag des gewählten Produkts.
  useEffect(() => {
    if (!createOpen || preisTouched) return;
    const produkt = produktVon.get(form.productId);
    const satz = toNum(produkt?.mietpreisProTag);
    if (!produkt || satz <= 0 || !form.von || !form.bis) return;
    const von = new Date(form.von).getTime();
    const bis = new Date(form.bis).getTime();
    if (!(bis > von)) return;
    const tage = Math.max(1, Math.round((bis - von) / 86400000));
    setForm((f) => ({ ...f, preis: (tage * satz).toFixed(2) }));
  }, [createOpen, preisTouched, form.productId, form.von, form.bis, produktVon]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        productId: form.productId,
        customerId: form.customerId,
        von: form.von,
        bis: form.bis,
      };
      if (form.preis) payload.preis = Number(form.preis);
      await api.post('/shop/rentals', payload);
      toast(t('shop.rental.toast.created'));
      onCreateClose();
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setModalError(t('shop.rental.overlap'));
      } else {
        setModalError(err instanceof Error ? err.message : t('shop.error.save'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(rental: Rental, status: 'aktiv' | 'zurueck') {
    setBusy(true);
    try {
      await api.patch(`/shop/rentals/${rental.id}/status`, { status });
      toast(t('shop.rental.toast.status'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shop.error.statusChange'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {error && <ErrorBox message={error} className="mb-4" />}

      {rentals === null ? (
        <Loading />
      ) : (
        <div className="card">
          {rentals.length === 0 ? (
            <Empty text={t('shop.rental.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('shop.col.product')}</th>
                    <th>{t('shop.rental.col.kunde')}</th>
                    <th>{t('shop.rental.col.zeitraum')}</th>
                    <th className="text-right">{t('shop.rental.col.preis')}</th>
                    <th>{t('shop.col.status')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{produktVon.get(r.productId)?.name ?? '–'}</td>
                      <td>{kundenName(kundeVon.get(r.customerId))}</td>
                      <td className="whitespace-nowrap">
                        {datum(r.von)} – {datum(r.bis)}
                      </td>
                      <td className="text-right">{eur(r.preis)}</td>
                      <td>
                        <Badge className={RENTAL_STATUS_COLOR[r.status] ?? 'badge-neutral'}>
                          {RENTAL_STATUS_KEY[r.status] ? t(RENTAL_STATUS_KEY[r.status]) : r.status}
                        </Badge>
                      </td>
                      <td className="text-right">
                        {darfVermieten && (
                          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                            {r.status === 'reserviert' && (
                              <button className="link-action text-xs" disabled={busy} onClick={() => setStatus(r, 'aktiv')}>
                                {t('shop.rental.action.uebergeben')}
                              </button>
                            )}
                            {r.status !== 'zurueck' && (
                              <button className="link-action text-xs" disabled={busy} onClick={() => setStatus(r, 'zurueck')}>
                                {t('shop.rental.action.ruecknahme')}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Neue Vermietung */}
      <Modal open={createOpen} onClose={onCreateClose} title={t('shop.rental.new')}>
        {vermietbar.length === 0 ? (
          <div className="space-y-5">
            <p className="text-sm text-chrome-300">{t('shop.rental.noRentable')}</p>
            <div className="flex justify-end">
              <button type="button" className="btn-ghost" onClick={onCreateClose}>{t('common.close')}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('shop.rental.form.produkt')}</label>
                <select
                  className="input"
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  required
                >
                  <option value="">{t('shop.rental.form.select')}</option>
                  {vermietbar.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('shop.rental.form.kunde')}</label>
                <select
                  className="input"
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  required
                >
                  <option value="">{t('shop.rental.form.select')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {kundenName(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('shop.rental.form.von')}</label>
                <input type="date" className="input" value={form.von} onChange={(e) => setForm({ ...form, von: e.target.value })} required />
              </div>
              <div>
                <label className="label">{t('shop.rental.form.bis')}</label>
                <input type="date" className="input" value={form.bis} min={form.von || undefined} onChange={(e) => setForm({ ...form, bis: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="label">{t('shop.rental.form.preis')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.preis}
                onChange={(e) => {
                  setPreisTouched(true);
                  setForm({ ...form, preis: e.target.value });
                }}
              />
            </div>

            {modalError && <ErrorBox message={modalError} />}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onCreateClose}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy && <span className="spinner" />}
                {t('shop.rental.create')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
