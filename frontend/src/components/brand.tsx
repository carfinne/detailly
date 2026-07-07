// Marken-Bausteine: EINE Quelle für das Auto-Logo statt kopierter Inline-SVGs
// (vorher 8× dupliziert in Login, Registrierung, Passwort-Seiten, Sidebar,
// MobileNav, App-Layout und Landing).

/** Das Detailly-Auto als nacktes SVG; Farbe kommt über currentColor. */
export function BrandMark({
  className = 'h-7 w-7',
  wheels = false,
}: {
  className?: string;
  /** true = Variante mit Radkreisen (Landingpage). */
  wheels?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
      <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
      {wheels && (
        <>
          <circle cx="7.5" cy="16.5" r="1.1" />
          <circle cx="16.5" cy="16.5" r="1.1" />
        </>
      )}
    </svg>
  );
}

// Kachel-Größen wie bisher im Einsatz: sm = Sidebar/Drawer, md = Lade-Screen,
// lg = öffentliche Seiten (Login & Co.).
const TILE = {
  sm: { box: 'h-9 w-9 rounded-xl', icon: 'h-5 w-5' },
  md: { box: 'h-11 w-11 rounded-xl', icon: 'h-6 w-6' },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-7 w-7' },
} as const;

/** Kupfer-Kachel mit Logo; Extras (shadow-glow, animate-pulse, mb-4) via className. */
export function BrandTile({
  size = 'md',
  className,
}: {
  size?: keyof typeof TILE;
  className?: string;
}) {
  const t = TILE[size];
  return (
    <div className={`grid place-items-center bg-copper-grad text-ink-950 ${t.box} ${className ?? ''}`}>
      <BrandMark className={t.icon} />
    </div>
  );
}
