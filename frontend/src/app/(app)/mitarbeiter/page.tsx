'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { eur } from '@/lib/format';
import type { Employee, EmployeeInvitation } from '@/lib/types';
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

// Rollen-Rang (kleiner = mehr Rechte) – gespiegelt aus dem Backend
// (employees.service.ts / invitations.service.ts). Man darf keine Rolle vergeben,
// die MEHR Rechte hat als die eigene; sonst lehnt der Server mit 403 ab. Plattform-
// Rollen (Rang 0) duerfen alle Betriebs-Rollen vergeben.
const ROLE_RANK: Record<string, number> = {
  platform_admin: 0,
  platform_analyst: 0,
  platform_support: 0,
  owner: 1,
  manager: 2,
  technician: 3,
  receptionist: 4,
};
// Anzeige-/Auswahlreihenfolge der vergebbaren Betriebs-Rollen.
const TENANT_ROLLEN_ORDER = ['owner', 'manager', 'technician', 'receptionist'] as const;

// Gewerk-Funktionen (Reihenfolge = Anzeige im Auswahlfeld). Werte = Backend-
// Konstante EMPLOYEE_FUNKTIONEN; Labels zentral via FUNKTION_KEY.
const FUNKTIONEN = ['aufbereiter', 'folierer', 'ppf_spezialist', 'allrounder', 'buero'];

const LEER = { email: '', password: '', firstName: '', lastName: '', phone: '', role: 'technician', stundenlohn: '', geburtstag: '', funktion: '' };
const LEER_INVITE = { email: '', firstName: '', lastName: '', role: 'technician' };

// Tarif-Kontingent: genutzte (aktive) Mitarbeiter vs. maxUsers (null = unbegrenzt).
type Usage = { used: number; limit: number | null };

export default function MitarbeiterPage() {
  const t = useT();
  const { user } = useAuth();
  // Welche Rollen die aktuelle Rolle vergeben darf: nie eine mit mehr Rechten als
  // die eigene (Rang-Wache im Backend). Ein Manager sieht daher "Inhaber" nicht.
  const meinRang = ROLE_RANK[user?.role ?? ''] ?? 99;
  const vergebbareRollen = TENANT_ROLLEN_ORDER.filter((r) => ROLE_RANK[r] >= meinRang);
  // Rollen AENDERN (Bearbeiten-Modus) duerfen nur Inhaber/Plattform-Admin (Backend
  // update(): CAN_CHANGE = [OWNER, PLATFORM_ADMIN]). Fuer einen Manager ist das
  // Rollenfeld beim Bearbeiten daher gesperrt – sonst liefe jede Aenderung ins 403.
  const darfRollenAendern = user?.role === 'owner' || user?.role === 'platform_admin';
  const [items, setItems] = useState<Employee[]>([]);
  const [invites, setInvites] = useState<EmployeeInvitation[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manuelle Anlage (Fallback, mit Passwort)
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Einladen (empfohlener Weg)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(LEER_INVITE);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Deaktivieren-Bestätigung (Pending-State: welcher Mitarbeiter steht an?)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Einladung zurückziehen-Bestätigung
  const [confirmWithdraw, setConfirmWithdraw] = useState<EmployeeInvitation | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // Kontingent separat nachladen (ohne den Karten-Spinner), damit Meter/Button
  // nach Anlegen/Deaktivieren – und nach einem Limit-403 – den Ist-Stand zeigen.
  const refreshUsage = useCallback(async () => {
    try {
      setUsage(await api.get<Usage>('/employees/limit'));
    } catch {
      /* Kontingent optional: bei Fehler bleibt die Anzeige einfach aus. */
    }
  }, []);

  const refreshInvites = useCallback(async () => {
    try {
      setInvites(await api.get<EmployeeInvitation[]>('/employee-invitations'));
    } catch {
      /* Einladungen optional: bei Fehler bleibt die Liste einfach leer. */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list] = await Promise.all([
        api.get<Employee[]>('/employees'),
        refreshUsage(),
        refreshInvites(),
      ]);
      setItems(list);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t, refreshUsage, refreshInvites]);

  useEffect(() => {
    load();
  }, [load]);

  // Limit erreicht: kein weiterer aktiver Mitarbeiter anlegbar (null = unbegrenzt).
  const atLimit = usage != null && usage.limit != null && usage.used >= usage.limit;

  function openInvite() {
    if (atLimit) return; // Button ist disabled; defensiver Zusatz-Guard.
    setInviteForm(LEER_INVITE);
    setInviteError('');
    setInviteOpen(true);
  }
  function openNew() {
    if (atLimit) return;
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

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSaving(true);
    setInviteError('');
    try {
      await api.post('/employee-invitations', {
        email: inviteForm.email,
        firstName: inviteForm.firstName,
        lastName: inviteForm.lastName,
        role: inviteForm.role,
      });
      setInviteOpen(false);
      setInviteForm(LEER_INVITE);
      await Promise.all([refreshInvites(), refreshUsage()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_LIMIT_REACHED') {
        setInviteError(e.message);
        await refreshUsage();
      } else {
        setInviteError(e instanceof Error ? e.message : t('mitarbeiter.invite.error'));
      }
    } finally {
      setInviteSaving(false);
    }
  }

  async function resendInvite(inv: EmployeeInvitation) {
    setError('');
    try {
      await api.post(`/employee-invitations/${inv.id}/resend`);
      await refreshInvites();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  }

  async function withdrawInvite() {
    if (!confirmWithdraw) return;
    setError('');
    setWithdrawing(true);
    try {
      await api.delete(`/employee-invitations/${confirmWithdraw.id}`);
      setConfirmWithdraw(null);
      await Promise.all([refreshInvites(), refreshUsage()]);
    } catch (e) {
      setConfirmWithdraw(null);
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setWithdrawing(false);
    }
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
      // Tarif-Limit (403 PLAN_LIMIT_REACHED): klare Backend-Meldung inkl. Upgrade-
      // Hinweis zeigen und das Kontingent auffrischen (Button/Meter sperren dann).
      if (e instanceof ApiError && e.code === 'PLAN_LIMIT_REACHED') {
        setModalError(e.message);
        await refreshUsage();
      } else {
        setModalError(e instanceof Error ? e.message : t('mitarbeiter.error.save'));
      }
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

  function roleLabel(role: string) {
    return ROLE_KEY[role] ? t(ROLE_KEY[role]) : role;
  }

  return (
    <div>
      <PageHeader
        title={t('mitarbeiter.title')}
        subtitle={t('mitarbeiter.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={openNew}
              disabled={atLimit}
              title={atLimit ? t('mitarbeiter.limit.reachedHint') : undefined}
            >
              {t('mitarbeiter.createManual')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={openInvite}
              disabled={atLimit}
              title={atLimit ? t('mitarbeiter.limit.reachedHint') : undefined}
            >
              {t('mitarbeiter.invite')}
            </button>
          </div>
        }
      />

      {/* Tarif-Kontingent: "X von Y Mitarbeitern genutzt" + dezenter Upgrade-Weg
          bei Erreichen. Balken-Breite animiert (transition-all). */}
      {usage && (
        <div className="dl-error-in mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-chrome-400">
              {usage.limit == null
                ? t('mitarbeiter.limit.usedUnlimited', { used: usage.used })
                : t('mitarbeiter.limit.used', { used: usage.used, limit: usage.limit })}
            </span>
            {atLimit && (
              <Link
                href="/abo"
                className="text-sm font-medium text-copper transition-colors hover:text-copper-300"
              >
                {t('mitarbeiter.limit.upgradeCta')}
              </Link>
            )}
          </div>
          {usage.limit != null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${atLimit ? 'bg-danger' : 'bg-copper'}`}
                style={{
                  width: `${Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100))}%`,
                }}
              />
            </div>
          )}
          {atLimit && <p className="mt-2 text-xs text-chrome-500">{t('mitarbeiter.limit.reachedHint')}</p>}
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Offene Einladungen (nur wenn vorhanden). Erneut senden / zurückziehen. */}
      {invites.length > 0 && (
        <div className="card mb-5 dl-error-in">
          <h2 className="mb-3 text-sm font-semibold text-chrome-200">{t('mitarbeiter.pending.title')}</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('mitarbeiter.col.name')}</th>
                  <th>{t('mitarbeiter.col.email')}</th>
                  <th>{t('mitarbeiter.col.rolle')}</th>
                  <th>{t('mitarbeiter.col.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium">{inv.firstName} {inv.lastName}</td>
                    <td>{inv.email}</td>
                    <td>{roleLabel(inv.role)}</td>
                    <td>
                      {inv.status === 'abgelaufen' ? (
                        <Badge className="badge-danger">{t('mitarbeiter.pending.status.abgelaufen')}</Badge>
                      ) : (
                        <Badge className="badge-neutral">{t('mitarbeiter.pending.status.offen')}</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          label={t('mitarbeiter.pending.actionsFor', { email: inv.email })}
                          items={[
                            { key: 'resend', label: t('mitarbeiter.pending.resend'), onSelect: () => resendInvite(inv) },
                            { key: 'withdraw', label: t('mitarbeiter.pending.withdraw'), danger: true, onSelect: () => setConfirmWithdraw(inv) },
                          ] satisfies ActionMenuItem[]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    <td>{roleLabel(m.role)}</td>
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

      {/* Einladen (empfohlener Weg): E-Mail + Name + Rolle. Kein Passwort. */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('mitarbeiter.invite.title')}>
        <form onSubmit={sendInvite} className="space-y-4">
          <p className="text-sm text-chrome-400">{t('mitarbeiter.invite.hint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('mitarbeiter.form.firstName')}</label>
              <input className="input" value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="label">{t('mitarbeiter.form.lastName')}</label>
              <input className="input" value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">{t('mitarbeiter.form.email')}</label>
            <input type="email" className="input" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">{t('mitarbeiter.form.role')}</label>
            <select className="select" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
              {vergebbareRollen.map((r) => (
                <option key={r} value={r}>{t(ROLE_KEY[r])}</option>
              ))}
            </select>
          </div>
          {inviteError && <ErrorBox message={inviteError} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setInviteOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={inviteSaving}>
              {inviteSaving ? t('mitarbeiter.invite.sending') : t('mitarbeiter.invite.send')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manuelle Anlage (Fallback, mit Passwort) bzw. Bearbeiten. */}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('mitarbeiter.modal.edit') : t('mitarbeiter.createManual')}>
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
              <select
                className="select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={editId !== null && !darfRollenAendern}
              >
                {/* Rang-gefiltert; die aktuell gesetzte Rolle bleibt immer sichtbar,
                    damit der Bearbeiten-Modus den Ist-Wert korrekt anzeigt. */}
                {TENANT_ROLLEN_ORDER.filter((r) => ROLE_RANK[r] >= meinRang || r === form.role).map((r) => (
                  <option key={r} value={r}>{t(ROLE_KEY[r])}</option>
                ))}
              </select>
              {editId !== null && !darfRollenAendern && (
                <p className="help mt-1">{t('mitarbeiter.form.roleLockedHint')}</p>
              )}
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

      <ConfirmDialog
        open={!!confirmWithdraw}
        title={t('mitarbeiter.withdraw.title')}
        message={confirmWithdraw ? t('mitarbeiter.withdraw.msg', { email: confirmWithdraw.email }) : ''}
        confirmLabel={t('mitarbeiter.pending.withdraw')}
        busy={withdrawing}
        onConfirm={withdrawInvite}
        onCancel={() => setConfirmWithdraw(null)}
      />
    </div>
  );
}
