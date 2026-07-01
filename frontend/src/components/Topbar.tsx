'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/labels';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';

export function Topbar() {
  const { user, logout } = useAuth();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') ||
    (user?.email?.[0] ?? '?').toUpperCase();

  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Globaler Shortcut: ⌘K (Mac) / Strg+K (Windows/Linux) öffnet die Suche.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Profil-Menü bei Klick ausserhalb / Escape schliessen.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-ink-700/70 bg-ink-900/80 px-5 py-3 backdrop-blur-md">
      {/* Mobile Navigation (Hamburger + Drawer) – auf md+ ausgeblendet */}
      <MobileNav />

      {/* Marke (mobil) – zurück zum Dashboard */}
      <Link href="/dashboard" className="font-display text-base font-bold tracking-tight md:hidden">
        Detail<span className="text-gradient">ly</span>
      </Link>

      {/* Suchfeld – öffnet die Command-Palette (⌘K) */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Globale Suche öffnen"
        className="ml-2 hidden flex-1 items-center gap-2 rounded-xl border border-ink-700/70 bg-ink-850/60 px-3 py-2 text-sm text-chrome-500 transition-colors hover:border-ink-600 hover:text-chrome-300 lg:flex lg:max-w-md"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span>Suchen…</span>
        <kbd className="ml-auto rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-chrome-400">⌘K</kbd>
      </button>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="ml-auto flex items-center gap-2">
        {/* Suche-Button (mobil/tablet, < lg) */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Globale Suche öffnen"
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700/70 bg-ink-850/60 text-chrome-400 transition-colors hover:text-chrome-200 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>

        {/* Hinweise (Glocke) */}
        <NotificationBell />

        {/* Einstellungen (Zahnrad) */}
        <Link
          href="/einstellungen"
          aria-label="Einstellungen"
          title="Einstellungen"
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-700/70 bg-ink-850/60 text-chrome-400 transition-colors hover:text-copper"
        >
          <Icon className="h-[18px] w-[18px]">{ICON_PATHS.settings}</Icon>
        </Link>

        {/* Profil-Menü */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 rounded-xl border border-transparent px-1.5 py-1 transition-colors hover:border-ink-700 hover:bg-ink-850/60"
          >
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight text-chrome-50">{name}</div>
              <div className="text-xs text-chrome-400">{user ? ROLE_LABEL[user.role] ?? user.role : ''}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-copper-grad text-sm font-bold text-ink-950">{initials}</div>
          </button>

          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-pop animate-fade-in">
              <div className="border-b border-ink-700/70 px-4 py-3">
                <div className="truncate text-sm font-semibold text-chrome-50">{name}</div>
                <div className="truncate text-xs text-chrome-500">{user?.email}</div>
              </div>
              <div className="p-1.5">
                <Link href="/einstellungen" role="menuitem" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-chrome-200 hover:bg-ink-750">
                  <Icon className="h-[18px] w-[18px] text-chrome-400">{ICON_PATHS.settings}</Icon>
                  Einstellungen
                </Link>
                <button role="menuitem" onClick={() => { setMenuOpen(false); logout(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-chrome-200 hover:bg-ink-750">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-chrome-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
