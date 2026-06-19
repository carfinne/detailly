'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// Gruppierte Navigation nach Arbeitsablauf statt einer langen flachen Liste
// (klarer als beim Wettbewerber, der 10+ Punkte ungruppiert zeigt).
// `rollen` (optional) schraenkt die Sichtbarkeit eines Eintrags ein.
type NavItem = { href: string; label: string; icon: JSX.Element; rollen?: string[] };
type NavGroup = { label: string; items: NavItem[] };

// Standorte nur fuer Leitungsrollen sichtbar.
const STANDORT_ROLLEN = ['super_admin', 'franchise_owner', 'manager'];

const I = {
  dashboard: (
    <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
  ),
  orders: <path d="M9 5h6m-6 4h6m-6 4h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />,
  intake: <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1m14-6a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M7 17v2m10-2v2M7 14h.01M17 14h.01" />,
  calendar: <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  customers: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />,
  vehicles: <path d="M7 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 17H3v-5l2-5h10l3 5h2a1 1 0 0 1 1 1v4h-2M7 17h10" />,
  services: <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6l-6.4 6.4a2 2 0 1 0 2.8 2.8l6.4-6.4a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.1-.4-.4-2.1 2.2-2.3Z" />,
  invoices: <path d="M9 7h6m-6 4h6m-6 4h4M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />,
  shop: <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L22 7H6m3 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
  staff: <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />,
  locations: <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  audit: <path d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
};

const GROUPS: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: I.dashboard }],
  },
  {
    label: 'Betrieb',
    items: [
      { href: '/auftraege', label: 'Aufträge', icon: I.orders },
      { href: '/fahrzeugannahme', label: 'Fahrzeugannahme', icon: I.intake },
      { href: '/plantafel', label: 'Plantafel', icon: I.calendar },
    ],
  },
  {
    label: 'Stammdaten',
    items: [
      { href: '/kunden', label: 'Kunden', icon: I.customers },
      { href: '/fahrzeuge', label: 'Fahrzeuge', icon: I.vehicles },
      { href: '/leistungen', label: 'Leistungen', icon: I.services },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { href: '/rechnungen', label: 'Rechnungen', icon: I.invoices },
      { href: '/shop', label: 'Shop & Lager', icon: I.shop },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { href: '/standorte', label: 'Standorte', icon: I.locations, rollen: STANDORT_ROLLEN },
      { href: '/mitarbeiter', label: 'Mitarbeiter', icon: I.staff },
      { href: '/audit', label: 'Audit-Log', icon: I.audit },
    ],
  },
];

function Icon({ children }: { children: JSX.Element }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-700/70 bg-ink-850/70 backdrop-blur-sm md:flex">
      {/* Marke */}
      <div className="flex items-center gap-2.5 border-b border-ink-700/70 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-copper-grad text-ink-950 shadow-glow">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
            <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
          </svg>
        </div>
        <div className="leading-tight">
          <span className="font-display text-lg font-bold tracking-tight">
            Detail<span className="text-gradient">ly</span>
          </span>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-chrome-600">Detailing Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {GROUPS.map((group) => {
          // Eintraege nach Rollensichtbarkeit filtern; leere Gruppen entfallen.
          const sichtbar = group.items.filter(
            (item) => !item.rollen || (user && item.rollen.includes(user.role)),
          );
          if (sichtbar.length === 0) return null;
          return (
          <div key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {sichtbar.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? 'nav-link-active' : ''}`}
                >
                  <span className={active ? 'text-copper' : 'text-chrome-400'}>
                    <Icon>{item.icon}</Icon>
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Mandant / Standort-Hinweis */}
      <div className="border-t border-ink-700/70 px-4 py-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-ink-800/60 px-3 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-copper-soft text-copper">
            <Icon>{I.locations}</Icon>
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-chrome-200">
              {user?.tenantName ?? 'Hauptstandort'}
            </p>
            <p className="truncate text-[10px] text-chrome-600">{user?.role ?? 'Betrieb'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
