'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { Location, StandortAuswertung } from '@/lib/types';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Modal,
  SectionCard,
} from '@/components/ui';

// Rollen, die Standorte verwalten und die Auswertung sehen duerfen.
const VERWALTUNG_ROLLEN = ['platform_admin', 'owner', 'manager'];

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
  if (daten.length === 0) return <Empty text="Noch keine Auswertungsdaten." />;
  const maxUmsatz = Math.max(1, ...daten.map((d) => d.umsatz));
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Standort</th>
            <th>Umsatz</th>
            <th className="text-right">Offene Aufträge</th>
            <th className="text-right">Termine</th>
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
  const { user } = useAuth();
  const darfVerwalten = !!user && VERWALTUNG_ROLLEN.includes(user.role);

  const [standorte, setStandorte] = useState<Location[] | null>(null);
  const [auswertung, setAuswertung] = useState<StandortAuswertung[]>([]);
  const [error, setError] = useState('');

  const [modalOffen, setModalOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(LEER);
  const [busy, setBusy] = useState(false);

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
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    }
  }, [darfVerwalten]);

  useEffect(() => {
    laden();
  }, [laden]);

  function neu() {
    setBearbeiteId(null);
    setForm(LEER);
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
    setModalOffen(true);
  }

  async function speichern() {
    if (!form.name.trim()) {
      setError('Name ist erforderlich.');
      return;
    }
    setBusy(true);
    try {
      if (bearbeiteId) {
        await api.patch(`/locations/${bearbeiteId}`, form);
      } else {
        await api.post('/locations', form);
      }
      setModalOffen(false);
      await laden();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
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
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  if (error && !standorte) return <ErrorBox message={error} />;
  if (!standorte) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Standorte"
        subtitle="Standorte verwalten und vergleichen"
        action={
          darfVerwalten ? (
            <button className="btn-primary" onClick={neu}>
              + Standort
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      {darfVerwalten && (
        <div className="mb-4">
          <SectionCard title="Standortübergreifende Auswertung" subtitle="Innerhalb des Mandanten">
            <Auswertung daten={auswertung} />
          </SectionCard>
        </div>
      )}

      <SectionCard title={`Standorte (${standorte.length})`}>
        {standorte.length === 0 ? (
          <Empty
            text="Noch keine Standorte angelegt."
            action={
              darfVerwalten ? (
                <button className="btn-primary" onClick={neu}>
                  Ersten Standort anlegen
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Adresse</th>
                  <th>Telefon</th>
                  <th>Status</th>
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
                        {s.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </td>
                    {darfVerwalten && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button className="btn-subtle btn-sm" onClick={() => bearbeiten(s)}>
                            Bearbeiten
                          </button>
                          <button
                            className="btn-subtle btn-sm"
                            disabled={busy}
                            onClick={() => deaktivierenUmschalten(s)}
                          >
                            {s.isActive ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
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
        title={bearbeiteId ? 'Standort bearbeiten' : 'Standort anlegen'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Filiale München-Nord"
            />
          </div>
          <div>
            <label className="label">Straße</label>
            <input
              className="input"
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">PLZ</label>
              <input
                className="input"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="label">Stadt</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Telefon</label>
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
            Standort aktiv
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModalOffen(false)}>
              Abbrechen
            </button>
            <button className="btn-primary" disabled={busy} onClick={speichern}>
              Speichern
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
