'use client';

// ---------------------------------------------------------------------------
// Plantafel 2.0 – das Planungs-Herzstueck des Betriebs.
//
// Kalender-Mission W1 (Frontend): Arbeitszeitfenster statt 0–24, Mitarbeiter-
// Zuweisung + Standort im Termin, Farbmodi (Status/Mitarbeiter/Leistung),
// Konflikt-Dialog des Doppelbuchungs-Schutzes (409 APPOINTMENT_OVERLAP) fuer
// Anlegen/Bearbeiten/Drag, fuenf Ansichten (Tag/Woche/2 Wochen/Monat/Jahr),
// Anfragen-Seitenpanel und Auslastungs-Balken (nur Leitung).
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { kundenName, toLocalInput } from '@/lib/format';
import type { Appointment, Customer, Vehicle, Employee, Location, Order, TerminKonflikt } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Modal, ConfirmDialog, RequiredMark, useToast } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { SERVICE_TYPE_KEY } from '@/lib/labels';
import {
  View,
  Farbmodus,
  KalenderEinstellungen,
  EINSTELLUNGEN_DEFAULTS,
  LEISTUNG_STIL,
  NEUTRAL_STIL,
  STATUS_STYLE,
  addDays,
  auslastungProzent,
  initialen,
  mitarbeiterStil,
  startOfDay,
  startOfMonth,
  startOfWeek,
  statusStil,
  wochentagVon,
} from './plantafel-lib';
import { TimeGrid } from './TimeGrid';
import { MonthGrid } from './MonthGrid';
import { YearView } from './YearView';
import { KonfliktDialog } from './KonfliktDialog';
import { AnfragenPanel } from './AnfragenPanel';

// Enum->i18n-Key (Rohwert-Fallback in der Komponente). Die geteilte labels.ts
// bleibt unangetastet; die Aufloesung erfolgt lokal via t().
const APPT_STATUS_KEY: Record<string, string> = {
  geplant: 'plantafel.status.geplant',
  bestaetigt: 'plantafel.status.bestaetigt',
  laeuft: 'plantafel.status.laeuft',
  abgeschlossen: 'plantafel.status.abgeschlossen',
  abgesagt: 'plantafel.status.abgesagt',
};

const LEER = {
  id: '', titel: '', start: '', ende: '', customerId: '', vehicleId: '', orderId: '',
  status: 'geplant', assignedUserId: '', locationId: '',
};

/** Offener Konflikt (409): Liste + Wiederholung mit konfliktBestaetigt + optionaler Revert. */
interface KonfliktState {
  konflikte: TerminKonflikt[];
  retry: () => void;
  cancel?: () => void;
}

export default function PlantafelPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [view, setView] = useState<View>('woche');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [farbmodus, setFarbmodus] = useState<Farbmodus>('status');
  // Mitarbeiter-Filter: leere Menge = alle anzeigen; '' steht fuer "ohne Mitarbeiter".
  const [mitarbeiterFilter, setMitarbeiterFilter] = useState<Set<string>>(new Set());

  const [einst, setEinst] = useState<KalenderEinstellungen>(EINSTELLUNGEN_DEFAULTS);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  // /employees ist Leitung-only: 403 -> Zuweisungs-UI still ausblenden.
  const [employeesVerfuegbar, setEmployeesVerfuegbar] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  // Leistungsart-Farbmodus: orderId -> serviceType, lazy geladen (403 -> Modus still weg).
  const [serviceTypeByOrder, setServiceTypeByOrder] = useState<Record<string, string> | null>(null);
  const [leistungVerfuegbar, setLeistungVerfuegbar] = useState(true);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);
  const [error, setError] = useState('');

  // Anfragen-Seitenpanel (Rolle ohne Zugriff -> Toggle ausblenden).
  const [anfragenOffen, setAnfragenOffen] = useState(false);
  const [anfragenNeu, setAnfragenNeu] = useState(0);
  const [anfragenVerfuegbar, setAnfragenVerfuegbar] = useState(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Konflikt-Dialog (Anlegen/Bearbeiten UND Drag).
  const [konflikt, setKonflikt] = useState<KonfliktState | null>(null);
  const apptsSnapshot = useRef<Appointment[]>([]);

  const colsRef = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const ws = einst.darstellung.wochenstart;
  const zeitformat = einst.darstellung.zeitformat;
  const fensterStart = einst.darstellung.kalenderStartStunde;
  const fensterEnde = einst.darstellung.kalenderEndStunde;

  // sichtbarer Bereich je Ansicht
  const range = useMemo(() => {
    if (view === 'tag') return { days: [anchor], from: anchor, to: addDays(anchor, 1) };
    if (view === 'woche') {
      const f = startOfWeek(anchor, ws);
      return { days: Array.from({ length: 7 }, (_, i) => addDays(f, i)), from: f, to: addDays(f, 7) };
    }
    if (view === 'zweiwochen') {
      const f = startOfWeek(anchor, ws);
      return { days: Array.from({ length: 14 }, (_, i) => addDays(f, i)), from: f, to: addDays(f, 14) };
    }
    if (view === 'jahr') {
      const from = new Date(anchor.getFullYear(), 0, 1);
      return { days: [] as Date[], from, to: new Date(anchor.getFullYear() + 1, 0, 1) };
    }
    const gridStart = startOfWeek(startOfMonth(anchor), ws);
    return { days: Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), from: gridStart, to: addDays(gridStart, 42) };
  }, [view, anchor, ws]);

  const load = useCallback(async () => {
    // Skeleton nur beim Erstladen – bei Navigation/Reload nach Speichern
    // bleibt das Board stehen (sonst blinkt der ganze Kalender).
    if (initialLoad.current) setLoading(true);
    try {
      const [a, c, v, emp] = await Promise.all([
        api.get<Appointment[]>(`/appointments?from=${range.from.toISOString()}&to=${range.to.toISOString()}`),
        api.get<Customer[]>('/customers/select'),
        api.get<Vehicle[]>('/vehicles'),
        // Leitung-only (403 fuer Techniker): Zuweisungs-UI dann still ausblenden,
        // das Board selbst darf davon nie brechen.
        api.get<Employee[]>('/employees').catch(() => null),
      ]);
      setAppts(a);
      setCustomers(c);
      setVehicles(v);
      setEmployees(emp ?? []);
      setEmployeesVerfuegbar(emp !== null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plantafel.error.load'));
    } finally {
      setLoading(false);
      initialLoad.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.getTime(), range.to.getTime()]);

  useEffect(() => { void load(); }, [load]);

  // Einmalig: Kalender-Einstellungen, Standorte, Anfragen-Badge (alle tolerant).
  const ladeBadge = useCallback(async () => {
    try {
      const r = await api.get<{ neu: number }>('/booking-requests/count');
      setAnfragenNeu(r.neu);
      setAnfragenVerfuegbar(true);
    } catch {
      setAnfragenVerfuegbar(false);
    }
  }, []);
  useEffect(() => {
    api.get<KalenderEinstellungen>('/tenants/me/kalender-einstellungen')
      .then(setEinst)
      .catch(() => undefined); // Fallback: Defaults (7–19, Montag, 24h)
    api.get<Location[]>('/locations')
      .then((l) => setLocations(l.filter((x) => x.isActive)))
      .catch(() => setLocations([]));
    void ladeBadge();
  }, [ladeBadge]);

  // "Jetzt"-Linie aktuell halten
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Spaltenbreite messen (fuer Drag ueber Tage)
  useLayoutEffect(() => {
    const measure = () => {
      if (colsRef.current && range.days.length > 0) setColW(colsRef.current.clientWidth / range.days.length);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [range.days.length, view, loading]);

  const custMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);
  const vehMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);
  const aktiveEmployees = useMemo(() => employees.filter((e) => e.isActive !== false), [employees]);
  // Deterministische Farbzuteilung: Position in der SORTIERTEN ID-Liste (stabil).
  const empSortIds = useMemo(() => employees.map((e) => e.id).sort(), [employees]);

  // --- Farbmodus / Leistungsart-Map (lazy) ---
  const ladeLeistungen = useCallback(async () => {
    try {
      // Array-Modus des Orders-Endpoints (ohne page/limit): schlanke Listen-Projektion.
      const orders = await api.get<Order[]>('/orders');
      setServiceTypeByOrder(Object.fromEntries(orders.map((o) => [o.id, o.serviceType])));
    } catch {
      // Kein Zugriff (Rolle/Tarif) -> Modus still ausblenden, zurueck auf Status.
      setLeistungVerfuegbar(false);
      setFarbmodus((m) => (m === 'leistung' ? 'status' : m));
    }
  }, []);
  function waehleFarbmodus(m: Farbmodus) {
    setFarbmodus(m);
    if (m === 'leistung' && serviceTypeByOrder === null) void ladeLeistungen();
  }

  const stilFuer = useCallback((a: Appointment) => {
    if (a.status === 'abgesagt') return STATUS_STYLE.abgesagt; // abgesagt immer neutral
    if (farbmodus === 'mitarbeiter') return mitarbeiterStil(a.assignedUserId, empSortIds);
    if (farbmodus === 'leistung') {
      const st = a.orderId ? serviceTypeByOrder?.[a.orderId] : undefined;
      return (st && LEISTUNG_STIL[st]) || NEUTRAL_STIL;
    }
    return statusStil(a.status);
  }, [farbmodus, empSortIds, serviceTypeByOrder]);

  // Leistungs-Label eines Termins (fuer Fallback-Titel "Kunde – Leistung").
  const leistungFuer = useCallback((a: Appointment): string | undefined => {
    const st = a.orderId ? serviceTypeByOrder?.[a.orderId] : undefined;
    if (!st) return undefined;
    const key = SERVICE_TYPE_KEY[st];
    return key ? t(key) : st;
  }, [serviceTypeByOrder, t]);

  // --- Mitarbeiter-Filter ---
  const sichtbareAppts = useMemo(() => {
    if (mitarbeiterFilter.size === 0) return appts;
    return appts.filter((a) => mitarbeiterFilter.has(a.assignedUserId ?? ''));
  }, [appts, mitarbeiterFilter]);
  function toggleFilter(id: string) {
    setMitarbeiterFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const arbeitszeitFuer = useCallback(
    (day: Date) => einst.kalender.arbeitszeiten[wochentagVon(day)],
    [einst],
  );
  // Chef-Layer: Auslastung je Tag (clientseitig aus Terminen vs. Arbeitszeitfenster).
  const auslastungFuer = useMemo(() => {
    if (!istLeitung) return undefined;
    return (day: Date) => auslastungProzent(appts, day, arbeitszeitFuer(day));
  }, [istLeitung, appts, arbeitszeitFuer]);

  // --- Navigation ---
  const step = (dir: number) => setAnchor((a) => {
    if (view === 'tag') return addDays(a, dir);
    if (view === 'woche') return addDays(a, dir * 7);
    if (view === 'zweiwochen') return addDays(a, dir * 14);
    const x = new Date(a);
    if (view === 'jahr') { x.setFullYear(x.getFullYear() + dir); return startOfDay(x); }
    x.setMonth(x.getMonth() + dir);
    return startOfDay(x);
  });
  const rangeLabel = () => {
    if (view === 'tag') return anchor.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (view === 'woche' || view === 'zweiwochen') {
      const f = startOfWeek(anchor, ws);
      const l = addDays(f, view === 'woche' ? 6 : 13);
      return `${f.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${l.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (view === 'jahr') return String(anchor.getFullYear());
    return anchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  // --- Termin anlegen/bearbeiten ---
  function openNew(prefill?: { start: Date; ende: Date }) {
    const s = prefill?.start ?? (() => {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(Math.min(Math.max(fensterStart, d.getHours()), Math.max(fensterStart, fensterEnde - 1)));
      return d;
    })();
    const e = prefill?.ende ?? new Date(s.getTime() + 60 * 60_000);
    setForm({ ...LEER, start: toLocalInput(s), ende: toLocalInput(e) });
    setModalError('');
    setOpen(true);
  }
  function openEdit(a: Appointment) {
    setForm({
      id: a.id, titel: a.titel ?? '', start: toLocalInput(new Date(a.start)), ende: toLocalInput(new Date(a.ende)),
      customerId: a.customerId ?? '', vehicleId: a.vehicleId ?? '', orderId: a.orderId ?? '', status: a.status,
      assignedUserId: a.assignedUserId ?? '', locationId: a.locationId ?? '',
    });
    setModalError('');
    setOpen(true);
  }

  const istOverlap = (e: unknown): e is ApiError =>
    e instanceof ApiError && e.status === 409 && e.code === 'APPOINTMENT_OVERLAP';
  const konflikteAus = (e: ApiError): TerminKonflikt[] =>
    ((e.data as { konflikte?: TerminKonflikt[] } | undefined)?.konflikte) ?? [];

  const saveInner = useCallback(async (konfliktBestaetigt: boolean) => {
    setSaving(true);
    setModalError('');
    try {
      const payload: Record<string, unknown> = {
        titel: form.titel.trim(),
        start: new Date(form.start).toISOString(),
        ende: new Date(form.ende).toISOString(),
        customerId: form.customerId || undefined,
        vehicleId: form.vehicleId || undefined,
        // Zuweisung ENTFERNEN heisst explizit null senden ('' lehnt das DTO mit 400 ab).
        assignedUserId: form.assignedUserId || null,
        locationId: form.locationId || null,
      };
      if (konfliktBestaetigt) payload.konfliktBestaetigt = true;
      if (form.id) { payload.status = form.status; await api.patch(`/appointments/${form.id}`, payload); }
      else await api.post('/appointments', payload);
      setOpen(false);
      setForm(LEER);
      toast(t('plantafel.gespeichert'), { variant: 'positive' });
      await load();
    } catch (err) {
      if (istOverlap(err)) {
        setKonflikt({ konflikte: konflikteAus(err), retry: () => void saveInner(true) });
      } else {
        setModalError(err instanceof Error ? err.message : t('plantafel.error.save'));
      }
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, load, toast]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await saveInner(false);
  }

  async function remove() {
    if (!form.id) return;
    setSaving(true);
    setModalError('');
    try { await api.delete(`/appointments/${form.id}`); setConfirmDelete(false); setOpen(false); await load(); }
    catch (err) { setConfirmDelete(false); setModalError(err instanceof Error ? err.message : t('plantafel.error.delete')); }
    finally { setSaving(false); }
  }

  const patchTime = useCallback(async (id: string, start: Date, ende: Date, konfliktBestaetigt = false) => {
    // Optimistisch verschieben; Snapshot fuer den Revert bei "Abbrechen" im Konflikt-Dialog.
    if (!konfliktBestaetigt) apptsSnapshot.current = appts;
    setAppts((prev) => prev.map((a) => (a.id === id ? { ...a, start: start.toISOString(), ende: ende.toISOString() } : a)));
    try {
      await api.patch(`/appointments/${id}/zeit`, {
        start: start.toISOString(),
        ende: ende.toISOString(),
        ...(konfliktBestaetigt ? { konfliktBestaetigt: true } : {}),
      });
    } catch (err) {
      if (istOverlap(err)) {
        setKonflikt({
          konflikte: konflikteAus(err),
          retry: () => void patchTime(id, start, ende, true),
          cancel: () => setAppts(apptsSnapshot.current), // Drag zuruecknehmen
        });
      } else {
        setError(err instanceof Error ? err.message : t('plantafel.error.move'));
        await load();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts, load]);

  const fahrzeugName = (v: Vehicle) => `${v.make} ${v.model}`.trim();

  return (
    <div>
      <PageHeader
        title={t('plantafel.title')}
        subtitle={t('plantafel.subtitle')}
        action={<button className="btn-primary" onClick={() => openNew()}>{t('plantafel.new')}</button>}
      />

      {/* Steuerleiste: Navigation + Ansichten */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50" onClick={() => step(-1)} aria-label={t('common.back')}>‹</button>
          <button className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm font-medium text-chrome-200 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50" onClick={() => setAnchor(startOfDay(new Date()))}>{t('plantafel.today')}</button>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50" onClick={() => step(1)} aria-label={t('plantafel.next')}>›</button>
        </div>
        <span className="font-display text-base font-semibold text-chrome-50">{rangeLabel()}</span>
        <div className="seg-group ml-auto">
          {(['tag', 'woche', 'zweiwochen', 'monat', 'jahr'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`seg ${view === v ? 'seg-active' : ''}`}>
              {t(`plantafel.view.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Zweite Leiste: Farbmodus + Mitarbeiter-Filter + Anfragen-Panel-Toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {view !== 'jahr' && (
          <div className="flex items-center gap-2">
            <span className="kpi-label">{t('plantafel.farbe.label')}</span>
            <div className="seg-group">
              {(['status', 'mitarbeiter', 'leistung'] as const).map((m) => {
                if (m === 'mitarbeiter' && !employeesVerfuegbar) return null;
                if (m === 'leistung' && !leistungVerfuegbar) return null;
                return (
                  <button key={m} onClick={() => waehleFarbmodus(m)}
                    className={`seg !px-2.5 !py-1 text-xs ${farbmodus === m ? 'seg-active' : ''}`}>
                    {t(`plantafel.farbe.${m}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Mitarbeiter-Filter-Chips (nur wenn Mitarbeiterliste zugaenglich) */}
        {employeesVerfuegbar && aktiveEmployees.length > 0 && view !== 'jahr' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {aktiveEmployees.map((emp) => {
              const aktiv = mitarbeiterFilter.has(emp.id);
              const st = mitarbeiterStil(emp.id, empSortIds);
              return (
                <button
                  key={emp.id}
                  onClick={() => toggleFilter(emp.id)}
                  aria-pressed={aktiv}
                  title={`${emp.firstName} ${emp.lastName}`}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 ${aktiv ? 'border-copper/50 bg-copper-soft text-copper-300' : 'border-ink-700 bg-ink-850 text-chrome-400 hover:text-chrome-100'}`}
                >
                  <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                  {initialen(emp)}
                </button>
              );
            })}
            <button
              onClick={() => toggleFilter('')}
              aria-pressed={mitarbeiterFilter.has('')}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 ${mitarbeiterFilter.has('') ? 'border-copper/50 bg-copper-soft text-copper-300' : 'border-ink-700 bg-ink-850 text-chrome-400 hover:text-chrome-100'}`}
            >
              {t('plantafel.filter.ohne')}
            </button>
            {mitarbeiterFilter.size > 0 && (
              <button onClick={() => setMitarbeiterFilter(new Set())} className="text-xs text-chrome-500 underline-offset-2 hover:text-chrome-200 hover:underline">
                {t('plantafel.filter.alle')}
              </button>
            )}
          </div>
        )}
        {/* Anfragen-Panel-Toggle mit Neu-Badge */}
        {anfragenVerfuegbar && (
          <button
            onClick={() => setAnfragenOffen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm font-medium text-chrome-200 transition-colors hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
          >
            <Icon className="h-4 w-4">{ICON_PATHS.inbox}</Icon>
            {t('plantafel.anfragen.toggle')}
            {anfragenNeu > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-copper px-1 text-xs font-bold text-ink-950">
                {anfragenNeu}
              </span>
            )}
          </button>
        )}
      </div>

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {loading ? (
        <Loading />
      ) : view === 'jahr' ? (
        <YearView
          year={anchor.getFullYear()}
          appts={appts}
          wochenstart={ws}
          onDay={(d) => { setAnchor(d); setView('woche'); }}
        />
      ) : view === 'monat' ? (
        <MonthGrid
          days={range.days} month={anchor.getMonth()} appts={sichtbareAppts} custMap={custMap} employees={employees}
          wochenstart={ws} zeitformat={zeitformat} arbeitszeitFuer={arbeitszeitFuer}
          stilFuer={stilFuer} leistungFuer={leistungFuer}
          onDay={(d) => { setAnchor(d); setView('tag'); }} onAppt={openEdit}
        />
      ) : (
        <TimeGrid
          days={range.days} appts={sichtbareAppts} custMap={custMap} vehMap={vehMap} empMap={empMap} employees={employees}
          fensterStart={fensterStart} fensterEnde={fensterEnde} zeitformat={zeitformat}
          arbeitszeitFuer={arbeitszeitFuer} stilFuer={stilFuer} leistungFuer={leistungFuer}
          auslastungFuer={auslastungFuer} kompakt={view === 'zweiwochen'}
          colsRef={colsRef} colW={colW} nowTick={nowTick}
          onCreate={openNew} onEdit={openEdit} onMove={(id, s, e) => void patchTime(id, s, e)}
        />
      )}

      {/* Modal anlegen/bearbeiten */}
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? t('plantafel.edit') : t('plantafel.new')}>
        <form onSubmit={save} className="space-y-4">
          <div className="field">
            <label className="label">{t('plantafel.form.titel')}</label>
            <input className="input" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} placeholder={t('plantafel.form.titelHinweis')} maxLength={150} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="field"><label className="label">{t('plantafel.form.start')}<RequiredMark /></label>
              <input type="datetime-local" className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required /></div>
            <div className="field"><label className="label">{t('plantafel.form.ende')}<RequiredMark /></label>
              <input type="datetime-local" className="input" value={form.ende} onChange={(e) => setForm({ ...form, ende: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="field"><label className="label">{t('plantafel.form.kunde')}</label>
              <select className="select" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, vehicleId: '' })}>
                <option value="">{t('plantafel.form.optional')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{kundenName(c)}</option>)}
              </select></div>
            <div className="field"><label className="label">{t('plantafel.form.fahrzeug')}</label>
              <select className="select" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">{t('plantafel.form.optional')}</option>
                {vehicles.filter((v) => !form.customerId || v.customerId === form.customerId).map((v) => <option key={v.id} value={v.id}>{fahrzeugName(v)}</option>)}
              </select></div>
          </div>
          {(employeesVerfuegbar || locations.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {employeesVerfuegbar && (
                <div className="field"><label className="label">{t('plantafel.form.mitarbeiter')}</label>
                  <select className="select" value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}>
                    <option value="">{t('plantafel.form.optional')}</option>
                    {aktiveEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                  </select></div>
              )}
              {locations.length > 0 && (
                <div className="field"><label className="label">{t('plantafel.form.standort')}</label>
                  <select className="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                    <option value="">{t('plantafel.form.optional')}</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select></div>
              )}
            </div>
          )}
          {form.id && (
            <div className="field"><label className="label">{t('plantafel.form.status')}</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.keys(APPT_STATUS_KEY).map((s) => <option key={s} value={s}>{APPT_STATUS_KEY[s] ? t(APPT_STATUS_KEY[s]) : s}</option>)}
              </select></div>
          )}
          {form.id && (form.customerId || form.vehicleId || form.orderId) && (
            <div className="flex flex-wrap gap-2 border-t border-ink-700 pt-3">
              {form.customerId && (
                <Link href={`/kunden/detail/?id=${form.customerId}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200 hover:text-copper">{t('plantafel.link.customer')}</Link>
              )}
              {form.vehicleId && (
                <Link href={`/fahrzeuge/detail/?id=${form.vehicleId}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200 hover:text-copper">{t('plantafel.link.vehicle')}</Link>
              )}
              {form.orderId && (
                <Link href={`/auftraege/detail/?id=${form.orderId}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200 hover:text-copper">{t('plantafel.link.order')}</Link>
              )}
            </div>
          )}
          {modalError && <ErrorBox message={modalError} />}
          <div className="flex items-center justify-between gap-2 pt-1">
            {form.id ? <button type="button" className="link-danger text-sm" onClick={() => setConfirmDelete(true)} disabled={saving}>{t('common.delete')}</button> : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('plantafel.saving') : t('common.save')}</button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={t('plantafel.delete.title')}
        message={t('plantafel.delete.msg')}
        confirmLabel={t('common.delete')}
        busy={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Konflikt-Dialog des Doppelbuchungs-Schutzes (Anlegen/Bearbeiten/Drag). */}
      <KonfliktDialog
        konflikte={konflikt?.konflikte ?? null}
        blockiert={einst.kalender.konfliktverhalten === 'blockieren'}
        busy={saving}
        empMap={empMap}
        onConfirm={() => { const k = konflikt; setKonflikt(null); k?.retry(); }}
        onCancel={() => { konflikt?.cancel?.(); setKonflikt(null); }}
      />

      {/* Anfragen-Seitenpanel (Slide-over rechts). */}
      <AnfragenPanel
        open={anfragenOffen}
        onClose={() => setAnfragenOffen(false)}
        employees={employeesVerfuegbar ? aktiveEmployees : []}
        empMap={empMap}
        konfliktverhalten={einst.kalender.konfliktverhalten}
        zeitformat={zeitformat}
        onAccepted={() => { void load(); void ladeBadge(); }}
      />
    </div>
  );
}
