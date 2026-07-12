'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Employee } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { FUNKTION_KEY, FUNKTION_BADGE } from '@/lib/labels';
import { useT } from '@/lib/i18n';

// Enum->i18n-Key (Rohwert-Fallback in der Komponente). Die geteilte labels.ts
// bleibt unangetastet; die Auflösung erfolgt lokal via t(). Dieselben Keys
// dienen der Tabellen-Anzeige und den Rollen-Optionen im Formular.
const ROLE_KEY: Record<string, string> = {
  owner: 'mitarbeiter.role.owner',
  manager: 'mitarbeiter.role.manager',
  technician: 'mitarbeiter.role.technician',
  receptionist: 'mitarbeiter.role.receptionist',
};

// Gewerk-Funktionen (Reihenfolge = Anzeige im Auswahlfeld). Werte = Backend-
// Konstante EMPLOYEE_FUNKTIONEN; Labels zentral via FUNKTION_KEY.
const FUNKTIONEN = ['aufbereiter', 'folierer', 'ppf_spezialist', 'allrounder', 'buero'];

const LEER = { email: '', password: '', firstName: '', lastName: '', phone: '', role: 'technician', stundenlohn: '', geburtstag: '', funktion: '' };

export default function MitarbeiterPage() {
  const t = useT();
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Deaktivieren-Bestätigung (Pending-State: welcher Mitarbeiter steht an?)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get<Employee[]>('/employees'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditId(null);
    setForm(LEER);
    setModalError('');
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
      // geburtstag kommt als 'YYYY-MM-DD' vom Server -> passt direkt ins date-Input.
      geburtstag: m.geburtstag ? m.geburtstag.slice(0, 10) : '',
      funktion: m.funktion ?? '',
    });
    setModalError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError('');
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
          // leeres Feld -> null (Wert entfernen), sonst ISO-Datum bzw. Funktions-Wert.
          geburtstag: form.geburtstag || null,
          funktion: form.funktion || null,
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
        if (form.geburtstag) payload.geburtstag = form.geburtstag;
        if (form.funktion) payload.funktion = form.funktion;
        await api.post('/employees', payload);
      }
      setOpen(false);
      setForm(LEER);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : t('mitarbeiter.error.save'));
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!confirmDeactivate) return;
    setError('');
    setDeactivating(true);
    try {
      await api.delete(`/employees/${confirmDeactivate.id}`);
      setConfirmDeactivate(null);
      await load();
    } catch (e) {
      setConfirmDeactivate(null);
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('mitarbeiter.title')}
        subtitle={t('mitarbeiter.subtitle')}
        action={
          <button className="btn-primary" onClick={openNew}>
            {t('mitarbeiter.new')}
          </button>
        }
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text={t('mitarbeiter.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('mitarbeiter.col.name')}</th>
                  <th>{t('mitarbeiter.col.email')}</th>
                  <th>{t('mitarbeiter.col.rolle')}</th>
                  <th>{t('mitarbeiter.col.funktion')}</th>
                  <th className="text-right">{t('mitarbeiter.col.stundenlohn')}</th>
                  <th>{t('mitarbeiter.col.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.firstName} {m.lastName}</td>
                    <td>{m.email}</td>
                    <td>{ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : m.role}</td>
                    <td>
                      {m.funktion ? (
                        <Badge className={FUNKTION_BADGE[m.funktion] ?? 'badge-neutral'}>
                          {FUNKTION_KEY[m.funktion] ? t(FUNKTION_KEY[m.funktion]) : m.funktion}
                        </Badge>
                      ) : (
                        <span className="text-chrome-600">–</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {m.stundenlohn != null ? t('mitarbeiter.wagePerHour', { amount: eur(m.stundenlohn) }) : '–'}
                    </td>
                    <td>
                      {m.isActive === false ? (
                        <Badge className="badge-danger">{t('mitarbeiter.inactive')}</Badge>
                      ) : (
                        <Badge className="badge-positive">{t('mitarbeiter.active')}</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          label={t('mitarbeiter.actionsFor', { name: `${m.firstName} ${m.lastName}` })}
                          items={[
                            { key: 'edit', label: t('mitarbeiter.action.edit'), onSelect: () => openEdit(m) },
                            ...(m.isActive !== false
                              ? [{ key: 'deact', label: t('mitarbeiter.action.deactivate'), danger: true, onSelect: () => setConfirmDeactivate(m) }]
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('mitarbeiter.modal.edit') : t('mitarbeiter.new')}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('mitarbeiter.form.firstName')}</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="label">{t('mitarbeiter.form.lastName')}</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">{t('mitarbeiter.form.email')}</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!editId && (
              <div>
                <label className="label">{t('mitarbeiter.form.password')}</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
            )}
            <div>
              <label className="label">{t('mitarbeiter.form.phone')}</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('mitarbeiter.form.role')}</label>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="owner">{t('mitarbeiter.role.owner')}</option>
                <option value="manager">{t('mitarbeiter.role.manager')}</option>
                <option value="technician">{t('mitarbeiter.role.technician')}</option>
                <option value="receptionist">{t('mitarbeiter.role.receptionist')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('mitarbeiter.form.wage')} <span className="text-chrome-600">{t('mitarbeiter.form.optional')}</span></label>
              <input type="number" step="0.01" min="0" className="input" placeholder={t('mitarbeiter.form.wagePlaceholder')} value={form.stundenlohn} onChange={(e) => setForm({ ...form, stundenlohn: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('mitarbeiter.form.geburtstag')} <span className="text-chrome-600">{t('mitarbeiter.form.optional')}</span></label>
              <input type="date" className="input" value={form.geburtstag} onChange={(e) => setForm({ ...form, geburtstag: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('mitarbeiter.form.funktion')} <span className="text-chrome-600">{t('mitarbeiter.form.optional')}</span></label>
              <select className="select" value={form.funktion} onChange={(e) => setForm({ ...form, funktion: e.target.value })}>
                <option value="">{t('mitarbeiter.form.funktionNone')}</option>
                {FUNKTIONEN.map((f) => (
                  <option key={f} value={f}>{FUNKTION_KEY[f] ? t(FUNKTION_KEY[f]) : f}</option>
                ))}
              </select>
            </div>
          </div>
          {modalError && <ErrorBox message={modalError} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('mitarbeiter.saving') : t('common.save')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeactivate}
        title={t('mitarbeiter.deactivate.title')}
        message={
          confirmDeactivate
            ? t('mitarbeiter.deactivate.msg', { name: `${confirmDeactivate.firstName} ${confirmDeactivate.lastName}` })
            : ''
        }
        confirmLabel={t('mitarbeiter.action.deactivate')}
        busy={deactivating}
        onConfirm={deactivate}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
