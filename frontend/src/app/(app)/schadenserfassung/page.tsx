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
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import AuthedImage from '@/components/AuthedImage';
import { PageHeader, SectionCard, Loading, ErrorBox, UpgradeHinweis, Empty, Modal, ConfirmDialog, useToast } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { eur } from '@/lib/format';
import { FAHRZEUG_GROESSEN } from '@/lib/kalkulation-katalog';
import {
  KALK_LEISTUNGEN,
  DEFAULT_LEISTUNG,
  defaultFlaeche,
  flaechenPreis,
  proQmFuer,
  type KalkLeistung,
  type KalkulationSettings,
} from '@/lib/flaechen-preise';
import NeueInspektionModal from '@/components/Inspection3D/NeueInspektionModal';
import SignaturePad from '@/components/SignaturePad';
import {
  SCHWEREGRAD_LABEL,
  SCHWEREGRAD_COLOR,
  DAMAGE_ART_LABEL,
  DAMAGE_ORIGIN_LABEL,
  INSPECTION_TYP_LABEL,
  INSPECTION_STATUS_LABEL,
  INSPECTION_STATUS_COLOR,
} from '@/lib/labels';
import { partLabel, canonicalPartId } from '@/lib/vehicle-parts';

// Clientseitiger Spiegel des serverseitigen CONSENT_TEXT (der wahre, gespeicherte
// Wert kommt nach der Unterschrift via inspection.consentText vom Server).
const CONSENT_TEXT =
  'Ich bestätige, dass die in dieser Inspektion dokumentierten Schäden, Fotos und Angaben den Zustand des Fahrzeugs zum Zeitpunkt der Unterschrift korrekt wiedergeben.';
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

// Akzent als CSS-Variable, damit das Branchen-Theming greift (nur in style={{...}}
// verwenden – SVG-Praesentationsattribute unterstuetzen keine CSS-Variablen).
const COPPER = 'rgb(var(--copper-500))';

// Kalkulieren-Modus (B2/B3): Steuer- und Rechenkonstanten.
const MWST = 0.19;
const round2 = (n: number) => Math.round(n * 100) / 100;

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
// Interaktions-Modus (unabhaengig von 3D/2D-Ansicht): heutiges Schaden-Erfassen
// vs. reine Preis-Kalkulation ohne Schaden-Item (B2).
type WorkMode = 'erfassen' | 'kalkulieren';

// ===========================================================================
// 2D-Fallback: selbst-enthaltene SVG-Seitenansicht eines stilisierten Autos
// mit Ankerpunkten je partId. Bauteil antippen = Marker setzen,
// Marker antippen = auswaehlen. Keine Abhaengigkeit zu FahrzeugDiagramm.tsx.
// ===========================================================================

// Ankerpunkt (2D-Layout) je kanonischer partId im 100x60-viewBox
// (Seitenansicht links). Nur die Positionen sind hier lokal – die Labels kommen
// aus lib/vehicle-parts.ts (partLabel), damit die Taxonomie EINE Quelle hat.
// Bewusst eine Teilmenge (linke Seite): rechte Bauteile haben in dieser
// Seitenansicht keinen Anker – unveraendertes Bestandsverhalten.
const PART_ANCHORS_2D: Record<string, { x: number; y: number }> = {
  stossfaenger_vorne: { x: 8, y: 38 },
  motorhaube: { x: 22, y: 30 },
  kotfluegel_vl: { x: 28, y: 40 },
  windschutzscheibe: { x: 38, y: 20 },
  dach: { x: 52, y: 12 },
  tuer_vl: { x: 44, y: 34 },
  tuer_hl: { x: 58, y: 34 },
  seitenwand_hl: { x: 72, y: 34 },
  heckklappe: { x: 84, y: 28 },
  stossfaenger_hinten: { x: 92, y: 38 },
};

function Fallback2D({
  items,
  selectedId,
  selectedParts,
  onPlace,
  onSelect,
}: {
  items: DamageItem[];
  selectedId?: string | null;
  selectedParts?: string[];
  onPlace: (partId: string, position3d: Position3D) => void;
  onSelect: (id: string) => void;
}) {
  // Im Kalkulieren-Modus gewaehlte Bauteile (kanonische partIds) hervorheben.
  const gewaehltSet = useMemo(() => new Set(selectedParts ?? []), [selectedParts]);
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

  // Items in zwei Render-Pfade trennen:
  //  - 3D-Items (positionMode!=='2d'): ueber die Bauteil-Ankerpunkte gestreut.
  //  - 2D-Annahme-Items (positionMode==='2d'): ueber ihre eigenen x2d/y2d-
  //    Koordinaten (Prozent 0–100), UNABHAENGIG von partId und Ansicht – so
  //    werden migrierte und in der Schnellannahme erfasste Schaeden sichtbar.
  const items3d = useMemo(() => items.filter((it) => it.positionMode !== '2d'), [items]);
  const items2d = useMemo(
    () =>
      items.filter(
        (it) => it.positionMode === '2d' && typeof it.x2d === 'number' && typeof it.y2d === 'number',
      ),
    [items],
  );

  // Marker eines Bauteils leicht gestreut um den Anker anordnen (nur 3D-Pfad).
  // Gruppierung ueber die KANONISCHE partId, damit auch alt gespeicherte/abweichende
  // Werte denselben Anker treffen und kein Marker "unsichtbar" wird.
  const grouped = useMemo(() => {
    const map = new Map<string, DamageItem[]>();
    for (const it of items3d) {
      const key = canonicalPartId(it.partId);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return map;
  }, [items3d]);

  // Einheitliche Schadensmarker-Darstellung (Farbe/Aktiv-Ring/Vorschaden-Hohlform).
  // cx/cy im 100×60-viewBox; identische Optik fuer 3D- und 2D-Pfad.
  function renderMarker(m: DamageItem, cx: number, cy: number) {
    const aktiv = m.id === selectedId;
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
          style={{
            fill: istVor ? 'none' : aktiv ? COPPER : color,
            stroke: aktiv ? COPPER : color,
          }}
          strokeWidth={istVor ? 0.7 : 0.4}
          opacity={istVor ? 0.85 : 1}
        />
        {aktiv && (
          <circle
            cx={cx}
            cy={cy}
            r={3.6}
            fill="none"
            style={{ stroke: COPPER }}
            strokeWidth="0.5"
            opacity="0.6"
          />
        )}
      </g>
    );
  }

  return (
    <svg viewBox="0 0 100 60" className="h-full w-full select-none">
      {/* Karosserie-Silhouette (Seitenansicht), rein dekorativ – theme-faehig. */}
      <path
        d="M6 40 Q8 30 18 28 L30 18 Q34 14 46 14 L60 15 Q70 16 78 26 L92 30 Q96 32 96 40 L96 44 Q96 47 92 47 L10 47 Q6 47 6 44 Z"
        style={{ fill: 'rgb(var(--ink-750))', stroke: 'rgb(var(--ink-600))' }}
        strokeWidth="0.6"
      />
      {/* Raeder */}
      <circle cx="28" cy="47" r="5" style={{ fill: 'rgb(var(--ink-850))', stroke: 'rgb(var(--ink-600))' }} strokeWidth="0.5" />
      <circle cx="74" cy="47" r="5" style={{ fill: 'rgb(var(--ink-850))', stroke: 'rgb(var(--ink-600))' }} strokeWidth="0.5" />

      {/* Bauteil-Ankerpunkte: antippen = Marker setzen bzw. Bauteil kalkulieren. */}
      {Object.entries(PART_ANCHORS_2D).map(([partId, a]) => {
        const gewaehlt = gewaehltSet.has(partId);
        return (
          <g
            key={partId}
            className="cursor-pointer"
            onClick={() => placeAt(partId)}
          >
            <circle cx={a.x} cy={a.y} r={3.2} fill="transparent" />
            <circle
              cx={a.x}
              cy={a.y}
              r={gewaehlt ? 1.7 : 1}
              style={{ fill: gewaehlt ? COPPER : 'rgb(var(--ink-600))' }}
              className="transition-colors hover:!fill-copper"
            >
              <title>{partLabel(partId)}</title>
            </circle>
          </g>
        );
      })}

      {/* 3D-Schadensmarker je Bauteil (gestreut um den Anker). */}
      {Array.from(grouped.entries()).flatMap(([partId, list]) => {
        const a = PART_ANCHORS_2D[partId];
        if (!a) return [];
        return list.map((m, i) => {
          const angle = (i / Math.max(1, list.length)) * Math.PI * 2;
          const cx = a.x + Math.cos(angle) * (i === 0 ? 0 : 2.2);
          const cy = a.y + Math.sin(angle) * (i === 0 ? 0 : 2.2);
          return renderMarker(m, cx, cy);
        });
      })}

      {/* 2D-Annahme-Schaeden ueber eigene x2d/y2d-Koordinaten (Prozent -> viewBox:
          x2d 0–100 = cx; y2d 0–100 auf die Silhouettenhoehe 0–60 skaliert). */}
      {items2d.map((m) => renderMarker(m, m.x2d as number, ((m.y2d as number) * 60) / 100))}
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

function SchadenserfassungInner() {
  // Redirect-Ziel der 2D-Schnellannahme (?inspection=<id>): die frisch
  // angelegte Annahme wird direkt geoeffnet, statt der ersten der Liste.
  // ?warnung=schaden signalisiert, dass beim Anlegen ein Schaden fehlschlug –
  // hier (am Ort des Nacherfassens) als sichtbarer Hinweis gerendert.
  const searchParams = useSearchParams();
  const initialInspectionId = searchParams.get('inspection');
  const [warnungSchaden, setWarnungSchaden] = useState(
    searchParams.get('warnung') === 'schaden',
  );

  const [inspection, setInspection] = useState<DamageInspection | null>(null);
  const [inspections, setInspections] = useState<DamageInspection[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(
    initialInspectionId,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [items, setItems] = useState<DamageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tarif-403 (3D-Schadenserfassung ab Basic bzw. Starter-Add-on) -> Upgrade-Weg.
  const [upgrade, setUpgrade] = useState(false);

  const [mode, setMode] = useState<Mode>('3d');
  const [autoFell, setAutoFell] = useState(false); // automatisch (nicht manuell) auf 2D
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- Kalkulieren-Modus (B2/B3): reine Preis-Kalkulation im Client ---
  // Kein Server-State; ein Klick auf ein Bauteil legt KEIN Schaden-Item an,
  // sondern fuegt das Bauteil zur Live-Kalkulation (Flaeche x qm-Satz) hinzu.
  const [workMode, setWorkMode] = useState<WorkMode>('erfassen');
  const [kalkParts, setKalkParts] = useState<string[]>([]); // kanonische partIds, Auswahlreihenfolge
  const [kalkLeistung, setKalkLeistung] = useState<KalkLeistung>(DEFAULT_LEISTUNG);
  const [kalkGroesse, setKalkGroesse] = useState('mittel');
  const [kalkProQm, setKalkProQm] = useState(''); // Override EUR/qm; '' = Betriebs-/Leistungs-Default
  const [kalkFlaeche, setKalkFlaeche] = useState<Record<string, string>>({}); // Override Flaeche je partId
  // Betriebs-EUR/qm-Saetze aus den Tenant-Settings (Block `kalkulation`). Sind
  // sie gesetzt, bilden sie den Basissatz der Sofort-Kalkulation; sonst greifen
  // die Konstanten aus flaechen-preise. Fehlerhafter/fehlender Endpunkt = null.
  const [kalkSettings, setKalkSettings] = useState<KalkulationSettings | null>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  // Bestaetigungs-Dialoge (Pending-State-Muster).
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Gesperrt, sobald unterschrieben (unterschriftPng) ODER Status 'freigegeben'.
  const isLocked = !!inspection?.unterschriftPng || inspection?.status === 'freigegeben';

  const readyRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Betriebs-EUR/qm-Saetze einmalig laden (Tenant-Settings, Block kalkulation) ---
  // Bewusst tolerant: schlaegt der Abruf fehl (z. B. Endpunkt liefert den Block
  // noch nicht), bleibt kalkSettings null und die Konstanten-Defaults greifen.
  useEffect(() => {
    let aktiv = true;
    api
      .get<{ kalkulation?: KalkulationSettings | null }>('/tenants/me')
      .then((r) => aktiv && setKalkSettings(r.kalkulation ?? null))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, []);

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
    setUpgrade(false);
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
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
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

  // --- Watchdog: ohne onReady binnen 8s automatisch auf 2D ---
  // 8s statt 4s, weil der three.js-Chunk (dynamic import) beim ersten Laden
  // gross ist; onReady feuert jetzt zuverlaessig via Canvas onCreated, aber der
  // Chunk-Download/-Compile darf im Dev/bei langsamer Leitung etwas dauern, ohne
  // dass wir faelschlich auf 2D zurueckfallen.
  const startWatchdog = useCallback(() => {
    readyRef.current = false;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      if (!readyRef.current) {
        setMode('2d');
        setAutoFell(true);
      }
    }, 8000);
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

  // Wechsel Schaden erfassen <-> Kalkulieren. Beim Kalkulieren die aktive
  // Schaden-Auswahl loesen, damit das rechte Panel sauber die Summe zeigt.
  function switchWorkMode(m: WorkMode) {
    setWorkMode(m);
    if (m === 'kalkulieren') setSelectedId(null);
  }

  // --- Bauteil-Klick: je nach Modus Schaden anlegen ODER kalkulieren ---
  const handlePlace = useCallback(
    async (partId: string, position3d: Position3D) => {
      // Kalkulieren-Modus: reine Preis-Kalkulation, kein Schaden-Item, kein
      // Server-Call. Klick auf ein gewaehltes Bauteil entfernt es wieder.
      if (workMode === 'kalkulieren') {
        const canonical = canonicalPartId(partId);
        setKalkParts((prev) =>
          prev.includes(canonical) ? prev.filter((p) => p !== canonical) : [...prev, canonical],
        );
        return;
      }
      if (!inspection || busy || isLocked) return;
      setBusy(true);
      try {
        const created = await api.post<DamageItem>(`/inspections/${inspection.id}/items`, {
          partId,
          // Label aus der EINEN Taxonomie-Quelle (deckt auch rechte Bauteile ab,
          // die keinen 2D-Anker haben – zuvor blieb das Label dort leer).
          partLabel: partLabel(partId) || undefined,
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
    [workMode, inspection, busy, isLocked],
  );

  // --- Schaden bearbeiten (PATCH) ---
  const patchItem = useCallback(
    async (id: string, patch: Partial<Pick<DamageItem, 'origin' | 'art' | 'schweregrad' | 'notiz'>>) => {
      if (isLocked) return;
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
      if (!inspection || uploading || isLocked) return;
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
      if (isLocked) return;
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

  // --- Kalkulieren-Modus: abgeleitete Preise (Flaeche x Groesse x EUR/qm) ---
  const kalkGroesseFaktor = FAHRZEUG_GROESSEN.find((g) => g.id === kalkGroesse)?.faktor ?? 1;
  const kalkLeistungMeta =
    KALK_LEISTUNGEN.find((l) => l.id === kalkLeistung) ?? KALK_LEISTUNGEN[0];
  // Basissatz: gepflegter Betriebs-EUR/qm (Tenant-Settings) sonst Konstante.
  const proQmBasis = proQmFuer(kalkLeistung, kalkSettings);
  const proQmEffektiv =
    kalkProQm !== '' && !Number.isNaN(Number(kalkProQm))
      ? Math.max(0, Number(kalkProQm))
      : proQmBasis;

  // Effektive Flaeche (qm) einer Position: Override (falls gueltig) sonst Richtwert.
  function kalkFlaecheOf(partId: string): number {
    const o = kalkFlaeche[partId];
    if (o !== undefined && o !== '' && !Number.isNaN(Number(o))) return Math.max(0, Number(o));
    return defaultFlaeche(partId);
  }
  const kalkZeilenPreis = (partId: string) =>
    flaechenPreis(kalkFlaecheOf(partId), kalkGroesseFaktor, proQmEffektiv);

  const kalkNetto = round2(kalkParts.reduce((s, p) => s + kalkZeilenPreis(p), 0));
  const kalkMwst = round2(kalkNetto * MWST);
  const kalkBrutto = round2(kalkNetto + kalkMwst);

  function entferneKalkPart(partId: string) {
    setKalkParts((prev) => prev.filter((p) => p !== partId));
  }
  function leereKalk() {
    setKalkParts([]);
    setKalkFlaeche({});
  }

  async function kalkKopieren() {
    const g = FAHRZEUG_GROESSEN.find((x) => x.id === kalkGroesse)?.label ?? '';
    const zeilen = kalkParts.map(
      (p) => `- ${partLabel(p)} (${kalkFlaecheOf(p)} qm): ${eur(kalkZeilenPreis(p))}`,
    );
    const text = [
      `Kalkulation ${kalkLeistungMeta.label} - ${g} (${proQmEffektiv} EUR/qm, Richtwerte)`,
      ...zeilen,
      `Netto: ${eur(kalkNetto)}`,
      `MwSt (19 %): ${eur(kalkMwst)}`,
      `Gesamt: ${eur(kalkBrutto)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Kalkulation kopiert');
    } catch {
      /* Clipboard evtl. gesperrt */
    }
  }

  // --- Inspektion digital unterschreiben (sperrt den Beleg) ---
  const handleSign = useCallback(
    async (unterschriftPng: string, unterschriebenVonName: string) => {
      if (!inspection || signing) return;
      setSigning(true);
      setSignError('');
      try {
        const updated = await api.post<DamageInspection>(
          `/inspections/${inspection.id}/signatur`,
          { unterschriftPng, unterschriebenVonName },
        );
        // Rueckgabe enthaelt items nicht -> bestehende items via Spread beibehalten.
        setInspection((prev) => ({ ...(prev ?? {}), ...updated }));
        setInspections((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
        setSignOpen(false);
        setError('');
      } catch (e) {
        setSignError(e instanceof ApiError ? e.message : 'Unterschrift fehlgeschlagen');
      } finally {
        setSigning(false);
      }
    },
    [inspection, signing],
  );

  // --- Unterschrift widerrufen (nur Inhaber; Backend erzwingt die Rolle) ---
  const handleRevoke = useCallback(async () => {
    if (!inspection || signing) return;
    setSigning(true);
    try {
      const updated = await api.post<DamageInspection>(
        `/inspections/${inspection.id}/signatur/widerrufen`,
      );
      setInspection((prev) => ({ ...(prev ?? {}), ...updated }));
      setInspections((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Widerruf fehlgeschlagen (nur Inhaber).');
    } finally {
      setSigning(false);
      setConfirmRevoke(false);
    }
  }, [inspection, signing]);

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
          workMode === 'kalkulieren'
            ? 'Kalkulieren – Bauteil anklicken für den Sofortpreis (Richtwerte, kein Schaden)'
            : inspection
              ? `Inspektion ${inspection.id.slice(0, 8)} · ${items.length} Schäden`
              : 'Interaktive 3D-Schadenserfassung am Fahrzeugmodell'
        }
        action={
          <>
            <Segmented<WorkMode>
              value={workMode}
              options={[
                { value: 'erfassen', label: 'Schaden erfassen' },
                { value: 'kalkulieren', label: 'Kalkulieren' },
              ]}
              onChange={switchWorkMode}
            />
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
            {inspection?.status && (
              <span className={INSPECTION_STATUS_COLOR[inspection.status] ?? 'badge-neutral'}>
                {INSPECTION_STATUS_LABEL[inspection.status] ?? inspection.status}
              </span>
            )}
            <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
              Neue Inspektion
            </button>
            {workMode === 'erfassen' && inspection && !isLocked && (
              <button type="button" className="btn-primary" onClick={() => { setSignError(''); setSignOpen(true); }}>
                Unterschreiben &amp; abschließen
              </button>
            )}
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

      {/* Querverweis zur klassischen 2D-Fahrzeugannahme (km/Tank, schnelle
          Zustandsaufnahme). Reiner UI-Hinweis (kein gemeinsames Datenmodell).
          Im Kalkulieren-Modus ausgeblendet – dort geht es nur um den Preis. */}
      {workMode === 'erfassen' && (
      <Link
        href="/fahrzeugannahme"
        className="group mb-4 flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-800/60 px-4 py-3 transition-colors hover:border-copper/40 hover:bg-ink-750"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-copper-soft text-copper ring-1 ring-copper/20">
          <Icon>{ICON_PATHS.intake}</Icon>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-chrome-100">
            Schnelle Zustandsaufnahme mit km-Stand & Tank?
          </span>
          <span className="block text-xs text-chrome-400">
            Zur klassischen 2D-Fahrzeugannahme wechseln.
          </span>
        </span>
        <Icon className="h-4 w-4 shrink-0 text-chrome-500 transition-colors group-hover:text-copper">
          {ICON_PATHS.arrow}
        </Icon>
      </Link>
      )}

      {error && (
        <div className="mb-4">
          {upgrade ? <UpgradeHinweis message={error} /> : <ErrorBox message={error} />}
        </div>
      )}

      {workMode === 'erfassen' && warnungSchaden && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-caution/40 text-caution">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-chrome-50">Nicht alle Schäden übernommen</p>
            <p className="mt-0.5 text-xs text-chrome-400">
              Die Annahme wurde gespeichert, aber mindestens ein Schaden aus der
              Schnellannahme konnte nicht übernommen werden. Bitte hier prüfen und
              fehlende Schäden ergänzen.
            </p>
          </div>
          <button
            type="button"
            className="link-muted shrink-0 text-xs"
            onClick={() => setWarnungSchaden(false)}
          >
            Verstanden
          </button>
        </div>
      )}

      {workMode === 'erfassen' && isLocked && inspection && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-positive/30 bg-positive-soft px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-positive/30 bg-positive-soft text-positive">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-chrome-50">Beleg unterschrieben &amp; gesperrt</p>
            <p className="mt-0.5 text-xs text-chrome-400">
              {inspection.unterschriebenVonName
                ? `Unterschrieben von ${inspection.unterschriebenVonName}`
                : 'Unterschrieben'}
              {inspection.unterschriebenAm
                ? ` am ${new Date(inspection.unterschriebenAm).toLocaleString('de-DE')}`
                : ''}
              {' '}· Bearbeitung ist gesperrt (read-only).
            </p>
          </div>
          {inspection.unterschriftPng && (
            <img
              src={inspection.unterschriftPng}
              alt="Unterschrift"
              className="h-14 w-auto rounded-lg border border-ink-600 bg-white"
            />
          )}
          <button
            type="button"
            className="link-muted text-xs"
            onClick={() => setConfirmRevoke(true)}
            disabled={signing}
            title="Nur Inhaber – macht den Beleg wieder bearbeitbar"
          >
            Widerrufen
          </button>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : workMode === 'erfassen' && !inspection ? (
        <SectionCard title="Keine Inspektion">
          <Empty
            text="Es ist noch keine Inspektion vorhanden. Lege eine neue Inspektion an, um Schäden zu erfassen – oder wechsle oben auf „Kalkulieren“ für einen schnellen Sofortpreis ohne Inspektion."
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
              workMode === 'kalkulieren'
                ? mode === '3d'
                  ? 'Bauteil anklicken, um es zur Kalkulation hinzuzufügen'
                  : 'Seitenansicht – Bauteil antippen, um es zu kalkulieren'
                : mode === '3d'
                  ? 'Bauteil anklicken, um einen Schaden zu setzen'
                  : 'Seitenansicht – Bauteil antippen, um einen Schaden zu setzen'
            }
          >
            {autoFell && mode === '2d' && (
              <div className="mb-3 rounded-xl border border-caution/30 bg-caution-soft px-3 py-2 text-xs text-caution">
                3D nicht verfügbar – 2D aktiv.
              </div>
            )}
            {/* bg-ink-900 statt -950: folgt dem Hell-Thema und passt zur Canvas-Buehne. */}
            <div className="relative h-[460px] w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
              {mode === '3d' ? (
                <SceneErrorBoundary onError={handleSceneError}>
                  <Scene3D
                    items={workMode === 'kalkulieren' ? [] : items}
                    selectedId={workMode === 'kalkulieren' ? null : selectedId}
                    selectedParts={workMode === 'kalkulieren' ? kalkParts : undefined}
                    onPlace={handlePlace}
                    onSelect={setSelectedId}
                    onReady={handleReady}
                  />
                </SceneErrorBoundary>
              ) : (
                <Fallback2D
                  items={workMode === 'kalkulieren' ? [] : items}
                  selectedId={workMode === 'kalkulieren' ? null : selectedId}
                  selectedParts={workMode === 'kalkulieren' ? kalkParts : undefined}
                  onPlace={handlePlace}
                  onSelect={setSelectedId}
                />
              )}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-chrome-400">
              {workMode === 'kalkulieren' ? (
                <>
                  <span>
                    Gewählte Bauteile: <strong className="text-chrome-200">{kalkParts.length}</strong>
                  </span>
                  <span>
                    Gesamt (brutto): <strong className="text-copper">{eur(kalkBrutto)}</strong>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Vorschäden: <strong className="text-chrome-200">{anzahlVor}</strong>
                  </span>
                  <span>
                    Neuschäden: <strong className="text-chrome-200">{anzahlNeu}</strong>
                  </span>
                </>
              )}
            </div>
          </SectionCard>

          {/* Seitenpanel: Sofort-Kalkulation ODER Schaden-Editor je nach Modus */}
          {workMode === 'kalkulieren' ? (
            <div className="lg:sticky lg:top-6 lg:self-start">
              <SectionCard
                title="Sofort-Kalkulation"
                subtitle={`${kalkParts.length} Position(en) · ${kalkLeistungMeta.label}`}
              >
                <div className="space-y-5">
                  {/* Leistung */}
                  <div>
                    <span className="label mb-1.5 block">Leistung</span>
                    <Segmented<KalkLeistung>
                      value={kalkLeistung}
                      options={KALK_LEISTUNGEN.map((l) => ({ value: l.id, label: l.label }))}
                      onChange={setKalkLeistung}
                    />
                    <p className="help mt-1.5">{kalkLeistungMeta.hinweis}</p>
                  </div>

                  {/* Fahrzeuggroesse + EUR/qm (beides ueberschreibbarer Richtwert) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label" htmlFor="kalk-groesse">Fahrzeuggröße</label>
                      <select
                        id="kalk-groesse"
                        className="select"
                        value={kalkGroesse}
                        onChange={(e) => setKalkGroesse(e.target.value)}
                      >
                        {FAHRZEUG_GROESSEN.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}{g.faktor !== 1 ? ` (×${g.faktor})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="kalk-proqm">€/qm (Richtwert)</label>
                      <input
                        id="kalk-proqm"
                        type="number"
                        min="0"
                        step="1"
                        className="input"
                        value={kalkProQm}
                        placeholder={String(proQmBasis)}
                        onChange={(e) => setKalkProQm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Positionen: Flaeche je Bauteil (ueberschreibbar) -> Zeilenpreis */}
                  {kalkParts.length === 0 ? (
                    <Empty text="Noch kein Bauteil gewählt. Klicke ein Karosserie-Bauteil an, um es zur Kalkulation hinzuzufügen." />
                  ) : (
                    <div className="space-y-1.5">
                      {kalkParts.map((pid) => (
                        <div key={pid} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-chrome-200">{partLabel(pid)}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={kalkFlaeche[pid] ?? ''}
                              placeholder={String(defaultFlaeche(pid))}
                              onChange={(e) => setKalkFlaeche((x) => ({ ...x, [pid]: e.target.value }))}
                              className="input h-8 w-16 py-0 text-right text-sm tabular-nums"
                              aria-label={`Fläche für ${partLabel(pid)} in Quadratmetern`}
                            />
                            <span className="text-xs text-chrome-600">qm</span>
                          </span>
                          <span className="w-20 shrink-0 text-right font-medium tabular-nums text-chrome-100">
                            {eur(kalkZeilenPreis(pid))}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-chrome-500 transition-colors hover:text-danger"
                            onClick={() => entferneKalkPart(pid)}
                            aria-label={`${partLabel(pid)} entfernen`}
                            title="Entfernen"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      <div className="mt-3 space-y-1 border-t border-ink-700 pt-3 text-sm">
                        <div className="flex items-center justify-between text-chrome-300">
                          <span>Netto</span><span className="tabular-nums">{eur(kalkNetto)}</span>
                        </div>
                        <div className="flex items-center justify-between text-chrome-400">
                          <span>MwSt (19 %)</span><span className="tabular-nums">{eur(kalkMwst)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 text-base font-semibold">
                          <span className="text-chrome-50">Gesamt</span>
                          <span className="tabular-nums text-copper">{eur(kalkBrutto)}</span>
                        </div>
                      </div>

                      <button className="btn-primary mt-3 w-full justify-center" onClick={kalkKopieren}>
                        Zusammenfassung kopieren
                      </button>
                      <button className="btn-ghost btn-sm mt-2 w-full justify-center" onClick={leereKalk}>
                        Auswahl leeren
                      </button>
                    </div>
                  )}

                  <p className="help">
                    Richtwerte: Fläche (qm) × Fahrzeuggröße × €/qm. Fläche je Bauteil und der
                    €/qm-Satz sind frei überschreibbar. Reine Kalkulation – es wird kein Schaden angelegt.
                  </p>
                </div>
              </SectionCard>
            </div>
          ) : (
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
                    {selected.partLabel || partLabel(selected.partId)}
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
                      <div
                        key={p.id}
                        className="block h-16 w-16 overflow-hidden rounded-lg border border-ink-600 bg-ink-900"
                        title="Schadenfoto"
                      >
                        <AuthedImage
                          path={`/inspections/photos/${p.id}/thumb`}
                          alt="Schadenfoto"
                          className="h-full w-full object-cover"
                        />
                      </div>
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
                    onClick={() => setConfirmDeleteId(selected.id)}
                  >
                    Schaden löschen
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
          )}
        </div>
      )}

      <NeueInspektionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />

      <Modal open={signOpen} onClose={() => setSignOpen(false)} title="Inspektion unterschreiben">
        {signError && <ErrorBox className="mb-4" message={signError} />}
        <SignaturePad
          consentText={inspection?.consentText ?? CONSENT_TEXT}
          onConfirm={handleSign}
          onCancel={() => setSignOpen(false)}
          busy={signing}
        />
      </Modal>

      <ConfirmDialog
        open={confirmRevoke}
        title="Unterschrift widerrufen"
        message="Unterschrift wirklich widerrufen? Der Beleg wird wieder bearbeitbar."
        confirmLabel="Widerrufen"
        busy={signing}
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevoke(false)}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Schaden löschen"
        message={(() => {
          const it = items.find((i) => i.id === confirmDeleteId);
          const teil = it?.partLabel || partLabel(it?.partId);
          return `Den Schaden${teil ? ` an „${teil}“` : ''} wirklich löschen? Zugehörige Fotos werden mit entfernt.`;
        })()}
        confirmLabel="Löschen"
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) void deleteItem(id);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

// useSearchParams verlangt im App Router eine Suspense-Boundary.
export default function SchadenserfassungPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SchadenserfassungInner />
    </Suspense>
  );
}
