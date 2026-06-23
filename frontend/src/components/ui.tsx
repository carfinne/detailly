'use client';

import { useEffect, useId, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, routeIcon } from '@/lib/icons';

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Optionales Icon; ohne Angabe wird das Modul-Icon aus der Route abgeleitet. */
  icon?: React.ReactNode;
}) {
  const pathname = usePathname();
  const resolved = icon ?? routeIcon(pathname);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {resolved && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-copper-soft text-copper ring-1 ring-copper/20">
            <Icon className="h-5 w-5">{resolved}</Icon>
          </span>
        )}
        <div className="min-w-0">
          <h1 className="display-xl text-chrome-50">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-chrome-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Lädt">
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-full opacity-80" />
      <div className="skeleton h-10 w-2/3 opacity-60" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4m0 4h.01" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-600">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7L9.5 4.5A2 2 0 0 0 8 4H5a2 2 0 0 0-2 2Z" />
        </svg>
      </div>
      <p className="text-sm text-chrome-400">{text}</p>
      {action}
    </div>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className ?? 'badge-neutral'}>{children}</span>;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-flush animate-fade-in ${className ?? ''}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-5 py-4">
          <div>
            {title && <h2 className="font-display text-base font-semibold text-chrome-50">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-chrome-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
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

    // Initialer Fokus in den Dialog.
    (focusables()[0] ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
      document.body.style.overflow = '';
      // Fokus an den ausloesenden Trigger zurueckgeben.
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const maxW = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-3xl' : 'max-w-2xl';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[90vh] w-full ${maxW} animate-fade-in overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 shadow-pop focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-ink-700/70 bg-ink-850/95 px-6 py-4 backdrop-blur">
          <h2 id={titleId} className="font-display text-lg font-semibold text-chrome-50">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
            aria-label="Schließen"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
