'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { ACCESS_COLOR, ACCESS_LABEL, SUBSCRIPTION_STATUS_LABEL } from '@/lib/labels';
import { useAuth } from '@/lib/auth';
import type { Plan, Subscription } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Badge } from '@/components/ui';

const MODUL_LABEL: Record<string, string> = {
  kunden: 'Kunden',
  fahrzeuge: 'Fahrzeuge',
  auftraege: 'Aufträge',
  termine: 'Termine',
  rechnungen: 'Rechnungen',
  shop: 'Shop & Lager',
  mitarbeiter: 'Mitarbeiter',
  standorte: 'Standorte',
  audit: 'Audit-Log',
};

function trialTageRest(sub: Subscription | null): number | null {
  if (!sub || sub.status !== 'trial' || !sub.trialEndsAt) return null;
  const ms = new Date(sub.trialEndsAt).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}

export default function AboPage() {
  const { user } = useAuth();
  const istInhaber = user?.role === 'owner' || user?.role === 'platform_admin';

  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [interval, setIntervalChoice] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [hinweis, setHinweis] = useState<{ art: 'ok' | 'info'; text: string } | null>(null);

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
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  // Rueckkehr aus dem Checkout: Stand aktiv von Stripe nachziehen (Webhook-Fallback).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status === 'success') {
      setHinweis({ art: 'ok', text: 'Vielen Dank! Dein Abo wird aktiviert.' });
      api.post('/billing/sync').catch(() => undefined).finally(() => void load());
      window.history.replaceState(null, '', window.location.pathname);
    } else if (status === 'cancel') {
      setHinweis({ art: 'info', text: 'Vorgang abgebrochen – es wurde nichts berechnet.' });
      window.history.replaceState(null, '', window.location.pathname);
      void load();
    } else {
      void load();
    }
  }, [load]);

  async function buchen(plan: Plan) {
    setError('');
    setBusyPlan(plan.id);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', { planId: plan.id, interval });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Checkout fehlgeschlagen');
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
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Portal konnte nicht geöffnet werden');
      setPortalBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Abo & Tarif" subtitle="Tarif wählen, buchen und verwalten" />
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
      <PageHeader title="Abo & Tarif" subtitle="Tarif wählen, buchen und verwalten" />

      <div className="max-w-4xl space-y-5">
        {error && <ErrorBox message={error} />}
        {hinweis && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              hinweis.art === 'ok'
                ? 'border-positive/30 bg-positive-soft text-positive'
                : 'border-ink-700 bg-ink-800/60 text-chrome-300'
            }`}
          >
            {hinweis.text}
          </div>
        )}

        {/* Aktueller Stand */}
        <SectionCard title="Dein Abo" subtitle="Aktueller Status deines Betriebs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-display text-lg font-semibold text-chrome-50">
                  {sub?.plan?.name ?? (sub?.status === 'trial' ? 'Testphase' : 'Kein Tarif')}
                </span>
                {access && <Badge className={ACCESS_COLOR[access.access]}>{ACCESS_LABEL[access.access]}</Badge>}
              </div>
              <p className="text-sm text-chrome-400">
                {sub ? SUBSCRIPTION_STATUS_LABEL[sub.status] : 'Kein Abo hinterlegt'}
                {tageRest !== null && ` · noch ${tageRest} Tag${tageRest === 1 ? '' : 'e'}`}
                {sub?.currentPeriodEnd && sub.status !== 'trial' && ` · Laufzeit bis ${datum(sub.currentPeriodEnd)}`}
                {access?.reason && access.access !== 'full' ? ` · ${access.reason}` : ''}
              </p>
            </div>
            {hatStripeAbo && (
              <button className="btn-ghost" onClick={verwalten} disabled={portalBusy}>
                {portalBusy ? 'Öffne…' : 'Abo verwalten'}
              </button>
            )}
          </div>
        </SectionCard>

        {!istInhaber && (
          <div className="rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-chrome-300">
            Nur der Betriebsinhaber kann das Abo buchen oder ändern.
          </div>
        )}

        {/* Zahlweise-Umschalter */}
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-xl border border-ink-700 bg-ink-850 p-1">
            {(['month', 'year'] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setIntervalChoice(iv)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  interval === iv ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'
                }`}
              >
                {iv === 'month' ? 'Monatlich' : 'Jährlich'}
                {iv === 'year' && <span className="ml-1.5 text-xs text-copper-300">2 Monate gratis</span>}
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
                  {aktuell && <span className="badge-copper">Aktuell</span>}
                </div>
                {interval === 'year' ? (
                  <>
                    <p className="mt-1 font-display text-2xl font-bold text-chrome-50">
                      {eur(jahrespreis)}
                      <span className="text-sm font-normal text-chrome-500"> / Jahr</span>
                    </p>
                    <p className="text-xs text-copper-300">
                      entspricht {eur(jahrespreis / 12)} / Monat
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-display text-2xl font-bold text-chrome-50">
                    {eur(plan.preisMonatlich)}
                    <span className="text-sm font-normal text-chrome-500"> / Monat</span>
                  </p>
                )}
                {plan.beschreibung && <p className="mt-2 text-sm text-chrome-400">{plan.beschreibung}</p>}

                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-chrome-300">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {MODUL_LABEL[f] ?? f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {aktuell ? (
                    <button className="btn-ghost w-full" disabled>Aktueller Tarif</button>
                  ) : (
                    <button
                      className="btn-primary w-full"
                      onClick={() => buchen(plan)}
                      disabled={!buchbar || busyPlan === plan.id}
                      title={!preisIdDa ? 'Diese Zahlweise ist für diesen Tarif noch nicht buchbar.' : undefined}
                    >
                      {busyPlan === plan.id
                        ? 'Weiter zu Stripe…'
                        : !preisIdDa
                          ? 'Bald verfügbar'
                          : hatStripeAbo
                            ? 'Wechseln'
                            : 'Jetzt buchen'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-chrome-500">
          Die Bezahlung läuft sicher über Stripe. Du wirst zur Stripe-Bezahlseite weitergeleitet;
          Detailly speichert keine Kartendaten. Kündigung und Zahlungsmittel verwaltest du jederzeit
          über „Abo verwalten".
        </p>
      </div>
    </>
  );
}
