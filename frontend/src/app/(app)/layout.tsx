'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { VerificationBanner } from '@/components/VerificationBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
          <div className="grid h-11 w-11 animate-pulse place-items-center rounded-xl bg-copper-grad text-ink-950">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
              <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
            </svg>
          </div>
          <p className="text-sm text-chrome-400">Detailly wird geladen…</p>
        </div>
      </div>
    );
  }

  return (
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
  );
}
