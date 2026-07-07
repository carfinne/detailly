'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import type { Vehicle, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Modal, ConfirmDialog, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';

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
  const { user } = useAuth();
  const toast = useToast();
  const darfLoeschen = !!user && LEITUNG_ROLLEN.includes(user.role);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  // Loeschen-Bestaetigung (Soft-Delete: FK-Referenzen/Historie bleiben erhalten).
  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Der /vehicles-Endpoint liefert die volle Liste (unpaginiert) – daher
  // clientseitige Suche ueber Kennzeichen/Marke/Modell/Variante/Halter.
  const [search, setSearch] = useState('');

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

  // Clientseitige Suche: Kennzeichen, Marke, Modell, Variante oder Halter.
  const q = search.trim().toLowerCase();
  const gefiltert = q
    ? items.filter((v) => {
        const halter = kundenName(custMap[v.customerId]) ?? '';
        return [v.licensePlate, v.make, v.model, v.variant, halter]
          .filter(Boolean)
          .some((feld) => String(feld).toLowerCase().includes(q));
      })
    : items;

  async function deleteVehicle() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/vehicles/${confirmDelete.id}`);
      toast(`${confirmDelete.make} ${confirmDelete.model} gelöscht`);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setConfirmDelete(null);
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeleting(false);
    }
  }

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
      {!loading && items.length > 0 && (
        <input
          className="input mb-4 max-w-sm"
          placeholder="Suche nach Kennzeichen, Marke, Modell oder Halter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
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
        ) : gefiltert.length === 0 ? (
          <Empty text="Keine Fahrzeuge gefunden." />
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
                {gefiltert.map((v) => (
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
                      <div className="flex justify-end">
                        <ActionMenu
                          label={`Aktionen für ${v.make} ${v.model}`}
                          items={[
                            { key: 'open', label: 'Fahrzeugakte öffnen', href: `/fahrzeuge/detail/?id=${v.id}` },
                            ...(v.customerId
                              ? [{ key: 'order', label: 'Neuer Auftrag', href: `/auftraege?kunde=${v.customerId}&neu=1` }]
                              : []),
                            ...(darfLoeschen
                              ? [{ key: 'delete', label: 'Löschen', danger: true, onSelect: () => setConfirmDelete(v) }]
                              : []),
                          ] satisfies ActionMenuItem[]}
                        />
                      </div>
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

      <ConfirmDialog
        open={!!confirmDelete}
        title="Fahrzeug löschen"
        message={
          confirmDelete
            ? `${confirmDelete.make} ${confirmDelete.model}${confirmDelete.licensePlate ? ` (${confirmDelete.licensePlate})` : ''} wirklich löschen? Das Fahrzeug wird aus der Liste entfernt. Bereits erfasste Aufträge und Termine bleiben erhalten.`
            : ''
        }
        confirmLabel="Löschen"
        busy={deleting}
        onConfirm={deleteVehicle}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
