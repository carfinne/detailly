// Zentrale Icon-Quelle fuer die gesamte App: Sidebar, Seitenkoepfe und
// Dashboard nutzen dieselben Pfade -> einheitliches, abgestimmtes Erscheinungsbild.
// Reine SVG-Pfade (24x24, stroke). Kein State -> in Server- wie Client-Komponenten nutzbar.

export const ICON_PATHS: Record<string, JSX.Element> = {
  dashboard: <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />,
  orders: <path d="M9 5h6m-6 4h6m-6 4h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />,
  intake: <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1m14-6a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M7 17v2m10-2v2M7 14h.01M17 14h.01" />,
  calendar: <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  inbox: <path d="M22 12h-6l-2 3h-4l-2-3H2m20 0V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6m20 0v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6" />,
  customers: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />,
  vehicles: <path d="M7 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 17H3v-5l2-5h10l3 5h2a1 1 0 0 1 1 1v4h-2M7 17h10" />,
  services: <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6l-6.4 6.4a2 2 0 1 0 2.8 2.8l6.4-6.4a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.1-.4-.4-2.1 2.2-2.3Z" />,
  invoices: <path d="M9 7h6m-6 4h6m-6 4h4M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />,
  shop: <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L22 7H6m3 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
  // Karton/Paket (Material & Lager): 3D-Box mit Klebeband-Linie an der Oberseite.
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12M16.5 4.35 7.5 9.5" />
    </>
  ),
  staff: <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />,
  locations: <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  audit: <path d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  subscription: <path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />,
  time: (
    <>
      <path d="M10 2h4" />
      <path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 14V10" />
    </>
  ),
  inspection3d: (
    <>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </>
  ),
  // Schichtdicke: Messuhr/Gauge (Schichtdickenmessgeraet).
  schichtdicke: (
    <>
      <path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
      <path d="M12 12l4-3" />
      <path d="M12 7v1m5 4h-1M8 12H7m8.5-3.5-.7.7" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  kalkulation: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2" />
    </>
  ),
  analytics: <path d="M3 20h18M7 20v-6m5 6V8m5 12v-9" />,
  marketplace: <path d="M4 9.5 5.2 4h13.6L20 9.5M4 9.5v10h16v-10M4 9.5h16M9.5 19.5v-5h5v5" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.8 2.8 0 1 1 3.9 2.6c-.8.35-1.2 1-1.2 1.9v.2M12 17h.01" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  tag: (
    <>
      <path d="M20 13.2 12.8 20.4a1.7 1.7 0 0 1-2.4 0L4 14V4h10l6 6a1.7 1.7 0 0 1 0 2.4z" />
      <circle cx="8.5" cy="8.5" r="1.3" />
    </>
  ),
  support: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20l1-4.9a8.4 8.4 0 1 1 17-3.6z" />,
  // Support-Assistent (KI-Hilfe): Funken/Sparkle – klar von der Chat-Blase (support) unterscheidbar.
  assistant: (
    <>
      <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8L19 14Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  // Mahnungen: Glocke (ueberfaellige Rechnungen anmahnen).
  mahnung: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  // Geschenk (Geburtstags-Erinnerung im Kalender). Bewusst KEIN Emoji – dezentes
  // Strich-Icon im Stil der uebrigen Icons (Schleife + Karton).
  gift: (
    <>
      <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
      <path d="M2 8h20v4H2z" />
      <path d="M12 8v13" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8m4.5 0a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8" />
    </>
  ),
  // Pokal (Erfolge & Bestenliste): Strich-Trophaee im Stil der uebrigen Icons.
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a1.5 1.5 0 0 0 0 5H7m10-5h2.5a1.5 1.5 0 0 1 0 5H17" />
      <path d="M12 14v3m-4 4h8m-6.5 0c0-1.9 1-3 2.5-3s2.5 1.1 2.5 3" />
    </>
  ),
  // Zusatz-Icons (Dashboard, Aktionen)
  revenue: <path d="M3 17l6-6 4 4 8-8M21 7h-4M21 7v4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  // Drei-Punkte-Menue (⋯) fuer Zeilen-Aktionen (ActionMenu). Kleine Kreise, die
  // mit der Icon-Strichstaerke als volle Punkte erscheinen.
  overflow: (
    <>
      <circle cx="12" cy="5" r="0.6" />
      <circle cx="12" cy="12" r="0.6" />
      <circle cx="12" cy="19" r="0.6" />
    </>
  ),
};

/** Einheitlicher SVG-Rahmen. Default-Groesse passt zur Navigation. */
export function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? 'h-[18px] w-[18px]'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// Route-Praefix -> Modul-Icon. Laengste Uebereinstimmung gewinnt (Detailseiten erben das Modul-Icon).
const ROUTE_ICONS: { prefix: string; key: string }[] = [
  { prefix: '/dashboard', key: 'dashboard' },
  { prefix: '/erfolge', key: 'trophy' },
  { prefix: '/auftraege', key: 'orders' },
  { prefix: '/kalkulation', key: 'kalkulation' },
  { prefix: '/fahrzeugannahme', key: 'intake' },
  { prefix: '/schadenserfassung', key: 'inspection3d' },
  { prefix: '/plantafel', key: 'calendar' },
  { prefix: '/anfragen', key: 'inbox' },
  { prefix: '/kunden', key: 'customers' },
  { prefix: '/fahrzeuge', key: 'vehicles' },
  { prefix: '/leistungen', key: 'services' },
  { prefix: '/rechnungen', key: 'invoices' },
  { prefix: '/mahnungen', key: 'mahnung' },
  { prefix: '/auswertungen', key: 'analytics' },
  { prefix: '/buchhaltung', key: 'revenue' },
  { prefix: '/shop', key: 'box' },
  { prefix: '/marktplatz', key: 'marketplace' },
  { prefix: '/standorte', key: 'locations' },
  { prefix: '/mitarbeiter', key: 'staff' },
  { prefix: '/audit', key: 'audit' },
  { prefix: '/hilfe', key: 'help' },
  { prefix: '/assistent', key: 'assistant' },
  { prefix: '/abos', key: 'subscription' },
  { prefix: '/abo', key: 'subscription' },
  { prefix: '/zeiterfassung', key: 'time' },
  { prefix: '/einstellungen', key: 'settings' },
  { prefix: '/plattform-analysen', key: 'globe' },
  { prefix: '/plattform-marktplatz', key: 'tag' },
  { prefix: '/plattform-support', key: 'support' },
];

/** Liefert das passende Modul-Icon zu einem Pfad (oder null). */
export function routeIcon(pathname: string | null | undefined): JSX.Element | null {
  if (!pathname) return null;
  const match = ROUTE_ICONS.filter((r) => pathname.startsWith(r.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match ? ICON_PATHS[match.key] : null;
}
