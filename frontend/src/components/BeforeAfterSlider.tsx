'use client';

// ===========================================================================
// Vorher/Nachher-Vergleichs-Slider (autark, ohne Fremd-Bibliothek).
// ---------------------------------------------------------------------------
// Zwei deckungsgleich uebereinander liegende Bilder; ein zieh-/tastbarer Trenner
// gibt links das "Vorher"- und rechts das "Nachher"-Bild frei (clip-path). Reine
// CSS + Pointer Events:
//   - Maus + Touch (Pointer Events, ein einziger Codepfad),
//   - Tastatur (Pfeiltasten/Pos/Ende/Bild-hoch/-runter) am role=slider-Griff,
//   - a11y: role=slider + aria-valuemin/max/now + aria-label.
//
// BEWUSST datenquellen-neutral: die beiden Bilder werden als `before`/`after`
// SLOTS (ReactNode) uebergeben. Intern kann so <AuthedImage> (guard-geschuetzt),
// oeffentlich ein normales <img src>-Element eingesetzt werden – der Slider
// kennt weder Token noch Endpunkt. Der uebergebene Knoten sollte seinen Container
// voll ausfuellen (z. B. className="h-full w-full object-cover").
//
// Nur transform/opacity/clip werden animiert; kein Layout-Shift (feste Aspect-
// Ratio-Box). prefers-reduced-motion / persoenliche Reduzieren-Option: KEIN
// automatisches Wischen (gibt es ohnehin nicht) und keine Griff-Transition –
// die Position folgt ausschliesslich der Nutzer-Eingabe.
// ===========================================================================

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { motionOk } from '@/lib/motion';

interface BeforeAfterSliderProps {
  /** Linkes Bild (wird bis zur Trenner-Position gezeigt). Fuellt seinen Container. */
  before: ReactNode;
  /** Rechtes Bild (Grundschicht). Fuellt seinen Container. */
  after: ReactNode;
  /** Sichtbares Label links (z. B. "Vorher"). */
  beforeLabel: string;
  /** Sichtbares Label rechts (z. B. "Nachher"). */
  afterLabel: string;
  /** aria-label der Vergleichs-Region. */
  ariaLabel: string;
  /** aria-label des ziehbaren Griffs (Tastatur-Hinweis). */
  handleLabel: string;
  /** Startposition in Prozent (0–100), Standard 50 (mittig). */
  initial?: number;
  /** Zusatzklassen fuer die Aspect-Ratio-Box (z. B. eigene Ratio). */
  className?: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export default function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  ariaLabel,
  handleLabel,
  initial = 50,
  className = '',
}: BeforeAfterSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState(() => clamp(initial));
  const [dragging, setDragging] = useState(false);
  // Griff-Transition (fuer sanfte Tastatur-Schritte) nur, wenn Bewegung erlaubt.
  const [animate, setAnimate] = useState(false);
  useEffect(() => setAnimate(motionOk()), []);

  const value = Math.round(pos);
  // Waehrend des Ziehens keine Transition (Position folgt 1:1 dem Finger/der Maus).
  const smooth = animate && !dragging;

  function posFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return pos;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return pos;
    return clamp(((clientX - rect.left) / rect.width) * 100);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Nur primaerer Knopf/Beruehrung; kein Rechtsklick-Drag.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    setDragging(true);
    setPos(posFromClientX(e.clientX));
    trackRef.current?.setPointerCapture(e.pointerId);
    handleRef.current?.focus({ preventScroll: true });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setPos(posFromClientX(e.clientX));
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    if (trackRef.current?.hasPointerCapture?.(e.pointerId)) {
      trackRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = e.shiftKey ? 10 : 2;
    let next = pos;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = pos - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = pos + step;
        break;
      case 'PageDown':
        next = pos - 10;
        break;
      case 'PageUp':
        next = pos + 10;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 100;
        break;
      default:
        return;
    }
    e.preventDefault();
    setPos(clamp(next));
  }

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragStart={(e) => e.preventDefault()}
      className={`group relative w-full cursor-ew-resize select-none overflow-hidden rounded-xl border border-ink-700 bg-ink-850 ${
        className || 'aspect-video'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Grundschicht: Nachher */}
      <div className="absolute inset-0">{after}</div>

      {/* Deckschicht: Vorher, links bis zur Trenner-Position freigelegt */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(0 ${100 - pos}% 0 0)`,
          transition: smooth ? 'clip-path 140ms ease-out' : undefined,
        }}
      >
        {before}
      </div>

      {/* Labels (dezent, nicht interaktiv) */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-ink-950/55 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-chrome-100 backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-ink-950/55 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-chrome-100 backdrop-blur-sm">
        {afterLabel}
      </span>

      {/* Trennlinie (Copper) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-copper shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
        style={{ left: `${pos}%`, transition: smooth ? 'left 140ms ease-out' : undefined }}
      />

      {/* Griff: role=slider, tastatur- & fokusfaehig */}
      <button
        ref={handleRef}
        type="button"
        role="slider"
        aria-label={handleLabel}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${beforeLabel} ${value}%`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-copper/70 bg-ink-950/70 text-copper shadow-lg backdrop-blur-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 group-hover:scale-105 active:scale-95"
        style={{ left: `${pos}%`, transition: smooth ? 'left 140ms ease-out' : undefined }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6 4 12l5 6M15 6l5 6-5 6" />
        </svg>
      </button>
    </div>
  );
}
