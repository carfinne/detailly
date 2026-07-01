'use client';

// Glocke in der Topbar: kompakte Hinweise (ueberfaellige Rechnungen, Termine
// heute, knappes Material). Laedt /reminders bei Login + jedem Routenwechsel,
// damit der Zaehler nach dem Bearbeiten sinkt. Dropdown nach dem Profilmenue-
// Muster (Klick ausserhalb / Escape schliessen).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface ReminderItem {
  key: string;
  anzahl: number;
  label: string;
  href: string;
  severity: 'danger' | 'caution' | 'info';
}
interface Reminders {
  total: number;
  items: ReminderItem[];
}

const DOT: Record<string, string> = { danger: 'bg-danger', caution: 'bg-caution', info: 'bg-info' };

export function NotificationBell() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [data, setData] = useState<Reminders>({ total: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setData({ total: 0, items: [] });
      return;
    }
    let aktiv = true;
    api
      .get<Reminders>('/reminders')
      .then((r) => aktiv && setData(r))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, [user, pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Hinweise"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-ink-700/70 bg-ink-850/60 text-chrome-400 transition-colors hover:text-copper"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {data.total > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-copper px-1 text-[10px] font-bold text-ink-950">
            {data.total > 99 ? '99+' : data.total}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-pop animate-fade-in">
          <div className="border-b border-ink-700/70 px-4 py-2.5 text-sm font-semibold text-chrome-50">Hinweise</div>
          {data.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-chrome-500">Keine offenen Hinweise. 🎉</p>
          ) : (
            <div className="p-1.5">
              {data.items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-chrome-200 transition-colors hover:bg-ink-750"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[it.severity] ?? 'bg-chrome-500'}`} />
                  <span className="flex-1">{it.label}</span>
                  <span aria-hidden className="text-chrome-500">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
