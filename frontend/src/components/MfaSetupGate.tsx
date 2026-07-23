'use client';

// Vollbild-Einrichtungsschranke fuer die ERZWUNGENE 2FA (Pilot-Haertung).
// Wird vom (app)-Layout ANSTELLE der App gerendert, sobald 2FA fuer den Nutzer
// Pflicht ist (user.mfaPflicht) und noch nicht aktiv (siehe Server-Erzwingung im
// JwtAuthGuard). Vorteil gegenueber einem Redirect: es werden GAR KEINE
// geschuetzten Endpunkte geladen (die der Server ohnehin mit 403
// MFA_SETUP_REQUIRED sperren wuerde) – der Nutzer richtet 2FA direkt hier ein.
// Wiederverwendet die bestehende MfaSection (QR + Code + Recovery-Codes).

import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui';
import { MfaSection } from '@/components/MfaSection';
import { BrandTile } from '@/components/brand';

export function MfaSetupGate() {
  const { logout } = useAuth();
  const t = useT();

  return (
    <ToastProvider>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6">
        {/* Atmosphaerischer Glow wie auf den oeffentlichen Seiten. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-copper-glow blur-[120px]" />
          <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/10 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-lg animate-fade-in">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandTile size="lg" className="mb-4 shadow-glow" />
            <h1 className="font-display text-2xl font-bold tracking-tight">{t('mfa.gate.title')}</h1>
            <p className="mt-2 text-sm text-chrome-400">{t('mfa.gate.desc')}</p>
          </div>

          <MfaSection />

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-sm font-medium text-chrome-500 transition-colors hover:text-chrome-300"
            >
              {t('mfa.gate.logout')}
            </button>
          </div>
        </div>
      </main>
    </ToastProvider>
  );
}
