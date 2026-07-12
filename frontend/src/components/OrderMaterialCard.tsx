'use client';

// Materialverbrauch je Auftrag (Lager -> Auftrag). Erfassen senkt den Bestand,
// Loeschen (nur Leitung) bucht ihn zurueck. Jeder kann erfassen; die
// Bestands-Rueckbuchung beim Loeschen ist Leitung vorbehalten.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { OrderMaterial, Product } from '@/lib/types';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { berechneLfm, toNum, VERSCHNITT_DEFAULT } from '@/lib/lfm-rechner';
import { Loading, Empty, SectionCard, ConfirmDialog } from '@/components/ui';
import { useT } from '@/lib/i18n';

const mengeFmt = (n: number) =>
  Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function OrderMaterialCard({ orderId }: { orderId: string }) {
  const t = useT();
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [eintraege, setEintraege] = useState<OrderMaterial[]>([]);
  const [produkte, setProdukte] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [productId, setProductId] = useState('');
  const [menge, setMenge] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // lfm-Helfer: aus Fläche + Verschnitt die Laufmeter-Menge der gewählten Folie
  // berechnen und ins Mengen-Feld übernehmen (füllt NUR `menge`, kein Server-State).
  const [lfmOffen, setLfmOffen] = useState(false);
  const [lfmFlaeche, setLfmFlaeche] = useState('');
  const [lfmVerschnitt, setLfmVerschnitt] = useState(VERSCHNITT_DEFAULT);
  const gewaehltesProdukt = produkte.find((p) => p.id === productId);
  const breiteCm = toNum(gewaehltesProdukt?.breiteCm);
  const lfmErgebnis = berechneLfm({
    flaecheQm: toNum(lfmFlaeche),
    breiteCm,
    verschnittProzent: lfmVerschnitt,
    einkaufspreis: 0,
    verkaufspreis: 0,
  });

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
      setError(e instanceof Error ? e.message : t('ui.material.loadError'));
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
      setError(t('ui.material.validation'));
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
      setError(err instanceof Error ? err.message : t('ui.material.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function entfernen(id: string) {
    setBusyId(id);
    try {
      await api.delete(`/order-materials/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ui.material.deleteError'));
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  return (
    <SectionCard
      title={t('auftraege.detail.material')}
      action={<span className="text-xs text-chrome-500">{t('ui.material.hint')}</span>}
    >
      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Erfassen */}
      <form onSubmit={bucheMaterial} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="label">{t('ui.material.product')}</label>
          <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t('ui.material.choose')}</option>
            {produkte.map((p) => (
              <option key={p.id} value={p.id}>
                {t('ui.material.option', { name: p.name, menge: mengeFmt(p.bestand), einheit: p.einheit ?? '' })}
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="label">{t('ui.material.menge')}</label>
          <input type="number" step="0.01" min="0" className="input" value={menge} onChange={(e) => setMenge(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('ui.material.booking') : t('ui.material.book')}
        </button>
      </form>

      {/* lfm-Helfer: Fläche → Laufmeter der gewählten Folie → ins Mengen-Feld. */}
      {productId && (
        <div className="mb-4">
          <button
            type="button"
            className="btn-ghost btn-sm"
            aria-expanded={lfmOffen}
            onClick={() => setLfmOffen((v) => !v)}
          >
            {lfmOffen ? '▾ ' : '▸ '}{t('ui.material.lfm.toggle')}
          </button>
          {lfmOffen && (
            <div className="mt-2 rounded-xl border border-ink-700/60 bg-ink-850/40 p-3 animate-fade-in">
              {breiteCm > 0 ? (
                <>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-32">
                      <label className="label">{t('ui.material.lfm.flaeche')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="input"
                        value={lfmFlaeche}
                        onChange={(e) => setLfmFlaeche(e.target.value)}
                      />
                    </div>
                    <div className="w-28">
                      <label className="label">{t('ui.material.lfm.verschnitt')}</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        className="input"
                        value={lfmVerschnitt}
                        onChange={(e) =>
                          setLfmVerschnitt(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-subtle"
                      disabled={!lfmErgebnis.gueltig}
                      onClick={() => setMenge(String(lfmErgebnis.lfmMitVerschnitt))}
                    >
                      {t('ui.material.lfm.apply')}
                    </button>
                  </div>
                  {lfmErgebnis.gueltig && (
                    <p className="mt-2 text-sm text-chrome-300">
                      {t('ui.material.lfm.result', {
                        lfm: mengeFmt(lfmErgebnis.lfmMitVerschnitt),
                        breite: mengeFmt(breiteCm),
                        verschnitt: lfmVerschnitt,
                      })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-chrome-500">{t('ui.material.lfm.noWidth')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : eintraege.length === 0 ? (
        <Empty text={t('ui.material.empty')} />
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
                  onClick={() => setConfirmDelete(m.id)}
                >
                  {t('common.delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('ui.material.delete.title')}
        message={t('ui.material.delete.msg')}
        confirmLabel={t('common.delete')}
        busy={!!confirmDelete && busyId === confirmDelete}
        onConfirm={() => confirmDelete && entfernen(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </SectionCard>
  );
}
