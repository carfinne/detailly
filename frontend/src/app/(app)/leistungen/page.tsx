'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { ServiceItem } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Modal } from '@/components/ui';

const KAT: Record<string, string> = {
  aufbereitung: 'Aufbereitung',
  folierung: 'Folierung',
  ppf: 'PPF',
  sonstiges: 'Sonstiges',
};
const EINHEIT: Record<string, string> = { pauschal: 'Pauschal', qm: 'pro qm', stunde: 'pro Stunde' };

const LEER = { name: '', beschreibung: '', kategorie: 'aufbereitung', basispreis: '', einheit: 'pauschal' };

export default function LeistungenPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get<ServiceItem[]>('/services'));
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
    setForm(LEER);
    setEditId(null);
    setOpen(true);
  }
  function openEdit(s: ServiceItem) {
    setForm({
      name: s.name,
      beschreibung: s.beschreibung ?? '',
      kategorie: s.kategorie,
      basispreis: String(s.basispreis),
      einheit: s.einheit,
    });
    setEditId(s.id);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        kategorie: form.kategorie,
        basispreis: Number(form.basispreis),
        einheit: form.einheit,
      };
      if (form.beschreibung) payload.beschreibung = form.beschreibung;
      if (editId) await api.patch(`/services/${editId}`, payload);
      else await api.post('/services', payload);
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
        title="Leistungen & Pakete"
        subtitle="Katalog fuer die Auftragskalkulation"
        action={
          <button className="btn-primary" onClick={openNew}>
            Neue Leistung
          </button>
        }
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="Keine Leistungen vorhanden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kategorie</th>
                  <th>Einheit</th>
                  <th className="text-right">Basispreis</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td>{KAT[s.kategorie] ?? s.kategorie}</td>
                    <td>{EINHEIT[s.einheit] ?? s.einheit}</td>
                    <td className="text-right">{eur(s.basispreis)}</td>
                    <td className="text-right">
                      <button className="text-accent hover:underline" onClick={() => openEdit(s)}>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Leistung bearbeiten' : 'Neue Leistung'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <input className="input" value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Kategorie</label>
              <select className="input" value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })}>
                <option value="aufbereitung">Aufbereitung</option>
                <option value="folierung">Folierung</option>
                <option value="ppf">PPF</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <label className="label">Einheit</label>
              <select className="input" value={form.einheit} onChange={(e) => setForm({ ...form, einheit: e.target.value })}>
                <option value="pauschal">Pauschal</option>
                <option value="qm">pro qm</option>
                <option value="stunde">pro Stunde</option>
              </select>
            </div>
            <div>
              <label className="label">Basispreis</label>
              <input type="number" step="0.01" className="input" value={form.basispreis} onChange={(e) => setForm({ ...form, basispreis: e.target.value })} required />
            </div>
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
