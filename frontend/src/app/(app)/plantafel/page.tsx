'use client';

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import { APPT_STATUS_LABEL } from '@/lib/labels';
import type { Appointment, Customer, Vehicle } from '@/lib/types';
import { PageHeader, ErrorBox, Modal } from '@/components/ui';

type View = 'tag' | 'woche' | 'monat';

const DAY_START = 7; // 07:00
const DAY_END = 21; // 21:00
const HOUR_H = 52; // px pro Stunde
const SNAP = 15; // Minuten-Raster
const GRID_H = (DAY_END - DAY_START) * HOUR_H;
const DAY_MS = 86_400_000;

// --- Datums-Helfer ---
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
function startOfWeek(d: Date) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }
const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const minsIntoDay = (d: string | Date) => { const x = new Date(d); return x.getHours() * 60 + x.getMinutes(); };
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// --- Status-Farben ---
const STATUS_STYLE: Record<string, { bar: string; chip: string }> = {
  geplant: { bar: 'bg-copper', chip: 'bg-copper-soft text-copper-200 ring-copper/30' },
  bestaetigt: { bar: 'bg-positive', chip: 'bg-positive-soft text-positive ring-positive/30' },
  abgeschlossen: { bar: 'bg-info', chip: 'bg-info-soft text-info ring-info/30' },
  abgesagt: { bar: 'bg-chrome-600', chip: 'bg-ink-700/50 text-chrome-400 ring-ink-600' },
};
const styleFor = (s: string) => STATUS_STYLE[s] ?? STATUS_STYLE.geplant;

const LEER = { id: '', titel: '', start: '', ende: '', customerId: '', vehicleId: '', orderId: '', status: 'geplant' };

/** Ueberlappende Termine eines Tages in Spalten anordnen (Lane-Packing). */
function layoutDay(items: Appointment[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime() || new Date(b.ende).getTime() - new Date(a.ende).getTime(),
  );
  const result = new Map<string, { col: number; cols: number }>();
  let cluster: Appointment[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes: number[] = [];
    const colOf = new Map<string, number>();
    for (const a of cluster) {
      const s = new Date(a.start).getTime();
      const e = new Date(a.ende).getTime();
      let placed = -1;
      for (let i = 0; i < lanes.length; i++) if (lanes[i] <= s) { lanes[i] = e; placed = i; break; }
      if (placed < 0) { lanes.push(e); placed = lanes.length - 1; }
      colOf.set(a.id, placed);
    }
    for (const a of cluster) result.set(a.id, { col: colOf.get(a.id)!, cols: lanes.length });
    cluster = [];
    clusterEnd = 0;
  };
  for (const a of sorted) {
    const s = new Date(a.start).getTime();
    if (cluster.length && s >= clusterEnd) flush();
    cluster.push(a);
    clusterEnd = Math.max(clusterEnd, new Date(a.ende).getTime());
  }
  flush();
  return result;
}

export default function PlantafelPage() {
  const [view, setView] = useState<View>('woche');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  const colsRef = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // sichtbarer Bereich je Ansicht
  const range = useMemo(() => {
    if (view === 'tag') return { from: anchor, days: [anchor] };
    if (view === 'woche') { const f = startOfWeek(anchor); return { from: f, days: Array.from({ length: 7 }, (_, i) => addDays(f, i)) }; }
    const f = startOfMonth(anchor);
    const gridStart = startOfWeek(f);
    return { from: gridStart, days: Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)) };
  }, [view, anchor]);

  const loadFrom = range.days[0];
  const loadTo = addDays(range.days[range.days.length - 1], 1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, v] = await Promise.all([
        api.get<Appointment[]>(`/appointments?from=${loadFrom.toISOString()}&to=${loadTo.toISOString()}`),
        api.get<Customer[]>('/customers/select'),
        api.get<Vehicle[]>('/vehicles'),
      ]);
      setAppts(a);
      setCustomers(c);
      setVehicles(v);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFrom.getTime(), loadTo.getTime()]);

  useEffect(() => { void load(); }, [load]);

  // "Jetzt"-Linie aktuell halten
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Spaltenbreite messen (fuer Drag ueber Tage)
  useLayoutEffect(() => {
    const measure = () => { if (colsRef.current) setColW(colsRef.current.clientWidth / range.days.length); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [range.days.length, view, loading]);

  const custMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);

  // --- Navigation ---
  const step = (dir: number) => setAnchor((a) => (view === 'tag' ? addDays(a, dir) : view === 'woche' ? addDays(a, dir * 7) : (() => { const x = new Date(a); x.setMonth(x.getMonth() + dir); return startOfDay(x); })()));
  const rangeLabel = () => {
    if (view === 'tag') return anchor.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (view === 'woche') { const f = startOfWeek(anchor); const l = addDays(f, 6); return `${f.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${l.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`; }
    return anchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  // --- Termin anlegen/bearbeiten ---
  function openNew(prefill?: { start: Date; ende: Date }) {
    const s = prefill?.start ?? (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(Math.max(DAY_START, d.getHours())); return d; })();
    const e = prefill?.ende ?? new Date(s.getTime() + 60 * 60_000);
    setForm({ ...LEER, start: toLocalInput(s), ende: toLocalInput(e) });
    setOpen(true);
  }
  function openEdit(a: Appointment) {
    setForm({ id: a.id, titel: a.titel, start: toLocalInput(new Date(a.start)), ende: toLocalInput(new Date(a.ende)), customerId: a.customerId ?? '', vehicleId: a.vehicleId ?? '', orderId: a.orderId ?? '', status: a.status });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        titel: form.titel,
        start: new Date(form.start).toISOString(),
        ende: new Date(form.ende).toISOString(),
        customerId: form.customerId || undefined,
        vehicleId: form.vehicleId || undefined,
      };
      if (form.id) { payload.status = form.status; await api.patch(`/appointments/${form.id}`, payload); }
      else await api.post('/appointments', payload);
      setOpen(false);
      setForm(LEER);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!form.id || !window.confirm('Diesen Termin löschen?')) return;
    setSaving(true);
    try { await api.delete(`/appointments/${form.id}`); setOpen(false); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen'); }
    finally { setSaving(false); }
  }
  async function patchTime(id: string, start: Date, ende: Date) {
    // Optimistisch verschieben, dann speichern.
    setAppts((prev) => prev.map((a) => (a.id === id ? { ...a, start: start.toISOString(), ende: ende.toISOString() } : a)));
    try { await api.patch(`/appointments/${id}`, { start: start.toISOString(), ende: ende.toISOString() }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Verschieben fehlgeschlagen'); await load(); }
  }

  return (
    <div>
      <PageHeader
        title="Plantafel"
        subtitle="Termine planen – Tag, Woche oder Monat. Ziehen zum Verschieben."
        action={<button className="btn-primary" onClick={() => openNew()}>Neuer Termin</button>}
      />

      {/* Steuerleiste */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50" onClick={() => step(-1)} aria-label="Zurück">‹</button>
          <button className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm font-medium text-chrome-200 hover:text-chrome-50" onClick={() => setAnchor(startOfDay(new Date()))}>Heute</button>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50" onClick={() => step(1)} aria-label="Weiter">›</button>
        </div>
        <span className="font-display text-base font-semibold text-chrome-50">{rangeLabel()}</span>
        <div className="ml-auto flex rounded-xl border border-ink-700 bg-ink-850 p-1">
          {(['tag', 'woche', 'monat'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {view === 'monat' ? (
        <MonthGrid days={range.days} month={anchor.getMonth()} appts={appts} custMap={custMap}
          onDay={(d) => { setAnchor(d); setView('tag'); }} onAppt={openEdit} />
      ) : (
        <TimeGrid days={range.days} appts={appts} custMap={custMap} colsRef={colsRef} colW={colW} nowTick={nowTick}
          onCreate={openNew} onEdit={openEdit} onMove={patchTime} />
      )}

      {/* Modal anlegen/bearbeiten */}
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Termin bearbeiten' : 'Neuer Termin'}>
        <form onSubmit={save} className="space-y-4">
          <div className="field">
            <label className="label">Titel</label>
            <input className="input" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Start</label>
              <input type="datetime-local" className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required /></div>
            <div className="field"><label className="label">Ende</label>
              <input type="datetime-local" className="input" value={form.ende} onChange={(e) => setForm({ ...form, ende: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Kunde</label>
              <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, vehicleId: '' })}>
                <option value="">– optional –</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{kundenName(c)}</option>)}
              </select></div>
            <div className="field"><label className="label">Fahrzeug</label>
              <select className="input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">– optional –</option>
                {vehicles.filter((v) => !form.customerId || v.customerId === form.customerId).map((v) => <option key={v.id} value={v.id}>{v.make} {v.model}</option>)}
              </select></div>
          </div>
          {form.id && (
            <div className="field"><label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.keys(APPT_STATUS_LABEL).map((s) => <option key={s} value={s}>{APPT_STATUS_LABEL[s]}</option>)}
              </select></div>
          )}
          {form.id && (form.customerId || form.vehicleId || form.orderId) && (
            <div className="flex flex-wrap gap-2 border-t border-ink-700 pt-3">
              {form.customerId && (
                <Link href={`/kunden/detail/?id=${form.customerId}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200 hover:text-copper">Zum Kunden →</Link>
              )}
              {form.vehicleId && (
                <Link href={`/fahrzeuge/detail/?id=${form.vehicleId}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200 hover:text-copper">Zum Fahrzeug →</Link>
              )}
              {form.orderId && (
                <Link href={`/auftraege/detail/?id=${form.orderId}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200 hover:text-copper">Zum Auftrag →</Link>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            {form.id ? <button type="button" className="link-danger text-sm" onClick={remove} disabled={saving}>Löschen</button> : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Abbrechen</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zeitraster (Tag / Woche)
// ---------------------------------------------------------------------------
function TimeGrid({ days, appts, custMap, colsRef, colW, nowTick, onCreate, onEdit, onMove }: {
  days: Date[]; appts: Appointment[]; custMap: Record<string, Customer>;
  colsRef: React.RefObject<HTMLDivElement>; colW: number; nowTick: number;
  onCreate: (p: { start: Date; ende: Date }) => void;
  onEdit: (a: Appointment) => void;
  onMove: (id: string, start: Date, ende: Date) => void;
}) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const [drag, setDrag] = useState<null | { id: string; mode: 'move' | 'resize'; offDays: number; offMin: number }>(null);
  const di = useRef<null | { id: string; mode: 'move' | 'resize'; sx: number; sy: number; os: number; oe: number; moved: boolean }>(null);
  const now = new Date(nowTick);

  function down(e: React.PointerEvent, a: Appointment, mode: 'move' | 'resize') {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    di.current = { id: a.id, mode, sx: e.clientX, sy: e.clientY, os: new Date(a.start).getTime(), oe: new Date(a.ende).getTime(), moved: false };
  }
  function move(e: React.PointerEvent, a: Appointment) {
    const d = di.current; if (!d || d.id !== a.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const offMin = Math.round((dy / HOUR_H * 60) / SNAP) * SNAP;
    const offDays = d.mode === 'move' && colW ? Math.round(dx / colW) : 0;
    setDrag({ id: a.id, mode: d.mode, offDays, offMin });
  }
  function up(e: React.PointerEvent, a: Appointment) {
    const d = di.current; di.current = null;
    const cur = drag; setDrag(null);
    if (!d || d.id !== a.id) return;
    if (!d.moved) { onEdit(a); return; }
    const offMin = cur?.offMin ?? 0, offDays = cur?.offDays ?? 0;
    if (d.mode === 'move') {
      const shift = offDays * DAY_MS + offMin * 60_000;
      onMove(a.id, new Date(d.os + shift), new Date(d.oe + shift));
    } else {
      const ne = Math.max(d.oe + offMin * 60_000, d.os + SNAP * 60_000);
      onMove(a.id, new Date(d.os), new Date(ne));
    }
  }

  function createAt(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let mins = DAY_START * 60 + Math.round((y / HOUR_H * 60) / 30) * 30;
    mins = Math.max(DAY_START * 60, Math.min(mins, DAY_END * 60 - 60));
    const s = new Date(day); s.setHours(0, mins, 0, 0);
    onCreate({ start: s, ende: new Date(s.getTime() + 60 * 60_000) });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-700/70 bg-ink-850">
      <div className="min-w-[680px]">
        {/* Kopf */}
        <div className="flex border-b border-ink-700/70">
          <div className="w-14 shrink-0" />
          {days.map((d) => {
            const today = sameDay(d, now);
            return (
              <div key={d.toISOString()} className="flex-1 px-2 py-2.5 text-center">
                <div className="text-[11px] uppercase tracking-wide text-chrome-500">{d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                <div className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${today ? 'bg-copper text-ink-950' : 'text-chrome-100'}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        {/* Koerper */}
        <div className="flex">
          {/* Stunden-Gutter */}
          <div className="w-14 shrink-0">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_H }}>
                <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-chrome-600">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {/* Spalten */}
          <div ref={colsRef} className="relative flex flex-1">
            {days.map((day, idx) => {
              const list = appts.filter((a) => sameDay(new Date(a.start), day));
              const lay = layoutDay(list);
              const today = sameDay(day, now);
              return (
                <div key={day.toISOString()}
                  className={`relative flex-1 border-l border-ink-700/40 ${today ? 'bg-copper-soft/10' : ''}`}
                  style={{ height: GRID_H, backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_H - 1}px, rgba(255,255,255,0.05) ${HOUR_H - 1}px, rgba(255,255,255,0.05) ${HOUR_H}px)` }}
                  onClick={(e) => createAt(day, e)}>
                  {list.map((a) => {
                    const top = Math.max(0, (minsIntoDay(a.start) - DAY_START * 60) / 60 * HOUR_H);
                    const dur = (new Date(a.ende).getTime() - new Date(a.start).getTime()) / 60_000;
                    const h = Math.max(22, dur / 60 * HOUR_H);
                    const pos = lay.get(a.id) ?? { col: 0, cols: 1 };
                    const w = 100 / pos.cols;
                    const st = styleFor(a.status);
                    const isDrag = drag?.id === a.id;
                    const tx = isDrag ? (drag!.offDays * colW) : 0;
                    const ty = isDrag ? (drag!.offMin / 60 * HOUR_H) : 0;
                    const rh = isDrag && drag!.mode === 'resize' ? Math.max(22, h + drag!.offMin / 60 * HOUR_H) : h;
                    return (
                      <div key={a.id}
                        onPointerDown={(e) => down(e, a, 'move')}
                        onPointerMove={(e) => move(e, a)}
                        onPointerUp={(e) => up(e, a)}
                        className={`group absolute overflow-hidden rounded-lg ring-1 ${st.chip} cursor-grab touch-none select-none ${isDrag ? 'z-20 cursor-grabbing opacity-90 shadow-pop' : 'z-10'}`}
                        style={{ top, height: rh, left: `calc(${pos.col * w}% + 2px)`, width: `calc(${w}% - 4px)`, transform: `translate(${tx}px, ${ty}px)` }}>
                        <span className={`absolute left-0 top-0 h-full w-1 ${st.bar}`} />
                        <div className="px-2 py-1 pl-3">
                          <div className="truncate text-[11px] font-semibold leading-tight">{a.titel}</div>
                          <div className="truncate text-[10px] opacity-80">{fmtTime(a.start)}–{fmtTime(a.ende)}</div>
                          {a.customerId && h > 44 && <div className="truncate text-[10px] opacity-70">{kundenName(custMap[a.customerId])}</div>}
                        </div>
                        <span onPointerDown={(e) => down(e, a, 'resize')} onPointerMove={(e) => move(e, a)} onPointerUp={(e) => up(e, a)}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100" />
                      </div>
                    );
                  })}
                  {/* Jetzt-Linie */}
                  {today && minsIntoDay(now) >= DAY_START * 60 && minsIntoDay(now) <= DAY_END * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-30 flex items-center" style={{ top: (minsIntoDay(now) - DAY_START * 60) / 60 * HOUR_H }}>
                      <span className="h-2 w-2 -ml-1 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger/70" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monatsraster
// ---------------------------------------------------------------------------
function MonthGrid({ days, month, appts, custMap, onDay, onAppt }: {
  days: Date[]; month: number; appts: Appointment[]; custMap: Record<string, Customer>;
  onDay: (d: Date) => void; onAppt: (a: Appointment) => void;
}) {
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850">
      <div className="grid grid-cols-7 border-b border-ink-700/70 text-center text-[11px] uppercase tracking-wide text-chrome-500">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => <div key={w} className="py-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = d.getMonth() === month;
          const list = appts
            .filter((a) => sameDay(new Date(a.start), d))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()}
              className={`min-h-[104px] cursor-pointer border-b border-l border-ink-700/40 p-1.5 transition-colors hover:bg-ink-800/60 ${inMonth ? '' : 'bg-ink-900/40'}`}
              onClick={() => onDay(d)}>
              <div className={`mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? 'bg-copper text-ink-950' : inMonth ? 'text-chrome-200' : 'text-chrome-600'}`}>{d.getDate()}</div>
              <div className="space-y-1">
                {list.slice(0, 3).map((a) => {
                  const st = styleFor(a.status);
                  return (
                    <button key={a.id} onClick={(e) => { e.stopPropagation(); onAppt(a); }}
                      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] ring-1 ${st.chip}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.bar}`} />
                      <span className="tabular-nums opacity-80">{fmtTime(a.start)}</span>
                      <span className="truncate font-medium">{a.titel}</span>
                    </button>
                  );
                })}
                {list.length > 3 && <div className="px-1 text-[10px] text-chrome-500">+{list.length - 3} weitere</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
