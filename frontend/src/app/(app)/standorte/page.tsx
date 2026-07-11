'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { Location, StandortAuswertung } from '@/lib/types';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Modal,
  SectionCard,
} from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { useT } from '@/lib/i18n';

type FormState = {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  isActive: boolean;
};

const LEER: FormState = {
  name: '',
  street: '',
  city: '',
  postalCode: '',
  phone: '',
  isActive: true,
};

// Standortuebergreifende Auswertung als kleines horizontales Balkendiagramm.
function Auswertung({ daten }: { daten: StandortAuswertung[] }) {
  const t = useT();
  if (daten.length === 0) return <Empty text={t('standorte.auswertung.empty')} />;
  const maxUmsatz = Math.max(1, ...daten.map((d) => d.umsatz));
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{t('standorte.col.standort')}</th>
            <th>{t('standorte.col.umsatz')}</th>
            <th className="text-right">{t('standorte.col.offeneAuftraege')}</th>
            <th className="text-right">{t('standorte.col.termine')}</th>
          </tr>
        </thead>
        <tbody>
          {daten.map((d) => (
            <tr key={d.locationId ?? 'ohne'}>
              <td className="font-medium">{d.name}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full bg-copper-grad"
                      style={{ width: `${Math.round((d.umsatz / maxUmsatz) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-chrome-200">{eur(d.umsatz)}</span>
                </div>
              </td>
              <td className="text-right">{d.offeneAuftraege}</td>
              <td className="text-right">{d.termine}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StandortePage() {
  const t = useT();
  const { user } = useAuth();
  const darfVerwalten = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [standorte, setStandorte] = useState<Location[] | null>(null);
  const [auswertung, setAuswertung] = useState<StandortAuswertung[]>([]);
  const [error, setError] = useState('');

  const [modalOffen, setModalOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(LEER);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const laden = useCallback(async () => {
    try {
      const liste = await api.get<Location[]>('/locations');
      setStandorte(liste);
      if (darfVerwalten) {
        const a = await api.get<StandortAuswertung[]>('/locations/auswertung');
        setAuswertung(a);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('standorte.error.load'));
    }
  }, [darfVerwalten, t]);

  useEffect(() => {
    laden();
  }, [laden]);

  function neu() {
    setBearbeiteId(null);
    setForm(LEER);
    setModalError('');
    setModalOffen(true);
  }

  function bearbeiten(s: Location) {
    setBearbeiteId(s.id);
    setForm({
      name: s.name,
      street: s.street ?? '',
      city: s.city ?? '',
      postalCode: s.postalCode ?? '',
      phone: s.phone ?? '',
      isActive: s.isActive,
    });
    setModalError('');
    setModalOffen(true);
  }

  async function speichern() {
    if (!form.name.trim()) {
      setModalError(t('standorte.error.nameRequired'));
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      if (bearbeiteId) {
        await api.patch(`/locations/${bearbeiteId}`, form);
      } else {
        await api.post('/locations', form);
      }
      setModalOffen(false);
      await laden();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : t('standorte.error.save'));
    } finally {
      setBusy(false);
    }
  }

  async function deaktivierenUmschalten(s: Location) {
    setBusy(true);
    try {
      await api.patch(`/locations/${s.id}`, { isActive: !s.isActive });
      await laden();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('standorte.error.action'));
    } finally {
      setBusy(false);
    }
  }

  if (error && !standorte) return <ErrorBox message={error} />;
  if (!standorte) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('standorte.title')}
        subtitle={t('standorte.subtitle')}
        action={
          darfVerwalten ? (
            <button className="btn-primary" onClick={neu}>
              {t('standorte.new')}
            </button>
          ) : undefined
        }
      />

      {error && <ErrorBox className="mb-4" message={error} />}

      {darfVerwalten && (
        <div className="mb-4">
          <SectionCard title={t('standorte.auswertung.title')} subtitle={t('standorte.auswertung.subtitle')}>
            <Auswertung daten={auswertung} />
          </SectionCard>
        </div>
      )}

      <SectionCard title={t('standorte.listTitle', { count: standorte.length })}>
        {standorte.length === 0 ? (
          <Empty
            text={t('standorte.empty')}
            action={
              darfVerwalten ? (
                <button className="btn-primary" onClick={neu}>
                  {t('standorte.emptyCta')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('standorte.col.name')}</th>
                  <th>{t('standorte.col.adresse')}</th>
                  <th>{t('standorte.col.telefon')}</th>
                  <th>{t('standorte.col.status')}</th>
                  {darfVerwalten && <th></th>}
                </tr>
              </thead>
              <tbody>
                {standorte.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-chrome-300">
                      {[s.street, [s.postalCode, s.city].filter(Boolean).join(' ')]
                        .filter(Boolean)
                        .join(', ') || '–'}
                    </td>
                    <td className="text-chrome-300">{s.phone || '–'}</td>
                    <td>
                      <Badge className={s.isActive ? 'badge-positive' : 'badge-neutral'}>
                        {s.isActive ? t('standorte.active') : t('standorte.inactive')}
                      </Badge>
                    </td>
                    {darfVerwalten && (
                      <td className="text-right">
                        <div className="flex justify-end">
                          <ActionMenu
                            label={t('standorte.actionsFor', { name: s.name })}
                            items={[
                              { key: 'edit', label: t('standorte.action.edit'), onSelect: () => bearbeiten(s) },
                              {
                                key: 'toggle',
                                label: s.isActive ? t('standorte.action.deactivate') : t('standorte.action.activate'),
                                disabled: busy,
                                onSelect: () => deaktivierenUmschalten(s),
                              },
                            ] satisfies ActionMenuItem[]}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={modalOffen}
        onClose={() => setModalOffen(false)}
        title={bearbeiteId ? t('standorte.modal.edit') : t('standorte.modal.new')}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('standorte.form.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('standorte.form.namePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('standorte.form.street')}</label>
            <input
              className="input"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">{t('standorte.form.plz')}</label>
              <input
                className="input"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="label">{t('standorte.form.stadt')}</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">{t('standorte.form.telefon')}</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-chrome-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-copper"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t('standorte.form.active')}
          </label>
          {modalError && <ErrorBox message={modalError} />}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModalOffen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={busy} onClick={speichern}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
