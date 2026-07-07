'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { BrandTile } from './brand';
import { NavLinks } from './nav-data';

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-700/70 bg-ink-850/70 backdrop-blur-sm md:flex">
      {/* Marke – zurück zum Dashboard */}
      <Link href="/dashboard" className="flex items-center gap-2.5 border-b border-ink-700/70 px-5 py-5 transition-colors hover:bg-ink-800/40">
        <BrandTile size="sm" className="shadow-glow" />
        <div className="leading-tight">
          <span className="font-display text-lg font-bold tracking-tight">
            Detail<span className="text-gradient">ly</span>
          </span>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-chrome-600">Detailing Suite</p>
        </div>
      </Link>

      {/* Navigation (geteilt mit dem mobilen Drawer) */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        <NavLinks />
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
