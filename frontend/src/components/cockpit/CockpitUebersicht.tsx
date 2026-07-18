'use client';

// Cockpit-Tab „Übersicht": Live-Kennzahlen (/platform/cockpit/live) plus
// Schnellzugriff-Karten in die Plattform-Spezialbereiche. Read-only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { zahl } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { Loading, ErrorBox, StatCard } from '@/components/ui';
import type { LiveKpi, TenantListResult } from './types';

export function CockpitUebersicht({ istAdmin }: { istAdmin: boolean }) {
  const t = useT();
  const [kpi, setKpi] = useState<LiveKpi | null>(null);
  const [betriebeGesamt, setBetriebeGesamt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        // Betriebe-Gesamtzahl kommt aus dem total der (ohnehin paginierten)
        // Betriebs-Liste – eine Zeile reicht, uns interessiert nur der Zaehler.
        const [live, tenants] = await Promise.all([
          api.get<LiveKpi>('/platform/cockpit/live'),
          api.get<TenantListResult>('/platform/tenants?limit=1'),
        ]);
        if (!aktiv) return;
        setKpi(live);
        setBetriebeGesamt(tenants.total);
        setError('');
      } catch (e) {
        if (aktiv) setError(e instanceof Error ? e.message : t('cockpit.error.load'));
      } finally {
        if (aktiv) setLoading(false);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [t]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!kpi) return null;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h2 className="font-display text-base font-semibold text-chrome-50">{t('cockpit.live.title')}</h2>
          <p className="mt-0.5 text-xs text-chrome-400">{t('cockpit.live.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={t('cockpit.kpi.tenants')}
            value={betriebeGesamt ?? 0}
            icon={ICON_PATHS.customers}
            accent
          />
          <StatCard
            label={t('cockpit.kpi.trials')}
            value={kpi.testphasenEndenIn7Tagen}
            icon={ICON_PATHS.time}
            hint={t('cockpit.kpi.trialsHint')}
          />
          <StatCard
            label={t('cockpit.kpi.activeUsers')}
            value={kpi.aktiveNutzer24h}
            icon={ICON_PATHS.staff}
          />
          <StatCard
            label={t('cockpit.kpi.tickets')}
            value={kpi.offeneSupportTickets}
            icon={ICON_PATHS.support}
          />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-display text-base font-semibold text-chrome-50">{t('cockpit.hub.title')}</h2>
          <p className="mt-0.5 text-xs text-chrome-400">{t('cockpit.hub.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubKarte
            href="/plattform-support"
            icon={ICON_PATHS.support}
            title={t('cockpit.hub.support')}
            hint={t('cockpit.hub.supportHint')}
            zaehler={kpi.offeneSupportTickets}
          />
          <HubKarte
            href="/plattform-marktplatz"
            icon={ICON_PATHS.tag}
            title={t('cockpit.hub.marketplace')}
            hint={t('cockpit.hub.marketplaceHint')}
            zaehler={kpi.offeneKybBewerbungen}
          />
          {istAdmin && (
            <HubKarte
              href="/plattform-newsletter"
              icon={ICON_PATHS.inbox}
              title={t('cockpit.hub.newsletter')}
              hint={t('cockpit.hub.newsletterHint')}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function HubKarte({
  href,
  icon,
  title,
  hint,
  zaehler,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
  zaehler?: number;
}) {
  const t = useT();
  return (
    <Link
      href={href}
      className="card group flex items-center gap-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-600"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-copper-soft text-copper ring-1 ring-copper/20 transition-transform duration-150 group-hover:scale-105">
        <Icon className="h-5 w-5">{icon}</Icon>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-display text-sm font-semibold text-chrome-50">{title}</span>
          {zaehler !== undefined && zaehler > 0 && (
            <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-copper px-1.5 text-[11px] font-semibold text-ink-950">
              {zahl(zaehler)}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-chrome-400">{hint}</span>
      </span>
      <span className="shrink-0 text-chrome-500 transition-transform duration-150 group-hover:translate-x-0.5">
        <Icon className="h-4 w-4">{ICON_PATHS.arrow}</Icon>
      </span>
      <span className="sr-only">{t('cockpit.hub.open')}</span>
    </Link>
  );
}
