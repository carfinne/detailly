'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon, ICON_PATHS } from '@/lib/icons';

// Gemeinsame Navigations-Definition fuer Desktop-Sidebar UND mobilen Drawer –
// EINE Quelle der Wahrheit, damit beide nie auseinanderlaufen.
// Gruppiert nach Arbeitsablauf statt einer langen flachen Liste.
// `rollen` (optional) schraenkt die Sichtbarkeit eines Eintrags ein.
export type NavItem = { href: string; label: string; icon: JSX.Element; rollen?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

// Standorte nur fuer Leitungsrollen sichtbar.
const STANDORT_ROLLEN = ['super_admin', 'franchise_owner', 'manager'];

// Betriebs-Stammdaten (§14) pflegt der Inhaber.
const INHABER_ROLLEN = ['super_admin', 'franchise_owner'];

// Buchhaltungs-Export: Leitungsrollen (wie der Backend-Endpoint).
const BUCHHALTUNG_ROLLEN = ['super_admin', 'franchise_owner', 'manager'];

// Plattform-Bereich (Abo-Verwaltung) nur fuer den Detailly-Betreiber.
const PLATTFORM_ROLLEN = ['super_admin'];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: ICON_PATHS.dashboard }],
  },
  {
    label: 'Betrieb',
    items: [
      { href: '/auftraege', label: 'Aufträge', icon: ICON_PATHS.orders },
      { href: '/fahrzeugannahme', label: 'Fahrzeugannahme', icon: ICON_PATHS.intake },
      { href: '/schadenserfassung', label: 'Schadenserfassung', icon: ICON_PATHS.inspection3d },
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
      { href: '/buchhaltung', label: 'Buchhaltung', icon: ICON_PATHS.revenue, rollen: BUCHHALTUNG_ROLLEN },
      { href: '/shop', label: 'Shop & Lager', icon: ICON_PATHS.shop },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { href: '/standorte', label: 'Standorte', icon: ICON_PATHS.locations, rollen: STANDORT_ROLLEN },
      { href: '/mitarbeiter', label: 'Mitarbeiter', icon: ICON_PATHS.staff },
      { href: '/zeiterfassung', label: 'Zeiterfassung', icon: ICON_PATHS.time },
      { href: '/audit', label: 'Audit-Log', icon: ICON_PATHS.audit },
      { href: '/einstellungen', label: 'Betriebsdaten', icon: ICON_PATHS.settings, rollen: INHABER_ROLLEN },
    ],
  },
  {
    label: 'Plattform',
    items: [{ href: '/abos', label: 'Abos', icon: ICON_PATHS.subscription, rollen: PLATTFORM_ROLLEN }],
  },
];

/**
 * Rendert die gruppierten Navigations-Links (rollengefiltert, aktiver Zustand).
 * `onNavigate` wird beim Klick auf einen Link aufgerufen – der mobile Drawer
 * schliesst sich darüber selbst.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <>
      {NAV_GROUPS.map((group) => {
        // Eintraege nach Rollensichtbarkeit filtern; leere Gruppen entfallen.
        const sichtbar = group.items.filter(
          (item) => !item.rollen || (user && item.rollen.includes(user.role)),
        );
        if (sichtbar.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {sichtbar.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
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
    </>
  );
}
