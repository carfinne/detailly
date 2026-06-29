'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Icon, ICON_PATHS } from '@/lib/icons';

// Gemeinsame Navigations-Definition fuer Desktop-Sidebar UND mobilen Drawer –
// EINE Quelle der Wahrheit, damit beide nie auseinanderlaufen.
// Gruppiert nach Arbeitsablauf statt einer langen flachen Liste.
// `rollen` (optional) schraenkt die Sichtbarkeit eines Eintrags ein.
// `badge: 'anfragen'` blendet einen Live-Zaehler neuer Online-Anfragen ein.
export type NavItem = {
  href: string;
  label: string;
  icon: JSX.Element;
  rollen?: string[];
  badge?: 'anfragen';
};
export type NavGroup = { label: string; items: NavItem[] };

// Standorte nur fuer Leitungsrollen sichtbar.
const STANDORT_ROLLEN = ['super_admin', 'franchise_owner', 'manager'];

// Online-Terminanfragen: wie der Backend-Endpoint (Empfang/Leitung).
const ANFRAGEN_ROLLEN = ['super_admin', 'franchise_owner', 'manager', 'receptionist'];

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
      { href: '/anfragen', label: 'Anfragen', icon: ICON_PATHS.inbox, rollen: ANFRAGEN_ROLLEN, badge: 'anfragen' },
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
      { href: '/auswertungen', label: 'Auswertungen', icon: (<path d="M3 20h18M7 20v-6m5 6V8m5 12v-9" />), rollen: BUCHHALTUNG_ROLLEN },
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
      { href: '/einstellungen', label: 'Einstellungen', icon: ICON_PATHS.settings },
      { href: '/abo', label: 'Abo & Tarif', icon: ICON_PATHS.subscription, rollen: ['franchise_owner'] },
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
  const [anfragenCount, setAnfragenCount] = useState(0);

  // Zaehler neuer Anfragen laden (nur wenn der Nutzer den Bereich sehen darf).
  // Aktualisiert bei jedem Routenwechsel, damit das Badge nach dem Bearbeiten sinkt.
  useEffect(() => {
    if (!user || !ANFRAGEN_ROLLEN.includes(user.role)) {
      setAnfragenCount(0);
      return;
    }
    let aktiv = true;
    api
      .get<{ neu: number }>('/booking-requests/count')
      .then((r) => aktiv && setAnfragenCount(r.neu))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, [user, pathname]);

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
                  <span className="flex-1">{item.label}</span>
                  {item.badge === 'anfragen' && anfragenCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-copper px-1.5 text-[11px] font-semibold text-ink-950">
                      {anfragenCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
