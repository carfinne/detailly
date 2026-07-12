'use client';

// Wirtschaftlichkeit (Deckungsbeitrag) je Auftrag: Netto - Lohn - Material = Marge.
// NUR fuer die Leitung (Backend ist @Roles-geschuetzt); fuer andere Rollen wird
// gar nichts gerendert/geladen.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { LEITUNG_ROLLEN } from '@/lib/rollen';

interface Wirtschaftlichkeit {
  netto: number;
  lohnkosten: number;
  materialkosten: number;
  marge: number;
  margeProzent: number | null;
}

export function ProfitabilityCard({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const t = useT();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [data, setData] = useState<Wirtschaftlichkeit | null>(null);
  const [error, setError] = useState('');
  // Tarif-403 (Wirtschaftlichkeit ist Pro-only) -> Upgrade-Hinweis statt Sackgasse.
  const [upgrade, setUpgrade] = useState(false);

  useEffect(() => {
    if (!istLeitung) return;
    let aktiv = true;
    api
      .get<Wirtschaftlichkeit>(`/profitability/${orderId}`)
      .then((r) => aktiv && setData(r))
      .catch((e) => {
        if (!aktiv) return;
        if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
        setError(e instanceof Error ? e.message : t('ui.profitability.unavailable'));
      });
    return () => {
      aktiv = false;
    };
  }, [istLeitung, orderId]);

  if (!istLeitung) return null;

  const positiv = (data?.marge ?? 0) >= 0;

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('ui.profitability.title')}</h2>
        <span className="text-xs text-chrome-500">{t('ui.profitability.subtitle')}</span>
      </div>

      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-chrome-500">{error}</p>
          {upgrade && (
            <Link href="/abo" className="link-action text-sm">
              {t('common.toSubscription')} →
            </Link>
          )}
        </div>
      ) : !data ? (
        <p className="text-sm text-chrome-500">{t('common.loadingEllipsis')}</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          <Row k={t('ui.profitability.revenue')} v={eur(data.netto)} />
          <Row k={t('ui.profitability.labor')} v={eur(data.lohnkosten)} muted />
          <Row k={t('ui.profitability.material')} v={eur(data.materialkosten)} muted />
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink-700 pt-2.5">
            <dt className="font-semibold text-chrome-100">{t('ui.profitability.margin')}</dt>
            <dd className="flex items-baseline gap-2">
              <span className={`font-display text-xl font-bold ${positiv ? 'text-copper' : 'text-danger'}`}>
                {eur(data.marge)}
              </span>
              {data.margeProzent !== null && (
                <span className="text-xs text-chrome-500">{data.margeProzent} %</span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? 'text-chrome-400' : 'text-chrome-300'}>{k}</dt>
      <dd className="tabular-nums text-chrome-100">{v}</dd>
    </div>
  );
}
