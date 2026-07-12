'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { BrandTile } from './brand';
import { NavLinks } from './nav-data';

/**
 * Mobile/Tablet-Navigation: Hamburger in der Topbar oeffnet einen Off-Canvas-
 * Drawer mit derselben (geteilten) Navigation wie die Desktop-Sidebar. Auf
 * Desktop (md+) komplett ausgeblendet – dort uebernimmt die Sidebar.
 *
 * Schliesst bei: Routenwechsel, Escape, Klick auf Backdrop oder einen Link.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useT();
  const panelRef = useRef<HTMLElement>(null);

  // Bei jedem Routenwechsel schliessen (z. B. nach Klick auf einen Link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Solange offen: Escape schliesst, Tab-Fokus bleibt im Drawer gefangen,
  // Body-Scroll gesperrt (Drawer scrollt selbst). Muster wie <Modal> in ui.tsx.
  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = (): HTMLElement[] => {
      const el = panelRef.current;
      if (!el) return [];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
    };

    // Initialer Fokus in den Drawer (sonst bliebe er auf dem Hamburger).
    (focusables()[0] ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Fokus zurueck an den ausloesenden Hamburger-Button.
      prevActive?.focus?.();
    };
  }, [open]);

  return (
    <>
      {/* Hamburger – nur unterhalb md, ansonsten uebernimmt die Sidebar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-subtle btn-sm md:hidden"
        aria-label={t('ui.mobileNav.open')}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 animate-fade-in bg-ink-950/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside
            ref={panelRef}
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('ui.mobileNav.mainNav')}
            tabIndex={-1}
            className="absolute left-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-r border-ink-700/70 bg-ink-850 shadow-2xl focus:outline-none"
          >
            {/* Marke (zurück zum Dashboard) + Schliessen. Der Drawer schliesst
                bei Routenwechsel automatisch (useEffect auf pathname). */}
            <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-4">
              <Link
                href="/dashboard"
                aria-label={t('ui.nav.toDashboard')}
                className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
              >
                <BrandTile size="sm" className="shadow-glow" />
                <span className="font-display text-lg font-bold tracking-tight">
                  Detail<span className="text-gradient">ly</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-subtle btn-sm"
                aria-label={t('ui.mobileNav.close')}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation (geteilt mit der Desktop-Sidebar) */}
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>

            {/* Mandant / Standort-Hinweis */}
            <div className="border-t border-ink-700/70 px-4 py-3">
              <div className="flex items-center gap-2.5 rounded-xl bg-ink-800/60 px-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-copper-soft text-copper">
                  <Icon className="h-[18px] w-[18px] shrink-0">{ICON_PATHS.locations}</Icon>
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold text-chrome-200">
                    {user?.tenantName ?? t('ui.nav.mainLocation')}
                  </p>
                  <p className="truncate text-[10px] text-chrome-600">{user?.role ?? t('ui.nav.company')}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
