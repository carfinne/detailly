'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import type { Vehicle, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Modal } from '@/components/ui';

const LEER = {
  customerId: '',
  make: '',
  model: '',
  variant: '',
  year: '',
  color: '',
  licensePlate: '',
  fuelType: '',
  estimatedSqm: '',
};

export default function FahrzeugePage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        api.get<Vehicle[]>('/vehicles'),
        api.get<Customer[]>('/customers/select'),
      ]);
      setItems(v);
      setCustomers(c);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Vorbelegung aus der Kundenakte: /fahrzeuge?kunde=<id>&neu=1 oeffnet das
  // Anlage-Modal mit gesetztem Halter. Genau EINMAL auswerten (Ref-Guard) und
  // den Param danach aus der URL entfernen (kein erneutes Oeffnen bei Reload).
  const paramVerarbeitet = useRef(false);
  useEffect(() => {
    if (paramVerarbeitet.current || customers.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('neu') !== '1') return;
    paramVerarbeitet.current = true;
    const kunde = params.get('kunde') ?? '';
    const vorbelegt = kunde && customers.some((c) => c.id === kunde) ? kunde : '';
    setForm({ ...LEER, customerId: vorbelegt });
    setModalError('');
    setOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, [customers]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customerId: form.customerId,
        make: form.make,
        model: form.model,
      };
      if (form.variant) payload.variant = form.variant;
      if (form.year) payload.year = Number(form.year);
      if (form.color) payload.color = form.color;
      if (form.licensePlate) payload.licensePlate = form.licensePlate;
      if (form.fuelType) payload.fuelType = form.fuelType;
      if (form.estimatedSqm) payload.estimatedSqm = Number(form.estimatedSqm);
      await api.post('/vehicles', payload);
      setOpen(false);
      setForm(LEER);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fahrzeuge"
        subtitle="Fahrzeugbestand mit Fahrzeugakte"
        action={
          <button className="btn-primary" onClick={() => { setForm(LEER); setModalError(''); setOpen(true); }}>
            Neues Fahrzeug
          </button>
        }
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty
            text="Noch keine Fahrzeuge angelegt."
            action={
              <button
                className="btn-primary btn-sm"
                onClick={() => { setForm(LEER); setModalError(''); setOpen(true); }}
              >
                Erstes Fahrzeug anlegen
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Fahrzeug</th>
                  <th>Kennzeichen</th>
                  <th>Halter</th>
                  <th>Baujahr</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">
                      <Link href={`/fahrzeuge/detail/?id=${v.id}`} className="link-row">
                        {v.make} {v.model} {v.variant && <span className="text-chrome-400">{v.variant}</span>}
                      </Link>
                    </td>
                    <td>{v.licensePlate || '–'}</td>
                    <td>
                      {v.customerId ? (
                        <Link href={`/kunden/detail/?id=${v.customerId}`} className="link-row">
                          {kundenName(custMap[v.customerId])}
                        </Link>
                      ) : (
                        kundenName(custMap[v.customerId])
                      )}
                    </td>
                    <td>{v.year || '–'}</td>
                    <td className="text-right">
                      <Link href={`/fahrzeuge/detail/?id=${v.id}`} className="link-action">
                        Fahrzeugakte
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Neues Fahrzeug">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Halter</label>
            <select
              className="input"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              required
            >
              <option value="">– wählen –</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {kundenName(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Marke</label>
              <input className="input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required />
            </div>
            <div>
              <label className="label">Modell</label>
              <input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            </div>
            <div>
              <label className="label">Variante</label>
              <input className="input" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Baujahr</label>
              <input type="number" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div>
              <label className="label">Farbe</label>
              <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <label className="label">Kennzeichen</label>
              <input className="input" value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kraftstoff</label>
              <select className="select" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                <option value="">–</option>
                <option value="petrol">Benzin</option>
                <option value="diesel">Diesel</option>
                <option value="electric">Elektro</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="label">Fläche (qm)</label>
              <input type="number" step="0.1" className="input" value={form.estimatedSqm} onChange={(e) => setForm({ ...form, estimatedSqm: e.target.value })} />
            </div>
          </div>
          {modalError && <ErrorBox message={modalError} />}

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
