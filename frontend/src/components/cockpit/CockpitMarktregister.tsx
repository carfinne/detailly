'use client';

// Cockpit-Tab „Marktregister": internes, NEUTRALES Register fuer die
// Wettbewerbsbeobachtung des Detailly-Betreibers (/platform/marktregister).
// STRIKT nur PLATFORM_ADMIN (Backend gated; der Tab wird nur fuer Admins
// gerendert). Erfasst werden ausschliesslich sachliche, oeffentlich beobachtbare
// Fakten + die daraus abgeleitete EIGENE „besser machen"-Idee – kein Bewertungs-/
// Herabsetzungsfeld, keine gescrapten Fremdinhalte, keine Kundendaten. Der
// Freitext bleibt Freitext: der Betreiber traegt selbst ein.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { datum } from '@/lib/format';
import { useT } from '@/lib/i18n';
import {
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Modal,
  Field,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { Pager } from '@/components/Pager';
import {
  type MarktBeobachtung,
  type MarktListResult,
  type MarktKategorie,
  type MarktStatus,
  type MarktPrioritaet,
  MARKT_KATEGORIEN,
  MARKT_STATUS,
  MARKT_PRIORITAETEN,
  MARKT_KATEGORIE_KEY,
  MARKT_STATUS_KEY,
  MARKT_PRIORITAET_KEY,
  MARKT_STATUS_COLOR,
  MARKT_PRIORITAET_COLOR,
} from './types';

const SEITENGROESSE = 25;

const heute = () => new Date().toISOString().slice(0, 10);

// Leeres Formular. `status`/`prioritaet` tragen die Backend-Defaults, damit die
// Neuanlage ohne Extra-Auswahl funktioniert.
const LEER = {
  wettbewerber: '',
  kategorie: 'feature' as MarktKategorie,
  beobachtung: '',
  abgeleiteteIdee: '',
  quelleUrl: '',
  beobachtetAm: heute(),
  status: 'neu' as MarktStatus,
  prioritaet: 'mittel' as MarktPrioritaet,
};

export function CockpitMarktregister() {
  const t = useT();
  const toast = useToast();

  const [rows, setRows] = useState<MarktBeobachtung[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter (leer = alle). Aenderung setzt die Seite zurueck.
  const [fStatus, setFStatus] = useState('');
  const [fKategorie, setFKategorie] = useState('');
  const [fPrioritaet, setFPrioritaet] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MarktBeobachtung | null>(null);
  const [loeschId, setLoeschId] = useState<string | null>(null);
  const [loeschBusy, setLoeschBusy] = useState(false);

  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(SEITENGROESSE),
        offset: String((page - 1) * SEITENGROESSE),
      });
      if (fStatus) params.set('status', fStatus);
      if (fKategorie) params.set('kategorie', fKategorie);
      if (fPrioritaet) params.set('prioritaet', fPrioritaet);
      const res = await api.get<MarktListResult>(`/platform/marktregister?${params.toString()}`);
      if (id !== reqId.current) return;
      setRows(res.data);
      setTotal(res.total);
      setError('');
    } catch (e) {
      if (id === reqId.current) {
        setError(e instanceof Error ? e.message : t('marktregister.error.load'));
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, fStatus, fKategorie, fPrioritaet, t]);

  useEffect(() => {
    load();
  }, [load]);

  function setFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function neu() {
    setEditItem(null);
    setFormOpen(true);
  }

  function bearbeiten(item: MarktBeobachtung) {
    setEditItem(item);
    setFormOpen(true);
  }

  // Schnellwechsel des Arbeitsstatus direkt in der Liste (eigene Idee, nicht der
  // Wettbewerber). Optimistisch mit Rollback bei Fehler.
  async function statusWechseln(item: MarktBeobachtung, status: MarktStatus) {
    if (status === item.status) return;
    const vorher = item.status;
    setRows((list) => list.map((r) => (r.id === item.id ? { ...r, status } : r)));
    try {
      await api.patch(`/platform/marktregister/${item.id}/status`, { status });
      toast(t('marktregister.toast.statusChanged'));
    } catch (e) {
      setRows((list) => list.map((r) => (r.id === item.id ? { ...r, status: vorher } : r)));
      setError(e instanceof Error ? e.message : t('marktregister.error.save'));
    }
  }

  async function loeschen() {
    if (!loeschId) return;
    setLoeschBusy(true);
    try {
      await api.delete(`/platform/marktregister/${loeschId}`);
      toast(t('marktregister.toast.deleted'));
      setLoeschId(null);
      // Nach dem letzten Eintrag einer Seite ggf. eine Seite zurueck.
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('marktregister.error.save'));
    } finally {
      setLoeschBusy(false);
    }
  }

  const selectCls = 'select h-9 w-auto min-w-[9rem] py-1 text-sm';

  return (
    <div className="space-y-5">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-chrome-50">
            {t('marktregister.title')}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-chrome-400">{t('marktregister.subtitle')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={neu}>
          {t('marktregister.new')}
        </button>
      </div>

      {/* Filterleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectCls}
          value={fStatus}
          onChange={(e) => setFilter(setFStatus, e.target.value)}
          aria-label={t('marktregister.filter.status')}
        >
          <option value="">{t('marktregister.filter.allStatus')}</option>
          {MARKT_STATUS.map((s) => (
            <option key={s} value={s}>
              {t(MARKT_STATUS_KEY[s])}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={fKategorie}
          onChange={(e) => setFilter(setFKategorie, e.target.value)}
          aria-label={t('marktregister.filter.kategorie')}
        >
          <option value="">{t('marktregister.filter.allKategorie')}</option>
          {MARKT_KATEGORIEN.map((k) => (
            <option key={k} value={k}>
              {t(MARKT_KATEGORIE_KEY[k])}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={fPrioritaet}
          onChange={(e) => setFilter(setFPrioritaet, e.target.value)}
          aria-label={t('marktregister.filter.prioritaet')}
        >
          <option value="">{t('marktregister.filter.allPrioritaet')}</option>
          {MARKT_PRIORITAETEN.map((p) => (
            <option key={p} value={p}>
              {t(MARKT_PRIORITAET_KEY[p])}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <div className="card">
          <Loading />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty
            text={t('marktregister.empty')}
            action={
              <button type="button" className="btn-ghost" onClick={neu}>
                {t('marktregister.new')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="card animate-fade-in space-y-3">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-sm font-semibold text-chrome-50">
                      {r.wettbewerber}
                    </h3>
                    <Badge className="badge-neutral">
                      {t(MARKT_KATEGORIE_KEY[r.kategorie] ?? r.kategorie)}
                    </Badge>
                    <Badge className={MARKT_PRIORITAET_COLOR[r.prioritaet] ?? 'badge-neutral'}>
                      {t('marktregister.prioritaet.label')}: {t(MARKT_PRIORITAET_KEY[r.prioritaet] ?? r.prioritaet)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-chrome-500">
                    {t('marktregister.card.observedOn')}: {datum(r.beobachtetAm)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Schnellwechsel Arbeitsstatus */}
                  <label className="sr-only" htmlFor={`status-${r.id}`}>
                    {t('marktregister.field.status')}
                  </label>
                  <Badge className={MARKT_STATUS_COLOR[r.status] ?? 'badge-neutral'}>
                    {t(MARKT_STATUS_KEY[r.status] ?? r.status)}
                  </Badge>
                  <select
                    id={`status-${r.id}`}
                    className="select h-9 w-auto py-1 text-sm"
                    value={r.status}
                    onChange={(e) => statusWechseln(r, e.target.value as MarktStatus)}
                  >
                    {MARKT_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {t(MARKT_STATUS_KEY[s])}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost h-9 px-3 py-1 text-sm"
                    onClick={() => bearbeiten(r)}
                  >
                    {t('marktregister.action.edit')}
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-danger/30 bg-danger-soft px-3 py-1 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                    onClick={() => setLoeschId(r.id)}
                    aria-label={t('common.delete')}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </header>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-chrome-600">
                    {t('marktregister.field.beobachtung')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-chrome-200">{r.beobachtung}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-chrome-600">
                    {t('marktregister.field.abgeleiteteIdee')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-chrome-200">
                    {r.abgeleiteteIdee}
                  </p>
                </div>
              </div>

              {r.quelleUrl && (
                <a
                  href={r.quelleUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-xs text-copper hover:underline"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {t('marktregister.card.source')}
                </a>
              )}
            </article>
          ))}
        </div>
      )}

      <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />

      {formOpen && (
        <MarktFormModal
          open={formOpen}
          item={editItem}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!loeschId}
        title={t('marktregister.delete.title')}
        message={t('marktregister.delete.message')}
        confirmLabel={t('common.delete')}
        busy={loeschBusy}
        onConfirm={loeschen}
        onCancel={() => setLoeschId(null)}
      />
    </div>
  );
}

// --- Anlegen / Bearbeiten ---------------------------------------------------

function MarktFormModal({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: MarktBeobachtung | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editId = item?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      item
        ? {
            wettbewerber: item.wettbewerber ?? '',
            kategorie: item.kategorie ?? 'feature',
            beobachtung: item.beobachtung ?? '',
            abgeleiteteIdee: item.abgeleiteteIdee ?? '',
            quelleUrl: item.quelleUrl ?? '',
            beobachtetAm: (item.beobachtetAm ?? '').slice(0, 10) || heute(),
            status: item.status ?? 'neu',
            prioritaet: item.prioritaet ?? 'mittel',
          }
        : LEER,
    );
  }, [open, item]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        wettbewerber: form.wettbewerber.trim(),
        kategorie: form.kategorie,
        beobachtung: form.beobachtung.trim(),
        abgeleiteteIdee: form.abgeleiteteIdee.trim(),
        quelleUrl: form.quelleUrl.trim() || undefined,
        beobachtetAm: form.beobachtetAm,
        status: form.status,
        prioritaet: form.prioritaet,
      };
      if (editId) await api.patch(`/platform/marktregister/${editId}`, payload);
      else await api.post('/platform/marktregister', payload);
      toast(editId ? t('marktregister.toast.saved') : t('marktregister.toast.created'));
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('marktregister.error.save');
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editId ? t('marktregister.form.editTitle') : t('marktregister.form.newTitle')}
      size="lg"
    >
      <form onSubmit={speichern} className="space-y-4">
        <p className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-xs text-chrome-400">
          {t('marktregister.form.neutralHint')}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('marktregister.field.wettbewerber')} htmlFor="mr-wettbewerber" required>
            <input
              id="mr-wettbewerber"
              className="input"
              maxLength={200}
              required
              value={form.wettbewerber}
              onChange={(e) => setForm({ ...form, wettbewerber: e.target.value })}
            />
          </Field>
          <Field label={t('marktregister.field.kategorie')} htmlFor="mr-kategorie">
            <select
              id="mr-kategorie"
              className="select"
              value={form.kategorie}
              onChange={(e) => setForm({ ...form, kategorie: e.target.value as MarktKategorie })}
            >
              {MARKT_KATEGORIEN.map((k) => (
                <option key={k} value={k}>
                  {t(MARKT_KATEGORIE_KEY[k])}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label={t('marktregister.field.beobachtung')}
          htmlFor="mr-beobachtung"
          required
          help={t('marktregister.field.beobachtung.help')}
        >
          <textarea
            id="mr-beobachtung"
            className="textarea min-h-[88px]"
            maxLength={4000}
            required
            value={form.beobachtung}
            onChange={(e) => setForm({ ...form, beobachtung: e.target.value })}
          />
        </Field>

        <Field
          label={t('marktregister.field.abgeleiteteIdee')}
          htmlFor="mr-idee"
          required
          help={t('marktregister.field.abgeleiteteIdee.help')}
        >
          <textarea
            id="mr-idee"
            className="textarea min-h-[88px]"
            maxLength={4000}
            required
            value={form.abgeleiteteIdee}
            onChange={(e) => setForm({ ...form, abgeleiteteIdee: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={t('marktregister.field.quelleUrl')}
            htmlFor="mr-quelle"
            help={t('marktregister.field.quelleUrl.help')}
          >
            <input
              id="mr-quelle"
              type="url"
              inputMode="url"
              className="input"
              maxLength={2000}
              placeholder="https://"
              value={form.quelleUrl}
              onChange={(e) => setForm({ ...form, quelleUrl: e.target.value })}
            />
          </Field>
          <Field label={t('marktregister.field.beobachtetAm')} htmlFor="mr-datum" required>
            <input
              id="mr-datum"
              type="date"
              className="input"
              required
              value={form.beobachtetAm}
              onChange={(e) => setForm({ ...form, beobachtetAm: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('marktregister.field.status')} htmlFor="mr-status">
            <select
              id="mr-status"
              className="select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as MarktStatus })}
            >
              {MARKT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {t(MARKT_STATUS_KEY[s])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('marktregister.field.prioritaet')} htmlFor="mr-prio">
            <select
              id="mr-prio"
              className="select"
              value={form.prioritaet}
              onChange={(e) => setForm({ ...form, prioritaet: e.target.value as MarktPrioritaet })}
            >
              {MARKT_PRIORITAETEN.map((p) => (
                <option key={p} value={p}>
                  {t(MARKT_PRIORITAET_KEY[p])}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && <ErrorBox message={error} />}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <span className="spinner" />}
            {saving ? t('marktregister.form.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
