'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon, ICON_PATHS } from '@/lib/icons';
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

  // Bei jedem Routenwechsel schliessen (z. B. nach Klick auf einen Link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Solange offen: Escape schliesst + Body-Scroll sperren (Drawer scrollt selbst).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {/* Hamburger – nur unterhalb md, ansonsten uebernimmt die Sidebar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-subtle btn-sm md:hidden"
        aria-label="Menü öffnen"
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
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Hauptnavigation"
            className="absolute left-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-r border-ink-700/70 bg-ink-850 shadow-2xl"
          >
            {/* Marke + Schliessen */}
            <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-copper-grad text-ink-950 shadow-glow">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
                    <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
                  </svg>
                </div>
                <span className="font-display text-lg font-bold tracking-tight">
                  Detail<span className="text-gradient">ly</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-subtle btn-sm"
                aria-label="Menü schließen"
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
                    {user?.tenantName ?? 'Hauptstandort'}
                  </p>
                  <p className="truncate text-[10px] text-chrome-600">{user?.role ?? 'Betrieb'}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
