'use client';

// 3D-Showcase „Holo-Annahme" für die Landingpage: ein markenneutrales, rein
// prozedurales Sportcoupé (Shape + Extrude, keine Assets) als additives
// Hologramm. Ein Scan-Lichtvorhang „materialisiert" die Karosserie, drei
// Schadens-Pins poppen kausal auf, sobald die Scanlinie sie passiert.
// Signature-Feature: die Akzentfarben kommen zur Laufzeit aus den CSS-Tokens
// (--copper-*, --ink-950), gelesen am eigenen Container — der Branchen-
// Switcher der Seite färbt das Modell live um (Kupfer -> Ultraviolett
// -> Eis-Teal), inszeniert als schneller Re-Scan. Scan-Kante und Glas-Tint
// sind bewusst theme-FEST (wie der Backdrop): ihre Tokens kehren im
// Hell-Thema die Semantik um (s. Token-Bridge). Der Canvas rendert flat +
// linear (kein Tonemapping, keine Ausgabekonvertierung), damit Custom-Shader
// und eingebaute Materialien exakt dieselben Tokenwerte anzeigen.
//
// Client-only: three.js/WebGL läuft nie im SSR. Die Seite bindet diese Datei
// über next/dynamic({ ssr:false }) ein. Der Canvas mountet erst, wenn die
// Sektion in Viewport-Nähe kommt (IntersectionObserver) UND WebGL verfügbar
// ist; sonst — oder wenn der erste Frame ausbleibt (Watchdog 2500 ms) —
// bleibt der 2D-Fallback (Prop) sichtbar. Rendering pausiert offscreen und
// bei verstecktem Tab; Reduced Motion liefert ein statisches Standbild.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

/* ============================== Motion-Helfer ============================== */

// Gleiche Logik wie motionOk() in app/page.tsx (dort nicht exportiert):
// System-Präferenz UND persönliche Einstellung (html.dl-reduce-motion).
function motionOk(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !document.documentElement.classList.contains('dl-reduce-motion')
  );
}

/* ============================= Easing-Helfer ============================== */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutQuad = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
// Back-Overshoot (~1.15 bei 60 %) — gleiche Sprache wie die CSS-.gpin-Pins.
function easeOutBack(x: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/* ============================== Token-Bridge ============================== */

// Liest einen Farb-Token im Kanal-Format "R G B" (globals.css) — NIE als Hex
// parsen. Die Kanäle werden UNKONVERTIERT übernommen (NoColorSpace): der
// Canvas läuft flat + linear, d. h. weder sRGB->linear-Eingangs- noch
// linear->sRGB-Ausgangskonvertierung, kein Tonemapping. Nur so schreiben die
// Custom-Shader (ohne colorspace_/tonemapping_fragment-Chunks) und die
// eingebauten Materialien (Konturen/Felgen/Pins) denselben Token EXAKT
// gleich in den Framebuffer — WYSIWYG zu den CSS-Farben der Seite.
// Fällt bei unerwartetem Format auf die Kupfer-Defaults zurück.
function tokenFarbe(cs: CSSStyleDeclaration, name: string, fallbackHex: string): THREE.Color {
  const teile = cs.getPropertyValue(name).trim().split(/\s+/).map(Number);
  const c = new THREE.Color();
  if (teile.length >= 3 && teile.every((n) => Number.isFinite(n))) {
    c.setRGB(teile[0] / 255, teile[1] / 255, teile[2] / 255, THREE.NoColorSpace);
  } else {
    c.set(fallbackHex);
  }
  return c;
}

// Ein Farb-Slot: „farbe" ist die LIVE-Instanz (von Materialien/Uniforms
// geteilt), „alt"/„ziel" dienen der 0,9-s-Überblendung beim Branchenwechsel.
type FarbSlot = { farbe: THREE.Color; alt: THREE.Color; ziel: THREE.Color };
const neuerSlot = (hex: string): FarbSlot => ({
  farbe: new THREE.Color(hex),
  alt: new THREE.Color(hex),
  ziel: new THREE.Color(hex),
});

/* ============================ Shader (unlit) ============================== */

// Fresnel-Shell: Kanten glimmen, Fläche bleibt dünn. uScanX = aktuelle
// Scanlinie (Farb-Mix + helle Kante), uMatX = Materialisierungs-Front (nur
// beim ersten Scan-Pass; danach eingefroren bei +2.8, damit Re-Sweeps das
// Auto nicht wieder „entmaterialisieren").
const SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vLocalX;
  void main() {
    vNormal = normalMatrix * normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = -mv.xyz;
    vLocalX = position.x; // LOKALES x: Scan läuft längs der Karosserie, auch wenn die Gruppe gedreht ist
    gl_Position = projectionMatrix * mv;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uEdgeColor;
  uniform vec3 uTint;
  uniform float uTintGain;
  uniform float uBasis;
  uniform float uScanX;
  uniform float uMatX;
  uniform float uReveal;
  uniform float uPulse;
  uniform float uBand;
  uniform float uGeist;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vLocalX;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.4);
    float hinterFarbe = smoothstep(uScanX + 0.06, uScanX - 0.22, vLocalX);
    float hinterMat = smoothstep(uMatX + 0.06, uMatX - 0.22, vLocalX);
    vec3 col = mix(uColorA, uColorB, hinterFarbe) * uTint * uTintGain;
    float band = smoothstep(0.28, 0.0, abs(vLocalX - uScanX)) * uBand;
    vec3 rgb = col * (0.25 + fres * 1.15) * uPulse + uEdgeColor * band * 0.35;
    float alpha = (uBasis + fres * 0.5 + band * 0.4) * uReveal * mix(uGeist, 1.0, hinterMat);
    gl_FragColor = vec4(rgb, alpha);
  }
`;

// Datenpunkte: Mini-Shader, Punkte erscheinen hinter der Materialisierungs-
// Front und schimmern leise im Idle.
const PUNKTE_VERTEX = /* glsl */ `
  uniform float uDpr;
  varying float vX;
  void main() {
    vX = position.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.5 * uDpr;
    gl_Position = projectionMatrix * mv;
  }
`;

const PUNKTE_FRAGMENT = /* glsl */ `
  uniform vec3 uFarbe;
  uniform float uMatX;
  uniform float uTime;
  uniform float uReveal;
  varying float vX;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard; // runde Punkte
    float hinter = smoothstep(uMatX + 0.06, uMatX - 0.22, vX);
    float alpha = hinter * 0.65 * (0.85 + 0.15 * sin(uTime * 1.2)) * uReveal;
    gl_FragColor = vec4(uFarbe, alpha);
  }
`;

/* ============================ Schadens-Pins =============================== */

// Lokale Koordinaten (Kameraseite +Z). Poppen kausal, sobald die Scanlinie
// ihre x-Position passiert — kein Timer.
const PINS: { pos: [number, number, number]; label: string }[] = [
  { pos: [1.35, 0.55, 0.8], label: 'Steinschlag · 2 Fotos' },
  { pos: [0.1, 0.62, 0.84], label: 'Kratzer · Tür links' },
  { pos: [-1.45, 0.58, 0.78], label: 'Delle · dokumentiert' },
];

type PinZustand = { erschienen: boolean; popStart: number; hoverScale: number };

/* ======================= Eingabe (Parallax + Drag) ======================== */

// Wird vom Container (Outer-Komponente) beschrieben und von der Szene pro
// Frame gelesen — kein React-State im Renderpfad.
type Eingabe = {
  parallax: { yaw: number; pitch: number };
  drag: { aktiv: boolean; yaw: number; vel: number; letztesX: number };
  letzteEingabe: number; // performance.now() — pausiert die Idle-Gier für 3 s
};

/* ============================== Geometrien =============================== */

// Seitenprofil des Coupés als Shape in XY (gegen den Uhrzeigersinn, Radläufe
// als Teil der Außenkontur — keine Löcher, keine Triangulations-Artefakte).
// Länge 4,4 auf X, Front = +X: lange flache Haube, schnelle Scheibe, Fastback.
function karosserieShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-2.2, 0.3);
  s.lineTo(-1.91, 0.3);
  s.absarc(-1.45, 0.3, 0.46, Math.PI, 0, true); // hinterer Radausschnitt
  s.lineTo(0.99, 0.3);
  s.absarc(1.45, 0.3, 0.46, Math.PI, 0, true); // vorderer Radausschnitt
  s.lineTo(2.08, 0.3);
  s.quadraticCurveTo(2.24, 0.34, 2.2, 0.5); // Nase
  s.quadraticCurveTo(2.0, 0.6, 1.15, 0.66); // lange flache Haube
  s.quadraticCurveTo(0.55, 0.72, 0.28, 0.94); // schnelle Frontscheibe
  s.quadraticCurveTo(0.0, 1.06, -0.4, 1.05); // Dachbogen
  s.quadraticCurveTo(-1.1, 0.98, -1.7, 0.72); // Fastback
  s.quadraticCurveTo(-2.05, 0.62, -2.16, 0.52); // Abrisskante
  s.lineTo(-2.2, 0.3);
  s.closePath();
  return s;
}

// Glaskanzel: sitzt auf der Gürtellinie, schmaler als der Rumpf.
function kanzelShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.35, 0.7);
  s.quadraticCurveTo(0.14, 0.78, 0.05, 0.95);
  s.quadraticCurveTo(-0.15, 1.01, -0.45, 1.0);
  s.quadraticCurveTo(-1.05, 0.93, -1.5, 0.71);
  s.lineTo(0.35, 0.7);
  s.closePath();
  return s;
}

// Extrudiert, zentriert und säubert ein Profil. mergeVertices ist PFLICHT:
// ExtrudeGeometry liefert unverschweisste Flächen -> ohne Merge zerfällt der
// Fresnel-Falloff in Facetten.
function extrudiertesProfil(shape: THREE.Shape, optionen: THREE.ExtrudeGeometryOptions, tiefe: number): THREE.BufferGeometry {
  const roh = new THREE.ExtrudeGeometry(shape, optionen);
  roh.translate(0, 0, -tiefe / 2);
  const sauber = mergeVertices(roh, 1e-4);
  roh.dispose();
  sauber.computeVertexNormals();
  return sauber;
}

// 1400 (Desktop) bzw. 800 (Touch, Overdraw-Budget) Oberflächenpunkte.
// Fallback, falls der Sampler-Import wider Erwarten fehlt: vorhandene
// Vertices der Karosserie ausdünnen.
function punkteGeometrie(bodyGeo: THREE.BufferGeometry, anzahl: number): THREE.BufferGeometry {
  const positionen = new Float32Array(anzahl * 3);
  try {
    const probeMat = new THREE.MeshBasicMaterial();
    const probeMesh = new THREE.Mesh(bodyGeo, probeMat);
    const sampler = new MeshSurfaceSampler(probeMesh).build();
    const v = new THREE.Vector3();
    for (let i = 0; i < anzahl; i++) {
      sampler.sample(v);
      positionen[i * 3] = v.x;
      positionen[i * 3 + 1] = v.y;
      positionen[i * 3 + 2] = v.z;
    }
    probeMat.dispose();
  } catch {
    const quelle = bodyGeo.getAttribute('position');
    for (let i = 0; i < anzahl; i++) {
      const q = (i * 7) % quelle.count; // Primzahl-Schritt: gleichmäßiger verteilt
      positionen[i * 3] = quelle.getX(q);
      positionen[i * 3 + 1] = quelle.getY(q);
      positionen[i * 3 + 2] = quelle.getZ(q);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positionen, 3));
  return geo;
}

// Radialer Verlauf als CanvasTexture (Kontaktschatten + dunkler Backdrop) —
// kein Shadow-Mapping, keine externen Assets.
function radialTextur(breite: number, hoehe: number, innen: string, aussen: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(breite / 2, hoehe / 2, 2, breite / 2, hoehe / 2, breite / 2);
    g.addColorStop(0, innen);
    g.addColorStop(1, aussen);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, breite, hoehe);
  }
  return new THREE.CanvasTexture(c);
}

/* ================================ Szene =================================== */

type Scan = { art: 'erst' | 'resweep' | 'branche' | null; start: number; dauer: number };

interface SzenenProps {
  containerRef: RefObject<HTMLDivElement>;
  branche: string;
  reduziert: boolean;
  eingabe: MutableRefObject<Eingabe>;
  onErsterFrame: () => void;
  onPings?: (anzahl: number) => void;
}

function HoloSzene({ containerRef, branche, reduziert, eingabe, onErsterFrame, onPings }: SzenenProps) {
  const { camera, gl, invalidate } = useThree();

  // Callbacks stabil halten (frische Closures der Seite nicht in useFrame ziehen).
  const readyRef = useRef(onErsterFrame);
  const pingsRef = useRef(onPings);
  useEffect(() => {
    readyRef.current = onErsterFrame;
    pingsRef.current = onPings;
  }, [onErsterFrame, onPings]);

  /* ---- Farb-Slots: eine geteilte Color-Instanz je Rolle (Token-Bridge) ---- */
  const slots = useMemo(
    () => ({
      kern: neuerSlot('#F2B877'), // --copper-300 · Ping-Kerne
      kontur: neuerSlot('#EDA455'), // --copper-400 · Konturlinien/Felgen
      akzent: neuerSlot('#E8923B'), // --copper-500 · Shell/Punkte/Vorhang
      kante: neuerSlot('#F4F6FA'), // Scan-Kante — theme-fest (s. Token-Bridge)
      reifen: neuerSlot('#070809'), // --ink-950    · Reifen (in beiden Themes dunkel)
      glas: neuerSlot('#1B202B'), // Glas-Tint — theme-fest (s. Token-Bridge)
    }),
    [],
  );

  /* --------------------------- Geometrien (memo) --------------------------- */
  const geo = useMemo(() => {
    const body = extrudiertesProfil(
      karosserieShape(),
      { depth: 1.46, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelOffset: -0.02, bevelSegments: 4, curveSegments: 20 },
      1.46,
    );
    const kanzel = extrudiertesProfil(
      kanzelShape(),
      { depth: 1.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelOffset: 0, bevelSegments: 3, curveSegments: 16 },
      1.3,
    );
    // Blueprint-Konturen: Threshold-Fenster 15–25° hält Radläufe/Bevel ruhig.
    const bodyKontur = new THREE.EdgesGeometry(body, 18);
    const kanzelKontur = new THREE.EdgesGeometry(kanzel, 20);
    const grob = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    const punkte = punkteGeometrie(body, grob ? 800 : 1400);
    return {
      body,
      kanzel,
      bodyKontur,
      kanzelKontur,
      punkte,
      rad: new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28),
      felge: new THREE.TorusGeometry(0.3, 0.012, 8, 48),
      nabe: new THREE.SphereGeometry(0.03, 12, 12),
      pinKern: new THREE.SphereGeometry(0.045, 16, 16),
      pinRing: new THREE.RingGeometry(0.05, 0.07, 48),
      vorhang: new THREE.PlaneGeometry(2.2, 1.3),
      vorhangKante: new THREE.BoxGeometry(0.02, 1.3, 2.2), // führende Scan-Kante als dünne Scheibe
      schatten: new THREE.PlaneGeometry(3.4, 1.6),
      backdrop: new THREE.PlaneGeometry(7, 4),
    };
  }, []);

  /* ------------------------- Texturen & Materialien ------------------------ */
  const tex = useMemo(
    () => ({
      // Kontaktschatten: dunkler Anker unter dem Wagen.
      schatten: radialTextur(128, 64, 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)'),
      // Backdrop (Risiko R1): definierter dunkler Grund hinter dem additiven
      // Hologramm — bewusst fest in ink-950-Dunkel, unabhängig vom Theme.
      backdrop: radialTextur(256, 128, 'rgba(7,8,9,1)', 'rgba(7,8,9,0)'),
    }),
    [],
  );

  const weissTint = useMemo(() => new THREE.Color('#ffffff'), []);
  // uColorA = alte Akzentfarbe (vor der Scanlinie), uColorB = neue (dahinter).
  const farbeA = useMemo(() => new THREE.Color('#E8923B'), []);
  const farbeB = useMemo(() => new THREE.Color('#E8923B'), []);

  const mats = useMemo(() => {
    const shellUniforms = (basis: number, tint: THREE.Color, gain: number) => ({
      uColorA: { value: farbeA },
      uColorB: { value: farbeB },
      uEdgeColor: { value: slots.kante.farbe },
      uTint: { value: tint },
      uTintGain: { value: gain },
      uBasis: { value: basis },
      uScanX: { value: -2.8 },
      uMatX: { value: -2.8 },
      uReveal: { value: 0 },
      uPulse: { value: 1 },
      uBand: { value: 1 },
      // „Geist"-Faktor: vor der Materialisierungs-Front bleibt eine hauchdünne
      // Ghost-Shell sichtbar (0.18), damit der Scan etwas zum Enthüllen hat.
      uGeist: { value: 0.18 },
    });
    const holo = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

    const shellBody = new THREE.ShaderMaterial({
      uniforms: shellUniforms(0.05, weissTint, 1.0),
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      side: THREE.FrontSide,
      ...holo,
    });
    // Glas: dunklerer Tint Richtung --ink-750 (aufgehellt, sonst frisst der
    // Multiplikator die Farbe) + etwas mehr Grundopazität -> liest als Glas.
    const shellGlas = new THREE.ShaderMaterial({
      uniforms: shellUniforms(0.13, slots.glas.farbe, 3.0),
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      side: THREE.FrontSide,
      ...holo,
    });
    const punkte = new THREE.ShaderMaterial({
      uniforms: {
        uFarbe: { value: slots.akzent.farbe },
        uMatX: { value: -2.8 },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uDpr: { value: 1 },
      },
      vertexShader: PUNKTE_VERTEX,
      fragmentShader: PUNKTE_FRAGMENT,
      ...holo,
    });
    const kontur = new THREE.LineBasicMaterial({ opacity: 0, ...holo });
    kontur.color = slots.kontur.farbe;
    const felge = new THREE.MeshBasicMaterial({ opacity: 0.5, ...holo });
    felge.color = slots.kontur.farbe;
    const nabe = new THREE.MeshBasicMaterial({ opacity: 0.8, ...holo });
    nabe.color = slots.kern.farbe;
    // Reifen NORMAL geblendet: der dunkle Anker verhindert ein „schwebendes" Auto.
    const reifen = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
    reifen.color = slots.reifen.farbe;
    const vorhang = new THREE.MeshBasicMaterial({ opacity: 0, side: THREE.DoubleSide, ...holo });
    vorhang.color = slots.akzent.farbe;
    const vorhangKante = new THREE.MeshBasicMaterial({ opacity: 0, ...holo });
    vorhangKante.color = slots.kante.farbe;
    const pinKern = new THREE.MeshBasicMaterial({ opacity: 0.95, ...holo });
    pinKern.color = slots.kern.farbe;
    // Radar-Ringe: eigenes Material je Ring (Opacity animiert einzeln),
    // Farbinstanz geteilt -> Branchenwechsel färbt alle mit.
    const ringe = PINS.flatMap(() =>
      [0, 1].map(() => {
        const m = new THREE.MeshBasicMaterial({ opacity: 0, side: THREE.DoubleSide, ...holo });
        m.color = slots.akzent.farbe;
        return m;
      }),
    );
    const schatten = new THREE.MeshBasicMaterial({ map: tex.schatten, transparent: true, depthWrite: false });
    const backdrop = new THREE.MeshBasicMaterial({ map: tex.backdrop, transparent: true, opacity: 0.45, depthWrite: false });
    return { shellBody, shellGlas, punkte, kontur, felge, nabe, reifen, vorhang, vorhangKante, pinKern, ringe, schatten, backdrop };
  }, [slots, tex, weissTint, farbeA, farbeB]);

  // Podium: PolarGridHelper, auf eine einzige Akzentfarbe umgestellt.
  const podium = useMemo(() => {
    const helper = new THREE.PolarGridHelper(3.0, 12, 6, 48);
    const m = helper.material as THREE.LineBasicMaterial;
    m.vertexColors = false;
    m.color = slots.akzent.farbe;
    m.transparent = true;
    m.opacity = 0;
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    m.needsUpdate = true;
    helper.position.y = -0.04;
    return helper;
  }, [slots]);

  /* ------------------------------- Cleanup -------------------------------- */
  useEffect(() => {
    return () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(tex).forEach((t) => t.dispose());
      const { ringe, ...rest } = mats;
      Object.values(rest).forEach((m) => m.dispose());
      ringe.forEach((m) => m.dispose());
      podium.geometry.dispose();
      (podium.material as THREE.Material).dispose();
    };
  }, [geo, tex, mats, podium]);

  /* --------------------------- Kamera & Backdrop --------------------------- */
  const backdropRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    camera.lookAt(0, 0.55, 0);
    backdropRef.current?.lookAt(camera.position); // Backdrop zur Kamera drehen
    mats.punkte.uniforms.uDpr.value = gl.getPixelRatio();
  }, [camera, gl, mats]);

  /* ----------------------- Choreografie-Zustand (Refs) --------------------- */
  const uhr = useRef(0); // eigene Uhr: clock.elapsedTime läuft bei frameloop-Wechseln weiter
  const scan = useRef<Scan>({ art: null, start: 0, dauer: 0 });
  const erstFertig = useRef(false);
  const naechsterResweep = useRef(0);
  const farbScanAngefordert = useRef(false);
  const oszPhase = useRef(0);
  const bereitGemeldet = useRef(false);
  const reduziertGemeldet = useRef(false);
  const pinZustand = useRef<PinZustand[]>(PINS.map(() => ({ erschienen: false, popStart: 0, hoverScale: 1 })));
  const pinAnzahl = useRef(0);

  const gruppeRef = useRef<THREE.Group>(null);
  const vorhangRef = useRef<THREE.Group>(null);
  const pinGruppen = useRef<(THREE.Group | null)[]>([]);
  const pinKerne = useRef<(THREE.Mesh | null)[]>([]);
  const pinRinge = useRef<(THREE.Mesh | null)[]>([]);
  const felgen = useRef<(THREE.Mesh | null)[]>([]);

  const [chip, setChip] = useState<number | null>(null);

  /* ------------------- Token-Bridge: Lesen bei Branchenwechsel ------------- */
  const ersteLesung = useRef(true);
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    const lesen = () => {
      const el = containerRef.current;
      if (!el) return;
      const cs = getComputedStyle(el); // am Container: liegt UNTER dem data-branche-Wrapper
      slots.kern.ziel = tokenFarbe(cs, '--copper-300', '#F2B877');
      slots.kontur.ziel = tokenFarbe(cs, '--copper-400', '#EDA455');
      slots.akzent.ziel = tokenFarbe(cs, '--copper-500', '#E8923B');
      slots.reifen.ziel = tokenFarbe(cs, '--ink-950', '#070809');
      // Kante + Glas bewusst theme-FEST (wie der Backdrop, Risiko R1):
      // --chrome-50/--ink-750 kehren im Hell-Thema ihre Semantik um — die
      // „helle" Scan-Kante würde fast schwarz (additiv = unsichtbar), der
      // Glas-Tint fast weiß und mit uTintGain 3.0 überstrahlend.
      slots.kante.ziel.set('#F4F6FA');
      slots.glas.ziel.set('#1B202B');

      if (ersteLesung.current || reduziert) {
        // Erstes Setup bzw. Reduced Motion: Farben hart setzen, ein Frame anstoßen.
        ersteLesung.current = false;
        Object.values(slots).forEach((s) => {
          s.farbe.copy(s.ziel);
          s.alt.copy(s.ziel);
        });
        farbeA.copy(slots.akzent.ziel);
        farbeB.copy(slots.akzent.ziel);
        invalidate();
      } else {
        // Branchenwechsel: alte Farben einfrieren, Re-Scan im nächsten Frame starten.
        Object.values(slots).forEach((s) => s.alt.copy(s.farbe));
        farbeB.copy(slots.akzent.ziel);
        farbScanAngefordert.current = true;
      }
    };
    // Doppeltes rAF: CSS-Variablen sind erst nach dem Style-Recalc aktuell.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(lesen);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [branche, reduziert, slots, farbeA, farbeB, containerRef, invalidate]);

  // Reduced Motion: Badge-Kopplung statisch („3 Schäden erfasst").
  useEffect(() => {
    if (reduziert && !reduziertGemeldet.current) {
      reduziertGemeldet.current = true;
      pingsRef.current?.(PINS.length);
    }
  }, [reduziert]);

  /* ----------------------- Uniform-Helfer (beide Shells) ------------------- */
  function shellUniform(name: string, wert: number) {
    mats.shellBody.uniforms[name].value = wert;
    mats.shellGlas.uniforms[name].value = wert;
  }

  /* ------------------------------- useFrame -------------------------------- */
  useFrame((_state, delta) => {
    if (!bereitGemeldet.current) {
      bereitGemeldet.current = true;
      // Badge-Übergabe: ab jetzt zählt die 3D-Szene (0 -> 1 -> 2 -> 3). Ohne
      // den 0-Reset würde das Badge sichtbar von „2" (statische Fallback-
      // Pins) auf „1" ZURÜCKspringen, sobald der erste Scan-Ping feuert.
      if (!reduziert) pingsRef.current?.(0);
      readyRef.current(); // erster Frame -> Watchdog der Außenkomponente entschärfen
    }
    const gruppe = gruppeRef.current;
    if (!gruppe) return;

    /* --- Reduced Motion: statisches, voll materialisiertes Standbild --- */
    if (reduziert) {
      shellUniform('uScanX', 2.8);
      shellUniform('uMatX', 2.8);
      shellUniform('uReveal', 1);
      shellUniform('uPulse', 1);
      shellUniform('uBand', 0);
      mats.punkte.uniforms.uMatX.value = 2.8;
      mats.punkte.uniforms.uReveal.value = 1;
      mats.kontur.opacity = 0.35;
      (podium.material as THREE.LineBasicMaterial).opacity = 0.1;
      mats.vorhang.opacity = 0;
      mats.vorhangKante.opacity = 0;
      gruppe.rotation.set(0, -0.05, 0);
      gruppe.scale.setScalar(1);
      PINS.forEach((_pin, i) => {
        pinGruppen.current[i]?.scale.setScalar(1);
        pinKerne.current[i]?.scale.setScalar(1);
        const ring = pinRinge.current[i * 2];
        if (ring) {
          ring.scale.setScalar(1.4);
          mats.ringe[i * 2].opacity = 0.25; // Ring eingefroren
          mats.ringe[i * 2 + 1].opacity = 0;
        }
      });
      return;
    }

    const dt = Math.min(delta, 0.1); // Tab-Rückkehr: keine Zeitsprünge
    const t = (uhr.current += dt);

    /* --- Reveal (t 0–0.5): Konturen, Podium, Scale, uReveal --- */
    const reveal = easeOutCubic(clamp01(t / 0.5));
    mats.kontur.opacity = 0.35 * reveal;
    (podium.material as THREE.LineBasicMaterial).opacity = 0.1 * reveal;
    gruppe.scale.setScalar(0.96 + 0.04 * reveal);
    shellUniform('uReveal', reveal);
    mats.punkte.uniforms.uReveal.value = reveal;

    /* --- Scan-Zustandsmaschine --- */
    const s = scan.current;
    if (farbScanAngefordert.current) {
      // Branchenwechsel: übersteuert jederzeit den laufenden Scan.
      farbScanAngefordert.current = false;
      if (!erstFertig.current) {
        // Erster Pass noch nicht durch -> sofort voll materialisieren,
        // restliche Pins gestaffelt nachploppen lassen.
        erstFertig.current = true;
        pinZustand.current.forEach((z, i) => {
          if (!z.erschienen) {
            z.erschienen = true;
            z.popStart = t + i * 0.12;
            pinAnzahl.current += 1;
          }
        });
        pingsRef.current?.(pinAnzahl.current);
      }
      scan.current = { art: 'branche', start: t, dauer: 0.9 };
    } else if (!s.art && !erstFertig.current && t >= 0.5) {
      scan.current = { art: 'erst', start: t, dauer: 1.8 };
    } else if (!s.art && erstFertig.current && t >= naechsterResweep.current) {
      scan.current = { art: 'resweep', start: t, dauer: 2.2 }; // leiser Re-Sweep alle 9 s
    }

    let scanX = 2.8;
    let matX = erstFertig.current ? 2.8 : -2.8;
    let band = 0;
    const aktiv = scan.current;
    if (aktiv.art) {
      const p = clamp01((t - aktiv.start) / aktiv.dauer);
      scanX = -2.8 + 5.6 * easeInOutQuad(p);
      band = aktiv.art === 'resweep' ? 0.3 : 1;
      if (aktiv.art === 'erst') {
        matX = scanX;
        // Pins feuern kausal: sobald die Linie ihre x-Position passiert.
        PINS.forEach((pin, i) => {
          const z = pinZustand.current[i];
          if (!z.erschienen && scanX >= pin.pos[0]) {
            z.erschienen = true;
            z.popStart = t;
            pinAnzahl.current += 1;
            pingsRef.current?.(pinAnzahl.current);
          }
        });
      }
      if (aktiv.art === 'branche') {
        // Farb-Überblendung 0.9 s: alle Slots alt -> ziel, synchron zur Linie.
        Object.values(slots).forEach((sl) => sl.farbe.copy(sl.alt).lerp(sl.ziel, p));
      }
      if (p >= 1) {
        if (aktiv.art === 'erst') erstFertig.current = true;
        if (aktiv.art === 'branche') farbeA.copy(farbeB); // neue Farbe wird die „alte"
        scan.current = { art: null, start: 0, dauer: 0 };
        naechsterResweep.current = t + 9;
      }
    }
    shellUniform('uScanX', scanX);
    shellUniform('uMatX', matX);
    shellUniform('uBand', band);
    // Nach dem ersten Pass keine Ghost-Abdunklung mehr (Re-Sweeps sollen
    // das Auto nicht wieder „entmaterialisieren").
    shellUniform('uGeist', erstFertig.current ? 1.0 : 0.18);
    mats.punkte.uniforms.uMatX.value = matX;
    mats.punkte.uniforms.uTime.value = t;

    /* --- Lichtvorhang folgt der Linie, blendet außerhalb in ~200 ms aus --- */
    const vorhang = vorhangRef.current;
    if (vorhang) {
      vorhang.position.x = scanX;
      const zielOp = aktiv.art ? (aktiv.art === 'resweep' ? 0.03 : 0.1) : 0;
      mats.vorhang.opacity = THREE.MathUtils.damp(mats.vorhang.opacity, zielOp, 18, dt);
      mats.vorhangKante.opacity = THREE.MathUtils.damp(mats.vorhangKante.opacity, zielOp * 5, 18, dt);
    }

    /* --- Idle: Puls, Felgendrehung, Gier-Oszillation (KEIN Turntable) --- */
    const idle = erstFertig.current && !aktiv.art;
    shellUniform('uPulse', idle ? 0.925 + 0.075 * Math.sin((t * Math.PI * 2) / 6) : 1);
    felgen.current.forEach((f) => {
      if (f) f.rotation.z += 0.2 * dt;
    });

    /* --- Rotation: Idle-Gier + Parallax + Touch-Drag mit Trägheit --- */
    const e = eingabe.current;
    if (!e.drag.aktiv) {
      e.drag.yaw += e.drag.vel;
      e.drag.vel *= 0.94; // Trägheit
    }
    const eingabeAktiv = performance.now() - e.letzteEingabe < 3000;
    if (!eingabeAktiv) oszPhase.current += dt; // Idle-Gier pausiert 3 s nach Input
    const yawOsz = Math.sin((oszPhase.current * Math.PI * 2) / 14) * 0.16;
    const zielYaw = -0.05 + yawOsz + e.parallax.yaw + e.drag.yaw;
    gruppe.rotation.y = THREE.MathUtils.damp(gruppe.rotation.y, zielYaw, 4, dt);
    gruppe.rotation.z = THREE.MathUtils.damp(gruppe.rotation.z, e.parallax.pitch, 4, dt);

    /* --- Pins: Pop mit Back-Overshoot + Radar-Ringe (wie CSS .dl-ping) --- */
    PINS.forEach((_pin, i) => {
      const z = pinZustand.current[i];
      const g = pinGruppen.current[i];
      if (!g) return;
      if (!z.erschienen || t < z.popStart) {
        g.scale.setScalar(0.0001);
        mats.ringe[i * 2].opacity = 0;
        mats.ringe[i * 2 + 1].opacity = 0;
        return;
      }
      const pop = clamp01((t - z.popStart) / 0.45);
      g.scale.setScalar(Math.max(0.0001, pop >= 1 ? 1 : easeOutBack(pop)));
      z.hoverScale = THREE.MathUtils.damp(z.hoverScale, chip === i ? 1.25 : 1, 8, dt);
      pinKerne.current[i]?.scale.setScalar(z.hoverScale);
      // 2 Ringe, 1.2 s versetzt: scale 0.5 -> 2.1, opacity 0.9 -> 0 über 2.4 s.
      const seit = t - z.popStart - 0.45;
      for (let j = 0; j < 2; j++) {
        const ring = pinRinge.current[i * 2 + j];
        const mat = mats.ringe[i * 2 + j];
        const phase = seit - j * 1.2;
        if (!ring || phase < 0) {
          if (mat) mat.opacity = 0;
          continue;
        }
        const q = easeOutCubic((phase % 2.4) / 2.4);
        ring.scale.setScalar(0.5 + 1.6 * q);
        mat.opacity = 0.9 * (1 - q);
      }
    });
  });

  /* ------------------------- Pin-Interaktion (Chip) ------------------------ */
  function pinOver(i: number) {
    return (ev: ThreeEvent<PointerEvent>) => {
      ev.stopPropagation();
      if (ev.pointerType === 'mouse') {
        setChip(i);
        gl.domElement.style.cursor = 'pointer';
      }
    };
  }
  function pinOut() {
    return (ev: ThreeEvent<PointerEvent>) => {
      ev.stopPropagation();
      if (ev.pointerType === 'mouse') {
        setChip(null);
        gl.domElement.style.cursor = '';
      }
    };
  }
  function pinDown(i: number) {
    return (ev: ThreeEvent<PointerEvent>) => {
      ev.stopPropagation();
      if (ev.pointerType === 'touch') setChip((akt) => (akt === i ? null : i)); // Touch: Chip toggeln
    };
  }

  return (
    <>
      {/* Dunkler Grund hinter dem additiven Hologramm (Risiko R1) */}
      <mesh ref={backdropRef} geometry={geo.backdrop} material={mats.backdrop} position={[-1.2, 0.8, -1.6]} renderOrder={-1} />

      {/* Podium + Kontaktschatten bleiben fix, das Fahrzeug dreht darüber */}
      <primitive object={podium} />
      <mesh geometry={geo.schatten} material={mats.schatten} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]} />

      <group ref={gruppeRef}>
        {/* Karosserie + Glaskanzel als Fresnel-Shell */}
        <mesh geometry={geo.body} material={mats.shellBody} />
        <mesh geometry={geo.kanzel} material={mats.shellGlas} />

        {/* Blueprint-Konturlinien */}
        <lineSegments geometry={geo.bodyKontur} material={mats.kontur} />
        <lineSegments geometry={geo.kanzelKontur} material={mats.kontur} />

        {/* Datenpunkte auf der Oberfläche */}
        <points geometry={geo.punkte} material={mats.punkte} />

        {/* Räder: dunkle Anker + additiver Felgenring + Nabenpunkt */}
        {([[-1.45, -0.79], [-1.45, 0.79], [1.45, -0.79], [1.45, 0.79]] as [number, number][]).map(([x, z], i) => {
          const aussen = z > 0 ? 0.13 : -0.13;
          return (
            <group key={`rad-${i}`} position={[x, 0.3, z]}>
              <mesh geometry={geo.rad} material={mats.reifen} rotation={[Math.PI / 2, 0, 0]} />
              <mesh
                ref={(el) => {
                  felgen.current[i] = el;
                }}
                geometry={geo.felge}
                material={mats.felge}
                position={[0, 0, aussen]}
              />
              <mesh geometry={geo.nabe} material={mats.nabe} position={[0, 0, aussen]} />
            </group>
          );
        })}

        {/* Lichtvorhang (YZ-Ebene) + führende Scan-Kante */}
        <group ref={vorhangRef} position={[-2.8, 0.62, 0]}>
          <mesh geometry={geo.vorhang} material={mats.vorhang} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={geo.vorhangKante} material={mats.vorhangKante} />
        </group>

        {/* Schadens-Pins: Kern + 2 Radar-Ringe im Billboard + Hover-Chip */}
        {PINS.map((pin, i) => (
          <group
            key={pin.label}
            ref={(el) => {
              pinGruppen.current[i] = el;
            }}
            position={pin.pos}
            scale={0.0001}
          >
            <mesh
              geometry={geo.pinKern}
              material={mats.pinKern}
              ref={(el) => {
                pinKerne.current[i] = el;
              }}
              onPointerOver={pinOver(i)}
              onPointerOut={pinOut()}
              onPointerDown={pinDown(i)}
            />
            <Billboard>
              {[0, 1].map((j) => (
                <mesh
                  key={j}
                  geometry={geo.pinRing}
                  material={mats.ringe[i * 2 + j]}
                  ref={(el) => {
                    pinRinge.current[i * 2 + j] = el;
                  }}
                />
              ))}
            </Billboard>
            {/* Chip nur bei Hover/Tap gemountet — kein DOM-Update pro Frame */}
            {chip === i && (
              <Html position={[0, 0.14, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
                <span className="badge-copper" style={{ whiteSpace: 'nowrap' }}>
                  {pin.label}
                </span>
              </Html>
            )}
          </group>
        ))}
      </group>
    </>
  );
}

/* ============================ Außenkomponente ============================= */

export interface LandingCar3DProps {
  /** Aktiver Betriebstyp der Seite ('aufbereitung' | 'folierung' | 'ppf') — triggert den Farb-Re-Scan. */
  branche: string;
  /** 2D-Fallback (z.B. CarSilhouette): sichtbar bis der erste 3D-Frame steht, dauerhaft bei fehlendem WebGL. */
  fallback?: ReactNode;
  /** Optional: erster gerenderter 3D-Frame (Fallback kann ausgeblendet werden). */
  onReady?: () => void;
  /** Optional: Anzahl der bisher „gescannten" Schäden (Badge-Kopplung).
   *  Meldet 0, sobald die 3D-Szene übernimmt (erster Frame). */
  onPings?: (anzahl: number) => void;
  /** Optional: Szene fällt endgültig auf den 2D-Fallback zurück (Watchdog/
   *  Context-Lost) — die Seite kann z.B. das Schäden-Badge zurücksetzen. */
  onFehler?: () => void;
}

export default function LandingCar3D({ branche, fallback, onReady, onPings, onFehler }: LandingCar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Lebenszyklus: erst mounten wenn in Viewport-Nähe + WebGL-Probe bestanden;
  // „fehler" schaltet endgültig auf den 2D-Fallback (Watchdog/Context-Lost).
  const [gemountet, setGemountet] = useState(false);
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [sichtbar, setSichtbar] = useState(true);
  // Startwert aus document.hidden: In einem verdeckt geöffneten Tab (Hintergrund-
  // Tab, Session-Restore) läuft kein rAF -> ein hart auf true stehender Wert
  // würde den Watchdog bewaffnen und die Szene fälschlich dauerhaft auf 2D werfen.
  const [tabSichtbar, setTabSichtbar] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [reduziert, setReduziert] = useState(() => !motionOk());

  const onReadyRef = useRef(onReady);
  const onFehlerRef = useRef(onFehler);
  useEffect(() => {
    onReadyRef.current = onReady;
    onFehlerRef.current = onFehler;
  }, [onReady, onFehler]);

  // Endgültiger Rückfall auf 2D -> Seite informieren (z.B. Badge auf die
  // sichtbaren Fallback-Pins zurücksetzen).
  useEffect(() => {
    if (fehler) onFehlerRef.current?.();
  }, [fehler]);

  // Eingabe-Kanal für Parallax/Drag (Refs statt State — kein Re-Render pro Move).
  const eingabe = useRef<Eingabe>({
    parallax: { yaw: 0, pitch: 0 },
    drag: { aktiv: false, yaw: 0, vel: 0, letztesX: 0 },
    letzteEingabe: 0,
  });

  // 1) Lazy-Mount: einmaliger IntersectionObserver mit Vorlauf (250 px),
  //    danach WebGL-Probe — ohne WebGL bleibt dauerhaft der Fallback stehen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setGemountet(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setGemountet(true);
        }
      },
      { rootMargin: '250px 0px', threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!gemountet) return;
    let ok = false;
    try {
      const c = document.createElement('canvas');
      ok = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      ok = false;
    }
    setWebglOk(ok);
  }, [gemountet]);

  // 2) Render-Loop-Disziplin: zweiter Observer (threshold 0) + Tab-Sichtbarkeit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setSichtbar(entries.some((e) => e.isIntersecting)), { threshold: 0 });
    io.observe(el);
    const aufTab = () => setTabSichtbar(!document.hidden);
    document.addEventListener('visibilitychange', aufTab);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', aufTab);
    };
  }, []);

  // Reduced-Motion-Präferenz live verfolgen (Systemwechsel ohne Reload).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aufWechsel = () => setReduziert(!motionOk());
    mq.addEventListener('change', aufWechsel);
    return () => mq.removeEventListener('change', aufWechsel);
  }, []);

  // 3) Watchdog: kommt der erste Frame nicht binnen 2500 ms (nur zählen,
  //    solange wirklich gerendert werden kann), fällt die Karte auf 2D zurück.
  useEffect(() => {
    if (!gemountet || !webglOk || bereit || fehler || !sichtbar || !tabSichtbar) return;
    const timer = window.setTimeout(() => setFehler(true), 2500);
    return () => window.clearTimeout(timer);
  }, [gemountet, webglOk, bereit, fehler, sichtbar, tabSichtbar]);

  /* --------------------- Parallax (Maus) + Drag (Touch) -------------------- */
  function aufPointerDown(ev: React.PointerEvent<HTMLDivElement>) {
    if (ev.pointerType !== 'touch' || reduziert) return;
    const e = eingabe.current;
    e.drag.aktiv = true;
    e.drag.letztesX = ev.clientX;
    e.drag.vel = 0;
    e.letzteEingabe = performance.now();
  }
  function aufPointerMove(ev: React.PointerEvent<HTMLDivElement>) {
    if (reduziert) return;
    const e = eingabe.current;
    if (ev.pointerType === 'touch') {
      if (!e.drag.aktiv) return;
      const dx = ev.clientX - e.drag.letztesX;
      e.drag.letztesX = ev.clientX;
      e.drag.yaw += dx * 0.005; // direktes Drehen, Trägheit übernimmt useFrame
      e.drag.vel = dx * 0.005;
      e.letzteEingabe = performance.now();
      return;
    }
    // Desktop-Parallax: Zielrotation aus der Cursorposition auf der Karte.
    const rect = ev.currentTarget.getBoundingClientRect();
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((ev.clientY - rect.top) / rect.height) * 2 - 1;
    e.parallax.yaw = nx * 0.25;
    e.parallax.pitch = ny * 0.06;
    e.letzteEingabe = performance.now();
  }
  function aufPointerEnde(ev: React.PointerEvent<HTMLDivElement>) {
    const e = eingabe.current;
    if (ev.pointerType === 'touch') {
      e.drag.aktiv = false;
      return;
    }
    // Maus verlässt die Karte -> Ruhepose.
    e.parallax.yaw = 0;
    e.parallax.pitch = 0;
  }

  // frameloop: 'always' nur wenn sichtbar + Tab aktiv + Bewegung erlaubt.
  // Vor dem ersten Frame nie 'never' (sonst würgt es den Watchdog-Handshake ab).
  const loop: 'always' | 'never' | 'demand' = reduziert
    ? 'demand'
    : !bereit || (sichtbar && tabSichtbar)
      ? 'always'
      : 'never';

  const canvasAktiv = gemountet && webglOk === true && !fehler;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Interaktives 3D-Fahrzeugmodell mit markierten Schadenspunkten"
      className="relative h-full w-full"
      style={{ touchAction: 'pan-y' }} // vertikales Scrollen bleibt frei (kein Scroll-Hijack)
      onPointerDown={aufPointerDown}
      onPointerMove={aufPointerMove}
      onPointerUp={aufPointerEnde}
      onPointerCancel={aufPointerEnde}
      onPointerLeave={aufPointerEnde}
    >
      {/* Fallback-Ebene: IMMER im DOM (Absicherung), blendet nur auf opacity 0 */}
      {fallback && (
        <div
          aria-hidden={bereit && !fehler}
          className="absolute inset-0"
          style={{ opacity: bereit && !fehler ? 0 : 1, transition: 'opacity 400ms ease' }}
        >
          {fallback}
        </div>
      )}

      {canvasAktiv && (
        <div className="absolute inset-0" style={{ opacity: bereit ? 1 : 0, transition: 'opacity 400ms ease' }}>
          <Canvas
            dpr={[1, 1.75]}
            frameloop={loop}
            // flat + linear: kein ACES-Tonemapping, keine linear->sRGB-Ausgabe-
            // konvertierung. Pflicht für die Token-Treue: die Custom-Shader
            // schreiben gl_FragColor roh — mit den fiber-Defaults würden
            // geteilte Farbinstanzen (z. B. Scan-Kante als Uniform UND als
            // MeshBasicMaterial) in zwei verschiedenen Farben erscheinen.
            flat
            linear
            // low-power: die unlit-Szene braucht keine dedizierte GPU (Landing-Etikette).
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            camera={{ fov: 35, near: 0.1, far: 60, position: [3.6, 1.7, 4.4] }}
            onCreated={({ gl: renderer }) => {
              // Context-Verlust -> sofort zurück auf den 2D-Fallback.
              renderer.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                setFehler(true);
              });
            }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            <HoloSzene
              containerRef={containerRef}
              branche={branche}
              reduziert={reduziert}
              eingabe={eingabe}
              onErsterFrame={() => {
                setBereit(true);
                onReadyRef.current?.();
              }}
              onPings={onPings}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
}
