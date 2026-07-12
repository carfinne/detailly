'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { toNum } from '@/lib/lfm-rechner';
import type { FolienRolle, Product } from '@/lib/types';
import { Badge, ConfirmDialog, Empty, ErrorBox, Loading, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { SlideOver } from './SlideOver';

// Rollen-Status -> i18n-Key + Badge-Farbe (Rohwert-Fallback via t()).
const ROLLE_STATUS_KEY: Record<string, string> = {
  verfuegbar: 'shop.rollen.status.verfuegbar',
  aufgebraucht: 'shop.rollen.status.aufgebraucht',
  entsorgt: 'shop.rollen.status.entsorgt',
};
const ROLLE_STATUS_COLOR: Record<string, string> = {
  verfuegbar: 'badge-positive',
  aufgebraucht: 'badge-neutral',
  entsorgt: 'badge-danger',
};

const ROLLE_LEER = { bezeichnung: '', charge: '', restLfm: '' };

/**
 * Tab "Folien-Bibliothek": gefilterte Sicht auf Produkte der Kategorie 'folie'
 * (Hersteller/Serie/Finish/Breite) inkl. Vorlagen-Import und Restrollen-
 * Verwaltung je Folie (Slide-over, GET/POST/PATCH/DELETE /folien-rollen).
 */
export function FolienBibliothekTab({
  products,
  darfVerwalten,
  onImport,
  importBusy,
}: {
  products: Product[];
  darfVerwalten: boolean;
  onImport: () => Promise<void>;
  importBusy: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Filter ('' = alle)
  const [fHersteller, setFHersteller] = useState('');
  const [fSerie, setFSerie] = useState('');
  const [fFinish, setFFinish] = useState('');
  const [fBreite, setFBreite] = useState('');

  // Restrollen (alle des Betriebs, für Zähler + Slide-over)
  const [rollen, setRollen] = useState<FolienRolle[] | null>(null);
  const [rollenFor, setRollenFor] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [rolleForm, setRolleForm] = useState(ROLLE_LEER);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLfm, setEditLfm] = useState('');
  const [confirmEntsorgen, setConfirmEntsorgen] = useState<FolienRolle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FolienRolle | null>(null);

  const loadRollen = useCallback(async () => {
    try {
      setRollen(await api.get<FolienRolle[]>('/folien-rollen'));
    } catch {
      setRollen([]);
    }
  }, []);

  useEffect(() => {
    loadRollen();
  }, [loadRollen]);

  const folien = useMemo(
    () => products.filter((p) => p.aktiv !== false && (p.kategorie ?? '').toLowerCase() === 'folie'),
    [products],
  );

  const distinct = useCallback(
    (werte: (string | undefined)[]) => Array.from(new Set(werte.filter((w): w is string => !!w))).sort((a, b) => a.localeCompare(b, 'de')),
    [],
  );
  const herstellerListe = distinct(folien.map((p) => p.hersteller));
  const serienListe = distinct(folien.filter((p) => !fHersteller || p.hersteller === fHersteller).map((p) => p.serie));
  const finishListe = distinct(folien.map((p) => p.finish));
  const breitenListe = useMemo(
    () => Array.from(new Set(folien.map((p) => toNum(p.breiteCm)).filter((b) => b > 0))).sort((a, b) => a - b),
    [folien],
  );

  const gefiltert = folien.filter((p) => {
    if (fHersteller && p.hersteller !== fHersteller) return false;
    if (fSerie && p.serie !== fSerie) return false;
    if (fFinish && p.finish !== fFinish) return false;
    if (fBreite && toNum(p.breiteCm) !== Number(fBreite)) return false;
    return true;
  });

  const rollenVon = (p: Product) => (rollen ?? []).filter((r) => r.productId === p.id);

  function openRollen(p: Product) {
    setRollenFor(p);
    setAddOpen(false);
    setRolleForm(ROLLE_LEER);
    setEditId(null);
  }

  async function createRolle(e: React.FormEvent) {
    e.preventDefault();
    if (!rollenFor) return;
    setBusy(true);
    try {
      await api.post('/folien-rollen', {
        productId: rollenFor.id,
        bezeichnung: rolleForm.bezeichnung.trim(),
        ...(rolleForm.charge.trim() ? { charge: rolleForm.charge.trim() } : {}),
        restLfm: Number(rolleForm.restLfm),
      });
      toast(t('shop.rollen.toast.created'));
      setRolleForm(ROLLE_LEER);
      setAddOpen(false);
      await loadRollen();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shop.error.save'));
    } finally {
      setBusy(false);
    }
  }

  async function patchRolle(id: string, patch: Record<string, unknown>, meldung: string) {
    setBusy(true);
    try {
      await api.patch(`/folien-rollen/${id}`, patch);
      toast(meldung);
      await loadRollen();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shop.error.save'));
    } finally {
      setBusy(false);
    }
  }

  /** restLfm-Korrektur; 0 schreibt die Rolle als aufgebraucht, >0 macht sie wieder verfügbar. */
  async function saveLfm(rolle: FolienRolle) {
    const lfm = Number(editLfm);
    if (!Number.isFinite(lfm) || lfm < 0) return;
    const patch: Record<string, unknown> = { restLfm: lfm };
    if (lfm <= 0 && rolle.status === 'verfuegbar') patch.status = 'aufgebraucht';
    if (lfm > 0 && rolle.status === 'aufgebraucht') patch.status = 'verfuegbar';
    await patchRolle(rolle.id, patch, t('shop.rollen.toast.updated'));
    setEditId(null);
  }

  async function entsorgen() {
    if (!confirmEntsorgen) return;
    await patchRolle(confirmEntsorgen.id, { status: 'entsorgt' }, t('shop.rollen.toast.updated'));
    setConfirmEntsorgen(null);
  }

  async function deleteRolle() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.delete(`/folien-rollen/${confirmDelete.id}`);
      toast(t('shop.rollen.toast.deleted'), { variant: 'copper' });
      setConfirmDelete(null);
      await loadRollen();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  }

  const slideRollen = rollenFor ? rollenVon(rollenFor) : [];

  return (
    <div className="animate-fade-in">
      {error && <ErrorBox message={error} className="mb-4" />}

      {folien.length === 0 ? (
        <div className="card">
          <Empty
            text={t('shop.folien.empty')}
            action={
              darfVerwalten ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-chrome-400">{t('shop.folien.emptyHint')}</p>
                  <button className="btn-primary" onClick={onImport} disabled={importBusy}>
                    {importBusy && <span className="spinner" />}
                    {importBusy ? t('shop.folien.importing') : t('shop.folien.import')}
                  </button>
                </div>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Filterzeile */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select className="input sm:w-auto" value={fHersteller} onChange={(e) => { setFHersteller(e.target.value); setFSerie(''); }} aria-label={t('shop.form.hersteller')}>
              <option value="">{t('shop.form.hersteller')}: {t('shop.folien.filter.alle')}</option>
              {herstellerListe.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <select className="input sm:w-auto" value={fSerie} onChange={(e) => setFSerie(e.target.value)} aria-label={t('shop.form.serie')}>
              <option value="">{t('shop.form.serie')}: {t('shop.folien.filter.alle')}</option>
              {serienListe.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="input sm:w-auto" value={fFinish} onChange={(e) => setFFinish(e.target.value)} aria-label={t('shop.form.finish')}>
              <option value="">{t('shop.form.finish')}: {t('shop.folien.filter.alle')}</option>
              {finishListe.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select className="input sm:w-auto" value={fBreite} onChange={(e) => setFBreite(e.target.value)} aria-label={t('shop.folien.col.breite')}>
              <option value="">{t('shop.folien.col.breite')}: {t('shop.folien.filter.alle')}</option>
              {breitenListe.map((b) => (
                <option key={b} value={String(b)}>{b} cm</option>
              ))}
            </select>
          </div>

          <div className="card">
            {gefiltert.length === 0 ? (
              <Empty text={t('shop.folien.emptyFiltered')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('shop.folien.col.folie')}</th>
                      <th>{t('shop.form.finish')}</th>
                      <th className="text-right">{t('shop.folien.col.breite')}</th>
                      <th className="text-right">{t('shop.col.stock')}</th>
                      <th className="text-right">{t('shop.folien.col.rollen')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gefiltert.map((p) => {
                      const alle = rollenVon(p);
                      const verfuegbar = alle.filter((r) => r.status === 'verfuegbar').length;
                      return (
                        <tr key={p.id}>
                          <td className="font-medium">
                            {p.hersteller ? `${p.hersteller} ${p.serie ?? ''}`.trim() : p.name}
                            {p.farbcode && <span className="ml-2 text-xs text-chrome-500">{p.farbcode}</span>}
                          </td>
                          <td>{p.finish || '–'}</td>
                          <td className="text-right">{toNum(p.breiteCm) > 0 ? `${toNum(p.breiteCm)} cm` : '–'}</td>
                          <td className="text-right">
                            {p.bestand} {p.einheit}
                          </td>
                          <td className="text-right">
                            {rollen === null ? (
                              <span className="spinner" />
                            ) : verfuegbar > 0 ? (
                              <Badge className="badge-positive">{verfuegbar}</Badge>
                            ) : (
                              <span className="text-chrome-600">–</span>
                            )}
                          </td>
                          <td className="text-right">
                            <button className="link-action text-xs" onClick={() => openRollen(p)}>
                              {t('shop.folien.col.rollen')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Restrollen-Verwaltung */}
      <SlideOver
        open={rollenFor !== null}
        onClose={() => setRollenFor(null)}
        title={t('shop.rollen.title', { name: rollenFor?.name ?? '' })}
        blockEscape={confirmEntsorgen !== null || confirmDelete !== null}
      >
        <div className="mb-4">
          {addOpen ? (
            <form onSubmit={createRolle} className="animate-fade-in space-y-3 rounded-xl border border-ink-700/70 bg-ink-900/40 p-3">
              <div>
                <label className="label">{t('shop.rollen.bezeichnung')}</label>
                <input className="input" value={rolleForm.bezeichnung} onChange={(e) => setRolleForm({ ...rolleForm, bezeichnung: e.target.value })} required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('shop.rollen.charge')}</label>
                  <input className="input" value={rolleForm.charge} onChange={(e) => setRolleForm({ ...rolleForm, charge: e.target.value })} />
                </div>
                <div>
                  <label className="label">{t('shop.rollen.restLfm')}</label>
                  <input type="number" step="0.01" min="0" className="input" value={rolleForm.restLfm} onChange={(e) => setRolleForm({ ...rolleForm, restLfm: e.target.value })} required />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={busy || !rolleForm.bezeichnung.trim() || rolleForm.restLfm === ''}>
                  {busy && <span className="spinner" />}
                  {t('common.save')}
                </button>
              </div>
            </form>
          ) : (
            <button className="btn-ghost w-full" onClick={() => setAddOpen(true)}>
              + {t('shop.rollen.add')}
            </button>
          )}
        </div>

        {slideRollen.length === 0 ? (
          <p className="text-sm text-chrome-500">{t('shop.rollen.empty')}</p>
        ) : (
          <div className="space-y-2">
            {slideRollen.map((r) => (
              <div key={r.id} className="animate-fade-in rounded-xl border border-ink-700/70 bg-ink-900/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-chrome-200">{r.bezeichnung}</p>
                    {r.charge && <p className="text-xs text-chrome-500">{r.charge}</p>}
                  </div>
                  <Badge className={ROLLE_STATUS_COLOR[r.status] ?? 'badge-neutral'}>
                    {ROLLE_STATUS_KEY[r.status] ? t(ROLLE_STATUS_KEY[r.status]) : r.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  {editId === r.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-24 py-1"
                        value={editLfm}
                        onChange={(e) => setEditLfm(e.target.value)}
                        autoFocus
                      />
                      <button className="link-action text-xs" disabled={busy} onClick={() => saveLfm(r)}>
                        {t('common.save')}
                      </button>
                      <button className="link-action text-xs" onClick={() => setEditId(null)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <p className="font-display text-sm font-semibold tabular-nums text-chrome-100">
                      {toNum(r.restLfm).toLocaleString('de-DE')} <span className="text-xs font-normal text-chrome-500">lfm</span>
                    </p>
                  )}
                  {editId !== r.id && (
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                      <button className="link-action text-xs" onClick={() => { setEditId(r.id); setEditLfm(String(toNum(r.restLfm))); }}>
                        {t('shop.rollen.action.korrigieren')}
                      </button>
                      {r.status === 'entsorgt' ? (
                        <button className="link-action text-xs" disabled={busy} onClick={() => patchRolle(r.id, { status: 'verfuegbar' }, t('shop.rollen.toast.updated'))}>
                          {t('shop.rollen.action.reaktivieren')}
                        </button>
                      ) : (
                        <button className="link-action text-xs" disabled={busy} onClick={() => setConfirmEntsorgen(r)}>
                          {t('shop.rollen.action.entsorgen')}
                        </button>
                      )}
                      {darfVerwalten && (
                        <button className="link-action text-xs text-danger" disabled={busy} onClick={() => setConfirmDelete(r)}>
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {rollen === null && rollenFor !== null && <Loading />}
      </SlideOver>

      {/* Rolle entsorgen */}
      <ConfirmDialog
        open={confirmEntsorgen !== null}
        title={t('shop.rollen.entsorgen.title')}
        message={t('shop.rollen.entsorgen.message', { name: confirmEntsorgen?.bezeichnung ?? '' })}
        confirmLabel={t('shop.rollen.action.entsorgen')}
        variant="danger"
        busy={busy}
        onConfirm={entsorgen}
        onCancel={() => setConfirmEntsorgen(null)}
      />

      {/* Rolle löschen (nur Leitung) */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('shop.rollen.delete.title')}
        message={t('shop.rollen.delete.message', { name: confirmDelete?.bezeichnung ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        busy={busy}
        onConfirm={deleteRolle}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
