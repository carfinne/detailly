'use client';

// Schadenserfassung (Phase 2): interaktiver 3D-Schadensviewer mit robustem
// 2D-Fallback. Der R3F-Canvas wird CLIENT-ONLY ueber next/dynamic({ssr:false})
// geladen (sonst SSR-Crash mangels WebGL). Drei Schutzschichten halten die
// Seite immer bedienbar:
//   1. WebGL-Feature-Detection  -> kein WebGL: sofort 2D.
//   2. ErrorBoundary um Canvas  -> jeder 3D-Laufzeitfehler: 2D statt Blank.
//   3. Haenger-Watchdog (~4s)   -> kein onReady: automatisch 2D + Hinweis.
// Ein manueller 3D/2D-Schiebeschalter im Kopf erlaubt jederzeit den Wechsel.

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { api, ApiError, serverUrl } from '@/lib/api';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty } from '@/components/ui';
import NeueInspektionModal from '@/components/Inspection3D/NeueInspektionModal';
import {
  SCHWEREGRAD_LABEL,
  SCHWEREGRAD_COLOR,
  DAMAGE_ART_LABEL,
  DAMAGE_ORIGIN_LABEL,
  INSPECTION_TYP_LABEL,
} from '@/lib/labels';
import type {
  DamageInspection,
  DamageItem,
  DamagePhoto,
  DamageOrigin,
  DamageSchweregrad,
  DamageArt,
  Position3D,
} from '@/lib/types';
import type { Scene3DProps } from '@/components/Inspection3D/Scene3D';

const COPPER = '#E8923B';

// 3D-Szene strikt client-only laden. ssr:false ist hier KRITISCH.
const Scene3D = dynamic<Scene3DProps>(() => import('@/components/Inspection3D/Scene3D'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <Loading />
    </div>
  ),
});

// --- WebGL-Feature-Detection (laeuft nur im Browser) ---
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

// Liest eine Bilddatei als Data-URL (Base64) – genau das Format, das der
// Foto-Endpunkt erwartet (Muster wie die Auftrags-Fotos).
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}

// --- ErrorBoundary: faengt JEDEN Fehler unterhalb des Canvas ab ---
class SceneErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onError: () => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

type Mode = '3d' | '2d';

// ===========================================================================
// 2D-Fallback: selbst-enthaltene SVG-Seitenansicht eines stilisierten Autos
// mit Ankerpunkten je partId. Bauteil antippen = Marker setzen,
// Marker antippen = auswaehlen. Keine Abhaengigkeit zu FahrzeugDiagramm.tsx.
// ===========================================================================

// Ankerpunkt je partId im 100x60-viewBox (Seitenansicht links).
const PART_ANCHORS_2D: Record<string, { x: number; y: number; label: string }> = {
  stossfaenger_vorne: { x: 8, y: 38, label: 'Stoßfänger vorne' },
  motorhaube: { x: 22, y: 30, label: 'Motorhaube' },
  kotfluegel_vl: { x: 28, y: 40, label: 'Kotflügel vorne links' },
  windschutzscheibe: { x: 38, y: 20, label: 'Windschutzscheibe' },
  dach: { x: 52, y: 12, label: 'Dach' },
  tuer_vl: { x: 44, y: 34, label: 'Tür vorne links' },
  tuer_hl: { x: 58, y: 34, label: 'Tür hinten links' },
  seitenwand_hl: { x: 72, y: 34, label: 'Seitenwand hinten links' },
  heckklappe: { x: 84, y: 28, label: 'Heckklappe' },
  stossfaenger_hinten: { x: 92, y: 38, label: 'Stoßfänger hinten' },
};

function Fallback2D({
  items,
  selectedId,
  onPlace,
  onSelect,
}: {
  items: DamageItem[];
  selectedId?: string | null;
  onPlace: (partId: string, position3d: Position3D) => void;
  onSelect: (id: string) => void;
}) {
  // 2D-Klick erzeugt eine pseudo-3D-Position aus dem Ankerpunkt, damit das
  // Datenmodell einheitlich bleibt (Position bleibt nur Visualisierung).
  function placeAt(partId: string) {
    const a = PART_ANCHORS_2D[partId];
    if (!a) return;
    onPlace(partId, {
      x: (a.x - 50) / 25,
      y: (30 - a.y) / 20,
      z: 0,
      nx: 0,
      ny: 0,
      nz: 1,
    });
  }

  // Marker eines Bauteils leicht gestreut um den Anker anordnen.
  const grouped = useMemo(() => {
    const map = new Map<string, DamageItem[]>();
    for (const it of items) {
      const arr = map.get(it.partId) ?? [];
      arr.push(it);
      map.set(it.partId, arr);
    }
    return map;
  }, [items]);

  return (
    <svg viewBox="0 0 100 60" className="h-full w-full select-none">
      {/* Karosserie-Silhouette (Seitenansicht), rein dekorativ. */}
      <path
        d="M6 40 Q8 30 18 28 L30 18 Q34 14 46 14 L60 15 Q70 16 78 26 L92 30 Q96 32 96 40 L96 44 Q96 47 92 47 L10 47 Q6 47 6 44 Z"
        fill="#1b2230"
        stroke="#3a4456"
        strokeWidth="0.6"
      />
      {/* Raeder */}
      <circle cx="28" cy="47" r="5" fill="#13171f" stroke="#3a4456" strokeWidth="0.5" />
      <circle cx="74" cy="47" r="5" fill="#13171f" stroke="#3a4456" strokeWidth="0.5" />

      {/* Bauteil-Ankerpunkte: antippen = Marker setzen. */}
      {Object.entries(PART_ANCHORS_2D).map(([partId, a]) => (
        <g
          key={partId}
          className="cursor-pointer"
          onClick={() => placeAt(partId)}
        >
          <circle cx={a.x} cy={a.y} r={3.2} fill="transparent" />
          <circle
            cx={a.x}
            cy={a.y}
            r={1}
            fill="#2c3545"
            className="transition-colors hover:fill-copper"
          >
            <title>{a.label}</title>
          </circle>
        </g>
      ))}

      {/* Schadensmarker je Bauteil (gestreut). */}
      {Array.from(grouped.entries()).flatMap(([partId, list]) => {
        const a = PART_ANCHORS_2D[partId];
        if (!a) return [];
        return list.map((m, i) => {
          const aktiv = m.id === selectedId;
          const angle = (i / Math.max(1, list.length)) * Math.PI * 2;
          const cx = a.x + Math.cos(angle) * (i === 0 ? 0 : 2.2);
          const cy = a.y + Math.sin(angle) * (i === 0 ? 0 : 2.2);
          const istVor = m.origin === 'vorschaden';
          const color = SCHWEREGRAD_COLOR[m.schweregrad] ?? COPPER;
          return (
            <g
              key={m.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.id);
              }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={aktiv ? 2.4 : 1.8}
                fill={istVor ? 'none' : aktiv ? COPPER : color}
                stroke={aktiv ? COPPER : color}
                strokeWidth={istVor ? 0.7 : 0.4}
                opacity={istVor ? 0.85 : 1}
              />
              {aktiv && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3.6}
                  fill="none"
                  stroke={COPPER}
                  strokeWidth="0.5"
                  opacity="0.6"
                />
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}

// --- kleine segmentierte Auswahl (seg-aehnlich) ---
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-ink-600 bg-ink-900/60 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-copper-grad text-ink-950 shadow-glow'
                : 'text-chrome-400 hover:text-chrome-50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const ORIGIN_OPTIONS: { value: DamageOrigin; label: string }[] = [
  { value: 'neu', label: DAMAGE_ORIGIN_LABEL.neu },
  { value: 'vorschaden', label: DAMAGE_ORIGIN_LABEL.vorschaden },
];

const SCHWEREGRAD_OPTIONS: { value: DamageSchweregrad; label: string }[] = [
  { value: 'leicht', label: SCHWEREGRAD_LABEL.leicht },
  { value: 'mittel', label: SCHWEREGRAD_LABEL.mittel },
  { value: 'schwer', label: SCHWEREGRAD_LABEL.schwer },
];

const ART_OPTIONS = Object.keys(DAMAGE_ART_LABEL) as DamageArt[];

export default function SchadenserfassungPage() {
  const [inspection, setInspection] = useState<DamageInspection | null>(null);
  const [inspections, setInspections] = useState<DamageInspection[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [items, setItems] = useState<DamageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mode, setMode] = useState<Mode>('3d');
  const [autoFell, setAutoFell] = useState(false); // automatisch (nicht manuell) auf 2D
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const readyRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Eine bestimmte Inspektion (inkl. Items) laden und aktiv setzen ---
  const loadById = useCallback(async (id: string) => {
    try {
      const full = await api.get<DamageInspection>(`/inspections/${id}`);
      setInspection(full);
      setItems(full.items ?? []);
      setSelectedInspectionId(full.id);
      setSelectedId(null);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Inspektion konnte nicht geladen werden');
    }
  }, []);

  // --- Daten laden: Liste aller Inspektionen + aktive Inspektion mit Items ---
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get<DamageInspection[]>('/inspections');
      setInspections(list ?? []);
      if (!list || list.length === 0) {
        setInspection(null);
        setItems([]);
        setSelectedInspectionId(null);
        setError('');
        return;
      }
      // Bereits gewaehlte Inspektion beibehalten, sonst die erste der Liste.
      const aktiv =
        (selectedInspectionId && list.find((i) => i.id === selectedInspectionId)) || list[0];
      const full = await api.get<DamageInspection>(`/inspections/${aktiv.id}`);
      setInspection(full);
      setItems(full.items ?? []);
      setSelectedInspectionId(full.id);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Fehler beim Laden der Inspektion');
    } finally {
      setLoading(false);
    }
  }, [selectedInspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Robustheit: kein WebGL -> sofort 2D ---
  useEffect(() => {
    if (!hasWebGL()) {
      setMode('2d');
      setAutoFell(true);
    }
  }, []);

  // --- Watchdog: ohne onReady binnen 4s automatisch auf 2D ---
  const startWatchdog = useCallback(() => {
    readyRef.current = false;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      if (!readyRef.current) {
        setMode('2d');
        setAutoFell(true);
      }
    }, 4000);
  }, []);

  useEffect(() => {
    if (mode === '3d') startWatchdog();
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, [mode, startWatchdog]);

  const handleReady = useCallback(() => {
    readyRef.current = true;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
  }, []);

  const handleSceneError = useCallback(() => {
    setMode('2d');
    setAutoFell(true);
  }, []);

  // Manuelle Umschaltung setzt den Auto-Hinweis zurueck.
  function switchMode(m: Mode) {
    setAutoFell(false);
    setMode(m);
  }

  // --- Schaden anlegen (Bauteil-Klick) ---
  const handlePlace = useCallback(
    async (partId: string, position3d: Position3D) => {
      if (!inspection || busy) return;
      setBusy(true);
      try {
        const created = await api.post<DamageItem>(`/inspections/${inspection.id}/items`, {
          partId,
          partLabel: PART_ANCHORS_2D[partId]?.label,
          positionMode: '3d',
          position3d,
          origin: 'neu',
          art: 'kratzer',
          schweregrad: 'mittel',
        });
        setItems((prev) => [...prev, created]);
        setSelectedId(created.id);
        setError('');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Schaden konnte nicht angelegt werden');
      } finally {
        setBusy(false);
      }
    },
    [inspection, busy],
  );

  // --- Schaden bearbeiten (PATCH) ---
  const patchItem = useCallback(
    async (id: string, patch: Partial<Pick<DamageItem, 'origin' | 'art' | 'schweregrad' | 'notiz'>>) => {
      // Optimistisch aktualisieren, bei Fehler neu laden.
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
      try {
        const updated = await api.patch<DamageItem>(`/items/${id}`, patch);
        setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Änderung fehlgeschlagen');
        load();
      }
    },
    [load],
  );

  // --- Foto zu einem Schaden hochladen (Phase 1: Data-URL an das Backend) ---
  const uploadPhoto = useCallback(
    async (itemId: string, file: File) => {
      if (!inspection || uploading) return;
      setUploading(true);
      try {
        const bild = await fileToDataUrl(file);
        const created = await api.post<DamagePhoto>(
          `/inspections/${inspection.id}/photos`,
          { bild, damageItemId: itemId },
        );
        // Foto direkt an den Schaden im lokalen State haengen.
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, photos: [...(it.photos ?? []), created] } : it,
          ),
        );
        setError('');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Foto-Upload fehlgeschlagen');
      } finally {
        setUploading(false);
      }
    },
    [inspection, uploading],
  );

  // --- Schaden loeschen (DELETE) ---
  const deleteItem = useCallback(
    async (id: string) => {
      const prev = items;
      setItems((p) => p.filter((it) => it.id !== id));
      if (selectedId === id) setSelectedId(null);
      try {
        await api.delete(`/items/${id}`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen');
        setItems(prev);
      }
    },
    [items, selectedId],
  );

  const selected = items.find((it) => it.id === selectedId) ?? null;
  const anzahlVor = items.filter((it) => it.origin === 'vorschaden').length;
  const anzahlNeu = items.filter((it) => it.origin === 'neu').length;

  // Nach dem Anlegen: in die Liste aufnehmen und direkt aktiv laden
  // (GET :id, damit per Carry-over kopierte Vorschaeden sichtbar werden).
  const handleCreated = useCallback(
    async (created: DamageInspection) => {
      setInspections((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      await loadById(created.id);
    },
    [loadById],
  );

  return (
    <div>
      <PageHeader
        title="Schadenserfassung"
        subtitle={
          inspection
            ? `Inspektion ${inspection.id.slice(0, 8)} · ${items.length} Schäden`
            : 'Interaktive 3D-Schadenserfassung am Fahrzeugmodell'
        }
        action={
          <>
            {inspections.length > 0 && (
              <select
                className="select w-auto min-w-[12rem]"
                value={selectedInspectionId ?? ''}
                onChange={(e) => loadById(e.target.value)}
                aria-label="Inspektion wählen"
              >
                {inspections.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.typ ? INSPECTION_TYP_LABEL[i.typ] : 'Inspektion'}
                    {i.createdAt ? ` · ${new Date(i.createdAt).toLocaleDateString('de-DE')}` : ''}
                    {` · ${i.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
              Neue Inspektion
            </button>
            <Segmented<Mode>
              value={mode}
              options={[
                { value: '3d', label: '3D' },
                { value: '2d', label: '2D' },
              ]}
              onChange={switchMode}
            />
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      {loading ? (
        <Loading />
      ) : !inspection ? (
        <SectionCard title="Keine Inspektion">
          <Empty
            text="Es ist noch keine Inspektion vorhanden. Lege eine neue Inspektion an, um Schäden zu erfassen."
            action={
              <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                Neue Inspektion anlegen
              </button>
            }
          />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Buehne */}
          <SectionCard
            title="Fahrzeugmodell"
            subtitle={
              mode === '3d'
                ? 'Bauteil anklicken, um einen Schaden zu setzen'
                : 'Seitenansicht – Bauteil antippen, um einen Schaden zu setzen'
            }
          >
            {autoFell && mode === '2d' && (
              <div className="mb-3 rounded-xl border border-caution/30 bg-caution-soft px-3 py-2 text-xs text-caution">
                3D nicht verfügbar – 2D aktiv.
              </div>
            )}
            <div className="relative h-[460px] w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-950">
              {mode === '3d' ? (
                <SceneErrorBoundary onError={handleSceneError}>
                  <Scene3D
                    items={items}
                    selectedId={selectedId}
                    onPlace={handlePlace}
                    onSelect={setSelectedId}
                    onReady={handleReady}
                  />
                </SceneErrorBoundary>
              ) : (
                <Fallback2D
                  items={items}
                  selectedId={selectedId}
                  onPlace={handlePlace}
                  onSelect={setSelectedId}
                />
              )}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-chrome-400">
              <span>
                Vorschäden: <strong className="text-chrome-200">{anzahlVor}</strong>
              </span>
              <span>
                Neuschäden: <strong className="text-chrome-200">{anzahlNeu}</strong>
              </span>
            </div>
          </SectionCard>

          {/* Seitenpanel: Editor des ausgewaehlten Schadens */}
          <SectionCard title="Schaden">
            {!selected ? (
              <Empty text="Kein Schaden ausgewählt. Tippe ein Bauteil an, um einen Schaden zu setzen, oder wähle einen Marker." />
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-chrome-500">
                    Bauteil
                  </p>
                  <p className="mt-0.5 font-display text-base text-chrome-50">
                    {selected.partLabel || selected.partId}
                  </p>
                </div>

                <div>
                  <label className="label">Herkunft</label>
                  <Segmented<DamageOrigin>
                    value={selected.origin}
                    options={ORIGIN_OPTIONS}
                    onChange={(v) => patchItem(selected.id, { origin: v })}
                  />
                </div>

                <div>
                  <label className="label">Schweregrad</label>
                  <Segmented<DamageSchweregrad>
                    value={selected.schweregrad}
                    options={SCHWEREGRAD_OPTIONS}
                    onChange={(v) => patchItem(selected.id, { schweregrad: v })}
                  />
                </div>

                <div>
                  <label className="label">Art</label>
                  <select
                    className="select"
                    value={selected.art}
                    onChange={(e) =>
                      patchItem(selected.id, { art: e.target.value as DamageArt })
                    }
                  >
                    {ART_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {DAMAGE_ART_LABEL[a]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Fotos</label>
                  <div className="flex flex-wrap gap-2">
                    {(selected.photos ?? []).map((p) => (
                      <a
                        key={p.id}
                        href={serverUrl(p.pfad)}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-16 w-16 overflow-hidden rounded-lg border border-ink-600 bg-ink-900"
                        title="Foto öffnen"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={serverUrl(p.thumbnailPfad || p.pfad)}
                          alt="Schadenfoto"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                    <label
                      className={`grid h-16 w-16 place-items-center rounded-lg border border-dashed border-ink-600 text-chrome-500 transition-colors ${
                        uploading
                          ? 'cursor-wait opacity-60'
                          : 'cursor-pointer hover:border-copper hover:text-copper'
                      }`}
                      title="Foto hinzufügen"
                    >
                      {uploading ? (
                        <span className="text-[10px]">…</span>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto(selected.id, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <p className="help mt-1.5">Direkt vom Tablet aufnehmen oder Bild wählen.</p>
                </div>

                <div className="flex justify-end border-t border-ink-700/60 pt-4">
                  <button
                    type="button"
                    className="link-danger text-sm"
                    onClick={() => deleteItem(selected.id)}
                  >
                    Schaden löschen
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      <NeueInspektionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
