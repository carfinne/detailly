'use client';

// Projektzeit (Job-Costing): Zeit auf einen laufenden Auftrag buchen. FACHLICH
// GETRENNT von der Stempeluhr (Anwesenheit) – das hier ist KEINE Arbeitszeit-
// dokumentation, sondern die auf einen Auftrag verbuchte Dauer.
//
// Erfassung wahlweise manuell (Datum + Dauer) oder per einfacher Stoppuhr. Die
// Stoppuhr laeuft REIN im Browser (localStorage, ueberlebt Reload) und traegt beim
// Stoppen nur die Minuten ins Formular ein – gebucht wird erst nach Bestaetigung
// (Review-before-send). Kein Backend-Timer -> kein riskanter Umbau.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { BookableOrder, Employee } from '@/lib/types';
import { SectionCard, Loading, Empty, ErrorBox, UpgradeHinweis, Badge, useToast } from '@/components/ui';

const TIMER_KEY = 'detailly_projektzeit_timer';

interface LaufenderTimer {
  orderId: string;
  label: string;
  startedAt: number; // ms epoch
}

function heute(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Verstrichene Zeit als H:MM:SS (Stoppuhr-Anzeige). */
function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const LEER = { datum: heute(), stunden: '', notiz: '', userId: '' };

export function ProjektzeitCard({
  istLeitung,
  employees,
  onBooked,
}: {
  istLeitung: boolean;
  employees: Employee[];
  onBooked?: () => void;
}) {
  const t = useT();
  const toast = useToast();

  const [orders, setOrders] = useState<BookableOrder[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BookableOrder | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);

  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  // Stoppuhr (nur Browser, localStorage-persistent).
  const [timer, setTimer] = useState<LaufenderTimer | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Buchbare Auftraege laden (server-getriebene Suche, leicht entprellt).
  const loadOrders = useCallback(
    async (term: string) => {
      setLoadingOrders(true);
      try {
        const qs = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : '';
        const res = await api.get<BookableOrder[]>(`/order-times/orders${qs}`);
        setOrders(res);
        setError('');
        setUpgrade(false);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') {
          setUpgrade(true);
          setError(e.message);
        } else {
          setError(e instanceof Error ? e.message : t('projektzeit.error.load'));
        }
      } finally {
        setLoadingOrders(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const id = setTimeout(() => void loadOrders(search), 250);
    return () => clearTimeout(id);
  }, [search, loadOrders]);

  // Laufenden Timer aus dem Speicher wiederherstellen (Reload-fest).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      if (raw) setTimer(JSON.parse(raw) as LaufenderTimer);
    } catch {
      /* Speicher gesperrt -> ohne Timer weiter */
    }
  }, []);

  // Sekundentakt nur, solange ein Timer laeuft.
  useEffect(() => {
    if (timer) {
      tickRef.current = setInterval(() => setNowTick(Date.now()), 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
    return undefined;
  }, [timer]);

  function persistTimer(next: LaufenderTimer | null) {
    setTimer(next);
    try {
      if (next) localStorage.setItem(TIMER_KEY, JSON.stringify(next));
      else localStorage.removeItem(TIMER_KEY);
    } catch {
      /* Speicher gesperrt -> Timer bleibt nur im State */
    }
  }

  function orderLabel(o: BookableOrder): string {
    return [o.auftragsnummer, o.kennzeichen, o.kundeName].filter(Boolean).join(' · ');
  }

  function starteTimer() {
    if (!selected || timer) return;
    persistTimer({ orderId: selected.id, label: orderLabel(selected), startedAt: Date.now() });
    setNowTick(Date.now());
  }

  function stoppeTimer() {
    if (!timer) return;
    const minuten = Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000));
    // Auftrag der Stoppuhr in die Auswahl holen, Dauer vorbefuellen (Review-before-send).
    const passend = orders.find((o) => o.id === timer.orderId);
    if (passend) setSelected(passend);
    else setSelected({ id: timer.orderId, auftragsnummer: timer.label, kundeName: '', status: '', serviceType: '' });
    setForm((f) => ({ ...f, datum: heute(), stunden: String(Math.round((minuten / 60) * 100) / 100) }));
    persistTimer(null);
  }

  async function buchen(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const minuten = Math.round(Number(form.stunden) * 60);
    if (!Number.isFinite(minuten) || minuten < 1) {
      setError(t('projektzeit.error.minDuration'));
      return;
    }
    if (minuten > 1440) {
      setError(t('projektzeit.error.maxDuration'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { orderId: selected.id, datum: form.datum, minuten };
      if (form.notiz.trim()) payload.notiz = form.notiz.trim();
      if (istLeitung && form.userId) payload.userId = form.userId;
      await api.post('/order-times', payload);
      toast(t('projektzeit.booked'));
      setForm(LEER);
      onBooked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projektzeit.error.save'));
    } finally {
      setSaving(false);
    }
  }

  if (upgrade) {
    return (
      <SectionCard title={t('projektzeit.title')} subtitle={t('projektzeit.subtitle')}>
        <UpgradeHinweis message={error || t('ordertime.upgrade')} />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('projektzeit.title')} subtitle={t('projektzeit.subtitle')}>
      {error && <ErrorBox message={error} className="mb-3" />}

      {/* Laufende Stoppuhr – prominent, damit sie nie vergessen wird. */}
      {timer && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-copper/30 bg-copper-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-copper" aria-hidden />
            <div>
              <p className="text-sm font-medium text-chrome-100">{t('projektzeit.timer.running')}</p>
              <p className="text-xs text-chrome-400">{timer.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-xl font-bold tabular-nums text-copper">
              {elapsedLabel(nowTick - timer.startedAt)}
            </span>
            <button type="button" className="btn-primary min-h-[44px] px-5" onClick={stoppeTimer}>
              {t('projektzeit.timer.stop')}
            </button>
          </div>
        </div>
      )}

      {/* Auftrags-Auswahl (suchbar). */}
      <div className="mb-4">
        <label className="label" htmlFor="projektzeit-suche">
          {t('projektzeit.pick.label')}
        </label>
        <input
          id="projektzeit-suche"
          className="input min-h-[44px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('projektzeit.pick.placeholder')}
          autoComplete="off"
        />
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {loadingOrders ? (
            <Loading />
          ) : orders.length === 0 ? (
            <Empty text={t('projektzeit.pick.empty')} />
          ) : (
            orders.map((o) => {
              const aktiv = selected?.id === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelected(o)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    aktiv
                      ? 'border-copper/50 bg-copper-soft'
                      : 'border-ink-700/50 bg-ink-750 hover:border-ink-600'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-chrome-100">
                      {o.auftragsnummer}
                      {o.kennzeichen ? <span className="text-chrome-400"> · {o.kennzeichen}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-chrome-400">{o.kundeName}</span>
                  </span>
                  {aktiv && <Badge className="badge-positive shrink-0">{t('projektzeit.pick.selected')}</Badge>}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Buchungsformular für den gewählten Auftrag. */}
      {selected && (
        <form onSubmit={buchen} className="animate-fade-in space-y-4 rounded-xl border border-ink-700/50 bg-ink-800/40 p-4">
          <p className="text-sm text-chrome-300">
            {t('projektzeit.form.for')} <span className="font-medium text-chrome-100">{orderLabel(selected)}</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="field">
              <label className="label">{t('projektzeit.form.date')}</label>
              <input
                type="date"
                className="input min-h-[44px]"
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="label">{t('projektzeit.form.duration')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="input min-h-[44px]"
                  placeholder={t('projektzeit.form.durationPlaceholder')}
                  value={form.stunden}
                  onChange={(e) => setForm({ ...form, stunden: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn-ghost min-h-[44px] shrink-0 whitespace-nowrap px-4"
                  onClick={starteTimer}
                  disabled={!!timer}
                  title={t('projektzeit.timer.startHint')}
                >
                  {t('projektzeit.timer.start')}
                </button>
              </div>
            </div>
          </div>
          {istLeitung && (
            <div className="field">
              <label className="label">{t('projektzeit.form.employee')}</label>
              <select
                className="select min-h-[44px]"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              >
                <option value="">{t('projektzeit.form.self')}</option>
                {employees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label className="label">
              {t('projektzeit.form.note')} <span className="text-chrome-600">{t('ui.optional')}</span>
            </label>
            <input
              className="input min-h-[44px]"
              value={form.notiz}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
              placeholder={t('projektzeit.form.notePlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary min-h-[44px] px-6" disabled={saving}>
              {saving ? t('projektzeit.form.saving') : t('projektzeit.form.book')}
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
