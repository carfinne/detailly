'use client';

// 3D-Dellenviewer (Smart Repair / PDR). Nutzt DIESELBE Karosserie-Geometrie wie
// der Schadensviewer + die Schichtdicke-Heatmap (./car-body – eine Quelle der
// Wahrheit). Klick auf ein Bauteil liefert partId + Weltpunkt/-normale
// (Raycasting) zum Setzen eines Dellen-Markers. Marker-Groesse codiert die
// Groessenklasse (groesser = groesserer Punkt), Auswahl = Kupfer-Glow. Im
// Hagel-Modus sitzt je Bauteil ein Marker (die Dellen-Anzahl steht im Panel).
//
// Client-only: three.js/WebGL laeuft nie im SSR. Die Seite bindet diese Datei
// ueber next/dynamic({ ssr:false }) ein.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Groessenklasse, Position3D } from '@/lib/types';
import { BODY_COLOR, GLASS_COLOR, PARTS, WHEELS } from './car-body';

/** Kompakter Marker fuer die Szene (unabhaengig vom vollen DellenMarker-Typ). */
export interface DellenSzeneMarker {
  id: string;
  bauteil: string;
  position3d?: Position3D | null;
  groessenklasse?: Groessenklasse | null;
}

export interface Scene3DDellenProps {
  markers: DellenSzeneMarker[];
  /** Aktuell gewaehlter Marker (Kupfer-Glow + Puls). */
  selectedId?: string | null;
  /** Aktuell fokussiertes Bauteil (Kupfer-Emissive auf der Flaeche). */
  selectedPart?: string | null;
  onPlace: (partId: string, position3d: Position3D) => void;
  onSelect: (id: string) => void;
  onReady: () => void;
}

/** Radius je Groessenklasse (aufsteigend – groessere Delle = groesserer Punkt). */
const GROESSEN_RADIUS: Record<Groessenklasse, number> = {
  '1euro': 0.05,
  '2euro': 0.062,
  '5euro': 0.075,
  golfball: 0.09,
  groesser: 0.11,
};

interface SzeneFarben {
  akzent: string;
  klein: string;
  gross: string;
  buehne: string;
}
function leseFarben(): SzeneFarben {
  const styles = getComputedStyle(document.documentElement);
  const rgb = (token: string, fallback: string) => {
    const raw = styles.getPropertyValue(token).trim();
    return raw ? `rgb(${raw.split(/\s+/).join(', ')})` : fallback;
  };
  return {
    akzent: rgb('--copper-500', '#E8923B'),
    // kleine Delle = ruhiges Gruen, grosse = Warnrot (Preis-Intuition).
    klein: rgb('--positive', '#4FB477'),
    gross: rgb('--danger', '#E06A6A'),
    buehne: rgb('--ink-900', '#0b0d11'),
  };
}
function useFarben(): SzeneFarben {
  const [farben, setFarben] = useState<SzeneFarben>(leseFarben);
  useEffect(() => {
    const observer = new MutationObserver(() => setFarben(leseFarben()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-branche'],
    });
    return () => observer.disconnect();
  }, []);
  return farben;
}

function usePrefersReducedMotion(): boolean {
  const [reduziert, setReduziert] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduziert(mq.matches);
    const onChange = () => setReduziert(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduziert;
}

const GROESSEN_ORDER: Groessenklasse[] = ['1euro', '2euro', '5euro', 'golfball', 'groesser'];
/** Farbe je Groessenklasse (linear zwischen klein/gross interpoliert). */
function farbeFuerKlasse(klasse: Groessenklasse | null | undefined, farben: SzeneFarben): string {
  const idx = klasse ? GROESSEN_ORDER.indexOf(klasse) : 0;
  const t = GROESSEN_ORDER.length > 1 ? Math.max(0, idx) / (GROESSEN_ORDER.length - 1) : 0;
  const a = new THREE.Color(farben.klein);
  const b = new THREE.Color(farben.gross);
  return a.lerp(b, t).getStyle();
}

function Body({
  selectedPart,
  akzent,
  onPlace,
}: {
  selectedPart?: string | null;
  akzent: string;
  onPlace: (partId: string, p: Position3D) => void;
}) {
  function handlePlace(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    const partId = e.object.name;
    if (!partId) return;
    const point = e.point;
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
        <meshStandardMaterial color={BODY_COLOR} metalness={0.55} roughness={0.32} />
      </mesh>

      {PARTS.map((part) => {
        const fokus = part.id === selectedPart;
        return (
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
              metalness={part.glass ? 0.1 : 0.55}
              roughness={part.glass ? 0.12 : 0.32}
              transparent={part.glass}
              opacity={part.glass ? 0.55 : 1}
              emissive={fokus ? akzent : '#000000'}
              emissiveIntensity={fokus ? 0.28 : 0}
            />
          </mesh>
        );
      })}

      {WHEELS.map((w, i) => (
        <mesh key={`wheel-${i}`} position={w} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
          <meshStandardMaterial color="#13171f" metalness={0.2} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function GlowHalo({ radius, color, reduziert }: { radius: number; color: string; reduziert: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh || reduziert) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.6) * 0.06;
    mesh.scale.setScalar(s);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius * 1.9, 20, 20]} />
      <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

function Marker({
  marker,
  selected,
  farben,
  reduziert,
  onSelect,
}: {
  marker: DellenSzeneMarker;
  selected: boolean;
  farben: SzeneFarben;
  reduziert: boolean;
  onSelect: (id: string) => void;
}) {
  const p = marker.position3d;
  if (!p) return null;
  const radius = (marker.groessenklasse && GROESSEN_RADIUS[marker.groessenklasse]) || 0.06;
  const baseColor = farbeFuerKlasse(marker.groessenklasse, farben);
  const offset = 0.04;
  const position: [number, number, number] = [
    p.x + p.nx * offset,
    p.y + p.ny * offset,
    p.z + p.nz * offset,
  ];
  return (
    <group position={position}>
      {selected && <GlowHalo radius={radius} color={farben.akzent} reduziert={reduziert} />}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(marker.id);
        }}
      >
        <sphereGeometry args={[radius, 20, 20]} />
        <meshStandardMaterial
          color={selected ? farben.akzent : baseColor}
          emissive={selected ? farben.akzent : baseColor}
          emissiveIntensity={0.45}
          metalness={0.1}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    onReady();
  });
  return null;
}

export default function Scene3DDellen({
  markers,
  selectedId,
  selectedPart,
  onPlace,
  onSelect,
  onReady,
}: Scene3DDellenProps) {
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  const farben = useFarben();
  const reduziert = usePrefersReducedMotion();
  const markerItems = useMemo(() => markers.filter((m) => m.position3d), [markers]);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      camera={{ position: [4.2, 2.8, 4.6], fov: 42, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
      onCreated={() => readyRef.current()}
    >
      <color attach="background" args={[farben.buehne]} />
      <ReadySignal onReady={() => readyRef.current()} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#cfd6e4', farben.buehne, 0.4]} />
      <directionalLight position={[6, 9, 5]} intensity={0.95} />
      <directionalLight position={[-5, 4, -4]} intensity={0.3} />

      <ContactShadows
        position={[0, 0.01, 0]}
        scale={9}
        far={2.2}
        blur={2.6}
        opacity={0.5}
        resolution={512}
        frames={1}
        color={farben.buehne}
      />

      <Body selectedPart={selectedPart} akzent={farben.akzent} onPlace={onPlace} />

      {markerItems.map((m) => (
        <Marker
          key={m.id}
          marker={m}
          selected={m.id === selectedId}
          farben={farben}
          reduziert={reduziert}
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
