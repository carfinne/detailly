'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useHasFeature } from '@/lib/entitlements';
import { Icon } from '@/lib/icons';
import { ALL_NAV_ITEMS, filterNavItems, type NavItem } from './nav-data';
import { useMobileNav } from './MobileNavContext';

/**
 * Untere Schnellzugriff-Leiste (nur mobil/Tablet, bis `md`).
 *
 * Werkstattalltag: die Kernaktionen sind am Handy sonst mehrere Taps entfernt
 * (Menue oeffnen -> scrollen -> tippen). Diese dezente Leiste bringt die 4
 * wichtigsten Ziele plus „Mehr" (oeffnet den bestehenden Drawer) an den
 * Daumen. Auf Desktop (`md:hidden`) ist sie komplett unsichtbar – dort
 * uebernimmt die Sidebar.
 *
 * Wiederverwendung statt Duplikat: die Ziele stammen als echte NavItems aus
 * `nav-data` und laufen durch DIESELBE Rollen-/Tarif-Filterung wie Sidebar und
 * Drawer (`filterNavItems`). Ein fuer die Rolle/den Tarif gesperrtes Ziel
 * erscheint hier gar nicht (keine 403-Sackgasse).
 *
 * A11y/Touch: jede Schaltflaeche ist >= 44px hoch, aktiver Zustand sichtbar
 * (Farbe + oberer Indikator, `aria-current`), sichere Unterkante via
 * `env(safe-area-inset-bottom)`. RTL: rein logisches/symmetrisches Layout.
 * Bewegung: nur eine dezente Farb-Transition – die globale „Bewegung
 * reduzieren"-Einstellung (`.dl-reduce-motion`) stellt sie ohnehin ruhig.
 */

// Wunsch-Reihenfolge der Schnellziele. Als echte NavItems aufgeloest, damit
// Icon/Label/Rollen/Tarif-Gate identisch zur restlichen Navigation sind.
const QUICK_HREFS = ['/dashboard', '/auftraege', '/fahrzeugannahme', '/plantafel'] as const;

export function MobileQuickBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useT();
  const hasFeature = useHasFeature();
  const { openNav, open } = useMobileNav();

  const quickItems: NavItem[] = QUICK_HREFS.map((href) =>
    ALL_NAV_ITEMS.find((item) => item.href === href),
  ).filter((item): item is NavItem => Boolean(item));

  // Exakt dieselbe Sichtbarkeitslogik wie Sidebar/Drawer (Rolle UND Tarif).
  const sichtbar = filterNavItems(quickItems, user?.role, hasFeature);

  const istAktiv = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const itemClass =
    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper/60';

  return (
    <nav
      aria-label={t('ui.quickbar.label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/70 bg-ink-900/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {sichtbar.map((item) => {
          const active = istAktiv(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`${itemClass} ${active ? 'text-copper' : 'text-chrome-400 hover:text-chrome-200'}`}
            >
              {/* Aktiver Indikator (oben) – rein visuell. */}
              <span
                aria-hidden="true"
                className={`h-0.5 w-6 rounded-full ${active ? 'bg-copper' : 'bg-transparent'}`}
              />
              <Icon className="h-[22px] w-[22px] shrink-0">{item.icon}</Icon>
              <span className="max-w-full truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}

        {/* „Mehr" – oeffnet den bestehenden Drawer (MobileNav). */}
        <button
          type="button"
          onClick={openNav}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          className={`${itemClass} text-chrome-400 hover:text-chrome-200`}
        >
          <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-transparent" />
          <svg
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px] shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="max-w-full truncate">{t('ui.quickbar.more')}</span>
        </button>
      </div>
    </nav>
  );
}
