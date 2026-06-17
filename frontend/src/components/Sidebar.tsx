'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/auftraege', label: 'Auftraege' },
  { href: '/kunden', label: 'Kunden' },
  { href: '/fahrzeuge', label: 'Fahrzeuge' },
  { href: '/plantafel', label: 'Plantafel' },
  { href: '/leistungen', label: 'Leistungen' },
  { href: '/rechnungen', label: 'Rechnungen' },
  { href: '/shop', label: 'Shop & Lager' },
  { href: '/mitarbeiter', label: 'Mitarbeiter' },
  { href: '/audit', label: 'Audit-Log' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-base-700 bg-base-800/60 md:flex md:flex-col">
      <div className="border-b border-base-700 px-6 py-5">
        <span className="text-xl font-bold tracking-tight">
          Detail<span className="text-accent">ly</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-accent text-white' : 'text-gray-300 hover:bg-base-600'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
