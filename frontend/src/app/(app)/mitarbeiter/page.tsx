'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import type { Employee } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

const LEER = { email: '', password: '', firstName: '', lastName: '', phone: '', role: 'technician', stundenlohn: '' };

export default function MitarbeiterPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get<Employee[]>('/employees'));
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

  function openNew() {
    setEditId(null);
    setForm(LEER);
    setOpen(true);
  }
  function openEdit(m: Employee) {
    setEditId(m.id);
    setForm({
      email: m.email,
      password: '',
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone ?? '',
      role: m.role,
      stundenlohn: m.stundenlohn != null ? String(m.stundenlohn) : '',
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // stundenlohn: leeres Feld -> null (Lohn entfernt), sonst Zahl.
      const stundenlohn = form.stundenlohn.trim() === '' ? null : Number(form.stundenlohn);
      if (editId) {
        const payload: Record<string, unknown> = {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          role: form.role,
          stundenlohn,
        };
        await api.patch(`/employees/${editId}`, payload);
      } else {
        const payload: Record<string, unknown> = {
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
        };
        if (form.phone) payload.phone = form.phone;
        if (stundenlohn != null) payload.stundenlohn = stundenlohn;
        await api.post('/employees', payload);
      }
      setOpen(false);
      setForm(LEER);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: string) {
    setError('');
    try {
      await api.delete(`/employees/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  }

  return (
    <div>
      <PageHeader
        title="Mitarbeiter"
        subtitle="Benutzer, Rollen (RBAC) und Stundenlöhne"
        action={
          <button className="btn-primary" onClick={openNew}>
            Neuer Mitarbeiter
          </button>
        }
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="Keine Mitarbeiter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th className="text-right">Stundenlohn</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.firstName} {m.lastName}</td>
                    <td>{m.email}</td>
                    <td>{ROLE_LABEL[m.role] ?? m.role}</td>
                    <td className="text-right tabular-nums">
                      {m.stundenlohn != null ? `${eur(m.stundenlohn)}/Std` : '–'}
                    </td>
                    <td>
                      {m.isActive === false ? (
                        <Badge className="badge-danger">Inaktiv</Badge>
                      ) : (
                        <Badge className="badge-positive">Aktiv</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <button className="link-muted" onClick={() => openEdit(m)}>
                          Bearbeiten
                        </button>
                        {m.isActive !== false && (
                          <button className="link-danger" onClick={() => deactivate(m.id)}>
                            Deaktivieren
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vorname</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="label">Nachname</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">E-Mail</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!editId && (
              <div>
                <label className="label">Passwort (min. 8)</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
            )}
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rolle</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="owner">Inhaber (Admin)</option>
                <option value="manager">Manager</option>
                <option value="technician">Techniker</option>
                <option value="receptionist">Rezeption</option>
              </select>
            </div>
            <div>
              <label className="label">Stundenlohn (€) <span className="text-chrome-600">(optional)</span></label>
              <input type="number" step="0.01" min="0" className="input" placeholder="z. B. 18,50" value={form.stundenlohn} onChange={(e) => setForm({ ...form, stundenlohn: e.target.value })} />
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
