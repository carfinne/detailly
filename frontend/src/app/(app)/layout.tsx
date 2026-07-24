'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useBrancheTheme } from '@/lib/branche';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { VerificationBanner } from '@/components/VerificationBanner';
import { MfaBanner } from '@/components/MfaBanner';
import { MfaSetupGate } from '@/components/MfaSetupGate';
import { ToastProvider } from '@/components/ui';
import { BrandLoader } from '@/components/BrandLoader';
import { EntitlementsProvider } from '@/lib/entitlements';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const t = useT();
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
    return <BrandLoader variant="full" />;
  }

  // 2FA-Erzwingung (serverseitig gespiegelt): ist 2FA fuer diesen Nutzer Pflicht
  // (Plattform-Rolle oder Tenant-mfaPflicht) und noch NICHT aktiv, wird die App
  // durch den Einrichtungs-Screen ERSETZT. So werden keine geschuetzten
  // Endpunkte geladen (der Server sperrt sie ohnehin mit 403 MFA_SETUP_REQUIRED)
  // und der Nutzer richtet 2FA sofort ein. Login selbst bleibt intakt.
  if (user.mfaPflicht && !user.mfaEnabled) {
    return <MfaSetupGate />;
  }

  return (
    <ToastProvider>
      <EntitlementsProvider>
      {/* Skip-Link: erstes fokussierbares Element -> Tastaturnutzer ueberspringen
          Sidebar/Topbar und landen direkt im Seiteninhalt. Sichtbar nur bei Fokus. */}
      <a
        href="#hauptinhalt"
        className="btn-primary btn-sm sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[70]"
      >
        {t('ui.skipToContent')}
      </a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main
            id="hauptinhalt"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden p-5 focus:outline-none md:p-7"
          >
            <VerificationBanner />
            <MfaBanner />
            {/* key=pathname -> sanfter Fade-In bei jedem Seitenwechsel (einheitlich) */}
            <div key={pathname} className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
      </EntitlementsProvider>
    </ToastProvider>
  );
}
