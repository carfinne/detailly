'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useBrancheTheme } from '@/lib/branche';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { VerificationBanner } from '@/components/VerificationBanner';
import { ToastProvider } from '@/components/ui';
import { BrandTile } from '@/components/brand';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Branchen-Theming: Betriebstyp faerbt den Akzent der gesamten App.
  useBrancheTheme(!!user);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Persoenliche Darstellungs-Einstellung (Bewegung reduzieren) app-weit anwenden.
  useEffect(() => {
    try {
      const reduce = localStorage.getItem('detailly_reduce_motion') === '1';
      document.documentElement.classList.toggle('dl-reduce-motion', reduce);
    } catch { /* localStorage evtl. gesperrt -> ignorieren */ }
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900">
        <div className="flex flex-col items-center gap-3">
          <BrandTile size="md" className="dl-brand-breathe" />
          <p className="text-sm text-chrome-400">Detailly wird geladen…</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden p-5 md:p-7">
            <VerificationBanner />
            {/* key=pathname -> sanfter Fade-In bei jedem Seitenwechsel (einheitlich) */}
            <div key={pathname} className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
