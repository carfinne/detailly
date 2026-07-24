'use client';

// Dellenkalkulation (Smart Repair / PDR – Hagel-/Parkdellen). Ab-Basic-Feature
// 'dellenkalkulation'. Wiederverwendet das 3D-Fahrzeugmodell (Scene3DDellen teilt
// die Karosserie-Geometrie mit dem Schadensviewer + der Schichtdicke-Heatmap):
// Bauteil anklicken -> Dellen-Marker setzen -> Groessenklasse/Kante/Alu/
// Lackschaden waehlen -> regelbasierter Sofortpreis. Modus Einzel (jede Delle)
// vs. Hagel (Staffel je Bauteil). 2D-Schema als Fallback ohne WebGL. Der Preis
// wird IMMER serverseitig berechnet (Client-Preis wird nie vertraut).

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import {
  PageHeader,
  SectionCard,
  Loading,
  ErrorBox,
  UpgradeHinweis,
  Empty,
  Modal,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { kundenName } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { partLabel, canonicalPartId } from '@/lib/vehicle-parts';
import { FahrzeugtypWahl } from '@/components/Inspection3D/FahrzeugtypWahl';
import {
  fahrzeugtypFromModelKey,
  modelKeyForFahrzeugtyp,
  type Fahrzeugtyp,
} from '@/components/Inspection3D/car-body';
import type {
  Customer,
  Vehicle,
  DellenKalkulation,
  DellenMarker,
  DellenModus,
  DellenPreismatrix,
  Groessenklasse,
  HagelStaffelStufe,
  Position3D,
} from '@/lib/types';
import type { Scene3DDellenProps } from '@/components/Inspection3D/Scene3DDellen';

const Scene3DDellen = dynamic<Scene3DDellenProps>(
  () => import('@/components/Inspection3D/Scene3DDellen'),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center">
        <Loading />
      </div>
    ),
  },
);

const GROESSENKLASSEN: Groessenklasse[] = ['1euro', '2euro', '5euro', 'golfball', 'groesser'];

/** Lokaler, editierbarer Marker (stabile Identitaet ueber clientUuid). */
interface LocalMarker {
  clientUuid: string;
  bauteil: string;
  bauteilLabel?: string;
  positionMode: '3d' | '2d';
  position3d?: Position3D | null;
  ansicht2d?: string;
  groessenklasse?: Groessenklasse | null;
  kante: boolean;
  alu: boolean;
  lackschaden: boolean;
  dellenAnzahl?: number | null;
  /** Serverseitig berechnet (nach Sync gesetzt). */
  einzelpreis?: string;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function eur(x: number | string | null | undefined): string {
  const n = typeof x === 'number' ? x : Number(x ?? 0);
  return `${(Number.isFinite(n) ? n : 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// --- 2D-Schema (Draufsicht) als klickbares SVG (Fallback ohne WebGL) ---------
const SCHEMA_RECTS: Array<{ partId: string; x: number; y: number; w: number; h: number }> = [
  { partId: 'stossfaenger_vorne', x: 35, y: 0, w: 100, h: 18 },
  { partId: 'motorhaube', x: 45, y: 20, w: 80, h: 52 },
  { partId: 'kotfluegel_vl', x: 20, y: 20, w: 22, h: 66 },
  { partId: 'kotfluegel_vr', x: 128, y: 20, w: 22, h: 66 },
  { partId: 'dach', x: 48, y: 92, w: 74, h: 108 },
  { partId: 'tuer_vl', x: 20, y: 92, w: 25, h: 52 },
  { partId: 'tuer_hl', x: 20, y: 148, w: 25, h: 52 },
  { partId: 'tuer_vr', x: 125, y: 92, w: 25, h: 52 },
  { partId: 'tuer_hr', x: 125, y: 148, w: 25, h: 52 },
  { partId: 'seitenwand_hl', x: 20, y: 204, w: 25, h: 48 },
  { partId: 'seitenwand_hr', x: 125, y: 204, w: 25, h: 48 },
  { partId: 'heckklappe', x: 45, y: 204, w: 80, h: 48 },
  { partId: 'stossfaenger_hinten', x: 35, y: 256, w: 100, h: 18 },
];

function SchemaSVG({
  markerCountByPart,
  selectedPart,
  onSelect,
}: {
  markerCountByPart: Record<string, number>;
  selectedPart: string | null;
  onSelect: (partId: string) => void;
}) {
  return (
    <svg viewBox="0 0 170 274" className="h-full w-full" role="img">
      {SCHEMA_RECTS.map((r) => {
        const anzahl = markerCountByPart[r.partId] ?? 0;
        const aktiv = r.partId === selectedPart;
        return (
          <g key={r.partId}>
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={3}
              fill={anzahl > 0 ? 'rgb(var(--copper-500))' : 'rgb(var(--ink-800))'}
              fillOpacity={anzahl > 0 ? 0.55 : 1}
              stroke={aktiv ? 'rgb(var(--copper-500))' : 'rgb(var(--ink-850))'}
              strokeWidth={aktiv ? 2.5 : 1}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onSelect(r.partId)}
            >
              <title>{partLabel(r.partId)}</title>
            </rect>
            {anzahl > 0 && (
              <text
                x={r.x + r.w / 2}
                y={r.y + r.h / 2 + 3}
                textAnchor="middle"
                className="fill-white text-[9px] font-semibold"
              >
                {anzahl}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// --- Neue-Kalkulation-Modal --------------------------------------------------
function NeueKalkulationModal({
  open,
  onClose,
  onCreated,
  vorbelegung,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (k: DellenKalkulation) => void;
  vorbelegung?: { vehicleId?: string };
}) {
  const t = useT();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [modus, setModus] = useState<DellenModus>('einzel');
  const [notiz, setNotiz] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [c, v] = await Promise.all([
        api.get<Customer[]>('/customers/select'),
        api.get<Vehicle[]>('/vehicles'),
      ]);
      setCustomers(c ?? []);
      setVehicles(v ?? []);
      if (vorbelegung?.vehicleId) {
        const veh = (v ?? []).find((x) => x.id === vorbelegung.vehicleId);
        if (veh) {
          setCustomerId(veh.customerId);
          setVehicleId(veh.id);
        }
      }
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('dellen.error.load'));
    } finally {
      setLoadingData(false);
    }
  }, [t, vorbelegung?.vehicleId]);

  useEffect(() => {
    if (open) {
      setCustomerId('');
      setVehicleId('');
      setModus('einzel');
      setNotiz('');
      setError('');
      loadData();
    }
  }, [open, loadData]);

  const kundeFahrzeuge = vehicles.filter((v) => v.customerId === customerId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = { modus };
      if (customerId) body.customerId = customerId;
      if (vehicleId) body.vehicleId = vehicleId;
      if (notiz.trim()) body.notiz = notiz.trim();
      const created = await api.post<DellenKalkulation>('/dellenkalkulation', body);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('dellen.error.save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('dellen.modal.title')}>
      <form onSubmit={save} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <div>
          <label className="label">{t('dellen.modal.modus')}</label>
          <div className="flex gap-2">
            {(['einzel', 'hagel'] as DellenModus[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn-ghost flex-1 ${modus === m ? 'ring-2 ring-copper' : ''}`}
                onClick={() => setModus(m)}
              >
                {t(`dellen.modus.${m}`)}
              </button>
            ))}
          </div>
          <p className="help mt-1">{t(`dellen.modus.${modus}.hint`)}</p>
        </div>
        <div>
          <label className="label">{t('dellen.modal.customer')}</label>
          <select
            className="select"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setVehicleId('');
            }}
            disabled={loadingData}
          >
            <option value="">{t('dellen.modal.optional')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {kundenName(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('dellen.modal.vehicle')}</label>
          <select
            className="select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!customerId}
          >
            <option value="">{t('dellen.modal.optional')}</option>
            {kundeFahrzeuge.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} {v.licensePlate ? `(${v.licensePlate})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('dellen.modal.notiz')}</label>
          <textarea
            className="textarea"
            rows={2}
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-700/60 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving || loadingData}>
            {saving ? t('dellen.modal.creating') : t('dellen.modal.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Preismatrix-Modal -------------------------------------------------------
function PreismatrixModal({
  open,
  onClose,
  matrix,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  matrix: DellenPreismatrix | null;
  onSaved: (m: DellenPreismatrix) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<DellenPreismatrix | null>(matrix);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(matrix);
      setError('');
    }
  }, [open, matrix]);

  if (!form) return null;

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const body = {
        basis1Euro: form.basispreise['1euro'],
        basis2Euro: form.basispreise['2euro'],
        basis5Euro: form.basispreise['5euro'],
        basisGolfball: form.basispreise.golfball,
        basisGroesser: form.basispreise.groesser,
        kantenFaktor: form.kantenFaktor,
        aluFaktor: form.aluFaktor,
        lackschadenAufschlag: form.lackschadenAufschlag,
        mindestpauschale: form.mindestpauschale,
        anfahrtspauschale: form.anfahrtspauschale,
        hagelStaffel: form.hagelStaffel,
      };
      const saved = await api.put<DellenPreismatrix>('/dellenkalkulation/preismatrix', body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('dellen.error.save'));
    } finally {
      setSaving(false);
    }
  }

  const setBasis = (k: Groessenklasse, v: string) =>
    setForm((f) => (f ? { ...f, basispreise: { ...f.basispreise, [k]: num(v) } } : f));
  const setStufe = (i: number, patch: Partial<HagelStaffelStufe>) =>
    setForm((f) =>
      f
        ? { ...f, hagelStaffel: f.hagelStaffel.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }
        : f,
    );

  return (
    <Modal open={open} onClose={onClose} title={t('dellen.matrix.title')}>
      <form onSubmit={save} className="space-y-5">
        {error && <ErrorBox message={error} />}

        <div>
          <p className="label mb-2">{t('dellen.matrix.basispreise')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GROESSENKLASSEN.map((k) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block text-xs text-ink-400">{t(`dellen.groesse.${k}`)}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input h-9"
                  value={form.basispreise[k]}
                  onChange={(e) => setBasis(k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-400">{t('dellen.matrix.kantenFaktor')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input h-9"
              value={form.kantenFaktor}
              onChange={(e) => setForm((f) => (f ? { ...f, kantenFaktor: num(e.target.value) } : f))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-400">{t('dellen.matrix.aluFaktor')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input h-9"
              value={form.aluFaktor}
              onChange={(e) => setForm((f) => (f ? { ...f, aluFaktor: num(e.target.value) } : f))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-400">
              {t('dellen.matrix.lackschadenAufschlag')}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input h-9"
              value={form.lackschadenAufschlag}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, lackschadenAufschlag: num(e.target.value) } : f))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-400">
              {t('dellen.matrix.mindestpauschale')}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input h-9"
              value={form.mindestpauschale}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, mindestpauschale: num(e.target.value) } : f))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-ink-400">
              {t('dellen.matrix.anfahrtspauschale')}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input h-9"
              value={form.anfahrtspauschale}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, anfahrtspauschale: num(e.target.value) } : f))
              }
            />
          </label>
        </div>

        <div>
          <p className="label mb-2">{t('dellen.matrix.hagelStaffel')}</p>
          <div className="space-y-2">
            {form.hagelStaffel.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-xs text-ink-400">
                  {s.maxDellen === null
                    ? t('dellen.matrix.staffelMore')
                    : t('dellen.matrix.staffelUpTo', { n: s.maxDellen })}
                </span>
                {s.maxDellen !== null && (
                  <input
                    type="number"
                    min={1}
                    className="input h-9 w-20"
                    value={s.maxDellen}
                    onChange={(e) => setStufe(i, { maxDellen: num(e.target.value) || 1 })}
                  />
                )}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input h-9 flex-1"
                  value={s.pauschale}
                  onChange={(e) => setStufe(i, { pauschale: num(e.target.value) })}
                />
                <span className="text-xs text-ink-400">€</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-700/60 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('common.loadingEllipsis') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Hauptseite -------------------------------------------------------------
function DellenInner() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialVehicle = searchParams.get('vehicle') ?? undefined;
  const toast = useToast();

  const [list, setList] = useState<DellenKalkulation[]>([]);
  const [current, setCurrent] = useState<DellenKalkulation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [marker, setMarker] = useState<LocalMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<DellenPreismatrix | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);

  const [use3D] = useState<boolean>(() => hasWebGL());
  const [ready, setReady] = useState(false);

  const isLocked = current?.status === 'final';
  const modus: DellenModus = current?.modus ?? 'einzel';
  // Fahrzeugtyp aus current.modelKey abgeleitet (Default = Limousine). Altdaten
  // ohne bzw. mit Legacy-modelKey fallen konservativ auf die Limousine zurueck.
  const fahrzeugtyp = fahrzeugtypFromModelKey(current?.modelKey);

  // Server-Marker -> lokale (editierbare) Marker mit stabiler clientUuid.
  const toLocal = useCallback(
    (ms: DellenMarker[] | undefined): LocalMarker[] =>
      (ms ?? []).map((m) => ({
        clientUuid: m.clientUuid || uuid(),
        bauteil: m.bauteil,
        bauteilLabel: m.bauteilLabel ?? undefined,
        positionMode: m.positionMode,
        position3d: m.position3d ?? null,
        ansicht2d: m.ansicht2d ?? undefined,
        groessenklasse: m.groessenklasse ?? null,
        kante: !!m.kante,
        alu: !!m.alu,
        lackschaden: !!m.lackschaden,
        dellenAnzahl: m.dellenAnzahl ?? null,
        einzelpreis: m.einzelpreis,
      })),
    [],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      const full = await api.get<DellenKalkulation>(`/dellenkalkulation/${id}`);
      setCurrent(full);
      setSelectedId(full.id);
      setMarker(toLocal(full.marker));
    },
    [toLocal],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setUpgrade(false);
    try {
      const [res, mx] = await Promise.all([
        api.get<{ data: DellenKalkulation[] } | DellenKalkulation[]>('/dellenkalkulation?limit=100'),
        api.get<DellenPreismatrix>('/dellenkalkulation/preismatrix'),
      ]);
      setMatrix(mx);
      const l = Array.isArray(res) ? res : res.data;
      setList(l ?? []);
      if (!l || l.length === 0) {
        setCurrent(null);
        setSelectedId(null);
        setMarker([]);
        setError('');
        return;
      }
      const aktiv = (selectedId && l.find((k) => k.id === selectedId)) || l[0];
      await loadDetail(aktiv.id);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof ApiError ? e.message : t('dellen.error.load'));
    } finally {
      setLoading(false);
    }
  }, [selectedId, loadDetail, t]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markerCountByPart = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of marker) {
      const c = canonicalPartId(m.bauteil);
      map[c] = (map[c] ?? 0) + (modus === 'hagel' ? m.dellenAnzahl ?? 0 : 1);
    }
    return map;
  }, [marker, modus]);

  const selectedPartFromMarker = useMemo(() => {
    const m = marker.find((x) => x.clientUuid === selectedMarker);
    return m ? canonicalPartId(m.bauteil) : null;
  }, [marker, selectedMarker]);

  // --- Marker -> Batch-Payload + Server-Sync (Preis serverseitig) ---
  const persist = useCallback(
    async (next: LocalMarker[]) => {
      if (!current) return;
      setBusy(true);
      try {
        const payload = {
          markers: next.map((m) => ({
            bauteil: m.bauteil,
            bauteilLabel: m.bauteilLabel,
            positionMode: m.positionMode,
            position3d: m.position3d ?? undefined,
            ansicht2d: m.ansicht2d,
            groessenklasse: m.groessenklasse ?? undefined,
            kante: m.kante,
            alu: m.alu,
            lackschaden: m.lackschaden,
            dellenAnzahl: m.dellenAnzahl ?? undefined,
            clientUuid: m.clientUuid,
          })),
        };
        const detail = await api.put<DellenKalkulation>(
          `/dellenkalkulation/${current.id}/marker`,
          payload,
        );
        setCurrent(detail);
        setMarker(toLocal(detail.marker));
      } catch (e) {
        toast(e instanceof ApiError ? e.message : t('dellen.error.save'));
      } finally {
        setBusy(false);
      }
    },
    [current, toLocal, toast, t],
  );

  // --- 3D/2D-Klick: Bauteil -> Marker setzen ---
  const handlePlace = useCallback(
    (partId: string, position3d: Position3D | null) => {
      if (isLocked || !current) return;
      const canon = canonicalPartId(partId);
      if (modus === 'hagel') {
        // Ein Marker je Bauteil: vorhandenen waehlen, sonst neuen mit 1 anlegen.
        const vorhanden = marker.find((m) => canonicalPartId(m.bauteil) === canon);
        if (vorhanden) {
          setSelectedMarker(vorhanden.clientUuid);
          return;
        }
        const neu: LocalMarker = {
          clientUuid: uuid(),
          bauteil: canon,
          bauteilLabel: partLabel(canon),
          positionMode: position3d ? '3d' : '2d',
          position3d,
          groessenklasse: null,
          kante: false,
          alu: false,
          lackschaden: false,
          dellenAnzahl: 1,
        };
        const next = [...marker, neu];
        setMarker(next);
        setSelectedMarker(neu.clientUuid);
        void persist(next);
      } else {
        const neu: LocalMarker = {
          clientUuid: uuid(),
          bauteil: canon,
          bauteilLabel: partLabel(canon),
          positionMode: position3d ? '3d' : '2d',
          position3d,
          groessenklasse: '2euro',
          kante: false,
          alu: false,
          lackschaden: false,
        };
        const next = [...marker, neu];
        setMarker(next);
        setSelectedMarker(neu.clientUuid);
        void persist(next);
      }
    },
    [isLocked, current, modus, marker, persist],
  );

  const updateMarker = (clientUuid: string, patch: Partial<LocalMarker>) => {
    const next = marker.map((m) => (m.clientUuid === clientUuid ? { ...m, ...patch } : m));
    setMarker(next);
    void persist(next);
  };

  const deleteMarker = (clientUuid: string) => {
    const next = marker.filter((m) => m.clientUuid !== clientUuid);
    setMarker(next);
    if (selectedMarker === clientUuid) setSelectedMarker(null);
    void persist(next);
  };

  async function deleteKalk() {
    if (!current) return;
    setConfirmDelete(false);
    try {
      await api.delete(`/dellenkalkulation/${current.id}`);
      setSelectedId(null);
      setCurrent(null);
      setMarker([]);
      await load();
      toast(t('dellen.deleted'));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('dellen.error.save'));
    }
  }

  async function finalisieren() {
    if (!current) return;
    setConfirmFinal(false);
    try {
      const detail = await api.post<DellenKalkulation>(
        `/dellenkalkulation/${current.id}/finalisieren`,
      );
      setCurrent(detail);
      setMarker(toLocal(detail.marker));
      await load();
      toast(t('dellen.finalized'));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('dellen.error.save'));
    }
  }

  async function changeModus(m: DellenModus) {
    if (!current || isLocked || m === current.modus) return;
    setBusy(true);
    try {
      const detail = await api.patch<DellenKalkulation>(`/dellenkalkulation/${current.id}`, {
        modus: m,
      });
      setCurrent(detail);
      setMarker(toLocal(detail.marker));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('dellen.error.save'));
    } finally {
      setBusy(false);
    }
  }

  // Fahrzeugtyp wechseln: optimistisch sofort umschalten (fluessiger 3D-Wechsel)
  // und als modelKey persistieren; bei Fehler den vorherigen Stand wiederherstellen.
  async function changeFahrzeugtyp(typ: Fahrzeugtyp) {
    if (!current || isLocked || busy) return;
    const modelKey = modelKeyForFahrzeugtyp(typ);
    if (modelKey === (current.modelKey ?? '')) return;
    const prev = current;
    setCurrent({ ...current, modelKey });
    setBusy(true);
    try {
      const detail = await api.patch<DellenKalkulation>(`/dellenkalkulation/${current.id}`, {
        modelKey,
      });
      setCurrent(detail);
      setMarker(toLocal(detail.marker));
    } catch (e) {
      setCurrent(prev);
      toast(e instanceof ApiError ? e.message : t('fahrzeugtyp.error.save'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  if (upgrade) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('dellen.title')} subtitle={t('dellen.subtitle')} />
        <UpgradeHinweis message={t('dellen.upgrade')} />
      </div>
    );
  }

  const selected = marker.find((m) => m.clientUuid === selectedMarker) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dellen.title')}
        subtitle={t('dellen.subtitle')}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setMatrixOpen(true)}>
              {t('dellen.matrix.open')}
            </button>
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              {t('dellen.new')}
            </button>
          </div>
        }
      />

      {error && <ErrorBox message={error} />}

      {list.length === 0 ? (
        <Empty
          text={t('dellen.none')}
          action={
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              {t('dellen.new')}
            </button>
          }
        />
      ) : (
        <>
          {/* Kalkulations-Auswahl + Aktionen */}
          <SectionCard>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="select max-w-xs"
                value={selectedId ?? ''}
                onChange={(e) => {
                  setSelectedMarker(null);
                  loadDetail(e.target.value).catch(() => toast(t('dellen.error.load')));
                }}
              >
                {list.map((k) => (
                  <option key={k.id} value={k.id}>
                    {t(`dellen.modus.${k.modus}`)} · {new Date(k.createdAt ?? '').toLocaleDateString()}{' '}
                    · {eur(k.gesamtpreis)}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-2">
                {isLocked ? (
                  <span className="rounded-full bg-positive-soft px-3 py-1 text-xs text-positive">
                    {t('dellen.status.final')}
                  </span>
                ) : (
                  <button
                    className="btn-ghost"
                    onClick={() => setConfirmFinal(true)}
                    disabled={!current || busy}
                  >
                    {t('dellen.finalize')}
                  </button>
                )}
                <button
                  className="btn-ghost text-danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!current || isLocked}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>

            {/* Modus-Umschalter */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-ink-400">{t('dellen.modal.modus')}:</span>
              {(['einzel', 'hagel'] as DellenModus[]).map((m) => (
                <button
                  key={m}
                  className={`btn-ghost h-8 px-3 text-sm ${modus === m ? 'ring-2 ring-copper' : ''}`}
                  onClick={() => changeModus(m)}
                  disabled={isLocked || busy}
                >
                  {t(`dellen.modus.${m}`)}
                </button>
              ))}
            </div>
            {isLocked && <p className="help mt-2">{t('dellen.locked')}</p>}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Viewer */}
            <SectionCard className="min-h-[420px]">
              {/* Fahrzeugtyp-Auswahl (nur 3D – das 2D-Schema ist typ-neutral). */}
              {use3D && (
                <div className="mb-3 flex items-center gap-2">
                  <FahrzeugtypWahl
                    value={fahrzeugtyp}
                    onChange={changeFahrzeugtyp}
                    disabled={isLocked || busy}
                  />
                </div>
              )}
              <div className="h-[420px] w-full overflow-hidden rounded-lg bg-ink-900">
                {use3D ? (
                  <Scene3DDellen
                    markers={marker.map((m) => ({
                      id: m.clientUuid,
                      bauteil: m.bauteil,
                      position3d: m.position3d,
                      groessenklasse: m.groessenklasse,
                    }))}
                    selectedId={selectedMarker}
                    selectedPart={selectedPartFromMarker}
                    fahrzeugtyp={fahrzeugtyp}
                    onPlace={(partId, pos) => handlePlace(partId, pos)}
                    onSelect={(id) => setSelectedMarker(id)}
                    onReady={() => setReady(true)}
                  />
                ) : (
                  <div className="grid h-full place-items-center p-4">
                    <div className="h-full max-h-[380px]">
                      <SchemaSVG
                        markerCountByPart={markerCountByPart}
                        selectedPart={selectedPartFromMarker}
                        onSelect={(partId) => handlePlace(partId, null)}
                      />
                    </div>
                  </div>
                )}
              </div>
              {use3D && !ready && <p className="help mt-2">{t('common.loadingEllipsis')}</p>}
              {!use3D && <p className="help mt-2">{t('dellen.fallback')}</p>}
              <p className="help mt-2">
                {modus === 'hagel' ? t('dellen.hint.hagel') : t('dellen.hint.einzel')}
              </p>
            </SectionCard>

            {/* Seiten-Panel */}
            <div className="space-y-6">
              {/* Live-Summe */}
              <SectionCard>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink-300">{t('dellen.sum.title')}</span>
                  <span className="text-2xl font-semibold tabular-nums text-copper">
                    {eur(current?.gesamtpreis)}
                  </span>
                </div>
                <p className="help mt-1">
                  {t('dellen.sum.count', { n: marker.length })}
                  {busy ? ` · ${t('common.loadingEllipsis')}` : ''}
                </p>
              </SectionCard>

              {/* Ausgewaehlter Marker */}
              {selected && (
                <SectionCard title={selected.bauteilLabel || partLabel(selected.bauteil)}>
                  <div className="space-y-4">
                    {modus === 'einzel' ? (
                      <>
                        <div>
                          <p className="label mb-2">{t('dellen.groesse.title')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {GROESSENKLASSEN.map((k) => (
                              <button
                                key={k}
                                className={`btn-ghost h-8 px-2 text-xs ${
                                  selected.groessenklasse === k ? 'ring-2 ring-copper' : ''
                                }`}
                                onClick={() => updateMarker(selected.clientUuid, { groessenklasse: k })}
                                disabled={isLocked}
                              >
                                {t(`dellen.groesse.${k}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(['kante', 'alu', 'lackschaden'] as const).map((flag) => {
                            const patch: Partial<LocalMarker> = {};
                            patch[flag] = !selected[flag];
                            return (
                              <button
                                key={flag}
                                className={`btn-ghost h-8 px-2 text-xs ${
                                  selected[flag] ? 'ring-2 ring-copper' : ''
                                }`}
                                onClick={() => updateMarker(selected.clientUuid, patch)}
                                disabled={isLocked}
                              >
                                {t(`dellen.flag.${flag}`)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="label mb-2">{t('dellen.hagel.count')}</p>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-ghost h-9 w-9 text-lg"
                            onClick={() =>
                              updateMarker(selected.clientUuid, {
                                dellenAnzahl: Math.max(1, (selected.dellenAnzahl ?? 1) - 1),
                              })
                            }
                            disabled={isLocked}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="input h-9 w-24 text-center"
                            value={selected.dellenAnzahl ?? 1}
                            onChange={(e) =>
                              updateMarker(selected.clientUuid, {
                                dellenAnzahl: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                              })
                            }
                            disabled={isLocked}
                          />
                          <button
                            className="btn-ghost h-9 w-9 text-lg"
                            onClick={() =>
                              updateMarker(selected.clientUuid, {
                                dellenAnzahl: (selected.dellenAnzahl ?? 1) + 1,
                              })
                            }
                            disabled={isLocked}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-ink-800 pt-3">
                      <span className="text-sm text-ink-300">{t('dellen.marker.price')}</span>
                      <span className="font-semibold tabular-nums">{eur(selected.einzelpreis)}</span>
                    </div>
                    {!isLocked && (
                      <button
                        className="text-xs text-danger hover:underline"
                        onClick={() => deleteMarker(selected.clientUuid)}
                      >
                        {t('dellen.marker.remove')}
                      </button>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* Marker-Liste */}
              <SectionCard title={t('dellen.marker.list')}>
                {marker.length === 0 ? (
                  <p className="text-sm text-ink-400">{t('dellen.marker.empty')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {marker.map((m) => (
                      <li key={m.clientUuid}>
                        <button
                          className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                            m.clientUuid === selectedMarker
                              ? 'border-copper bg-copper-soft'
                              : 'border-ink-700/60 hover:bg-ink-800'
                          }`}
                          onClick={() => setSelectedMarker(m.clientUuid)}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {m.bauteilLabel || partLabel(m.bauteil)}
                            <span className="ml-1 text-xs text-ink-400">
                              {modus === 'hagel'
                                ? t('dellen.hagel.countShort', { n: m.dellenAnzahl ?? 0 })
                                : t(`dellen.groesse.${m.groessenklasse ?? '2euro'}`)}
                            </span>
                          </span>
                          <span className="ml-2 shrink-0 tabular-nums">{eur(m.einzelpreis)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {/* Hinweis */}
              <div className="rounded-lg border border-caution/40 bg-caution-soft p-3 text-xs text-ink-200">
                <p className="mb-1 font-semibold">{t('dellen.hint.title')}</p>
                <p>{t('dellen.hint.text')}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <NeueKalkulationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vorbelegung={{ vehicleId: initialVehicle }}
        onCreated={async (k) => {
          setSelectedId(k.id);
          setSelectedMarker(null);
          await load();
        }}
      />

      <PreismatrixModal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        matrix={matrix}
        onSaved={async (m) => {
          setMatrix(m);
          // Nach Matrix-Aenderung Preis der aktuellen Kalkulation serverseitig
          // neu berechnen lassen (nur solange nicht finalisiert).
          if (current && !isLocked) {
            try {
              const detail = await api.post<DellenKalkulation>(
                `/dellenkalkulation/${current.id}/neu-berechnen`,
              );
              setCurrent(detail);
              setMarker(toLocal(detail.marker));
            } catch {
              /* Preis bleibt bis zur naechsten Marker-Aenderung */
            }
          }
          toast(t('dellen.matrix.saved'));
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('dellen.confirmDelete.title')}
        message={t('dellen.confirmDelete.message')}
        confirmLabel={t('common.delete')}
        onConfirm={deleteKalk}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmFinal}
        title={t('dellen.confirmFinal.title')}
        message={t('dellen.confirmFinal.message')}
        confirmLabel={t('dellen.finalize')}
        onConfirm={finalisieren}
        onCancel={() => setConfirmFinal(false)}
      />
    </div>
  );
}

export default function DellenkalkulationPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DellenInner />
    </Suspense>
  );
}
