'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { datumZeit, toLocalInput } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { TIME_ENTRY_TYPE_COLOR } from '@/lib/labels';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import type { TimeEntry, TimeClockStatus, TimeEntryType, Location, Employee } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, UpgradeHinweis, Empty, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { ProjektzeitCard } from '@/components/ProjektzeitCard';
import { ProjektUebersichtCard } from '@/components/ProjektUebersichtCard';
import { useT } from '@/lib/i18n';

// Enum->i18n-Key (Rohwert-Fallback via t()). Die geteilte labels.ts bleibt
// unangetastet; TIME_ENTRY_TYPE_COLOR (Badge-Farbe) bleibt importiert.
const ART_KEY: Record<string, string> = {
  kommen: 'zeiterfassung.art.kommen',
  gehen: 'zeiterfassung.art.gehen',
};

// Leeres Formular fuer das Anlegen/Bearbeiten eines Eintrags durch die Leitung.
const LEER = { userId: '', art: 'kommen' as TimeEntryType, zeitpunkt: '', locationId: '', notiz: '' };

// Zeigt nur die Uhrzeit (HH:MM) eines Zeitstempels fuer die Statusanzeige.
function uhrzeit(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function ZeiterfassungPage() {
  const t = useT();
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [status, setStatus] = useState<TimeClockStatus | null>(null);
  const [meine, setMeine] = useState<TimeEntry[]>([]);
  const [alle, setAlle] = useState<TimeEntry[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tarif-403 (Feature nicht im Tarif) vom Rollen-/Ladefehler unterscheiden, um
  // den Upgrade-Weg (/abo) statt einer Sackgasse zu zeigen.
  const [upgrade, setUpgrade] = useState(false);
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
  const [modalError, setModalError] = useState('');

  // Loeschen-Bestaetigung (Pending-State: welcher Eintrag steht zum Loeschen an?)
  const [confirmDelete, setConfirmDelete] = useState<TimeEntry | null>(null);
  const [removing, setRemoving] = useState(false);

  // Remount-Schluessel: nach einer neuen Projektzeit-Buchung laedt die Uebersicht neu.
  const [projektRefresh, setProjektRefresh] = useState(0);

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
      setUpgrade(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof Error ? e.message : t('zeiterfassung.error.load'));
    } finally {
      setLoading(false);
    }
  }, [istLeitung, ladeAlle, t]);

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
      setError(e instanceof Error ? e.message : t('zeiterfassung.error.stamp'));
    } finally {
      setStempelnLaeuft(false);
    }
  }

  // --- Leitung: Eintrag anlegen/bearbeiten ---
  function openNeu() {
    setEdit(null);
    setForm({ ...LEER, zeitpunkt: toLocalInput(new Date()) });
    setModalError('');
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
    setModalError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.zeitpunkt) {
      setModalError(t('zeiterfassung.error.timeRequired'));
      return;
    }
    setSaving(true);
    setModalError('');
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
      setModalError(e instanceof Error ? e.message : t('zeiterfassung.error.save'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirmDelete) return;
    setError('');
    setRemoving(true);
    try {
      await api.delete(`/zeiterfassung/${confirmDelete.id}`);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setConfirmDelete(null);
      setError(e instanceof Error ? e.message : t('zeiterfassung.error.delete'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('zeiterfassung.title')} subtitle={t('zeiterfassung.subtitle')} />

      {error && (upgrade ? <UpgradeHinweis message={error} /> : <ErrorBox message={error} />)}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {/* Stempeluhr */}
          <SectionCard title={t('zeiterfassung.clock.title')} subtitle={t('zeiterfassung.clock.subtitle')}>
            <div className="flex flex-wrap items-center justify-between gap-5">
              {/* Aktueller Status */}
              <div className="flex items-center gap-3">
                {status?.eingestempelt ? (
                  <Badge className="badge-positive">
                    {t('zeiterfassung.clock.since', { time: uhrzeit(status.seit) })}
                  </Badge>
                ) : (
                  <Badge className="badge-neutral">{t('zeiterfassung.clock.out')}</Badge>
                )}
              </div>

              {/* Aktion: Standortwahl + grosser Stempel-Button */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="input w-auto min-w-[12rem]"
                  value={stempelOrt}
                  onChange={(e) => setStempelOrt(e.target.value)}
                >
                  <option value="">{t('zeiterfassung.clock.noLocation')}</option>
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
                  {stempelnLaeuft
                    ? t('zeiterfassung.clock.stamping')
                    : status?.eingestempelt
                      ? t('zeiterfassung.art.gehen')
                      : t('zeiterfassung.art.kommen')}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Meine Zeiten */}
          <SectionCard title={t('zeiterfassung.mine.title')} subtitle={t('zeiterfassung.mine.subtitle')}>
            {meine.length === 0 ? (
              <Empty text={t('zeiterfassung.mine.empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('zeiterfassung.col.zeitpunkt')}</th>
                      <th>{t('zeiterfassung.col.art')}</th>
                      <th>{t('zeiterfassung.col.standort')}</th>
                      <th>{t('zeiterfassung.col.notiz')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meine.map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium">{datumZeit(e.zeitpunkt)}</td>
                        <td>
                          <Badge className={TIME_ENTRY_TYPE_COLOR[e.art]}>
                            {ART_KEY[e.art] ? t(ART_KEY[e.art]) : e.art}
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
              title={t('zeiterfassung.all.title')}
              subtitle={t('zeiterfassung.all.subtitle')}
              action={
                <button className="btn-primary" onClick={openNeu}>
                  {t('zeiterfassung.newEntry')}
                </button>
              }
            >
              {/* Filter */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label">{t('zeiterfassung.col.mitarbeiter')}</label>
                  <select
                    className="input"
                    value={filter.userId}
                    onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
                  >
                    <option value="">{t('zeiterfassung.filter.alle')}</option>
                    {employees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('zeiterfassung.col.standort')}</label>
                  <select
                    className="input"
                    value={filter.locationId}
                    onChange={(e) => setFilter({ ...filter, locationId: e.target.value })}
                  >
                    <option value="">{t('zeiterfassung.filter.alle')}</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('zeiterfassung.filter.von')}</label>
                  <input
                    type="date"
                    className="input"
                    value={filter.von}
                    onChange={(e) => setFilter({ ...filter, von: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">{t('zeiterfassung.filter.bis')}</label>
                  <input
                    type="date"
                    className="input"
                    value={filter.bis}
                    onChange={(e) => setFilter({ ...filter, bis: e.target.value })}
                  />
                </div>
              </div>

              {alle.length === 0 ? (
                <Empty text={t('zeiterfassung.all.empty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('zeiterfassung.col.mitarbeiter')}</th>
                        <th>{t('zeiterfassung.col.zeitpunkt')}</th>
                        <th>{t('zeiterfassung.col.art')}</th>
                        <th>{t('zeiterfassung.col.standort')}</th>
                        <th>{t('zeiterfassung.col.korrigiert')}</th>
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
                              {ART_KEY[e.art] ? t(ART_KEY[e.art]) : e.art}
                            </Badge>
                          </td>
                          <td className="text-chrome-300">{e.standortName ?? '–'}</td>
                          <td>
                            {e.korrigiert ? (
                              <Badge className="badge-neutral">{t('zeiterfassung.col.korrigiert')}</Badge>
                            ) : (
                              <span className="text-chrome-600">–</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-3 whitespace-nowrap">
                              <button className="link-muted" onClick={() => openEdit(e)}>
                                {t('zeiterfassung.action.edit')}
                              </button>
                              <button className="link-danger" onClick={() => setConfirmDelete(e)}>
                                {t('zeiterfassung.action.delete')}
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

          {/* ── Fachlich getrennt: Projektzeit (auftragsbezogen) ist KEINE
              Anwesenheits-/Arbeitszeitdokumentation, sondern Job-Costing. ── */}
          <div className="flex items-center gap-3 pt-2">
            <span className="h-px flex-1 bg-ink-700/60" />
            <span className="text-xs font-medium uppercase tracking-wide text-chrome-500">
              {t('projektzeit.divider')}
            </span>
            <span className="h-px flex-1 bg-ink-700/60" />
          </div>

          <ProjektzeitCard
            istLeitung={istLeitung}
            employees={employees}
            onBooked={() => setProjektRefresh((v) => v + 1)}
          />
          <ProjektUebersichtCard key={projektRefresh} istLeitung={istLeitung} employees={employees} />
        </div>
      )}

      {/* Modal: Eintrag anlegen/bearbeiten (Leitung) */}
      <Modal open={open} onClose={() => setOpen(false)} title={edit ? t('zeiterfassung.modal.edit') : t('zeiterfassung.newEntry')}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">{t('zeiterfassung.col.mitarbeiter')}</label>
            <select
              className="input"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              required
              disabled={!!edit}
            >
              <option value="" disabled>
                {t('zeiterfassung.form.selectEmployee')}
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
              <label className="label">{t('zeiterfassung.col.art')}</label>
              <select
                className="input"
                value={form.art}
                onChange={(e) => setForm({ ...form, art: e.target.value as TimeEntryType })}
              >
                <option value="kommen">{t('zeiterfassung.art.kommen')}</option>
                <option value="gehen">{t('zeiterfassung.art.gehen')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('zeiterfassung.col.zeitpunkt')}</label>
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
            <label className="label">{t('zeiterfassung.col.standort')}</label>
            <select
              className="input"
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            >
              <option value="">{t('zeiterfassung.clock.noLocation')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('zeiterfassung.col.notiz')}</label>
            <textarea
              className="input"
              rows={2}
              value={form.notiz}
              onChange={(e) => setForm({ ...form, notiz: e.target.value })}
            />
          </div>
          {modalError && <ErrorBox message={modalError} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('zeiterfassung.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('zeiterfassung.delete.title')}
        message={
          confirmDelete
            ? confirmDelete.mitarbeiterName
              ? t('zeiterfassung.delete.msgNamed', {
                  name: confirmDelete.mitarbeiterName,
                  date: datumZeit(confirmDelete.zeitpunkt),
                })
              : t('zeiterfassung.delete.msg', { date: datumZeit(confirmDelete.zeitpunkt) })
            : ''
        }
        confirmLabel={t('zeiterfassung.action.delete')}
        busy={removing}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
