'use client';

import { useT } from '@/lib/i18n';
import { BrandTile } from './brand';

/**
 * Gebrandeter Ladezustand: ein heller Sheen gleitet ueber die Markenkachel –
 * wie Licht ueber eine frisch versiegelte Flaeche –, darunter ein ruhiger
 * Kupfer-Glow-Puls als zweite Ebene. EIN Markenzeichen, alles andere ruhig.
 *
 * Zwei Groessen:
 *   - full   -> Vollbild-Splash (Auth-Bootstrap im (app)/layout)
 *   - inline -> Karten-grosse Ladeflaeche (z. B. innerhalb von <LoadingCard>)
 *
 * Bewegung strikt transform/opacity (Keyframes in globals.css: dl-brand-sweep/
 * dl-brand-glow). Reduced-Motion (personliche .dl-reduce-motion-Klasse +
 * @media prefers-reduced-motion) blendet den Sweep aus und laesst nur einen
 * langsamen Opacity-Puls des Glows stehen – kein Sweep, kein Skalieren.
 *
 * Fuer Inhalts-/Listen-Platzhalter weiterhin <Loading/> (Skeleton) verwenden.
 */
export function BrandLoader({
  variant = 'full',
  label,
  className,
}: {
  variant?: 'full' | 'inline';
  /** Ueberschreibt den Standardtext; ohne Angabe je nach Variante gesetzt. */
  label?: string;
  className?: string;
}) {
  const t = useT();
  const full = variant === 'full';
  const text = label ?? (full ? t('common.loadingBrand') : t('common.loadingEllipsis'));

  const stack = (
    <div
      className="flex flex-col items-center gap-3 text-center animate-fade-in"
      role="status"
      aria-busy="true"
    >
      <span className="relative inline-grid place-items-center">
        {/* Glow-Ebene: ruhiger Kupfer-Halo hinter der Kachel. */}
        <span className="dl-brandloader-glow" aria-hidden="true" />
        {/* Markenkachel mit clippendem Sheen-Sweep. */}
        <span
          className={`dl-brandloader-mark relative z-10 inline-grid overflow-hidden ${
            full ? 'rounded-2xl' : 'rounded-xl'
          }`}
        >
          <BrandTile size={full ? 'lg' : 'md'} />
          <span className="dl-brandloader-sweep" aria-hidden="true" />
        </span>
      </span>
      <p className="text-sm text-chrome-400">{text}</p>
    </div>
  );

  if (full) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-ink-900 ${className ?? ''}`}>
        {stack}
      </div>
    );
  }
  return <div className={`flex justify-center py-10 ${className ?? ''}`}>{stack}</div>;
}
