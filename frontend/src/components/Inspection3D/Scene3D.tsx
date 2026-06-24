'use client';

// 3D-Schadensviewer (Phase 2 MVP).
// Prozedurales Karosseriemodell aus Primitiven (Boxen/Zylinder). Jedes
// anklickbare Karosserie-Bauteil ist ein BENANNTES Mesh (mesh.name === partId)
// -> Raycasting liefert partId + Weltpunkt + Weltnormale. Raeder sind reine
// Deko-Zylinder (nicht klickbar). Marker je Schaden als kleine Sphere; Form/
// Saettigung codieren Herkunft (Vorschaden hohl/entsaettigt, Neu voll),
// Schweregrad die Farbe, Auswahl = Kupfer-Glow.
//
// Client-only: three.js/WebGL laeuft nie im SSR. Die Seite bindet diese Datei
// ueber next/dynamic({ ssr:false }) ein.

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DamageItem, Position3D } from '@/lib/types';

const COPPER = '#E8923B';

// Schweregrad-Farben (1:1 zu lib/labels SCHWEREGRAD_COLOR, hier ohne Import,
// damit die 3D-Datei eigenstaendig bleibt).
const SCHWEREGRAD_HEX: Record<string, string> = {
  leicht: '#4FB477',
  mittel: '#E0A93B',
  schwer: '#E06A6A',
};

const SCHWEREGRAD_RADIUS: Record<string, number> = {
  leicht: 0.05,
  mittel: 0.07,
  schwer: 0.095,
};

// --- Karosserie-Lackton (neutral, damit Kupfer der einzige Akzent bleibt) ---
const BODY_COLOR = '#3a4456';
const GLASS_COLOR = '#1b2230';

export interface Scene3DProps {
  items: DamageItem[];
  selectedId?: string | null;
  onPlace: (partId: string, position3d: Position3D) => void;
  onSelect: (id: string) => void;
  onReady: () => void;
}

// Ein klickbares Karosserie-Bauteil. position/size in Welt-Einheiten.
type Part = {
  id: string;
  pos: [number, number, number];
  size: [number, number, number];
  glass?: boolean;
};

// Prozedurale Karosserie. partIds folgen der kanonischen Taxonomie aus dem
// Konzept (<bauteil>_<seite> mit vl|vr|hl|hr).
const PARTS: Part[] = [
  // Front
  { id: 'stossfaenger_vorne', pos: [0, 0.35, 2.05], size: [1.9, 0.5, 0.35] },
  { id: 'motorhaube', pos: [0, 0.78, 1.35], size: [1.85, 0.18, 1.2] },
  // Kotfluegel vorne
  { id: 'kotfluegel_vl', pos: [-0.98, 0.6, 1.35], size: [0.12, 0.7, 1.0] },
  { id: 'kotfluegel_vr', pos: [0.98, 0.6, 1.35], size: [0.12, 0.7, 1.0] },
  // Dach + Scheibe
  { id: 'windschutzscheibe', pos: [0, 1.18, 0.75], size: [1.55, 0.7, 0.12], glass: true },
  { id: 'dach', pos: [0, 1.5, -0.1], size: [1.6, 0.14, 1.5] },
  // Tueren
  { id: 'tuer_vl', pos: [-0.97, 0.78, 0.35], size: [0.1, 0.85, 0.9] },
  { id: 'tuer_vr', pos: [0.97, 0.78, 0.35], size: [0.1, 0.85, 0.9] },
  { id: 'tuer_hl', pos: [-0.97, 0.78, -0.6], size: [0.1, 0.85, 0.9] },
  { id: 'tuer_hr', pos: [0.97, 0.78, -0.6], size: [0.1, 0.85, 0.9] },
  // Seitenwand hinten
  { id: 'seitenwand_hl', pos: [-0.98, 0.7, -1.35], size: [0.12, 0.7, 0.9] },
  { id: 'seitenwand_hr', pos: [0.98, 0.7, -1.35], size: [0.12, 0.7, 0.9] },
  // Heck
  { id: 'heckklappe', pos: [0, 0.95, -1.78], size: [1.7, 0.75, 0.14] },
  { id: 'stossfaenger_hinten', pos: [0, 0.35, -2.05], size: [1.9, 0.5, 0.35] },
];

// Raeder (reine Deko, nicht klickbar).
const WHEELS: [number, number, number][] = [
  [-0.95, 0.32, 1.25],
  [0.95, 0.32, 1.25],
  [-0.95, 0.32, -1.25],
  [0.95, 0.32, -1.25],
];

function Body({
  selectedId,
  onPlace,
}: {
  selectedId?: string | null;
  onPlace: (partId: string, p: Position3D) => void;
}) {
  // Raycast-Treffer auf einem Bauteil -> partId (= mesh.name), Weltpunkt und
  // Weltnormale ableiten und nach oben melden.
  function handlePlace(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    const partId = e.object.name;
    if (!partId) return;
    const point = e.point;
    // Weltnormale: Face-Normale in den Weltraum transformieren.
    const normal = new THREE.Vector3(0, 1, 0);
    if (e.face) {
      normal.copy(e.face.normal).transformDirection(e.object.matrixWorld).normalize();
    }
    onPlace(partId, {
      x: Number(point.x.toFixed(4)),
      y: Number(point.y.toFixed(4)),
      z: Number(point.z.toFixed(4)),
      nx: Number(normal.x.toFixed(4)),
      ny: Number(normal.y.toFixed(4)),
      nz: Number(normal.z.toFixed(4)),
    });
  }

  return (
    <group>
      {/* Grundkoerper (Fahrgastzelle/Unterboden) – nicht klickbar, nur Masse. */}
      <mesh position={[0, 0.55, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.55, 3.7]} />
        <meshStandardMaterial color={BODY_COLOR} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Klickbare, benannte Bauteile. name === partId ist die fachliche Wahrheit. */}
      {PARTS.map((part) => (
        <mesh
          key={part.id}
          name={part.id}
          position={part.pos}
          onPointerDown={handlePlace}
          castShadow
          receiveShadow
        >
          <boxGeometry args={part.size} />
          <meshStandardMaterial
            color={part.glass ? GLASS_COLOR : BODY_COLOR}
            metalness={part.glass ? 0.1 : 0.35}
            roughness={part.glass ? 0.15 : 0.55}
            transparent={part.glass}
            opacity={part.glass ? 0.55 : 1}
            emissive={part.id === selectedId ? COPPER : '#000000'}
            emissiveIntensity={part.id === selectedId ? 0.25 : 0}
          />
        </mesh>
      ))}

      {/* Raeder – reine Deko, KEIN onPointerDown (nicht klickbar). */}
      {WHEELS.map((w, i) => (
        <mesh key={`wheel-${i}`} position={w} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
          <meshStandardMaterial color="#13171f" metalness={0.2} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Marker({
  item,
  selected,
  onSelect,
}: {
  item: DamageItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const p = item.position3d;
  if (!p) return null;

  const istVorschaden = item.origin === 'vorschaden';
  const baseColor = SCHWEREGRAD_HEX[item.schweregrad] ?? COPPER;
  const radius = SCHWEREGRAD_RADIUS[item.schweregrad] ?? 0.07;

  // Marker leicht entlang der Normalen anheben, damit er auf der Oberflaeche sitzt.
  const offset = 0.04;
  const position: [number, number, number] = [
    p.x + p.nx * offset,
    p.y + p.ny * offset,
    p.z + p.nz * offset,
  ];

  return (
    <group position={position}>
      {/* Kupfer-Glow-Halo bei Auswahl (der EINE Akzent fuer "aktiv"). */}
      {selected && (
        <mesh>
          <sphereGeometry args={[radius * 1.9, 20, 20]} />
          <meshBasicMaterial color={COPPER} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(item.id);
        }}
      >
        <sphereGeometry args={[radius, 20, 20]} />
        {/* Vorschaden = entsaettigt + hohl (wireframe); Neuschaden = voll. */}
        <meshStandardMaterial
          color={selected ? COPPER : baseColor}
          wireframe={istVorschaden}
          transparent={istVorschaden}
          opacity={istVorschaden ? 0.7 : 1}
          emissive={selected ? COPPER : baseColor}
          emissiveIntensity={istVorschaden ? 0.1 : 0.45}
          metalness={0.1}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

// Meldet einmalig "ready", sobald der erste Frame gerendert wurde. Der
// Watchdog auf der Seite schaltet auf 2D, falls dieses Signal ausbleibt.
function ReadySignal({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    onReady();
  });
  return null;
}

export default function Scene3D({
  items,
  selectedId,
  onPlace,
  onSelect,
  onReady,
}: Scene3DProps) {
  // onReady stabil halten, falls die Seite eine frische Closure uebergibt.
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  const markerItems = useMemo(
    () => items.filter((it) => it.position3d && it.positionMode === '3d'),
    [items],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      camera={{ position: [4.2, 2.8, 4.6], fov: 42, near: 0.1, far: 100 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#0b0d11');
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <ReadySignal onReady={() => readyRef.current()} />

      {/* Lichter: weiches Umgebungslicht + gerichtetes Hauptlicht mit Schatten. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#cfd6e4', '#0b0d11', 0.4]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 4, -4]} intensity={0.35} />

      {/* Boden-Kontaktebene (faengt Schatten, dezent). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0e1219" metalness={0} roughness={1} />
      </mesh>

      <Body selectedId={selectedId} onPlace={onPlace} />

      {markerItems.map((item) => (
        <Marker
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.5}
        maxDistance={12}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0.7, 0]}
      />
    </Canvas>
  );
}
