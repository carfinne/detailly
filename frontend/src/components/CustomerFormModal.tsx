'use client';

import { useEffect, useState } from 'react';
import { api, authedFileUrl } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { Modal } from '@/components/ui';

const LEER = {
  type: 'private' as 'private' | 'business',
  firstName: '', lastName: '', companyName: '', email: '', phone: '',
  street: '', city: '', postalCode: '', vatNumber: '',
};

function buildPayload(form: typeof LEER) {
  const out: Record<string, unknown> = { type: form.type };
  for (const [k, v] of Object.entries(form)) {
    if (k === 'type') continue;
    if (v && String(v).trim()) out[k] = v;
  }
  return out;
}

/** Geteiltes Anlegen/Bearbeiten von Kunden (Liste + Kunden-Detailseite). */
export function CustomerFormModal({
  open, onClose, customer, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editId = customer?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      customer
        ? {
            type: (customer.type as 'private' | 'business') ?? 'private',
            firstName: customer.firstName ?? '', lastName: customer.lastName ?? '',
            companyName: customer.companyName ?? '', email: customer.email ?? '', phone: customer.phone ?? '',
            street: customer.street ?? '', city: customer.city ?? '', postalCode: customer.postalCode ?? '',
            vatNumber: customer.vatNumber ?? '',
          }
        : LEER,
    );
  }, [open, customer]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(form);
      if (editId) await api.patch(`/customers/${editId}`, payload);
      else await api.post('/customers', payload);
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function exportGdpr() {
    if (!editId) return;
    try {
      const url = await authedFileUrl(`/customers/${editId}/export`);
      const a = document.createElement('a');
      a.href = url; a.download = `kunde-${editId}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen');
    }
  }

  async function anonymizeGdpr() {
    if (!editId) return;
    const ok = window.confirm(
      'Kundendaten endgueltig loeschen/anonymisieren?\n\nPersonenbezogene Daten werden entfernt bzw. anonymisiert. ' +
        'Rechnungen bleiben aus gesetzlichen Gruenden (GoBD, 10 Jahre) erhalten, aber ohne Personenbezug. ' +
        'Dieser Vorgang kann NICHT rueckgaengig gemacht werden.',
    );
    if (!ok) return;
    setSaving(true);
    try { await api.post(`/customers/${editId}/anonymize`); onClose(); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Loeschung fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editId ? 'Kunde bearbeiten' : 'Neuer Kunde'}>
      <form onSubmit={save} className="space-y-4">
        {error && <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
        <div>
          <label className="label">Typ</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'private' | 'business' })}>
            <option value="private">Privat</option>
            <option value="business">Geschaeft</option>
          </select>
        </div>
        {form.type === 'business' ? (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Firma</label><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
            <div><label className="label">USt-IdNr.</label><input className="input" value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vorname</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><label className="label">Nachname</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">E-Mail</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><label className="label">Strasse</label><input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
          <div><label className="label">PLZ</label><input className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
        </div>
        <div><label className="label">Ort</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>

        {editId && (
          <div className="mt-2 space-y-3 border-t border-ink-700 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-chrome-600">Datenschutz (DSGVO)</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={exportGdpr}>Daten exportieren (JSON)</button>
              <button type="button" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60" onClick={anonymizeGdpr} disabled={saving}>
                Daten loeschen / anonymisieren
              </button>
            </div>
            <p className="text-xs text-chrome-600">Rechnungen bleiben aus gesetzlichen Gruenden (GoBD) erhalten, jedoch ohne Personenbezug.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
        </div>
      </form>
    </Modal>
  );
}
