'use client';

// Auftragszeiten (Job-Costing) auf der Auftrags-Detailseite. Jeder Mitarbeiter
// bucht seine EIGENE Zeit; nur die Leitung darf Eintraege aendern/loeschen oder
// fuer andere erfassen (Schutz vor Arbeitszeitbetrug – serverseitig erzwungen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { OrderTime, Employee } from '@/lib/types';
import { Modal, Loading, Empty } from '@/components/ui';

const LEITUNG = ['super_admin', 'franchise_owner', 'manager'];

function heute(): string {
  // YYYY-MM-DD in lokaler Zeit (fuer <input type="date">).
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const stundenFmt = (min: number) =>
  (min / 60).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const LEER = { datum: heute(), stunden: '', notiz: '', userId: '' };

export function OrderTimeCard({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG.includes(user.role);

  const [eintraege, setEintraege] = useState<OrderTime[]>([]);
  const [summeMinuten, setSummeMinuten] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOwner, setEditOwner] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ eintraege: OrderTime[]; summeMinuten: number }>(
        `/order-times?orderId=${orderId}`,
      );
      setEintraege(res.eintraege);
      setSummeMinuten(res.summeMinuten);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zeiten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mitarbeiterliste nur fuer die Leitung (Erfassung fuer andere).
  useEffect(() => {
    if (!istLeitung) return;
    api.get<Employee[]>('/employees').then(setEmployees).catch(() => undefined);
  }, [istLeitung]);

  function openNew() {
    setEditId(null);
    setEditOwner(null);
    setForm(LEER);
    setOpen(true);
  }
  function openEdit(t: OrderTime) {
    setEditId(t.id);
    // Eigentuemer merken, damit der Picker ihn auch zeigt, wenn er (z. B. inaktiv)
    // nicht mehr in /employees auftaucht.
    setEditOwner({ id: t.userId, name: t.mitarbeiterName || '—' });
    setForm({
      datum: new Date(t.datum).toISOString().slice(0, 10),
      stunden: String(t.minuten / 60),
      notiz: t.notiz ?? '',
      userId: t.userId,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const minuten = Math.round(Number(form.stunden) * 60);
    if (!Number.isFinite(minuten) || minuten < 1) {
      setError('Bitte eine Dauer größer als 0 angeben.');
      return;
    }
    if (minuten > 1440) {
      setError('Eine einzelne Buchung kann höchstens 24 Stunden umfassen.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { datum: form.datum, minuten };
      if (form.notiz.trim()) payload.notiz = form.notiz.trim();
      if (istLeitung && form.userId) payload.userId = form.userId;
      if (editId) {
        await api.patch(`/order-times/${editId}`, payload);
      } else {
        await api.post('/order-times', { orderId, ...payload });
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: OrderTime) {
    if (!window.confirm('Diesen Zeiteintrag löschen?')) return;
    setBusyId(t.id);
    try {
      await api.delete(`/order-times/${t.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setBusyId(null);
    }
  }

  const mitarbeiterOptions = useMemo(
    () => employees.map((m) => ({ id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email })),
    [employees],
  );

  // Beim Bearbeiten den echten Eigentuemer ergaenzen, falls er nicht (mehr) in
  // der aktiven Mitarbeiterliste steht – sonst zeigt das Feld faelschlich "ich selbst".
  const selectOptions = useMemo(() => {
    const opts = [...mitarbeiterOptions];
    if (editOwner?.id && !opts.some((o) => o.id === editOwner.id)) {
      opts.unshift({ id: editOwner.id, name: editOwner.name });
    }
    return opts;
  }, [mitarbeiterOptions, editOwner]);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Arbeitszeit</h2>
        <button className="text-sm text-copper hover:underline" onClick={openNew}>
          + Zeit erfassen
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold text-chrome-50">{stundenFmt(summeMinuten)}</span>
        <span className="text-sm text-chrome-400">Std erfasst</span>
      </div>

      {loading ? (
        <Loading />
      ) : eintraege.length === 0 ? (
        <Empty text="Noch keine Arbeitszeit erfasst." />
      ) : (
        <ul className="divide-y divide-ink-700/50">
          {eintraege.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs tabular-nums text-chrome-400">
                {new Date(t.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-chrome-100">
                  {t.mitarbeiterName || '—'}
                  {t.notiz && <span className="text-chrome-400"> · {t.notiz}</span>}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-chrome-50">
                {stundenFmt(t.minuten)} Std
              </span>
              {istLeitung && (
                <div className="flex shrink-0 gap-2 text-xs">
                  <button className="link-muted" onClick={() => openEdit(t)}>
                    Ändern
                  </button>
                  <button className="link-danger disabled:opacity-50" disabled={busyId === t.id} onClick={() => remove(t)}>
                    Löschen
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Arbeitszeit ändern' : 'Arbeitszeit erfassen'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Datum</label>
              <input type="date" className="input" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} required />
            </div>
            <div className="field">
              <label className="label">Dauer (Std)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                className="input"
                placeholder="z. B. 1,5"
                value={form.stunden}
                onChange={(e) => setForm({ ...form, stunden: e.target.value })}
                required
              />
            </div>
          </div>
          {istLeitung && (
            <div className="field">
              <label className="label">Mitarbeiter</label>
              <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                <option value="">— ich selbst —</option>
                {selectOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label className="label">Notiz <span className="text-chrome-600">(optional)</span></label>
            <input className="input" value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} placeholder="z. B. Folie zuschneiden" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
