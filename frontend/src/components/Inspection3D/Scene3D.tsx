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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { DamageItem, Position3D } from '@/lib/types';
import {
  BODY_COLOR,
  GLASS_COLOR,
  DEFAULT_FAHRZEUGTYP,
  getVehicleGeometry,
  type Fahrzeugtyp,
  type VehicleGeometry,
} from './car-body';
import { VehicleShells, VehicleWheels } from './VehicleDecor';

// --- Design-Tokens fuer three.js -----------------------------------------
// three kennt keine CSS-Variablen, daher lesen wir die Tokens zur Laufzeit
// via getComputedStyle und bauen daraus CSS-Farbstrings ("rgb(r, g, b)").
// So folgen Akzent (Kupfer/Branche), Schweregrad-Farben und Buehne dem
// aktiven Thema – wie FahrzeugDiagramm.tsx mit rgb(var(--...)).

/** Farb-Set der Szene; Fallbacks = bisherige Hex-Werte (dunkles Thema). */
export interface SzeneFarben {
  akzent: string;
  schweregrad: Record<string, string>;
  buehne: string;
  boden: string;
}

function leseSzeneFarben(): SzeneFarben {
  const styles = getComputedStyle(document.documentElement);
  const rgb = (token: string, fallback: string) => {
    const raw = styles.getPropertyValue(token).trim();
    return raw ? `rgb(${raw.split(/\s+/).join(', ')})` : fallback;
  };
  return {
    akzent: rgb('--copper-500', '#E8923B'),
    // 1:1 zu lib/labels SCHWEREGRAD_COLOR (gleiche Tokens).
    schweregrad: {
      leicht: rgb('--positive', '#4FB477'),
      mittel: rgb('--caution', '#E0A93B'),
      schwer: rgb('--danger', '#E06A6A'),
    },
    buehne: rgb('--ink-900', '#0b0d11'),
    boden: rgb('--ink-850', '#101319'),
  };
}

/** Tokens beim Mount lesen und auf Theme-/Branchen-Wechsel reagieren. */
function useSzeneFarben(): SzeneFarben {
  const [farben, setFarben] = useState<SzeneFarben>(leseSzeneFarben);
  useEffect(() => {
    const observer = new MutationObserver(() => setFarben(leseSzeneFarben()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-branche'],
    });
    return () => observer.disconnect();
  }, []);
  return farben;
}

/**
 * Liest die System-Praeferenz "prefers-reduced-motion" und reagiert live auf
 * Aenderungen. Wird genutzt, um die Marker-Pulsation abzuschalten.
 */
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

const SCHWEREGRAD_RADIUS: Record<string, number> = {
  leicht: 0.05,
  mittel: 0.07,
  schwer: 0.095,
};

/**
 * Netzwerkfreies Studio-Setup: statt `<Environment preset>` (laedt HDRIs von der
 * pmndrs-CDN und braeche den statischen Export/CSP) rendern wir INLINE
 * `<Lightformer>`-Flaechen in eine lokale Cubemap. drei leitet `<Environment>`
 * mit Kindern (ohne preset/files/map) auf den EnvironmentPortal um – alles wird
 * offline berechnet. Ergebnis: glaubwuerdige Softbox-Reflexe auf dem Lack.
 *
 * `frames={1}` backt die Cubemap EINMALIG (die Lichter sind statisch) – kein
 * Render pro Frame, daher kein Performance-Leck.
 */
function StudioUmgebung() {
  return (
    <Environment resolution={256} frames={1}>
      {/* Dunkle Studio-"Wand" als Reflexionsgrund, damit die Softboxen als helle
          Streifen auf dem Lack lesbar bleiben. */}
      <color attach="background" args={['#0a0c10']} />
      {/* Grosses, weiches Oberlicht (Key) – der breite Glanz auf Dach/Haube. */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#ffffff"
        position={[0, 6, 1]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[8, 8, 1]}
      />
      {/* Seitliche Softbox-Streifen – die wandernden Reflexe entlang der Flanken. */}
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#f4f7ff"
        position={[-5, 1.6, 1]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 1.2, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#f4f7ff"
        position={[5, 1.6, -1]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 1.2, 1]}
      />
      {/* Duenner Streifen vorn – setzt eine scharfe Glanzkante auf Haube/Scheibe. */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#ffffff"
        position={[0, 2.2, 5]}
        rotation={[Math.PI / 6, 0, 0]}
        scale={[5, 0.5, 1]}
      />
      {/* Warmer, dezenter Rim von hinten – trennt die Karosserie vom Hintergrund. */}
      <Lightformer
        form="rect"
        intensity={0.7}
        color="#ffe9d2"
        position={[0, 2, -5]}
        rotation={[-Math.PI / 8, Math.PI, 0]}
        scale={[5, 1, 1]}
      />
    </Environment>
  );
}

// Karosserie-Geometrie (PARTS/WHEELS/PART_GEOMETRY) + Lacktoene (BODY_COLOR/
// GLASS_COLOR) liegen zentral in ./car-body und werden von der Schichtdicke-
// Heatmap mitgenutzt.

export interface Scene3DProps {
  items: DamageItem[];
  selectedId?: string | null;
  /**
   * Zusaetzlich hervorgehobene Bauteile (kanonische partIds). Genutzt im
   * Kalkulieren-Modus, um alle gewaehlten Bauteile gleichzeitig farblich zu
   * markieren. Undefiniert = kein Effekt (unveraendertes Schaden-Verhalten).
   */
  selectedParts?: string[];
  /** Fahrzeugtyp steuert die geladene Karosserie-Geometrie (Default = Limousine). */
  fahrzeugtyp?: Fahrzeugtyp;
  onPlace: (partId: string, position3d: Position3D) => void;
  onSelect: (id: string) => void;
  onReady: () => void;
}

function Body({
  geo,
  selectedId,
  selectedParts,
  akzent,
  onPlace,
}: {
  geo: VehicleGeometry;
  selectedId?: string | null;
  selectedParts?: string[];
  akzent: string;
  onPlace: (partId: string, p: Position3D) => void;
}) {
  // Mehrfach-Auswahl (Kalkulieren-Modus) als Set fuer schnelle Lookups.
  const highlightSet = useMemo(() => new Set(selectedParts ?? []), [selectedParts]);
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
      {/* Grundkoerper (Fahrgastzelle/Unterboden) – nicht klickbar, nur Masse.
          Gerundete Kanten (RoundedBox) statt Klotz -> weiche Karosserie-Silhouette.
          Lack-Werte identisch zu den Bauteilen (glaenzender Klarlack). */}
      <RoundedBox
        args={geo.base.size}
        radius={geo.base.radius}
        smoothness={4}
        position={geo.base.pos}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={BODY_COLOR} metalness={0.55} roughness={0.32} envMapIntensity={1.1} />
      </RoundedBox>

      {/* Klickbare, benannte Bauteile. name === partId ist die fachliche Wahrheit.
          RoundedBox behaelt den Mesh-Namen + Pointer-Events, liefert aber weiche
          Kanten je Bauteil (kein Minecraft-Look). */}
      {geo.parts.map((part) => (
        <RoundedBox
          key={part.id}
          name={part.id}
          args={part.size}
          radius={part.radius}
          smoothness={4}
          position={part.pos}
          onPointerDown={handlePlace}
          castShadow
          receiveShadow
        >
          {/* Lack: hoehere Metalness + niedrige Roughness => scharfe Softbox-
              Reflexe aus der Studio-Umgebung (Klarlack-Optik). Glas bleibt
              glasklar. */}
          <meshStandardMaterial
            color={part.glass ? GLASS_COLOR : BODY_COLOR}
            metalness={part.glass ? 0.1 : 0.55}
            roughness={part.glass ? 0.12 : 0.32}
            envMapIntensity={part.glass ? 1.4 : 1.1}
            transparent={part.glass}
            opacity={part.glass ? 0.55 : 1}
            emissive={part.id === selectedId || highlightSet.has(part.id) ? akzent : '#000000'}
            emissiveIntensity={part.id === selectedId || highlightSet.has(part.id) ? 0.25 : 0}
          />
        </RoundedBox>
      ))}

      {/* Raeder + Zusatz-Deko (Pickup-Ladeflaeche) – reine Deko, nicht klickbar. */}
      <VehicleWheels wheels={geo.wheels} />
      <VehicleShells shells={geo.shells} />
    </group>
  );
}

/**
 * Akzent-Glow-Halo des ausgewaehlten Markers. Bekommt via `useFrame` einen
 * dezenten Scale-Puls (Aufmerksamkeit ohne Kitsch). Bei prefers-reduced-motion
 * bleibt der Halo statisch. useFrame laeuft nur, solange EIN Marker gewaehlt ist
 * (die Komponente wird nur dann gemountet) – kein Dauer-Overhead.
 */
function GlowHalo({
  radius,
  color,
  reduziert,
}: {
  radius: number;
  color: string;
  reduziert: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh || reduziert) return;
    // Sanfter Puls um 1.0 (+/-6 %), ~1,3 Zyklen/s.
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
  item,
  selected,
  farben,
  reduziert,
  onSelect,
}: {
  item: DamageItem;
  selected: boolean;
  farben: SzeneFarben;
  reduziert: boolean;
  onSelect: (id: string) => void;
}) {
  const p = item.position3d;
  if (!p) return null;

  const istVorschaden = item.origin === 'vorschaden';
  const baseColor = farben.schweregrad[item.schweregrad] ?? farben.akzent;
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
      {/* Akzent-Glow-Halo bei Auswahl (der EINE Akzent fuer "aktiv"), mit Puls. */}
      {selected && <GlowHalo radius={radius} color={farben.akzent} reduziert={reduziert} />}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(item.id);
        }}
      >
        <sphereGeometry args={[radius, 20, 20]} />
        {/* Vorschaden = entsaettigt + hohl (wireframe); Neuschaden = voll. */}
        <meshStandardMaterial
          color={selected ? farben.akzent : baseColor}
          wireframe={istVorschaden}
          transparent={istVorschaden}
          opacity={istVorschaden ? 0.7 : 1}
          emissive={selected ? farben.akzent : baseColor}
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
  selectedParts,
  fahrzeugtyp,
  onPlace,
  onSelect,
  onReady,
}: Scene3DProps) {
  // onReady stabil halten, falls die Seite eine frische Closure uebergibt.
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  // Karosserie-Geometrie je Fahrzeugtyp (gecacht). Wechsel = reiner Prop-Update
  // auf die per part.id gekeyten Meshes -> fluessig, kein Remount.
  const geo = useMemo(
    () => getVehicleGeometry(fahrzeugtyp ?? DEFAULT_FAHRZEUGTYP),
    [fahrzeugtyp],
  );

  const markerItems = useMemo(
    () => items.filter((it) => it.position3d && it.positionMode === '3d'),
    [items],
  );

  // Theme-/Branchen-Farben (reagiert live auf data-theme/data-branche).
  const farben = useSzeneFarben();
  // Puls des Auswahl-Halos nur bei erlaubter Bewegung.
  const reduziert = usePrefersReducedMotion();

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      camera={{ position: [4.2, 2.8, 4.6], fov: 42, near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%' }}
      // Hinweis (Integration Paket 3): Der frameloop="demand"-Quickwin aus PR
      // #235 wurde hier BEWUSST weggelassen. Er entstand gegen eine aeltere,
      // quasi-statische Szene; die inzwischen ergaenzte GlowHalo-Puls-Animation
      // (useFrame/clock, s.o.) braucht den kontinuierlichen Render-Loop. "demand"
      // wuerde den Puls einfrieren -> sichtbare Regression. Default-frameloop
      // ("always") bleibt daher bestehen.
      // Bereitschaft ZUVERLAESSIG bei WebGL-Context-Erstellung melden – unabhaengig
      // vom Render-Loop. `useFrame` (ReadySignal) feuert nicht, wenn der Tab/Canvas
      // beim Mounten nicht sichtbar ist (r3f drosselt) -> onReady blieb aus, der
      // Seiten-Watchdog fiel auf 2D bzw. es "haengt" bis zum Reload. onCreated
      // laeuft synchron beim Setup und behebt genau das.
      onCreated={() => readyRef.current()}
    >
      {/* Buehnen-Hintergrund als Element statt onCreated: folgt Theme-Wechseln. */}
      <color attach="background" args={[farben.buehne]} />

      <ReadySignal onReady={() => readyRef.current()} />

      {/* Studio-Reflexionen (netzwerkfrei, inline Lightformer) – Basis fuer die
          Lack-Glanzlichter. */}
      <StudioUmgebung />

      {/* Direktlicht behutsam auf die Umgebung abgestimmt: die Environment-IBL
          liefert nun das weiche Grundlicht, daher weniger Ambient. Kein
          Schatten-Map mehr – geerdet wird ueber ContactShadows. */}
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#cfd6e4', farben.buehne, 0.35]} />
      <directionalLight position={[6, 9, 5]} intensity={0.9} />
      <directionalLight position={[-5, 4, -4]} intensity={0.3} />

      {/* Kontaktschatten statt Boden-Plane: das Fahrzeug steht geerdet, rein
          berechnet (keine Textur/Asset). `frames={1}` backt den Schatten einmal
          – die Karosserie ist statisch, kein Render pro Frame. */}
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

      <Body geo={geo} selectedId={selectedId} selectedParts={selectedParts} akzent={farben.akzent} onPlace={onPlace} />

      {markerItems.map((item) => (
        <Marker
          key={item.id}
          item={item}
          selected={item.id === selectedId}
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
