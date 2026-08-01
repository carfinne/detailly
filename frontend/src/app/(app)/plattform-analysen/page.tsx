'use client';

// Plattform-Analysen (Detailly, betriebsuebergreifend). NUR Plattform-Rollen –
// Backend ist @Roles-geschuetzt; die Nav blendet den Eintrag fuer Kunden aus.
// Neben Abos/Wachstum/Nutzung/Aktivitaet zeigt die Seite die Zahlungs-/Bindungs-
// sicht: wer sollte zahlen und tut es nicht, welcher Test laeuft aus, wer kuendigt.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur, zahl, datum } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, StatCard, Badge } from '@/components/ui';

interface Overview {
  abos: {
    aktiv: number;
    testphase: number;
    gekuendigt: number;
    pilot: number;
    pastDue: number;
    suspended: number;
    mrr: number;
    tarife: { name: string; anzahl: number }[];
  };
  wachstum: { betriebeGesamt: number; neuDiesenMonat: number; trend: { label: string; anzahl: number }[] };
  nutzung: { auftraege: number; rechnungen: number; umsatzGesamt: number };
  aktivitaet: { topBetriebe: { name: string; auftraege: number }[]; inaktivAnzahl: number; inaktivBetriebe: { name: string }[] };
  zahlungen: {
    zahlungsprobleme: { anzahl: number; betriebe: { name: string; status: string; seit: string | null }[] };
    testsLaufenAus: { anzahl: number; betriebe: { name: string; ablauf: string | null; tageUebrig: number }[] };
    testsAbgelaufen: { anzahl: number; betriebe: { name: string; ablauf: string | null }[] };
    kuendigungenZumEnde: { anzahl: number; betriebe: { name: string; datum: string | null }[] };
    kuendigungenDiesenMonat: { anzahl: number; betriebe: { name: string; datum: string | null }[] };
  };
}

const STATUS_BADGE: Record<string, string> = {
  past_due: 'badge-caution',
  suspended: 'badge-danger',
};

export default function PlattformAnalysenPage() {
  const t = useT();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Overview>('/platform/analytics')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('platformAnalytics.error.load')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const trendMax = Math.max(1, ...data.wachstum.trend.map((m) => m.anzahl));
  const topMax = Math.max(1, ...data.aktivitaet.topBetriebe.map((b) => b.auftraege));
  const z = data.zahlungen;

  // Tage-uebrig als menschlicher Text + Dringlichkeitsfarbe.
  const tageText = (tage: number) =>
    tage <= 0 ? t('platformAnalytics.trialEnding.today') : t(`platformAnalytics.trialEnding.${tage === 1 ? 'day' : 'days'}`, { n: tage });
  const tageClass = (tage: number) =>
    tage <= 1 ? 'badge-danger' : tage <= 3 ? 'badge-caution' : 'badge-neutral';

  return (
    <div>
      <PageHeader title={t('platformAnalytics.title')} subtitle={t('platformAnalytics.subtitle')} />

      <div className="space-y-5">
        {/* ===== Zahlungs-/Bindungssicht – die dringendsten zuerst ===== */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Zahlungsprobleme */}
          <SectionCard title={t('platformAnalytics.payProblems.title')} subtitle={t('platformAnalytics.payProblems.subtitle')}>
            <p className="mb-3 font-display text-3xl font-bold text-danger">{zahl(z.zahlungsprobleme.anzahl)}</p>
            {z.zahlungsprobleme.betriebe.length === 0 ? (
              <Empty text={t('platformAnalytics.payProblems.empty')} />
            ) : (
              <ul className="divide-y divide-ink-700/50">
                {z.zahlungsprobleme.betriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-chrome-100">{b.name}</span>
                      {b.seit && (
                        <span className="mt-0.5 block text-xs text-chrome-500">
                          {t('platformAnalytics.payProblems.since', { datum: datum(b.seit) })}
                        </span>
                      )}
                    </span>
                    <Badge className={STATUS_BADGE[b.status] ?? 'badge-neutral'}>
                      {t(`platformAnalytics.status.${b.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Tests laufen bald aus – die wichtigste Liste */}
          <SectionCard title={t('platformAnalytics.trialEnding.title')} subtitle={t('platformAnalytics.trialEnding.subtitle')}>
            <p className="mb-3 font-display text-3xl font-bold text-copper">{zahl(z.testsLaufenAus.anzahl)}</p>
            {z.testsLaufenAus.betriebe.length === 0 ? (
              <Empty text={t('platformAnalytics.trialEnding.empty')} />
            ) : (
              <ul className="divide-y divide-ink-700/50">
                {z.testsLaufenAus.betriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-chrome-100">{b.name}</span>
                      {b.ablauf && <span className="mt-0.5 block text-xs text-chrome-500">{datum(b.ablauf)}</span>}
                    </span>
                    <Badge className={tageClass(b.tageUebrig)}>{tageText(b.tageUebrig)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Tests abgelaufen (ungewandelt) */}
          <SectionCard title={t('platformAnalytics.trialExpired.title')} subtitle={t('platformAnalytics.trialExpired.subtitle')}>
            <p className="mb-3 font-display text-2xl font-bold text-caution">{zahl(z.testsAbgelaufen.anzahl)}</p>
            {z.testsAbgelaufen.betriebe.length === 0 ? (
              <Empty text={t('platformAnalytics.trialExpired.empty')} />
            ) : (
              <ul className="divide-y divide-ink-700/50">
                {z.testsAbgelaufen.betriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-chrome-100">{b.name}</span>
                    {b.ablauf && <span className="shrink-0 text-xs text-chrome-500">{datum(b.ablauf)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Kuendigungen: zum Laufzeitende + diesen Monat */}
          <SectionCard title={t('platformAnalytics.churn.title')} subtitle={t('platformAnalytics.churn.subtitle')}>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-chrome-500">{t('platformAnalytics.churn.toEnd')}</span>
                  <span className="font-display text-lg font-bold text-chrome-50">{zahl(z.kuendigungenZumEnde.anzahl)}</span>
                </div>
                {z.kuendigungenZumEnde.betriebe.length === 0 ? (
                  <Empty text={t('platformAnalytics.churn.toEndEmpty')} />
                ) : (
                  <ul className="divide-y divide-ink-700/50">
                    {z.kuendigungenZumEnde.betriebe.map((b, i) => (
                      <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-chrome-100">{b.name}</span>
                        {b.datum && (
                          <span className="shrink-0 text-xs text-chrome-500">
                            {t('platformAnalytics.churn.endsOn', { datum: datum(b.datum) })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-ink-700/60 pt-4">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-chrome-500">{t('platformAnalytics.churn.thisMonth')}</span>
                  <span className="font-display text-lg font-bold text-caution">{zahl(z.kuendigungenDiesenMonat.anzahl)}</span>
                </div>
                {z.kuendigungenDiesenMonat.betriebe.length === 0 ? (
                  <Empty text={t('platformAnalytics.churn.thisMonthEmpty')} />
                ) : (
                  <ul className="divide-y divide-ink-700/50">
                    {z.kuendigungenDiesenMonat.betriebe.map((b, i) => (
                      <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-chrome-100">{b.name}</span>
                        {b.datum && (
                          <span className="shrink-0 text-xs text-chrome-500">
                            {t('platformAnalytics.churn.canceledOn', { datum: datum(b.datum) })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Ehrlicher Hinweis: Stripe ist noch nicht scharf. */}
        <p className="rounded-xl border border-ink-700/60 bg-ink-850 px-4 py-3 text-xs leading-relaxed text-chrome-400">
          {t('platformAnalytics.stripeNote')}
        </p>

        {/* ===== Abos & MRR – alle Status ===== */}
        <SectionCard title={t('platformAnalytics.subs.title')} subtitle={t('platformAnalytics.subs.subtitle')}>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('platformAnalytics.subs.mrr')} value={eur(data.abos.mrr)} accent />
            <StatCard label={t('platformAnalytics.subs.active')} value={zahl(data.abos.aktiv)} />
            <StatCard label={t('platformAnalytics.subs.pilot')} value={zahl(data.abos.pilot)} />
            <StatCard label={t('platformAnalytics.subs.trial')} value={zahl(data.abos.testphase)} />
            <StatCard label={t('platformAnalytics.subs.pastDue')} value={zahl(data.abos.pastDue)} />
            <StatCard label={t('platformAnalytics.subs.suspended')} value={zahl(data.abos.suspended)} />
            <StatCard label={t('platformAnalytics.subs.canceled')} value={zahl(data.abos.gekuendigt)} />
          </div>
          {data.abos.tarife.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.abos.tarife.map((tarif) => (
                <span key={tarif.name} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200">
                  {tarif.name}: <span className="font-semibold text-chrome-50">{zahl(tarif.anzahl)}</span>
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Wachstum */}
          <SectionCard title={t('platformAnalytics.growth.title')} subtitle={t('platformAnalytics.growth.subtitle')}>
            <div className="mb-3 flex items-baseline gap-4">
              <div>
                <p className="font-display text-2xl font-bold text-chrome-50">{zahl(data.wachstum.betriebeGesamt)}</p>
                <p className="text-xs text-chrome-500">{t('platformAnalytics.growth.total')}</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-copper">+{zahl(data.wachstum.neuDiesenMonat)}</p>
                <p className="text-xs text-chrome-500">{t('platformAnalytics.growth.thisMonth')}</p>
              </div>
            </div>
            <div className="flex h-24 items-end gap-2">
              {data.wachstum.trend.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t bg-copper/70" style={{ height: `${(m.anzahl / trendMax) * 100}%` }} title={`${m.label}: ${m.anzahl}`} />
                  </div>
                  <span className="text-[10px] text-chrome-500">{m.label}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Nutzung */}
          <SectionCard title={t('platformAnalytics.usage.title')} subtitle={t('platformAnalytics.usage.subtitle')}>
            <div className="grid grid-cols-1 gap-3">
              <Zeile k={t('platformAnalytics.usage.orders')} v={zahl(data.nutzung.auftraege)} />
              <Zeile k={t('platformAnalytics.usage.docs')} v={zahl(data.nutzung.rechnungen)} />
              <Zeile k={t('platformAnalytics.usage.revenue')} v={eur(data.nutzung.umsatzGesamt)} accent />
            </div>
          </SectionCard>
        </div>

        {/* Aktivität */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={t('platformAnalytics.topShops.title')} subtitle={t('platformAnalytics.topShops.subtitle')}>
            {data.aktivitaet.topBetriebe.length === 0 ? (
              <Empty text={t('platformAnalytics.topShops.empty')} />
            ) : (
              <ul className="space-y-3">
                {data.aktivitaet.topBetriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-chrome-100"><span className="mr-2 text-chrome-500">{i + 1}.</span>{b.name}</span>
                      <span className="shrink-0 tabular-nums text-chrome-200">{zahl(b.auftraege)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-750">
                      <div className="h-full rounded-full bg-copper" style={{ width: `${(b.auftraege / topMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={t('platformAnalytics.churnRisk.title')} subtitle={t('platformAnalytics.churnRisk.subtitle')}>
            <p className="mb-3 font-display text-2xl font-bold text-caution">{zahl(data.aktivitaet.inaktivAnzahl)}</p>
            {data.aktivitaet.inaktivBetriebe.length === 0 ? (
              <Empty text={t('platformAnalytics.churnRisk.empty')} />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.aktivitaet.inaktivBetriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="rounded-lg border border-caution/30 bg-caution-soft px-2.5 py-1 text-sm text-caution">
                    {b.name}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Zeile({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-700/50 pb-2 last:border-0">
      <span className="text-sm text-chrome-300">{k}</span>
      <span className={`font-display text-lg font-bold tabular-nums ${accent ? 'text-copper' : 'text-chrome-50'}`}>{v}</span>
    </div>
  );
}
