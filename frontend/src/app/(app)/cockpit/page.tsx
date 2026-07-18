'use client';

// BETREIBER-COCKPIT (Detailly-Plattform, Teil 2 = nur Frontend). Verbraucht die
// read-only API aus Teil 1 (/platform/*). In-Page-Tabs statt Sub-Routen.
//
// Sicherheit (Defense-in-Depth): Page-Level-Rollen-Guard – eine Nicht-Plattform-
// Rolle wird nach /dashboard umgeleitet (die Nav blendet den Eintrag ohnehin aus,
// und das Backend gated jeden Endpunkt zusaetzlich). Der Tab „Protokoll" und die
// Nutzer-Suche sind zusaetzlich auf PLATFORM_ADMIN begrenzt (passend zum API-Gate,
// das sonst 403 liefert).

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { PLATTFORM_ROLLEN } from '@/lib/rollen';
import { PageHeader } from '@/components/ui';
import { BrandLoader } from '@/components/BrandLoader';
import { CockpitUebersicht } from '@/components/cockpit/CockpitUebersicht';
import { CockpitStandorte } from '@/components/cockpit/CockpitStandorte';
import { CockpitBetriebe } from '@/components/cockpit/CockpitBetriebe';
import { CockpitProtokoll } from '@/components/cockpit/CockpitProtokoll';

type TabKey = 'uebersicht' | 'standorte' | 'betriebe' | 'protokoll';

export default function CockpitPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading } = useAuth();

  const istPlattform = !!user && PLATTFORM_ROLLEN.includes(user.role);
  const istAdmin = user?.role === 'platform_admin';

  // Rollen-Guard: Nicht-Plattform-Rollen hart wegleiten (nicht nur Nav-Filter).
  // Erst nach dem Laden entscheiden, damit ein noch nicht aufgeloester Nutzer
  // nicht faelschlich umgeleitet wird.
  useEffect(() => {
    if (!loading && user && !istPlattform) {
      router.replace('/dashboard');
    }
  }, [loading, user, istPlattform, router]);

  const [tab, setTab] = useState<TabKey>('uebersicht');

  // Tab-Definition: „Protokoll" nur fuer Plattform-Admin (API 403 sonst).
  const tabs = useMemo(
    () =>
      (
        [
          { key: 'uebersicht', labelKey: 'cockpit.tab.uebersicht' },
          { key: 'standorte', labelKey: 'cockpit.tab.standorte' },
          { key: 'betriebe', labelKey: 'cockpit.tab.betriebe' },
          ...(istAdmin ? [{ key: 'protokoll', labelKey: 'cockpit.tab.protokoll' }] : []),
        ] as { key: TabKey; labelKey: string }[]
      ),
    [istAdmin],
  );

  // Solange geladen wird ODER eine unzulaessige Rolle weggeleitet wird: Loader.
  if (loading || !user || !istPlattform) {
    return <BrandLoader variant="full" />;
  }

  return (
    <div>
      <PageHeader title={t('cockpit.title')} subtitle={t('cockpit.subtitle')} />

      <div className="seg-group mb-5" role="tablist" aria-label={t('cockpit.title')}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={`seg ${tab === tb.key ? 'seg-active' : ''}`}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {/* key=tab -> sanfter Fade beim Tab-Wechsel (Konvention aus dem App-Layout). */}
      <div key={tab} className="animate-fade-in">
        {tab === 'uebersicht' && <CockpitUebersicht istAdmin={istAdmin} />}
        {tab === 'standorte' && <CockpitStandorte />}
        {tab === 'betriebe' && <CockpitBetriebe istAdmin={istAdmin} />}
        {tab === 'protokoll' && istAdmin && <CockpitProtokoll />}
      </div>
    </div>
  );
}
