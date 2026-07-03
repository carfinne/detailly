// Gemeinsame Hülle aller öffentlichen Seiten (Login, Registrierung, Buchung,
// Status, Händler, ...) – vorher ~10× kopiert. Atmosphärischer Hintergrund mit
// Glow-Flächen und optionalem Linienraster.
//
// Das Raster nutzt das Theme-Token --grid-line (hell/dunkel korrekt) statt des
// früher hartkodierten Weiß. Deckkraft-Rechnung: bisher 0,5 (Linie) × 0,04
// (Wrapper) ≈ 0,02; das Token liefert 0,06 → Wrapper 1/3 hält das Raster
// visuell auf dem bisherigen, bewusst subtilen Niveau.

import { BrandTile } from '@/components/brand';

const WIDTH = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  wide: 'mx-auto max-w-5xl',
} as const;

export function PublicShell({
  children,
  width = 'md',
  raster = false,
}: {
  children: React.ReactNode;
  /** md/lg = vertikal zentrierte Karte; wide = oben ausgerichtete Vollseite. */
  width?: keyof typeof WIDTH;
  raster?: boolean;
}) {
  const wide = width === 'wide';
  return (
    <main
      className={
        wide
          ? 'relative min-h-screen overflow-hidden bg-ink-900 p-4 sm:p-8'
          : 'relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6'
      }
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-copper-glow blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/10 blur-[120px]" />
        {raster && (
          <div
            className="absolute inset-0 opacity-[0.33]"
            style={{
              backgroundImage:
                'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        )}
      </div>

      <div className={`relative z-10 w-full animate-fade-in ${WIDTH[width]}`}>{children}</div>
    </main>
  );
}

/** Logo-Kopf der Auth-Seiten: Kupfer-Kachel, Titel, optionale Unterzeile. */
export function PublicBrandHeader({
  title,
  subtitle,
  small,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** true = kompakter Titel (text-2xl) für Unterseiten wie Passwort/E-Mail. */
  small?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <BrandTile size="lg" className="mb-4 shadow-glow" />
      <h1 className={`font-display font-bold tracking-tight ${small ? 'text-2xl' : 'text-3xl'}`}>
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-sm text-chrome-400">{subtitle}</p>}
    </div>
  );
}
