'use client';

// Geteilte, rein DEKORATIVE 3D-Elemente der Karosserie: Raeder (mit angedeuteter
// Felge) und Zusatzflaechen (z. B. Pickup-Ladeflaeche). Nicht klickbar – die
// fachliche Wahrheit sind die benannten Bauteil-Meshes je Szene. Zentral, damit
// Schadens-/Dellen-/Heatmap-Szene nie divergieren.

import { RoundedBox } from '@react-three/drei';
import { BODY_COLOR, GLASS_COLOR, type ShellSpec, type WheelSpec } from './car-body';

/** Raeder je Fahrzeugtyp – Reifen (dunkel) + angedeutete Felge (heller Hub). */
export function VehicleWheels({ wheels }: { wheels: WheelSpec[] }) {
  return (
    <>
      {wheels.map((w, i) => (
        <group key={`wheel-${i}`} position={[w.x, w.y, w.z]}>
          {/* Reifen */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[w.r, w.r, w.width, 28]} />
            <meshStandardMaterial color="#13171f" metalness={0.2} roughness={0.8} />
          </mesh>
          {/* Felge/Hub – dezenter Metallkern, hebt das Rad vom Klotz-Look ab. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[w.r * 0.5, w.r * 0.5, w.width + 0.02, 20]} />
            <meshStandardMaterial color="#8a93a3" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * Zusatz-Deko (z. B. Pickup-Ladeflaeche). Rundboxen im Lackton (oder Glas).
 * `color` erlaubt der Heatmap-Szene einen neutralen Ton statt des Lacks.
 */
export function VehicleShells({
  shells,
  color = BODY_COLOR,
}: {
  shells: ShellSpec[];
  color?: string;
}) {
  return (
    <>
      {shells.map((s, i) => (
        <RoundedBox
          key={`shell-${i}`}
          args={s.size}
          radius={s.radius}
          smoothness={4}
          position={s.pos}
          rotation={s.rot}
          castShadow
          receiveShadow
        >
          {/* Glas-Shells (Fensterband/Fahrgastzelle): glaenzend-dunkel getoent und
              NAHEZU deckend. So liest die Fahrgastzelle als geschlossenes, dunkles
              Greenhouse (Dach ruht sichtbar auf der Zelle) statt als durchsichtiger
              Kasten mit "schwebendem" Dach. Opake Shells (z. B. Pickup-Ladeflaeche)
              bleiben unveraendert. */}
          <meshStandardMaterial
            color={s.glass ? GLASS_COLOR : color}
            metalness={s.glass ? 0.35 : 0.45}
            roughness={s.glass ? 0.08 : 0.45}
            transparent={s.glass}
            opacity={s.glass ? 0.9 : 1}
          />
        </RoundedBox>
      ))}
    </>
  );
}
