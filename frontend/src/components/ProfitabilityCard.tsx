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
  gebuchteMinuten: number;
  gebuchteStunden: number;
  deckungsbeitragProStunde: number | null;
  umsatzProStunde: number | null;
}

/** Stunden in Handwerker-Schreibweise (de-DE, bis 2 Nachkommastellen). */
const stdFmt = (n: number) =>
  Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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
        <>
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

          {/* "Was bringt die Stunde": die eigentliche Antwort – prominent. Bei
              0 gebuchten Stunden ein Hinweis statt einer irrefuehrenden 0. */}
          <div className="mt-4 rounded-xl border border-copper/30 bg-copper/[0.06] p-3.5">
            <div className="text-xs font-medium uppercase tracking-wide text-chrome-400">
              {t('ui.profitability.perHour.label')}
            </div>
            {data.deckungsbeitragProStunde === null ? (
              <p className="mt-1.5 text-sm text-chrome-500">{t('ui.profitability.perHour.noTime')}</p>
            ) : (
              <>
                <div className="mt-0.5 font-display text-2xl font-bold tabular-nums text-copper">
                  {t('ui.profitability.perHour.value', { wert: eur(data.deckungsbeitragProStunde) })}
                </div>
                <p className="mt-1 text-xs text-chrome-500">{t('ui.profitability.perHour.hint')}</p>
                <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-ink-700/60 pt-2.5 text-xs text-chrome-400">
                  <span>{t('ui.profitability.perHour.hours', { stunden: stdFmt(data.gebuchteStunden) })}</span>
                  {data.umsatzProStunde !== null && (
                    <span className="tabular-nums">
                      {t('ui.profitability.perHour.revenue', { wert: eur(data.umsatzProStunde) })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </>
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
