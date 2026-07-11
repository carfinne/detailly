'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { ACCESS_COLOR } from '@/lib/labels';
import { useAuth } from '@/lib/auth';
import { INHABER_ROLLEN } from '@/lib/rollen';
import type { Plan, Subscription } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Badge, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Enum->i18n-Key (Rohwert-Fallback in der Komponente via t()). Die Modul-
// Beschriftungen baut die Seite selbst aus den Backend-Feature-Codes.
const MODUL_KEY: Record<string, string> = {
  kunden: 'abo.modul.kunden',
  fahrzeuge: 'abo.modul.fahrzeuge',
  auftraege: 'abo.modul.auftraege',
  termine: 'abo.modul.termine',
  rechnungen: 'abo.modul.rechnungen',
  shop: 'abo.modul.shop',
  mitarbeiter: 'abo.modul.mitarbeiter',
  standorte: 'abo.modul.standorte',
  audit: 'abo.modul.audit',
  // Preismodell V2: Mehrwert-Module ab Basic/Pro.
  inspektion: 'abo.modul.inspektion',
  auswertungen: 'abo.modul.auswertungen',
  mahnwesen: 'abo.modul.mahnwesen',
  export: 'abo.modul.export',
  wirtschaftlichkeit: 'abo.modul.wirtschaftlichkeit',
  zeiterfassung: 'abo.modul.zeiterfassung',
};
const ACCESS_KEY: Record<string, string> = {
  full: 'abo.access.full',
  warn: 'abo.access.warn',
  blocked: 'abo.access.blocked',
};
const SUB_STATUS_KEY: Record<string, string> = {
  trial: 'abo.status.trial',
  active: 'abo.status.active',
  past_due: 'abo.status.past_due',
  canceled: 'abo.status.canceled',
  suspended: 'abo.status.suspended',
};

function trialTageRest(sub: Subscription | null): number | null {
  if (!sub || sub.status !== 'trial' || !sub.trialEndsAt) return null;
  const ms = new Date(sub.trialEndsAt).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}

export default function AboPage() {
  const { user } = useAuth();
  const toast = useToast();
  const t = useT();
  const istInhaber = !!user && INHABER_ROLLEN.includes(user.role);

  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [interval, setIntervalChoice] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, pl] = await Promise.all([
        api.get<Subscription | null>('/subscriptions/me'),
        api.get<Plan[]>('/subscriptions/plans'),
      ]);
      setSub(me);
      setPlans(pl);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('abo.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Rueckkehr aus dem Checkout: Stand aktiv von Stripe nachziehen (Webhook-Fallback).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status === 'success') {
      toast(t('abo.toast.success'), { duration: 6000 });
      api.post('/billing/sync').catch(() => undefined).finally(() => void load());
      window.history.replaceState(null, '', window.location.pathname);
    } else if (status === 'cancel') {
      toast(t('abo.toast.cancel'), { variant: 'copper', duration: 6000 });
      window.history.replaceState(null, '', window.location.pathname);
      void load();
    } else {
      void load();
    }
  }, [load, toast, t]);

  async function buchen(plan: Plan) {
    setError('');
    setBusyPlan(plan.id);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', { planId: plan.id, interval });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('abo.error.checkout'));
      setBusyPlan(null);
    }
  }

  async function verwalten() {
    setError('');
    setPortalBusy(true);
    try {
      const { url } = await api.post<{ url: string }>('/billing/portal');
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('abo.error.portal'));
      setPortalBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t('abo.title')} subtitle={t('abo.subtitle')} />
        <Loading />
      </>
    );
  }

  const access = sub?.access;
  const tageRest = trialTageRest(sub);
  // /subscriptions/me liefert bewusst keine rohe Stripe-ID mehr, nur dieses Flag.
  const hatStripeAbo = Boolean(sub?.hatStripeAbo);

  return (
    <>
      <PageHeader title={t('abo.title')} subtitle={t('abo.subtitle')} />

      <div className="max-w-4xl space-y-5">
        {error && <ErrorBox message={error} />}

        {/* Aktueller Stand */}
        <SectionCard title={t('abo.card.title')} subtitle={t('abo.card.subtitle')}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-display text-lg font-semibold text-chrome-50">
                  {sub?.plan?.name ?? (sub?.status === 'trial' ? t('abo.planFallback.trial') : t('abo.planFallback.none'))}
                </span>
                {access && (
                  <Badge className={ACCESS_COLOR[access.access]}>
                    {ACCESS_KEY[access.access] ? t(ACCESS_KEY[access.access]) : access.access}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-chrome-400">
                {sub ? (SUB_STATUS_KEY[sub.status] ? t(SUB_STATUS_KEY[sub.status]) : sub.status) : t('abo.noAbo')}
                {tageRest !== null && ` · ${t(tageRest === 1 ? 'abo.remainingDayOne' : 'abo.remainingDayMany', { count: tageRest })}`}
                {sub?.currentPeriodEnd && sub.status !== 'trial' && ` · ${t('abo.periodUntil', { datum: datum(sub.currentPeriodEnd) })}`}
                {access?.reason && access.access !== 'full' ? ` · ${access.reason}` : ''}
              </p>
            </div>
            {hatStripeAbo && (
              <button className="btn-ghost" onClick={verwalten} disabled={portalBusy}>
                {portalBusy ? t('abo.portalOpening') : t('abo.manage')}
              </button>
            )}
          </div>
        </SectionCard>

        {!istInhaber && (
          <div className="rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-chrome-300">
            {t('abo.ownerOnly')}
          </div>
        )}

        {/* Zahlweise-Umschalter */}
        <div className="flex items-center justify-center">
          <div className="seg-group inline-flex">
            {(['month', 'year'] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setIntervalChoice(iv)}
                className={`seg ${
                  interval === iv ? 'seg-active' : ''
                }`}
              >
                {iv === 'month' ? t('abo.interval.month') : t('abo.interval.year')}
                {iv === 'year' && <span className="ml-1.5 text-xs text-copper-300">{t('abo.interval.yearBonus')}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tarife */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const aktuell = sub?.planId === plan.id && sub?.status === 'active';
            const preisIdDa = interval === 'year' ? Boolean(plan.stripePriceIdYearly) : Boolean(plan.stripePriceId);
            const buchbar = istInhaber && preisIdDa && !aktuell;
            const jahrespreis =
              plan.preisJaehrlich != null && plan.preisJaehrlich !== ''
                ? Number(plan.preisJaehrlich)
                : Number(plan.preisMonatlich) * 10;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-5 ${
                  aktuell ? 'border-copper/60 bg-copper-soft/40' : 'border-ink-700 bg-ink-850'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg font-semibold text-chrome-50">{plan.name}</h3>
                  {aktuell && <span className="badge-copper">{t('abo.current')}</span>}
                </div>
                {interval === 'year' ? (
                  <>
                    <p className="mt-1 font-display text-2xl font-bold text-chrome-50">
                      {eur(jahrespreis)}
                      <span className="text-sm font-normal text-chrome-500"> {t('abo.perYear')}</span>
                    </p>
                    <p className="text-xs text-copper-300">
                      {t('abo.equivMonth', { preis: eur(jahrespreis / 12) })}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-display text-2xl font-bold text-chrome-50">
                    {eur(plan.preisMonatlich)}
                    <span className="text-sm font-normal text-chrome-500"> {t('abo.perMonth')}</span>
                  </p>
                )}
                {plan.beschreibung && <p className="mt-2 text-sm text-chrome-400">{plan.beschreibung}</p>}

                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-chrome-300">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {MODUL_KEY[f] ? t(MODUL_KEY[f]) : f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {aktuell ? (
                    <button className="btn-ghost w-full" disabled>{t('abo.currentPlanBtn')}</button>
                  ) : (
                    <button
                      className="btn-primary w-full"
                      onClick={() => buchen(plan)}
                      disabled={!buchbar || busyPlan === plan.id}
                      title={!preisIdDa ? t('abo.notBookableTitle') : undefined}
                    >
                      {busyPlan === plan.id
                        ? t('abo.toStripe')
                        : !preisIdDa
                          ? t('abo.soon')
                          : hatStripeAbo
                            ? t('abo.switch')
                            : t('abo.book')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-chrome-500">
          {t('abo.stripeNote')}
        </p>
      </div>
    </>
  );
}
