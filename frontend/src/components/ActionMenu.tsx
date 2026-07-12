'use client';

// Zeilen-Aktionsmenue (Kebab ⋯) fuer Listen: EIN Ausloeser buendelt mehrere
// Aktionen (Oeffnen, Bearbeiten, Loeschen …) statt einer Reihe einzelner Links.
//
// - Tastatur/a11y: aria-haspopup="menu" + role="menu"/role="menuitem", Pfeil-
//   Navigation (Auf/Ab/Home/End), Escape schliesst und fokussiert den Ausloeser,
//   Tab schliesst. Aussenklick + Scroll/Resize schliessen (Muster aus
//   NotificationBell.tsx).
// - Positionierung ueber ein Portal mit position:fixed, damit das Menue NICHT
//   vom overflow-x-auto der Tabellen-Wrapper abgeschnitten wird. Es klappt nach
//   oben, wenn unten kein Platz ist.
// - Motion: animate-fade-in (reduced-motion-sicher ueber globals.css).
// - Destruktive Aktionen: `danger` faerbt rot; die eigentliche Bestaetigung
//   (ConfirmDialog) und Erfolgsmeldung (Toast) liegen beim aufrufenden Screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

export type ActionMenuItem = {
  /** Stabiler Key (React-Liste). */
  key: string;
  label: string;
  /** Navigations-Aktion (rendert einen Link). Alternativ onSelect. */
  href?: string;
  /** Klick-Aktion (rendert einen Button). */
  onSelect?: () => void;
  /** Destruktiv: rote Einfaerbung + Trennlinie zur Gruppe darueber. */
  danger?: boolean;
  disabled?: boolean;
};

type Pos = { top?: number; bottom?: number; right: number };

export function ActionMenu({
  items,
  label,
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  const t = useT();
  const menuLabel = label ?? t('ui.actionMenu.label');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Portale erst nach dem Mount rendern (kein document beim SSR).
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const estH = items.length * 40 + 16;
    const right = Math.max(8, window.innerWidth - r.right);
    // Standard: unter dem Ausloeser. Wenn dort kein Platz ist, nach oben klappen.
    if (r.bottom + estH > window.innerHeight - 8 && r.top - estH > 8) {
      setPos({ bottom: window.innerHeight - r.top + gap, right });
    } else {
      setPos({ top: r.bottom + gap, right });
    }
  }, [items.length]);

  function toggle() {
    if (open) {
      setOpen(false);
    } else {
      place();
      setOpen(true);
    }
  }

  // Schliessen bei Aussenklick / Scroll / Resize; ersten Eintrag fokussieren.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    // preventScroll: verhindert, dass der initiale Fokus die Seite scrollt und
    // damit den soeben registrierten Scroll-Listener (schliesst) sofort ausloest.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    if (nodes.length === 0) return;
    const idx = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(idx + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(idx - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  }

  if (items.length === 0) return null;

  const itemBase =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
  const tone = (danger?: boolean) =>
    danger
      ? 'text-danger hover:bg-danger/10 focus-visible:ring-danger/40'
      : 'text-chrome-200 hover:bg-ink-750 hover:text-chrome-50 focus-visible:ring-copper/40';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        onClick={toggle}
        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 ${
          open
            ? 'bg-ink-750 text-chrome-50'
            : 'text-chrome-400 hover:bg-ink-750 hover:text-chrome-50'
        }`}
      >
        <Icon className="h-[18px] w-[18px]">{ICON_PATHS.overflow}</Icon>
      </button>

      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={menuLabel}
            onKeyDown={onMenuKey}
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, right: pos.right }}
            className="z-[70] min-w-[12rem] max-w-[16rem] overflow-hidden rounded-xl border border-ink-700 bg-ink-850 p-1.5 shadow-pop animate-fade-in"
          >
            {items.map((it, i) => {
              const divider = it.danger && i > 0 && !items[i - 1].danger;
              const cls = `${itemBase} ${tone(it.danger)}`;
              const node = it.href ? (
                <Link
                  href={it.href}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  {it.label}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={it.disabled}
                  aria-disabled={it.disabled || undefined}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                  className={cls}
                >
                  {it.label}
                </button>
              );
              return divider ? (
                <div key={it.key}>
                  <div role="separator" className="my-1 h-px bg-ink-700/70" />
                  {node}
                </div>
              ) : (
                <div key={it.key}>{node}</div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
