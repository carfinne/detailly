'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon, ICON_PATHS } from '@/lib/icons';

// Gruppierte Navigation nach Arbeitsablauf statt einer langen flachen Liste
// (klarer als beim Wettbewerber, der 10+ Punkte ungruppiert zeigt).
// `rollen` (optional) schraenkt die Sichtbarkeit eines Eintrags ein.
// Icons kommen zentral aus `lib/icons` – dieselbe Quelle wie die Seitenkoepfe.
type NavItem = { href: string; label: string; icon: JSX.Element; rollen?: string[] };
type NavGroup = { label: string; items: NavItem[] };

// Standorte nur fuer Leitungsrollen sichtbar.
const STANDORT_ROLLEN = ['super_admin', 'franchise_owner', 'manager'];

// Plattform-Bereich (Abo-Verwaltung) nur fuer den Detailly-Betreiber.
const PLATTFORM_ROLLEN = ['super_admin'];

const GROUPS: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: ICON_PATHS.dashboard }],
  },
  {
    label: 'Betrieb',
    items: [
      { href: '/auftraege', label: 'Aufträge', icon: ICON_PATHS.orders },
      { href: '/fahrzeugannahme', label: 'Fahrzeugannahme', icon: ICON_PATHS.intake },
      { href: '/plantafel', label: 'Plantafel', icon: ICON_PATHS.calendar },
    ],
  },
  {
    label: 'Stammdaten',
    items: [
      { href: '/kunden', label: 'Kunden', icon: ICON_PATHS.customers },
      { href: '/fahrzeuge', label: 'Fahrzeuge', icon: ICON_PATHS.vehicles },
      { href: '/leistungen', label: 'Leistungen', icon: ICON_PATHS.services },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { href: '/rechnungen', label: 'Rechnungen', icon: ICON_PATHS.invoices },
      { href: '/shop', label: 'Shop & Lager', icon: ICON_PATHS.shop },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { href: '/standorte', label: 'Standorte', icon: ICON_PATHS.locations, rollen: STANDORT_ROLLEN },
      { href: '/mitarbeiter', label: 'Mitarbeiter', icon: ICON_PATHS.staff },
      { href: '/audit', label: 'Audit-Log', icon: ICON_PATHS.audit },
    ],
  },
  {
    label: 'Plattform',
    items: [{ href: '/abos', label: 'Abos', icon: ICON_PATHS.subscription, rollen: PLATTFORM_ROLLEN }],
  },
];

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
                    <Icon className="h-[18px] w-[18px] shrink-0">{item.icon}</Icon>
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
            <Icon className="h-[18px] w-[18px] shrink-0">{ICON_PATHS.locations}</Icon>
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
