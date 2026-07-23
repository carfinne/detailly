'use client';

// „Weiterempfehlen" (Empfehlungs-/Affiliate-Programm, Tenant-Sicht). Nur der
// Inhaber (OWNER): Code + teilbarer Link, Zaehler (geworbene Betriebe, davon
// zahlend) und Belohnungs-Stand (Gutschrift-Anwartschaften). Strikte Isolation –
// die API liefert ausschliesslich die EIGENEN Werbungen (tenantId aus dem Token).

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { datum } from '@/lib/format';
import { PageHeader, StatCard, SectionCard, ErrorBox, Empty, Badge } from '@/components/ui';
import { BrandLoader } from '@/components/BrandLoader';
import { Icon, ICON_PATHS } from '@/lib/icons';

interface Empfehlung {
  betrieb: string;
  status: string;
  belohnungTyp: string | null;
  geworbenAm: string;
  zahlendSeit: string | null;
}

interface AffiliateView {
  code: string;
  sharePath: string;
  geworben: number;
  zahlend: number;
  anwartschaften: number;
  empfehlungen: Empfehlung[];
}

export default function WeiterempfehlenPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<AffiliateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | ''>('');

  const istInhaber = user?.role === 'owner';

  // Rollen-Guard (Defense-in-Depth): Nicht-Inhaber wegleiten (Backend gated 403).
  useEffect(() => {
    if (!authLoading && user && !istInhaber) router.replace('/dashboard');
  }, [authLoading, user, istInhaber, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AffiliateView>('/affiliate/me');
      setData(res);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('affiliate.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (istInhaber) load();
  }, [istInhaber, load]);

  const shareLink =
    data && typeof window !== 'undefined' ? `${window.location.origin}${data.sharePath}` : data?.sharePath ?? '';

  async function copy(value: string, key: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* Zwischenablage gesperrt (z. B. eingebettete Vorschau) – still ignorieren. */
    }
  }

  if (authLoading || !user || !istInhaber || loading) {
    return <BrandLoader variant="full" />;
  }

  return (
    <div>
      <PageHeader title={t('affiliate.title')} subtitle={t('affiliate.subtitle')} />

      {error && <ErrorBox message={error} className="mb-5" />}

      {data && (
        <div className="space-y-6">
          {/* Zaehler */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('affiliate.stat.referred')} value={data.geworben} icon={ICON_PATHS.staff} />
            <StatCard label={t('affiliate.stat.paying')} value={data.zahlend} icon={ICON_PATHS.revenue} accent />
            <StatCard
              label={t('affiliate.stat.rewards')}
              value={data.anwartschaften}
              icon={ICON_PATHS.gift}
              hint={t('affiliate.stat.rewardsHint')}
            />
          </div>

          {/* Code + Link */}
          <SectionCard title={t('affiliate.share.title')} subtitle={t('affiliate.share.subtitle')}>
            <div className="space-y-4">
              <div className="field">
                <span className="label">{t('affiliate.share.codeLabel')}</span>
                <div className="flex items-center gap-2">
                  <input
                    className="input font-mono text-lg uppercase tracking-[0.3em]"
                    value={data.code}
                    readOnly
                    aria-label={t('affiliate.share.codeLabel')}
                  />
                  <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => copy(data.code, 'code')}>
                    {copied === 'code' ? t('affiliate.copied') : t('affiliate.copy')}
                  </button>
                </div>
              </div>

              <div className="field">
                <span className="label">{t('affiliate.share.linkLabel')}</span>
                <div className="flex items-center gap-2">
                  <input
                    className="input font-mono text-sm"
                    value={shareLink}
                    readOnly
                    aria-label={t('affiliate.share.linkLabel')}
                  />
                  <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => copy(shareLink, 'link')}>
                    {copied === 'link' ? t('affiliate.copied') : t('affiliate.copyLink')}
                  </button>
                </div>
                <p className="help mt-1.5">{t('affiliate.share.help')}</p>
              </div>

              {/* Belohnungs-Hinweis (Stripe-Verrechnung folgt) */}
              <div className="flex items-start gap-2.5 rounded-xl border border-copper/25 bg-copper-soft/20 px-3.5 py-3">
                <span className="mt-0.5 text-copper">
                  <Icon className="h-4 w-4">{ICON_PATHS.subscription}</Icon>
                </span>
                <p className="text-xs leading-relaxed text-chrome-300">{t('affiliate.reward.notice')}</p>
              </div>
            </div>
          </SectionCard>

          {/* Geworbene Betriebe */}
          <SectionCard title={t('affiliate.list.title')} subtitle={t('affiliate.list.subtitle')}>
            {data.empfehlungen.length === 0 ? (
              <Empty text={t('affiliate.list.empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('affiliate.list.col.business')}</th>
                      <th>{t('affiliate.list.col.status')}</th>
                      <th>{t('affiliate.list.col.reward')}</th>
                      <th>{t('affiliate.list.col.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.empfehlungen.map((e, i) => (
                      <tr key={i}>
                        <td className="font-medium text-chrome-100">{e.betrieb}</td>
                        <td>
                          {e.status === 'zahlend' ? (
                            <Badge className="bg-positive-soft text-positive">{t('affiliate.status.paying')}</Badge>
                          ) : (
                            <Badge className="bg-ink-800 text-chrome-300">{t('affiliate.status.registered')}</Badge>
                          )}
                        </td>
                        <td className="text-xs text-chrome-400">
                          {e.belohnungTyp === 'monat_basic' ? t('affiliate.reward.monatBasic') : '—'}
                        </td>
                        <td className="whitespace-nowrap text-xs text-chrome-400">{datum(e.geworbenAm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
