'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import type { Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Modal } from '@/components/ui';

const LEER = {
  type: 'private' as 'private' | 'business',
  firstName: '',
  lastName: '',
  companyName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  postalCode: '',
  vatNumber: '',
};

function buildPayload(form: typeof LEER) {
  const out: Record<string, unknown> = { type: form.type };
  for (const [k, v] of Object.entries(form)) {
    if (k === 'type') continue;
    if (v && String(v).trim()) out[k] = v;
  }
  return out;
}

export default function KundenPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<Customer>>(
        `/customers?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      );
      setItems(res.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openNew() {
    setForm(LEER);
    setEditId(null);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setForm({
      type: (c.type as 'private' | 'business') ?? 'private',
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      companyName: c.companyName ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      street: c.street ?? '',
      city: c.city ?? '',
      postalCode: c.postalCode ?? '',
      vatNumber: c.vatNumber ?? '',
    });
    setEditId(c.id);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editId) await api.patch(`/customers/${editId}`, payload);
      else await api.post('/customers', payload);
      setOpen(false);
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
        title="Kunden"
        subtitle="Privat- und Geschaeftskunden"
        action={
          <button className="btn-primary" onClick={openNew}>
            Neuer Kunde
          </button>
        }
      />
      <input
        className="input mb-4 max-w-sm"
        placeholder="Suche nach Name, E-Mail, Telefon…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="Keine Kunden gefunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Typ</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Ort</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{kundenName(c)}</td>
                    <td>{c.type === 'business' ? 'Geschaeft' : 'Privat'}</td>
                    <td>{c.email || '–'}</td>
                    <td>{c.phone || '–'}</td>
                    <td>{c.city || '–'}</td>
                    <td className="text-right">
                      <button className="text-accent hover:underline" onClick={() => openEdit(c)}>
                        Bearbeiten
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Kunde bearbeiten' : 'Neuer Kunde'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Typ</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'private' | 'business' })}
            >
              <option value="private">Privat</option>
              <option value="business">Geschaeft</option>
            </select>
          </div>
          {form.type === 'business' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Firma</label>
                <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div>
                <label className="label">USt-IdNr.</label>
                <input className="input" value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vorname</label>
                <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className="label">Nachname</label>
                <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-Mail</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Strasse</label>
              <input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            </div>
            <div>
              <label className="label">PLZ</label>
              <input className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Ort</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
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
