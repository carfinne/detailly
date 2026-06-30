'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { datumZeit } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { TIME_ENTRY_TYPE_LABEL, TIME_ENTRY_TYPE_COLOR } from '@/lib/labels';
import type { TimeEntry, TimeClockStatus, TimeEntryType, Location, Employee } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

// Leitungsrollen sehen zusaetzlich die Gesamtuebersicht und koennen Eintraege pflegen.
const LEITUNG = ['platform_admin', 'owner', 'manager'];

// Leeres Formular fuer das Anlegen/Bearbeiten eines Eintrags durch die Leitung.
const LEER = { userId: '', art: 'kommen' as TimeEntryType, zeitpunkt: '', locationId: '', notiz: '' };

// Wandelt einen ISO-Zeitstempel in den Wert eines <input type="datetime-local"> (lokale Zeit, ohne Sekunden).
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Zeigt nur die Uhrzeit (HH:MM) eines Zeitstempels fuer die Statusanzeige.
function uhrzeit(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function ZeiterfassungPage() {
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG.includes(user.role);

  const [status, setStatus] = useState<TimeClockStatus | null>(null);
  const [meine, setMeine] = useState<TimeEntry[]>([]);
  const [alle, setAlle] = useState<TimeEntry[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stempelnLaeuft, setStempelnLaeuft] = useState(false);

  // Standortwahl der Stempeluhr (leer = ohne Standort).
  const [stempelOrt, setStempelOrt] = useState('');

  // Filter der Leitungs-Liste.
  const [filter, setFilter] = useState({ userId: '', locationId: '', von: '', bis: '' });

  // Modal "Eintrag anlegen/bearbeiten" (Leitung).
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);

  // Laedt die Leitungs-Liste mit den aktuellen Filtern.
  const ladeAlle = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.userId) params.set('userId', filter.userId);
    if (filter.locationId) params.set('locationId', filter.locationId);
    if (filter.von) params.set('von', new Date(filter.von).toISOString());
    if (filter.bis) params.set('bis', new Date(filter.bis).toISOString());
    const qs = params.toString();
    return api.get<TimeEntry[]>(`/zeiterfassung${qs ? `?${qs}` : ''}`);
  }, [filter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, me, locs] = await Promise.all([
        api.get<TimeClockStatus>('/zeiterfassung/status'),
        api.get<TimeEntry[]>('/zeiterfassung/meine'),
        api.get<Location[]>('/locations'),
      ]);
      setStatus(st);
      setMeine(me);
      setLocations(locs);
      // Leitungs-Daten nur fuer berechtigte Rollen nachladen.
      if (istLeitung) {
        const [al, emp] = await Promise.all([ladeAlle(), api.get<Employee[]>('/employees')]);
        setAlle(al);
        setEmployees(emp);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [istLeitung, ladeAlle]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Stempeluhr: Kommen/Gehen ---
  async function stempeln() {
    if (!status) return;
    setError('');
    setStempelnLaeuft(true);
    try {
      const art: TimeEntryType = status.eingestempelt ? 'gehen' : 'kommen';
      await api.post('/zeiterfassung/stempeln', {
        art,
        ...(stempelOrt ? { locationId: stempelOrt } : {}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stempeln fehlgeschlagen');
    } finally {
      setStempelnLaeuft(false);
    }
  }

  // --- Leitung: Eintrag anlegen/bearbeiten ---
  function openNeu() {
    setEdit(null);
    setForm({ ...LEER, zeitpunkt: toLocalInput(new Date().toISOString()) });
    setOpen(true);
  }
  function openEdit(e: TimeEntry) {
    setEdit(e);
    setForm({
      userId: e.userId,
      art: e.art,
      zeitpunkt: toLocalInput(e.zeitpunkt),
      locationId: e.locationId ?? '',
      notiz: e.notiz ?? '',
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.zeitpunkt) {
      setError('Bitte einen Zeitpunkt angeben.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        art: form.art,
        zeitpunkt: new Date(form.zeitpunkt).toISOString(),
        locationId: form.locationId || undefined,
        notiz: form.notiz || undefined,
      };
      if (edit) {
        await api.patch(`/zeiterfassung/${edit.id}`, payload);
      } else {
        payload.userId = form.userId;
        await api.post('/zeiterfassung', payload);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await api.delete(`/zeiterfassung/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loeschen fehlgeschlagen');
    }
  }

  return (
    <div>
      <PageHeader title="Zeiterfassung" subtitle="Stempeluhr: Kommen/Gehen erfassen" />

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {/* Stempeluhr */}
          <SectionCard title="Stempeluhr" subtitle="Erfasse jetzt Kommen oder Gehen">
            <div className="flex flex-wrap items-center justify-between gap-5">
              {/* Aktueller Status */}
              <div className="flex items-center gap-3">
                {status?.eingestempelt ? (
                  <Badge className="badge-positive">
                    Eingestempelt seit {uhrzeit(status.seit)} Uhr
                  </Badge>
                ) : (
                  <Badge className="badge-neutral">Ausgestempelt</Badge>
                )}
              </div>

              {/* Aktion: Standortwahl + grosser Stempel-Button */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="input w-auto min-w-[12rem]"
                  value={stempelOrt}
                  onChange={(e) => setStempelOrt(e.target.value)}
                >
                  <option value="">Ohne Standort</option>
                  {locations
                    .filter((l) => l.isActive)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
                <button
                  className="btn-primary px-8 py-3 text-base"
                  onClick={stempeln}
                  disabled={stempelnLaeuft || !status}
                >
                  {stempelnLaeuft ? 'Wird gestempelt…' : status?.eingestempelt ? 'Gehen' : 'Kommen'}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Meine Zeiten */}
          <SectionCard title="Meine Zeiten" subtitle="Deine letzten Stempelungen">
            {meine.length === 0 ? (
              <Empty text="Noch keine Stempelungen." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Zeitpunkt</th>
                      <th>Art</th>
                      <th>Standort</th>
                      <th>Notiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meine.map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium">{datumZeit(e.zeitpunkt)}</td>
                        <td>
                          <Badge className={TIME_ENTRY_TYPE_COLOR[e.art]}>
                            {TIME_ENTRY_TYPE_LABEL[e.art] ?? e.art}
                          </Badge>
                        </td>
                        <td className="text-chrome-300">{e.standortName ?? '–'}</td>
                        <td className="text-chrome-400">{e.notiz || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Alle Eintraege (Leitung) */}
          {istLeitung && (
            <SectionCard
              title="Alle Eintraege (Leitung)"
              subtitle="Stempelungen aller Mitarbeiter – filtern, korrigieren, anlegen"
              action={
                <button className="btn-primary" onClick={openNeu}>
                  Eintrag anlegen
                </button>
              }
            >
              {/* Filter */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label">Mitarbeiter</label>
                  <select
                    className="input"
                    value={filter.userId}
                    onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
                  >
                    <option value="">Alle</option>
                    {employees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Standort</label>
                  <select
                    className="input"
                    value={filter.locationId}
                    onChange={(e) => setFilter({ ...filter, locationId: e.target.value })}
                  >
                    <option value="">Alle</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Von</label>
                  <input
                    type="date"
                    className="input"
                    value={filter.von}
                    onChange={(e) => setFilter({ ...filter, von: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Bis</label>
                  <input
                    type="date"
                    className="input"
                    value={filter.bis}
                    onChange={(e) => setFilter({ ...filter, bis: e.target.value })}
                  />
                </div>
              </div>

              {alle.length === 0 ? (
                <Empty text="Keine Eintraege fuer die aktuelle Auswahl." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Mitarbeiter</th>
                        <th>Zeitpunkt</th>
                        <th>Art</th>
                        <th>Standort</th>
                        <th>Korrigiert</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alle.map((e) => (
                        <tr key={e.id}>
                          <td className="font-medium">{e.mitarbeiterName ?? '–'}</td>
                          <td>{datumZeit(e.zeitpunkt)}</td>
                          <td>
                            <Badge className={TIME_ENTRY_TYPE_COLOR[e.art]}>
                              {TIME_ENTRY_TYPE_LABEL[e.art] ?? e.art}
                            </Badge>
                          </td>
                          <td className="text-chrome-300">{e.standortName ?? '–'}</td>
                          <td>
                            {e.korrigiert ? (
                              <Badge className="badge-neutral">Korrigiert</Badge>
                            ) : (
                              <span className="text-chrome-600">–</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-3 whitespace-nowrap">
                              <button className="text-chrome-200 hover:underline" onClick={() => openEdit(e)}>
                                Bearbeiten
                              </button>
                              <button className="link-danger" onClick={() => remove(e.id)}>
                                Loeschen
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* Modal: Eintrag anlegen/bearbeiten (Leitung) */}
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? 'Eintrag bearbeiten' : 'Eintrag anlegen'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Mitarbeiter</label>
            <select
              className="input"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              required
              disabled={!!edit}
            >
              <option value="" disabled>
                Mitarbeiter auswaehlen…
              </option>
              {employees.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Art</label>
              <select
                className="input"
                value={form.art}
                onChange={(e) => setForm({ ...form, art: e.target.value as TimeEntryType })}
              >
                <option value="kommen">Kommen</option>
                <option value="gehen">Gehen</option>
              </select>
            </div>
            <div>
              <label className="label">Zeitpunkt</label>
              <input
                type="datetime-local"
                className="input"
                value={form.zeitpunkt}
                onChange={(e) => setForm({ ...form, zeitpunkt: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Standort</label>
            <select
              className="input"
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            >
              <option value="">Ohne Standort</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notiz</label>
            <textarea
              className="input"
              rows={2}
              value={form.notiz}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
            />
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
