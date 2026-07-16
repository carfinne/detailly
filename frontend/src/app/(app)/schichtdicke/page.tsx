'use client';

// Schichtdicken-Messprotokoll (Lackschichtdicke, µm). Pro-Add-on 'schichtdicke'.
// Wiederverwendet das 3D-Fahrzeugmodell (Scene3DHeatmap teilt die Karosserie-
// Geometrie mit dem Schadensviewer): Bauteil anklicken -> Messpunkt setzen -> µm
// erfassen -> Ampel-Heatmap + Auffaelligkeits-Hinweis -> PDF-Bericht (Download).
// 2D-Schema als Fallback ohne WebGL. Werte sind herstellerabhaengige Richtwerte
// (Haftungshinweis), kein Gutachten.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, downloadAuthed } from '@/lib/api';
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
import {
  AMPEL_LABEL_KEY,
  AMPEL_LEGENDE,
  AMPEL_TOKEN,
  bewerteBauteil,
  type AmpelStatus,
} from '@/lib/layer-norm-profiles';
import type {
  Customer,
  Vehicle,
  LayerMeasurement,
  LayerMeasurementPoint,
  LayerMeasurementAnlass,
  LayerBauteilAuswertung,
  Position3D,
} from '@/lib/types';
import type { Scene3DHeatmapProps } from '@/components/Inspection3D/Scene3DHeatmap';

const Scene3DHeatmap = dynamic<Scene3DHeatmapProps>(
  () => import('@/components/Inspection3D/Scene3DHeatmap'),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center">
        <Loading />
      </div>
    ),
  },
);

const ANLASS_OPTIONS: LayerMeasurementAnlass[] = [
  'vor_folierung',
  'vor_ppf',
  'ankauf',
  'gutachten',
  'sonstiges',
];

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

/** Inline-Style-Fuellung eines Ampel-Status (folgt den CSS-Tokens/Theme). */
function ampelStyle(status: AmpelStatus): React.CSSProperties {
  return { backgroundColor: `rgb(var(${AMPEL_TOKEN[status]}))` };
}

// --- 2D-Schema (Draufsicht) als klickbares SVG, dependency-frei --------------
// Gleiche Zonen wie das PDF-Schema. Dient als Fallback ohne WebGL und als
// jederzeit sichtbare Mini-Uebersicht.
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
  statusByPart,
  selectedPart,
  onSelect,
}: {
  statusByPart: Record<string, AmpelStatus>;
  selectedPart: string | null;
  onSelect: (partId: string) => void;
}) {
  return (
    <svg viewBox="0 0 170 274" className="h-full w-full" role="img">
      {SCHEMA_RECTS.map((r) => {
        const status = statusByPart[r.partId] ?? 'unbemessen';
        const aktiv = r.partId === selectedPart;
        return (
          <rect
            key={r.partId}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={3}
            fill={`rgb(var(${AMPEL_TOKEN[status]}))`}
            stroke={aktiv ? 'rgb(var(--copper-500))' : 'rgb(var(--ink-850))'}
            strokeWidth={aktiv ? 2.5 : 1}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onClick={() => onSelect(r.partId)}
          >
            <title>{partLabel(r.partId)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// --- Neues-Protokoll-Modal --------------------------------------------------
function NeuesProtokollModal({
  open,
  onClose,
  onCreated,
  vorbelegung,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (m: LayerMeasurement) => void;
  vorbelegung?: { vehicleId?: string; orderId?: string };
}) {
  const t = useT();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [anlass, setAnlass] = useState<LayerMeasurementAnlass>('ankauf');
  const [messgeraet, setMessgeraet] = useState('');
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
      // Vorbelegung aus Fahrzeug-/Auftrags-Einstieg: Kunde aus dem Fahrzeug ableiten.
      if (vorbelegung?.vehicleId) {
        const veh = (v ?? []).find((x) => x.id === vorbelegung.vehicleId);
        if (veh) {
          setCustomerId(veh.customerId);
          setVehicleId(veh.id);
        }
      }
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('schicht.modal.error'));
    } finally {
      setLoadingData(false);
    }
  }, [t, vorbelegung?.vehicleId]);

  useEffect(() => {
    if (open) {
      setCustomerId('');
      setVehicleId('');
      setAnlass('ankauf');
      setMessgeraet('');
      setNotiz('');
      setError('');
      loadData();
    }
  }, [open, loadData]);

  const kundeFahrzeuge = vehicles.filter((v) => v.customerId === customerId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError(t('schicht.modal.customerRequired'));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { customerId, anlass };
      if (vehicleId) body.vehicleId = vehicleId;
      if (vorbelegung?.orderId) body.orderId = vorbelegung.orderId;
      if (messgeraet.trim()) body.messgeraet = messgeraet.trim();
      if (notiz.trim()) body.notiz = notiz.trim();
      const created = await api.post<LayerMeasurement>('/schichtdicke', body);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('schicht.modal.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('schicht.modal.title')}>
      <form onSubmit={save} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <div>
          <label className="label">{t('schicht.modal.customer')}</label>
          <select
            className="select"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setVehicleId('');
            }}
            required
            disabled={loadingData}
          >
            <option value="">
              {loadingData ? t('common.loadingEllipsis') : t('schicht.modal.selectPlaceholder')}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {kundenName(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('schicht.modal.vehicle')}</label>
          <select
            className="select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!customerId}
          >
            <option value="">{t('schicht.modal.optional')}</option>
            {kundeFahrzeuge.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} {v.licensePlate ? `(${v.licensePlate})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('schicht.modal.anlass')}</label>
          <select
            className="select"
            value={anlass}
            onChange={(e) => setAnlass(e.target.value as LayerMeasurementAnlass)}
          >
            {ANLASS_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`schicht.anlass.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('schicht.modal.geraet')}</label>
          <input
            className="input"
            value={messgeraet}
            onChange={(e) => setMessgeraet(e.target.value)}
            placeholder={t('schicht.modal.geraetPlaceholder')}
          />
        </div>
        <div>
          <label className="label">{t('schicht.modal.notiz')}</label>
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
            {saving ? t('schicht.modal.creating') : t('schicht.modal.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Hauptseite -------------------------------------------------------------
function SchichtdickeInner() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialVehicle = searchParams.get('vehicle') ?? undefined;
  const initialOrder = searchParams.get('order') ?? undefined;

  const [list, setList] = useState<LayerMeasurement[]>([]);
  const [current, setCurrent] = useState<LayerMeasurement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [pending, setPending] = useState<{ partId: string; position3d: Position3D | null } | null>(
    null,
  );
  const [neuWert, setNeuWert] = useState('');
  const [neuLabel, setNeuLabel] = useState('');
  const [readingInputs, setReadingInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const [use3D] = useState<boolean>(() => hasWebGL());
  const [ready, setReady] = useState(false);

  const isLocked = !!current?.unterschriftPng || current?.status === 'freigegeben';

  // --- Laden ---
  const loadDetail = useCallback(async (id: string) => {
    const full = await api.get<LayerMeasurement>(`/schichtdicke/${id}`);
    setCurrent(full);
    setSelectedId(full.id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setUpgrade(false);
    try {
      const l = await api.get<LayerMeasurement[]>('/schichtdicke');
      setList(l ?? []);
      if (!l || l.length === 0) {
        setCurrent(null);
        setSelectedId(null);
        setError('');
        return;
      }
      const aktiv = (selectedId && l.find((m) => m.id === selectedId)) || l[0];
      await loadDetail(aktiv.id);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof ApiError ? e.message : t('schicht.error.load'));
    } finally {
      setLoading(false);
    }
  }, [selectedId, loadDetail, t]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Punkte des aktuell gewaehlten Bauteils.
  const points = useMemo(() => current?.points ?? [], [current]);
  const auswertung = useMemo<LayerBauteilAuswertung[]>(() => current?.auswertung ?? [], [current]);
  const statusByPart = useMemo(() => {
    const map: Record<string, AmpelStatus> = {};
    for (const a of auswertung) map[canonicalPartId(a.partId)] = a.status;
    return map;
  }, [auswertung]);
  const selectedPoints = useMemo(
    () => points.filter((p) => canonicalPartId(p.partId) === selectedPart),
    [points, selectedPart],
  );
  const auffaellige = useMemo(() => auswertung.filter((a) => a.auffaellig), [auswertung]);

  // --- 3D/2D-Klick: Bauteil waehlen (+ 3D-Position merken) ---
  const handlePlace = useCallback(
    (partId: string, position3d: Position3D) => {
      const canon = canonicalPartId(partId);
      setSelectedPart(canon);
      if (!isLocked) setPending({ partId: canon, position3d });
    },
    [isLocked],
  );
  const handleSelect2D = useCallback(
    (partId: string) => {
      const canon = canonicalPartId(partId);
      setSelectedPart(canon);
      if (!isLocked) setPending({ partId: canon, position3d: null });
    },
    [isLocked],
  );

  // --- Neuen Messpunkt anlegen ---
  async function addPoint() {
    if (!current || !pending) return;
    const wert = Number(neuWert);
    if (!neuWert || Number.isNaN(wert) || wert < 0) {
      toast(t('schicht.error.value'));
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        partId: pending.partId,
        partLabel: partLabel(pending.partId),
        positionMode: pending.position3d ? '3d' : '2d',
        readings: [{ wertUm: wert, erfasstAm: new Date().toISOString() }],
      };
      if (pending.position3d) body.position3d = pending.position3d;
      if (neuLabel.trim()) body.label = neuLabel.trim();
      await api.post(`/schichtdicke/${current.id}/points`, body);
      setNeuWert('');
      setNeuLabel('');
      await loadDetail(current.id);
      toast(t('schicht.saved'));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('schicht.error.save'));
    } finally {
      setBusy(false);
    }
  }

  // --- Weitere Messung an bestehendem Punkt anhaengen ---
  async function addReading(point: LayerMeasurementPoint) {
    if (!current) return;
    const raw = readingInputs[point.id] ?? '';
    const wert = Number(raw);
    if (!raw || Number.isNaN(wert) || wert < 0) {
      toast(t('schicht.error.value'));
      return;
    }
    setBusy(true);
    try {
      const readings = [
        ...(point.readings ?? []),
        { wertUm: wert, erfasstAm: new Date().toISOString() },
      ];
      await api.patch(`/schichtdicke/${current.id}/points/${point.id}`, { readings });
      setReadingInputs((prev) => ({ ...prev, [point.id]: '' }));
      await loadDetail(current.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('schicht.error.save'));
    } finally {
      setBusy(false);
    }
  }

  async function deletePoint(pointId: string) {
    if (!current) return;
    setBusy(true);
    try {
      await api.delete(`/schichtdicke/${current.id}/points/${pointId}`);
      await loadDetail(current.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('schicht.error.save'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteProtokoll() {
    if (!current) return;
    setConfirmDelete(false);
    try {
      await api.delete(`/schichtdicke/${current.id}`);
      setSelectedId(null);
      setCurrent(null);
      await load();
      toast(t('schicht.deleted'));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('schicht.error.save'));
    }
  }

  async function downloadPdf() {
    if (!current) return;
    try {
      await downloadAuthed(`/schichtdicke/${current.id}/pdf`, `Schichtdicke_${current.id.slice(0, 8)}.pdf`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('schicht.error.pdf'));
    }
  }

  // --- Live-Vorschau-Status des aktuell gewaehlten Bauteils (fuer den Panel-Kopf) ---
  const selectedStatus: AmpelStatus | null = selectedPart
    ? statusByPart[selectedPart] ?? bewerteBauteil(selectedPart, null, current?.normProfileKey)
    : null;

  if (loading) return <Loading />;

  if (upgrade) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('schicht.title')} subtitle={t('schicht.subtitle')} />
        <UpgradeHinweis message={t('schicht.upgrade')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('schicht.title')}
        subtitle={t('schicht.subtitle')}
        action={
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            {t('schicht.new')}
          </button>
        }
      />

      {error && <ErrorBox message={error} />}

      {list.length === 0 ? (
        <Empty
          text={t('schicht.none')}
          action={
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              {t('schicht.new')}
            </button>
          }
        />
      ) : (
        <>
          {/* Protokoll-Auswahl + Aktionen */}
          <SectionCard>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="select max-w-xs"
                value={selectedId ?? ''}
                onChange={(e) => loadDetail(e.target.value)}
              >
                {list.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t(`schicht.anlass.${m.anlass ?? 'sonstiges'}`)} · {new Date(m.createdAt ?? '').toLocaleDateString()} · {m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost" onClick={downloadPdf} disabled={!current}>
                  {t('schicht.pdf')}
                </button>
                <button
                  className="btn-ghost text-danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!current || isLocked}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
            {isLocked && <p className="help mt-2">{t('schicht.locked')}</p>}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Viewer */}
            <SectionCard className="min-h-[420px]">
              <div className="h-[420px] w-full overflow-hidden rounded-lg bg-ink-900">
                {use3D ? (
                  <Scene3DHeatmap
                    statusByPart={statusByPart}
                    points={points.map((p) => ({ id: p.id, partId: p.partId, position3d: p.position3d }))}
                    selectedPart={selectedPart}
                    onPlace={handlePlace}
                    onReady={() => setReady(true)}
                  />
                ) : (
                  <div className="grid h-full place-items-center p-4">
                    <div className="h-full max-h-[380px]">
                      <SchemaSVG
                        statusByPart={statusByPart}
                        selectedPart={selectedPart}
                        onSelect={handleSelect2D}
                      />
                    </div>
                  </div>
                )}
              </div>
              {use3D && !ready && <p className="help mt-2">{t('common.loadingEllipsis')}</p>}
              {!use3D && <p className="help mt-2">{t('schicht.fallback')}</p>}

              {/* Legende */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {AMPEL_LEGENDE.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 text-xs text-ink-300">
                    <span className="inline-block h-3 w-3 rounded-sm" style={ampelStyle(s)} />
                    {t(AMPEL_LABEL_KEY[s])}
                  </span>
                ))}
              </div>
            </SectionCard>

            {/* Seiten-Panel */}
            <div className="space-y-6">
              {/* Ausgewaehltes Bauteil */}
              <SectionCard title={selectedPart ? partLabel(selectedPart) : t('schicht.part.select')}>
                {!selectedPart ? (
                  <p className="text-sm text-ink-300">{t('schicht.part.hint')}</p>
                ) : (
                  <div className="space-y-4">
                    {selectedStatus && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-block h-3 w-3 rounded-sm" style={ampelStyle(selectedStatus)} />
                        <span>{t(AMPEL_LABEL_KEY[selectedStatus])}</span>
                      </div>
                    )}

                    {/* Bestehende Punkte */}
                    {selectedPoints.length === 0 ? (
                      <p className="text-sm text-ink-400">{t('schicht.part.noPoints')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedPoints.map((p, i) => (
                          <li key={p.id} className="rounded-md border border-ink-700/60 p-2">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {p.label || `${t('schicht.part.point')} ${i + 1}`}
                              </span>
                              {!isLocked && (
                                <button
                                  className="text-xs text-danger hover:underline"
                                  onClick={() => deletePoint(p.id)}
                                  disabled={busy}
                                >
                                  {t('common.delete')}
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(p.readings ?? []).map((r, ri) => (
                                <span
                                  key={ri}
                                  className="rounded bg-ink-800 px-1.5 py-0.5 text-xs tabular-nums"
                                >
                                  {Math.round(r.wertUm)} µm
                                </span>
                              ))}
                              {(p.readings ?? []).length === 0 && (
                                <span className="text-xs text-ink-400">–</span>
                              )}
                            </div>
                            {!isLocked && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  className="input h-8 text-sm"
                                  placeholder={t('schicht.part.um')}
                                  value={readingInputs[p.id] ?? ''}
                                  onChange={(e) =>
                                    setReadingInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                                  }
                                />
                                <button
                                  className="btn-ghost h-8 px-2 text-sm"
                                  onClick={() => addReading(p)}
                                  disabled={busy}
                                >
                                  {t('schicht.part.addReading')}
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Neuen Punkt anlegen */}
                    {!isLocked && (
                      <div className="rounded-md border border-dashed border-ink-700/60 p-2">
                        <p className="mb-2 text-xs text-ink-400">{t('schicht.part.addPoint')}</p>
                        <div className="space-y-2">
                          <input
                            className="input h-8 text-sm"
                            placeholder={t('schicht.part.label')}
                            value={neuLabel}
                            onChange={(e) => setNeuLabel(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={0}
                              className="input h-8 text-sm"
                              placeholder={t('schicht.part.um')}
                              value={neuWert}
                              onChange={(e) => setNeuWert(e.target.value)}
                            />
                            <button
                              className="btn-primary h-8 px-3 text-sm"
                              onClick={addPoint}
                              disabled={busy || !pending}
                            >
                              {t('schicht.part.save')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Auswertung */}
              <SectionCard title={t('schicht.rating.title')}>
                {auswertung.length === 0 ? (
                  <p className="text-sm text-ink-400">{t('schicht.rating.empty')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-400">
                        <th className="pb-1">{t('schicht.table.part')}</th>
                        <th className="pb-1 text-right">{t('schicht.table.max')}</th>
                        <th className="pb-1">{t('schicht.table.rating')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auswertung.map((a) => (
                        <tr key={a.partId} className="border-t border-ink-800">
                          <td className="py-1">{a.partLabel || partLabel(a.partId)}</td>
                          <td className="py-1 text-right tabular-nums">
                            {a.statistik ? `${Math.round(a.statistik.maxUm)} µm` : '–'}
                          </td>
                          <td className="py-1">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={ampelStyle(a.status)} />
                              {t(AMPEL_LABEL_KEY[a.status])}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-3 text-sm">
                  {auffaellige.length > 0
                    ? t('schicht.auffaellig.count', { n: auffaellige.length })
                    : t('schicht.auffaellig.none')}
                </p>
              </SectionCard>

              {/* Haftungshinweis */}
              <div className="rounded-lg border border-caution/40 bg-caution-soft p-3 text-xs text-ink-200">
                <p className="mb-1 font-semibold">{t('schicht.hint.title')}</p>
                <p>{t('schicht.hint.text')}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <NeuesProtokollModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vorbelegung={{ vehicleId: initialVehicle, orderId: initialOrder }}
        onCreated={async (m) => {
          setSelectedId(m.id);
          await load();
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('schicht.confirmDelete.title')}
        message={t('schicht.confirmDelete.message')}
        confirmLabel={t('common.delete')}
        onConfirm={deleteProtokoll}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default function SchichtdickePage() {
  return (
    <Suspense fallback={<Loading />}>
      <SchichtdickeInner />
    </Suspense>
  );
}
