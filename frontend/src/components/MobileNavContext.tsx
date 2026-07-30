'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Geteilter Offen-Zustand fuer den mobilen Navigations-Drawer.
 *
 * Warum ein Context: der Drawer (MobileNav, in der Topbar) und die untere
 * Schnellzugriff-Leiste (MobileQuickBar) sind zwei getrennte Komponenten, sollen
 * aber DENSELBEN Drawer oeffnen/schliessen. Statt den Zustand zu duplizieren,
 * teilen sie ihn ueber diesen kleinen Context (eine Quelle der Wahrheit).
 */
type MobileNavCtx = {
  open: boolean;
  setOpen: (value: boolean) => void;
  openNav: () => void;
  closeNav: () => void;
};

const MobileNavContext = createContext<MobileNavCtx | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openNav = useCallback(() => setOpen(true), []);
  const closeNav = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, setOpen, openNav, closeNav }), [open, openNav, closeNav]);
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav(): MobileNavCtx {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error('useMobileNav muss innerhalb von <MobileNavProvider> verwendet werden.');
  }
  return ctx;
}
