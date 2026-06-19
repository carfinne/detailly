'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { datumZeit, kundenName } from '@/lib/format';
import { APPT_STATUS_LABEL } from '@/lib/labels';
import type { Appointment, Customer, Vehicle, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Modal } from '@/components/ui';

function weekRange(offset: number) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Montag = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return { from: monday, to: sunday };
}

const LEER = { titel: '', start: '', ende: '', customerId: '', vehicleId: '' };

export default function PlantafelPage() {
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  const { from, to } = weekRange(offset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, v] = await Promise.all([
        api.get<Appointment[]>(`/appointments?from=${from.toISOString()}&to=${to.toISOString()}`),
        api.get<Paginated<Customer>>('/customers?limit=200'),
        api.get<Vehicle[]>('/vehicles'),
      ]);
      setAppts(a);
      setCustomers(c.data);
      setVehicles(v);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  useEffect(() => {
    load();
  }, [load]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return d;
  });

  function apptsForDay(d: Date) {
    return appts
      .filter((a) => new Date(a.start).toDateString() === d.toDateString())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        titel: form.titel,
        start: new Date(form.start).toISOString(),
        ende: new Date(form.ende).toISOString(),
      };
      if (form.customerId) payload.customerId = form.customerId;
      if (form.vehicleId) payload.vehicleId = form.vehicleId;
      await api.post('/appointments', payload);
      setOpen(false);
      setForm(LEER);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Plantafel"
        subtitle="Wochenuebersicht der Termine"
        action={
          <button className="btn-primary" onClick={() => { setForm(LEER); setOpen(true); }}>
            Neuer Termin
          </button>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <button className="btn-ghost" onClick={() => setOffset((o) => o - 1)}>← Vorige</button>
        <span className="text-sm text-chrome-400">
          {from.toLocaleDateString('de-DE')} – {days[6].toLocaleDateString('de-DE')}
        </span>
        <button className="btn-ghost" onClick={() => setOffset((o) => o + 1)}>Naechste →</button>
        {offset !== 0 && (
          <button className="text-sm text-copper hover:underline" onClick={() => setOffset(0)}>
            Diese Woche
          </button>
        )}
      </div>
      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((d) => {
            const list = apptsForDay(d);
            return (
              <div key={d.toISOString()} className="card min-h-[140px]">
                <div className="mb-2 text-sm font-semibold">
                  {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </div>
                {list.length === 0 ? (
                  <p className="text-xs text-chrome-400">–</p>
                ) : (
                  <div className="space-y-2">
                    {list.map((a) => (
                      <div key={a.id} className="rounded-lg bg-ink-900/60 p-2 text-xs">
                        <div className="font-medium">{a.titel}</div>
                        <div className="text-chrome-400">
                          {new Date(a.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {a.customerId && <div className="text-chrome-400">{kundenName(custMap[a.customerId])}</div>}
                        <div className="text-chrome-400">{APPT_STATUS_LABEL[a.status] ?? a.status}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Neuer Termin">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Titel</label>
            <input className="input" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start</label>
              <input type="datetime-local" className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required />
            </div>
            <div>
              <label className="label">Ende</label>
              <input type="datetime-local" className="input" value={form.ende} onChange={(e) => setForm({ ...form, ende: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kunde</label>
              <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, vehicleId: '' })}>
                <option value="">– optional –</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{kundenName(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fahrzeug</label>
              <select className="input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">– optional –</option>
                {vehicles.filter((v) => !form.customerId || v.customerId === form.customerId).map((v) => (
                  <option key={v.id} value={v.id}>{v.make} {v.model}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
