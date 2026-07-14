'use client';

// On-Screen-Variante der „Detailly Wrapped“-Karte. Teilt sich das View-Model
// (WrappedView) mit dem Canvas-Export (lib/wrapped-canvas.ts) -> identischer
// Inhalt. Bewusst FESTE Dunkel-Palette (nicht Theme-Tokens), damit die sichtbare
// Karte exakt so aussieht wie das exportierte Bild.

import type { WrappedView } from '@/lib/wrapped-canvas';

export function WrappedCard({ view }: { view: WrappedView }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/10 p-8 shadow-pop"
      style={{ background: 'linear-gradient(180deg, #0b0d11 0%, #070809 100%)' }}
    >
      {/* Copper-Schein oben rechts */}
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: 'rgba(232,146,59,0.20)' }}
      />

      {/* Kopf: Wortmarke + Badge */}
      <div className="relative flex items-center justify-between">
        <span className="text-lg font-bold tracking-[0.18em]" style={{ color: '#e8923b' }}>
          DETAILLY
        </span>
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: '#f2b877', borderColor: 'rgba(232,146,59,0.35)', background: 'rgba(232,146,59,0.12)' }}
        >
          {view.badge}
        </span>
      </div>

      {/* Jahr + Betriebsname */}
      <div className="relative mt-5">
        <p className="font-display font-extrabold leading-none tracking-tight" style={{ fontSize: '5.5rem', color: '#f4f6fa' }}>
          {view.jahr}
        </p>
        <p className="mt-2 truncate text-base font-medium" style={{ color: '#8a93a6' }}>
          {view.betriebsname}
        </p>
      </div>

      {/* Kennzahlen-Raster */}
      <div className="relative mt-6 grid grid-cols-2 gap-3">
        {view.stats.map((s, i) => (
          <div
            key={i}
            className="rounded-2xl border p-4"
            style={{ background: '#101319', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#f2b877' }}>
              {s.label}
            </p>
            <p className="mt-1.5 truncate text-xl font-bold" style={{ color: '#f4f6fa' }} title={s.value}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Fußzeile */}
      <p className="relative mt-7 text-center text-xs font-medium" style={{ color: '#727b8d' }}>
        {view.tagline}
      </p>
    </div>
  );
}
