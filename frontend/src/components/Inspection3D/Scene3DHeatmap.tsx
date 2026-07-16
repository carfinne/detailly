'use client';

// 3D-Schichtdicke-Heatmap. Nutzt dieselbe Karosserie-Geometrie wie der
// Schadensviewer (./car-body), faerbt aber jedes Bauteil nach seinem
// Ampel-Status (µm-Bewertung) statt Marker zu setzen. Ungemessene Bauteile
// bleiben neutral-grau (klar von "normal" unterscheidbar). Klick auf ein Bauteil
// liefert partId + Weltpunkt/-normale (Raycasting) zum Setzen eines Messpunktes.
//
// Client-only: three.js/WebGL laeuft nie im SSR. Die Seite bindet diese Datei
// ueber next/dynamic({ ssr:false }) ein.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Position3D } from '@/lib/types';
import { BODY_COLOR, GLASS_COLOR, PARTS, WHEELS } from './car-body';
import { AMPEL_TOKEN, type AmpelStatus } from '@/lib/layer-norm-profiles';

export interface Scene3DHeatmapProps {
  /** Ampel-Status je (kanonischer) partId. Fehlt einer -> unbemessen/grau. */
  statusByPart: Record<string, AmpelStatus>;
  /** Bestehende Messpunkte (fuer kleine Marker auf der Oberflaeche). */
  points: { id: string; partId: string; position3d?: Position3D | null }[];
  /** Aktuell fokussiertes Bauteil (Kupfer-Glow). */
  selectedPart?: string | null;
  onPlace: (partId: string, position3d: Position3D) => void;
  onReady: () => void;
}

/** Liest Ampel-/Buehnen-Farben aus den CSS-Tokens (folgt Theme/Branche). */
interface HeatFarben {
  ampel: Record<AmpelStatus, string>;
  akzent: string;
  buehne: string;
  boden: string;
}
function leseFarben(): HeatFarben {
  const styles = getComputedStyle(document.documentElement);
  const rgb = (token: string, fallback: string) => {
    const raw = styles.getPropertyValue(token).trim();
    return raw ? `rgb(${raw.split(/\s+/).join(', ')})` : fallback;
  };
  const ampel = {} as Record<AmpelStatus, string>;
  (Object.keys(AMPEL_TOKEN) as AmpelStatus[]).forEach((s) => {
    ampel[s] = rgb(AMPEL_TOKEN[s], '#8a93a3');
  });
  return {
    ampel,
    akzent: rgb('--copper-500', '#E8923B'),
    buehne: rgb('--ink-900', '#0b0d11'),
    boden: rgb('--ink-850', '#101319'),
  };
}

function useFarben(): HeatFarben {
  const [farben, setFarben] = useState<HeatFarben>(leseFarben);
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

function Body({
  statusByPart,
  selectedPart,
  farben,
  onPlace,
}: {
  statusByPart: Record<string, AmpelStatus>;
  selectedPart?: string | null;
  farben: HeatFarben;
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
        <meshStandardMaterial color={BODY_COLOR} metalness={0.3} roughness={0.6} />
      </mesh>

      {PARTS.map((part) => {
        const status: AmpelStatus = part.glass
          ? 'unbemessen'
          : statusByPart[part.id] ?? 'unbemessen';
        const flaeche = part.glass ? GLASS_COLOR : farben.ampel[status];
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
              color={flaeche}
              metalness={part.glass ? 0.1 : 0.25}
              roughness={part.glass ? 0.15 : 0.6}
              transparent={part.glass}
              opacity={part.glass ? 0.5 : 1}
              emissive={fokus ? farben.akzent : '#000000'}
              emissiveIntensity={fokus ? 0.3 : 0}
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

/** Kleiner Marker je erfasstem Messpunkt (auf der Oberflaeche angehoben). */
function PunktMarker({ position3d, akzent }: { position3d: Position3D; akzent: string }) {
  const p = position3d;
  const offset = 0.04;
  const position: [number, number, number] = [
    p.x + p.nx * offset,
    p.y + p.ny * offset,
    p.z + p.nz * offset,
  ];
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshStandardMaterial color={akzent} emissive={akzent} emissiveIntensity={0.4} />
    </mesh>
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

export default function Scene3DHeatmap({
  statusByPart,
  points,
  selectedPart,
  onPlace,
  onReady,
}: Scene3DHeatmapProps) {
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  const farben = useFarben();
  const markerPoints = useMemo(
    () => points.filter((p) => p.position3d && p.position3d != null),
    [points],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      camera={{ position: [4.2, 2.8, 4.6], fov: 42, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
      onCreated={() => readyRef.current()}
    >
      <color attach="background" args={[farben.buehne]} />
      <ReadySignal onReady={() => readyRef.current()} />

      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#cfd6e4', farben.buehne, 0.4]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 4, -4]} intensity={0.35} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={farben.boden} metalness={0} roughness={1} />
      </mesh>

      <Body
        statusByPart={statusByPart}
        selectedPart={selectedPart}
        farben={farben}
        onPlace={onPlace}
      />

      {markerPoints.map((p) => (
        <PunktMarker key={p.id} position3d={p.position3d as Position3D} akzent={farben.akzent} />
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
