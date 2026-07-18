'use client';

// GoBD-Kassenbuch (Barzahlungen). KERN – kein Tarif-Gate. Nutzt die Endpunkte:
//   GET    /kassenbuch            (paginiert, Filter typ/von/bis, inkl. Kassenbestand)
//   GET    /kassenbuch/saldo      (Kassenbestand + Tages-/Monatssaldo)
//   POST   /kassenbuch            (Eintrag anlegen, Entwurf)
//   PATCH  /kassenbuch/:id        (letzten Entwurf aendern)
//   DELETE /kassenbuch/:id        (letzten Entwurf loeschen)
//   POST   /kassenbuch/:id/festschreiben  | POST /kassenbuch/festschreiben (alle)
//   POST   /kassenbuch/:id/storno (Gegenbuchung – Original bleibt unveraendert)
//   GET    /kassenbuch/export     (GoBD-CSV, Leitung-only)
// Unveraenderbarkeit/Verkettung/Saldo sind serverseitig garantiert – die Seite
// spiegelt sie nur (Festschreiben mit ConfirmDialog „danach nicht mehr aenderbar").

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, downloadAuthed } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { eur, datumZeit } from '@/lib/format';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import type {
  KassenbuchEintrag,
  KassenbuchListe,
  KassenbuchSaldo,
  KassenbuchTyp,
} from '@/lib/types';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  StatCard,
  Modal,
  ConfirmDialog,
  Field,
  FieldError,
  useToast,
} from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

const PAGE_SIZE = 25;
const VAT_OPTIONS = [0, 7, 19];

type FormState = {
  typ: KassenbuchTyp;
  betrag: string;
  zweck: string;
  mwstSatz: number;
  belegNummer: string;
  kategorie: string;
};

const LEER_FORM: FormState = { typ: 'einnahme', betrag: '', zweck: '', mwstSatz: 0, belegNummer: '', kategorie: '' };

export default function KassenbuchPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const darfExportieren = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [items, setItems] = useState<KassenbuchEintrag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kassenbestand, setKassenbestand] = useState(0);
  const [saldo, setSaldo] = useState<KassenbuchSaldo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Filter
  const [typ, setTyp] = useState<'' | KassenbuchTyp>('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const hatFilter = typ !== '' || von !== '' || bis !== '';

  // Formular (Anlegen/Bearbeiten)
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(LEER_FORM);
  const [formError, setFormError] = useState<{ betrag?: string; zweck?: string }>({});

  // Bestaetigungs-Dialoge
  const [lockId, setLockId] = useState<string | null>(null);
  const [lockAllOpen, setLockAllOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stornoId, setStornoId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
        if (typ) params.set('typ', typ);
        if (von) params.set('von', von);
        if (bis) params.set('bis', bis);
        const [liste, s] = await Promise.all([
          api.get<KassenbuchListe>(`/kassenbuch?${params.toString()}`),
          api.get<KassenbuchSaldo>('/kassenbuch/saldo'),
        ]);
        setItems(liste.data);
        setTotal(liste.total);
        setPage(liste.page);
        setKassenbestand(liste.kassenbestand);
        setSaldo(s);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('kassenbuch.error.load'));
      } finally {
        setLoading(false);
      }
    },
    [typ, von, bis, t],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // Nur der GLOBAL letzte, noch nicht festgeschriebene Eintrag ist aenderbar/
  // loeschbar. Ohne Filter und auf Seite 1 ist das (DESC-Sortierung) die erste
  // Zeile – sonst blenden wir Bearbeiten/Loeschen aus (Backend erzwingt es hart).
  const editierbareId = useMemo(() => {
    if (hatFilter || page !== 1 || items.length === 0) return null;
    return items[0].festgeschrieben ? null : items[0].id;
  }, [hatFilter, page, items]);

  // Lokal bekannte Storno-Referenzen, um den Storno-Button an bereits stornierten
  // Originalen auszublenden (Backend verhindert Doppel-Storno zusaetzlich hart).
  const bereitsStorniert = useMemo(
    () => new Set(items.filter((e) => e.stornoVonId).map((e) => e.stornoVonId as string)),
    [items],
  );

  const nummerById = useMemo(() => new Map(items.map((e) => [e.id, e.laufendeNummer])), [items]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditId(null);
    setForm(LEER_FORM);
    setFormError({});
    setFormOpen(true);
  }

  function openEdit(e: KassenbuchEintrag) {
    setEditId(e.id);
    setForm({
      typ: e.typ,
      betrag: String(Number(e.betrag)),
      zweck: e.zweck,
      mwstSatz: Number(e.mwstSatz),
      belegNummer: e.belegNummer ?? '',
      kategorie: e.kategorie ?? '',
    });
    setFormError({});
    setFormOpen(true);
  }

  async function submitForm() {
    const betragNum = Number(form.betrag.replace(',', '.'));
    const errs: { betrag?: string; zweck?: string } = {};
    if (!(betragNum > 0)) errs.betrag = t('kassenbuch.form.error.amount');
    if (!form.zweck.trim()) errs.zweck = t('kassenbuch.form.error.purpose');
    setFormError(errs);
    if (errs.betrag || errs.zweck) return;

    setBusy(true);
    try {
      const body = {
        typ: form.typ,
        betrag: betragNum,
        zweck: form.zweck.trim(),
        mwstSatz: form.mwstSatz,
        belegNummer: form.belegNummer.trim() || undefined,
        kategorie: form.kategorie.trim() || undefined,
      };
      if (editId) {
        await api.patch(`/kassenbuch/${editId}`, body);
        toast(t('kassenbuch.toast.updated'), { variant: 'positive' });
      } else {
        await api.post('/kassenbuch', body);
        toast(t('kassenbuch.toast.created'), { variant: 'positive' });
      }
      setFormOpen(false);
      await load(editId ? page : 1);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('kassenbuch.error.generic'), { variant: 'copper' });
    } finally {
      setBusy(false);
    }
  }

  async function runAction(fn: () => Promise<void>, okKey: string, reloadPage = page) {
    setBusy(true);
    try {
      await fn();
      toast(t(okKey), { variant: 'positive' });
      await load(reloadPage);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('kassenbuch.error.generic'), { variant: 'copper' });
    } finally {
      setBusy(false);
    }
  }

  async function confirmLock() {
    const id = lockId;
    if (!id) return;
    setLockId(null);
    await runAction(() => api.post(`/kassenbuch/${id}/festschreiben`).then(() => undefined), 'kassenbuch.toast.locked');
  }

  async function confirmLockAll() {
    setLockAllOpen(false);
    setBusy(true);
    try {
      const res = await api.post<{ festgeschrieben: number }>('/kassenbuch/festschreiben');
      if (res.festgeschrieben > 0) {
        toast(t('kassenbuch.toast.lockedAll', { count: String(res.festgeschrieben) }), { variant: 'positive' });
      } else {
        toast(t('kassenbuch.lockAll.none'), { variant: 'copper' });
      }
      await load(page);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('kassenbuch.error.generic'), { variant: 'copper' });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const id = deleteId;
    if (!id) return;
    setDeleteId(null);
    await runAction(() => api.delete(`/kassenbuch/${id}`).then(() => undefined), 'kassenbuch.toast.deleted', 1);
  }

  async function confirmStorno() {
    const id = stornoId;
    if (!id) return;
    setStornoId(null);
    await runAction(() => api.post(`/kassenbuch/${id}/storno`, {}).then(() => undefined), 'kassenbuch.toast.storno', 1);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (von) params.set('von', von);
      if (bis) params.set('bis', bis);
      const q = params.toString();
      await downloadAuthed(`/kassenbuch/export${q ? `?${q}` : ''}`, 'Kassenbuch.csv');
      toast(t('kassenbuch.toast.exported'), { variant: 'positive' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('kassenbuch.error.generic'), { variant: 'copper' });
    } finally {
      setExporting(false);
    }
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {darfExportieren && (
        <button type="button" className="btn-ghost" disabled={exporting} onClick={exportCsv}>
          {exporting ? t('kassenbuch.exporting') : t('kassenbuch.export')}
        </button>
      )}
      <button type="button" className="btn-ghost" disabled={busy} onClick={() => setLockAllOpen(true)}>
        {t('kassenbuch.lockAll')}
      </button>
      <button type="button" className="btn-primary" onClick={openCreate}>
        <Icon className="h-4 w-4">{ICON_PATHS.plus}</Icon>
        <span>{t('kassenbuch.add')}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ICON_PATHS.revenue}
        title={t('kassenbuch.title')}
        subtitle={t('kassenbuch.subtitle')}
        action={headerActions}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('kassenbuch.stat.balance')} value={eur(kassenbestand)} hint={t('kassenbuch.stat.balanceHint')} accent icon={<Icon className="h-4 w-4">{ICON_PATHS.revenue}</Icon>} />
        <StatCard label={t('kassenbuch.stat.dayIn')} value={eur(saldo?.tag.einnahmen ?? 0)} />
        <StatCard label={t('kassenbuch.stat.dayOut')} value={eur(saldo?.tag.ausgaben ?? 0)} />
        <StatCard label={t('kassenbuch.stat.monthSaldo')} value={eur(saldo?.monat.saldo ?? 0)} />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-700 bg-ink-800/40 p-4">
        <Field label={t('kassenbuch.filter.from')} className="!mb-0">
          <input type="date" className="input" value={von} onChange={(e) => setVon(e.target.value)} />
        </Field>
        <Field label={t('kassenbuch.filter.to')} className="!mb-0">
          <input type="date" className="input" value={bis} onChange={(e) => setBis(e.target.value)} />
        </Field>
        <Field label={t('kassenbuch.filter.type')} className="!mb-0">
          <select className="select" value={typ} onChange={(e) => setTyp(e.target.value as '' | KassenbuchTyp)}>
            <option value="">{t('kassenbuch.filter.all')}</option>
            <option value="einnahme">{t('kassenbuch.type.einnahme')}</option>
            <option value="ausgabe">{t('kassenbuch.type.ausgabe')}</option>
          </select>
        </Field>
        {hatFilter && (
          <button type="button" className="btn-ghost" onClick={() => { setTyp(''); setVon(''); setBis(''); }}>
            {t('kassenbuch.filter.reset')}
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty text={t('kassenbuch.empty')} action={<button type="button" className="btn-primary" onClick={openCreate}>{t('kassenbuch.add')}</button>} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-ink-700 bg-ink-800/40">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-700 text-left text-chrome-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('kassenbuch.col.number')}</th>
                  <th className="px-4 py-3 font-medium">{t('kassenbuch.col.date')}</th>
                  <th className="px-4 py-3 font-medium">{t('kassenbuch.col.type')}</th>
                  <th className="px-4 py-3 font-medium">{t('kassenbuch.col.purpose')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('kassenbuch.col.amount')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('kassenbuch.col.balance')}</th>
                  <th className="px-4 py-3 font-medium">{t('kassenbuch.col.status')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('kassenbuch.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const einnahme = e.typ === 'einnahme';
                  const istEditierbar = e.id === editierbareId;
                  const kannStorno = e.festgeschrieben && !e.stornoVonId && !bereitsStorniert.has(e.id);
                  return (
                    <tr key={e.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-750/40">
                      <td className="px-4 py-3 font-mono text-chrome-300">{e.laufendeNummer}</td>
                      <td className="px-4 py-3 text-chrome-200">{datumZeit(e.datum)}</td>
                      <td className="px-4 py-3">
                        <Badge className={einnahme ? 'badge-positive' : 'badge-caution'}>
                          {t(einnahme ? 'kassenbuch.type.einnahme' : 'kassenbuch.type.ausgabe')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-chrome-50">{e.zweck}</span>
                        {e.stornoVonId && (
                          <div className="text-xs text-chrome-500">
                            {t('kassenbuch.badge.storno', { nr: String(nummerById.get(e.stornoVonId) ?? '?') })}
                          </div>
                        )}
                        {e.belegNummer && <div className="text-xs text-chrome-500">{e.belegNummer}</div>}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${einnahme ? 'text-positive' : 'text-caution'}`}>
                        {einnahme ? '+' : '−'}{eur(e.betrag)}
                      </td>
                      <td className="px-4 py-3 text-right text-chrome-100">{eur(e.kassenbestandNach)}</td>
                      <td className="px-4 py-3">
                        <Badge className={e.festgeschrieben ? 'badge-neutral' : 'badge-copper'}>
                          {t(e.festgeschrieben ? 'kassenbuch.status.locked' : 'kassenbuch.status.draft')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {istEditierbar && (
                            <>
                              <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => openEdit(e)}>
                                {t('kassenbuch.action.edit')}
                              </button>
                              <button type="button" className="btn-ghost btn-sm text-danger" disabled={busy} onClick={() => setDeleteId(e.id)}>
                                {t('kassenbuch.action.delete')}
                              </button>
                            </>
                          )}
                          {!e.festgeschrieben && (
                            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setLockId(e.id)}>
                              {t('kassenbuch.action.lock')}
                            </button>
                          )}
                          {kannStorno && (
                            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setStornoId(e.id)}>
                              {t('kassenbuch.action.storno')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => load(page - 1)}>
                <Icon className="h-4 w-4 rotate-180">{ICON_PATHS.arrow}</Icon>
              </button>
              <span className="text-sm text-chrome-400">{t('kassenbuch.page')} {page} / {pages}</span>
              <button type="button" className="btn-ghost" disabled={page >= pages} onClick={() => load(page + 1)}>
                <Icon className="h-4 w-4">{ICON_PATHS.arrow}</Icon>
              </button>
            </div>
          )}
        </>
      )}

      {/* Anlegen / Bearbeiten */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t(editId ? 'kassenbuch.editTitle' : 'kassenbuch.addTitle')}>
        <div className="space-y-4">
          <Field label={t('kassenbuch.form.type')}>
            <div className="flex gap-2">
              {(['einnahme', 'ausgabe'] as KassenbuchTyp[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={form.typ === option ? 'btn-primary flex-1' : 'btn-ghost flex-1'}
                  onClick={() => setForm({ ...form, typ: option })}
                >
                  {t(`kassenbuch.type.${option}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('kassenbuch.form.amount')} required error={formError.betrag}>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.betrag}
              onChange={(e) => setForm({ ...form, betrag: e.target.value })}
              autoFocus
            />
          </Field>

          <Field label={t('kassenbuch.form.purpose')} required error={formError.zweck}>
            <input className="input" value={form.zweck} onChange={(e) => setForm({ ...form, zweck: e.target.value })} maxLength={200} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('kassenbuch.form.vat')}>
              <select className="select" value={form.mwstSatz} onChange={(e) => setForm({ ...form, mwstSatz: Number(e.target.value) })}>
                {VAT_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v} %</option>
                ))}
              </select>
            </Field>
            <Field label={`${t('kassenbuch.form.receiptNo')} (${t('kassenbuch.form.optional')})`}>
              <input className="input" value={form.belegNummer} onChange={(e) => setForm({ ...form, belegNummer: e.target.value })} maxLength={80} />
            </Field>
          </div>

          <Field label={`${t('kassenbuch.form.category')} (${t('kassenbuch.form.optional')})`}>
            <input className="input" value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })} maxLength={80} />
          </Field>

          <FieldError message={null} />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={submitForm} disabled={busy}>
              {t('kassenbuch.form.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={lockId !== null}
        title={t('kassenbuch.lock.title')}
        message={t('kassenbuch.lock.message')}
        confirmLabel={t('kassenbuch.lock.confirm')}
        variant="neutral"
        busy={busy}
        onConfirm={confirmLock}
        onCancel={() => setLockId(null)}
      />
      <ConfirmDialog
        open={lockAllOpen}
        title={t('kassenbuch.lockAll.title')}
        message={t('kassenbuch.lockAll.message')}
        confirmLabel={t('kassenbuch.lockAll.confirm')}
        variant="neutral"
        busy={busy}
        onConfirm={confirmLockAll}
        onCancel={() => setLockAllOpen(false)}
      />
      <ConfirmDialog
        open={deleteId !== null}
        title={t('kassenbuch.delete.title')}
        message={t('kassenbuch.delete.message')}
        confirmLabel={t('kassenbuch.delete.confirm')}
        variant="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmDialog
        open={stornoId !== null}
        title={t('kassenbuch.storno.title')}
        message={t('kassenbuch.storno.message')}
        confirmLabel={t('kassenbuch.storno.confirm')}
        variant="neutral"
        busy={busy}
        onConfirm={confirmStorno}
        onCancel={() => setStornoId(null)}
      />
    </div>
  );
}
