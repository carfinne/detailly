'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { ServiceItem, StarterGewerk, StarterImportResult } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Modal, Badge, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { StarterKatalogDialog } from '@/components/StarterKatalogDialog';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements';
import { LEITUNG_ROLLEN } from '@/lib/rollen';

// Betriebstyp -> Starter-Gewerk-Vorauswahl. „komplett"/unbekannt => alle Gewerke.
function defaultGewerkeFor(betriebstyp: string | null): StarterGewerk[] {
  if (betriebstyp === 'aufbereitung' || betriebstyp === 'folierung' || betriebstyp === 'ppf') {
    return [betriebstyp];
  }
  return [];
}

// Enum->i18n-Key (Rohwert-Fallback in der Komponente via t()).
const KAT_KEY: Record<string, string> = {
  aufbereitung: 'leistungen.kat.aufbereitung',
  folierung: 'leistungen.kat.folierung',
  ppf: 'leistungen.kat.ppf',
  sonstiges: 'leistungen.kat.sonstiges',
};
const EINHEIT_KEY: Record<string, string> = {
  pauschal: 'leistungen.einheit.pauschal',
  qm: 'leistungen.einheit.qm',
  stunde: 'leistungen.einheit.stunde',
};

const LEER = { name: '', beschreibung: '', kategorie: 'aufbereitung', basispreis: '', einheit: 'pauschal' };

export default function LeistungenPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const { betriebstyp } = useEntitlements();
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);

  // Starter-Katalog nur der Leitung anbieten (Backend erzwingt OWNER/MANAGER).
  const darfStarter = !!user && LEITUNG_ROLLEN.includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get<ServiceItem[]>(`/services${showInactive ? '?includeInactive=true' : ''}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [showInactive, t]);

  // Leistung archivieren (aktiv=false) bzw. wieder aktivieren (PATCH aktiv=true).
  // Historische Auftraege/Rechnungen behalten ihre uebernommenen Werte.
  async function setAktiv(s: ServiceItem, aktiv: boolean) {
    setBusyId(s.id);
    try {
      if (aktiv) await api.patch(`/services/${s.id}`, { aktiv: true });
      else await api.delete(`/services/${s.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('leistungen.error.aktion'));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm(LEER);
    setEditId(null);
    setModalError('');
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
    setModalError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError('');
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
      setModalError(e instanceof Error ? e.message : t('leistungen.error.save'));
    } finally {
      setSaving(false);
    }
  }

  // Nach erfolgreichem Starter-Import: Dialog schließen, Liste neu laden, Toast
  // mit Erfolg-Feedback (inkl. übersprungener, bereits vorhandener Leistungen).
  async function handleStarterDone(result: StarterImportResult) {
    setStarterOpen(false);
    await load();
    if (result.importiert > 0) {
      const teile = [t('starter.done.toast', { count: result.importiert })];
      if (result.uebersprungen > 0) teile.push(t('starter.done.skipped', { count: result.uebersprungen }));
      toast(teile.join(' '));
    } else {
      toast(t('starter.done.nothing'), { variant: 'copper' });
    }
  }

  return (
    <div>
      <PageHeader
        title={t('leistungen.title')}
        subtitle={t('leistungen.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {darfStarter && items.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => setStarterOpen(true)}>
                {t('leistungen.starter.cta')}
              </button>
            )}
            <button className="btn-primary" onClick={openNew}>
              {t('leistungen.new')}
            </button>
          </div>
        }
      />
      {error && <ErrorBox message={error} />}
      <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-chrome-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-copper"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        {t('leistungen.showInactive')}
      </label>
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 && !showInactive && darfStarter ? (
          // Onboarding-Leerzustand: Starter-Katalog als primäre Aktion.
          <div className="animate-fade-in flex flex-col items-center justify-center gap-4 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-copper-soft text-copper ring-1 ring-copper/20">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 3 8l9 5 9-5-9-5Z" />
                <path d="M3 13l9 5 9-5" />
                <path d="M3 8v5m18-5v5" />
              </svg>
            </div>
            <div className="max-w-md">
              <h3 className="font-display text-base font-semibold text-chrome-50">
                {t('leistungen.starter.emptyTitle')}
              </h3>
              <p className="mt-1 text-sm text-chrome-400">{t('leistungen.starter.emptyHint')}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button className="btn-primary" onClick={() => setStarterOpen(true)}>
                {t('leistungen.starter.cta')}
              </button>
              <span className="text-xs text-chrome-500">{t('leistungen.starter.or')}</span>
              <button className="btn-ghost btn-sm" onClick={openNew}>
                {t('leistungen.empty.action')}
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <Empty
            text={showInactive ? t('leistungen.empty.inactive') : t('leistungen.empty.none')}
            action={
              showInactive ? undefined : (
                <button className="btn-primary btn-sm" onClick={openNew}>
                  {t('leistungen.empty.action')}
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('leistungen.col.name')}</th>
                  <th>{t('leistungen.col.kategorie')}</th>
                  <th>{t('leistungen.col.einheit')}</th>
                  <th className="text-end">{t('leistungen.col.basispreis')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className={s.aktiv === false ? 'opacity-60' : undefined}>
                    <td className="font-medium">
                      {s.name}
                      {s.aktiv === false && <Badge className="badge-neutral ms-2">{t('leistungen.inaktiv')}</Badge>}
                    </td>
                    <td>{KAT_KEY[s.kategorie] ? t(KAT_KEY[s.kategorie]) : s.kategorie}</td>
                    <td>{EINHEIT_KEY[s.einheit] ? t(EINHEIT_KEY[s.einheit]) : s.einheit}</td>
                    <td className="text-end">{eur(s.basispreis)}</td>
                    <td className="text-end">
                      <div className="flex justify-end">
                        <ActionMenu
                          label={t('leistungen.actionsFor', { name: s.name })}
                          items={[
                            { key: 'edit', label: t('leistungen.action.bearbeiten'), onSelect: () => openEdit(s) },
                            s.aktiv === false
                              ? { key: 'react', label: t('leistungen.action.reaktivieren'), disabled: busyId === s.id, onSelect: () => setAktiv(s, true) }
                              : { key: 'arch', label: t('leistungen.action.archivieren'), disabled: busyId === s.id, onSelect: () => setAktiv(s, false) },
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

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t('leistungen.modal.editTitle') : t('leistungen.modal.newTitle')}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">{t('leistungen.field.name')}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">{t('leistungen.field.beschreibung')}</label>
            <input className="input" value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">{t('leistungen.field.kategorie')}</label>
              <select className="select" value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })}>
                <option value="aufbereitung">{t('leistungen.kat.aufbereitung')}</option>
                <option value="folierung">{t('leistungen.kat.folierung')}</option>
                <option value="ppf">{t('leistungen.kat.ppf')}</option>
                <option value="sonstiges">{t('leistungen.kat.sonstiges')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('leistungen.field.einheit')}</label>
              <select className="select" value={form.einheit} onChange={(e) => setForm({ ...form, einheit: e.target.value })}>
                <option value="pauschal">{t('leistungen.einheit.pauschal')}</option>
                <option value="qm">{t('leistungen.einheit.qm')}</option>
                <option value="stunde">{t('leistungen.einheit.stunde')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('leistungen.field.basispreis')}</label>
              <input type="number" step="0.01" className="input" value={form.basispreis} onChange={(e) => setForm({ ...form, basispreis: e.target.value })} required />
            </div>
          </div>
          {modalError && <ErrorBox message={modalError} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('leistungen.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {darfStarter && (
        <StarterKatalogDialog
          open={starterOpen}
          onClose={() => setStarterOpen(false)}
          onDone={handleStarterDone}
          defaultGewerke={defaultGewerkeFor(betriebstyp)}
        />
      )}
    </div>
  );
}
