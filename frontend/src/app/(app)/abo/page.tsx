'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { ACCESS_COLOR } from '@/lib/labels';
import { useAuth } from '@/lib/auth';
import { INHABER_ROLLEN } from '@/lib/rollen';
import type { Plan, Subscription } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Badge, useToast, ConfirmDialog } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useEntitlements, useHasFeature } from '@/lib/entitlements';
import { BETRIEBSTYP_LABEL_KEY, type Betriebstyp } from '@/lib/branche';

// Gewerke-Empfehlungs-Layer (Preismodell V3): je Betriebstyp ein Marken-Bundle,
// das auf einen der drei Self-Service-Tarife (starter/basic/pro) verweist. Die
// Zuordnung ist die Betreiber-Entscheidung; sie ZWINGT nichts – alle Stufen
// bleiben buchbar, die passende Karte wird nur markiert.
interface BundleInfo {
  /** Empfohlener Tarif-slug (matcht plan.slug aus /subscriptions/plans). */
  slug: string;
  nameKey: string;
  descKey: string;
  priceKey: string;
  /** Nur Detailing: Zeiterfassung-Add-on (noch nicht buchbar). */
  addonKey?: string;
  /** Nur Protect/PPF: dezenter Pro-Upsell. */
  upsellKey?: string;
}
const BUNDLE_BY_TYP: Record<Betriebstyp, BundleInfo> = {
  aufbereitung: {
    slug: 'starter',
    nameKey: 'abo.bundle.detailing.name',
    descKey: 'abo.bundle.detailing.desc',
    priceKey: 'abo.bundle.detailing.price',
    addonKey: 'abo.bundle.addonSoon',
  },
  folierung: {
    slug: 'basic',
    nameKey: 'abo.bundle.wrap.name',
    descKey: 'abo.bundle.wrap.desc',
    priceKey: 'abo.bundle.wrap.price',
  },
  ppf: {
    slug: 'basic',
    nameKey: 'abo.bundle.protect.name',
    descKey: 'abo.bundle.protect.desc',
    priceKey: 'abo.bundle.protect.price',
    upsellKey: 'abo.bundle.ppfUpsell',
  },
  komplett: {
    slug: 'pro',
    nameKey: 'abo.bundle.studio.name',
    descKey: 'abo.bundle.studio.desc',
    priceKey: 'abo.bundle.studio.price',
  },
};

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

// Freiwillige Kuendigungsgrund-Kategorien (Spiegel von KUENDIGUNG_GRUND_KATEGORIEN
// im Backend). Reihenfolge = Anzeigereihenfolge; Label je i18n-Key.
const KUENDIGUNG_GRUND_KATEGORIEN = [
  'zu_teuer',
  'funktion_fehlt',
  'zu_kompliziert',
  'betrieb_aufgegeben',
  'wechsel_wettbewerb',
  'sonstiges',
] as const;

// Abo-Status, die noch eine Kuendigung erlauben (etwas Aktives zum Beenden).
const KUENDBARE_STATUS = ['active', 'trial', 'past_due', 'pilot'];

/** Kleiner Inline-Spinner fuer Warte-Buttons (Projektstandard: nie totes „Lädt…"). */
function BtnSpin() {
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
    />
  );
}

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
  // Betriebstyp aus den Entitlements (paralleler Backend-PR). Fehlt er noch,
  // bleibt `betriebstyp` null -> der Empfehlungs-Layer wird nicht gezeigt.
  const { betriebstyp } = useEntitlements();
  const bundle = betriebstyp ? BUNDLE_BY_TYP[betriebstyp] : null;
  const gewerkLabel = betriebstyp ? t(BETRIEBSTYP_LABEL_KEY[betriebstyp].label) : '';
  // À-la-carte Add-on 'folierung_ppf' (4,99 €/Monat): im Test/mit Buchung aktiv.
  const hasFeature = useHasFeature();
  const folierungAktiv = hasFeature('folierung_ppf');

  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [interval, setIntervalChoice] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  // Kuendigung & Halte-Ablauf
  const [cancelOpen, setCancelOpen] = useState(false);
  const [grundKategorie, setGrundKategorie] = useState('');
  const [grundText, setGrundText] = useState('');
  const [alsSupport, setAlsSupport] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [reactivateBusy, setReactivateBusy] = useState(false);

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

  // --- Kuendigung & Halte-Ablauf (nur Inhaber) ---
  function fehler(e: unknown) {
    setError(e instanceof ApiError || e instanceof Error ? e.message : t('abo.cancel.error'));
  }

  // Halte-Angebot annehmen: einmaliger Gratismonat -> Laufzeit +1 Monat, Kuendigung
  // zurueckgenommen. Der Doppelklick-Schutz liegt im Backend (atomarer Claim).
  async function gratismonatAnnehmen() {
    setError('');
    setRetentionBusy(true);
    try {
      const me = await api.post<Subscription>('/subscriptions/me/retention-offer');
      setSub(me);
      setCancelOpen(false);
      toast(t('abo.cancel.toast.retention'), { duration: 6000 });
    } catch (e) {
      fehler(e);
    } finally {
      setRetentionBusy(false);
    }
  }

  // Trotzdem kuendigen (nach Bestaetigung). Grund ist FREIWILLIG.
  async function kuendigen() {
    setError('');
    setCancelBusy(true);
    try {
      const me = await api.post<Subscription>('/subscriptions/me/cancel', {
        grundKategorie: grundKategorie || undefined,
        grundText: grundText.trim() || undefined,
        alsSupportAnfrage: alsSupport || undefined,
      });
      setSub(me);
      setConfirmOpen(false);
      setCancelOpen(false);
      setGrundKategorie('');
      setGrundText('');
      setAlsSupport(false);
      toast(t('abo.cancel.toast.canceled'), { duration: 6000 });
    } catch (e) {
      fehler(e);
      setConfirmOpen(false);
    } finally {
      setCancelBusy(false);
    }
  }

  // Kuendigung zuruecknehmen (vor Laufzeitende).
  async function kuendigungZuruecknehmen() {
    setError('');
    setReactivateBusy(true);
    try {
      const me = await api.post<Subscription>('/subscriptions/me/reactivate');
      setSub(me);
      toast(t('abo.cancel.toast.reactivated'), { duration: 6000 });
    } catch (e) {
      fehler(e);
    } finally {
      setReactivateBusy(false);
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

        {/* Bereits gekuendigt: Hinweis (Zugang bis Laufzeitende, Daten bleiben) + Ruecknahme */}
        {istInhaber && sub && sub.cancelAtPeriodEnd && (
          <SectionCard title={t('abo.cancel.scheduled.title')}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Badge className="badge-caution">{t('abo.cancel.scheduled.badge')}</Badge>
                  <span className="text-sm text-chrome-200">
                    {sub.currentPeriodEnd
                      ? t('abo.cancel.scheduled.info', { datum: datum(sub.currentPeriodEnd) })
                      : t('abo.cancel.scheduled.infoNoDate')}
                  </span>
                </div>
                <p className="text-xs text-chrome-500">{t('abo.cancel.dataKeptNote')}</p>
              </div>
              <button className="btn-primary" onClick={kuendigungZuruecknehmen} disabled={reactivateBusy}>
                {reactivateBusy && <BtnSpin />}
                {reactivateBusy ? t('abo.cancel.undoing') : t('abo.cancel.undo')}
              </button>
            </div>
          </SectionCard>
        )}

        {/* Kuendigung mit Halte-Ablauf: EIN Bildschirm, Angebot + „trotzdem kuendigen"
            gleichrangig. Grund ist FREIWILLIG (keine Pflichtfelder vor dem Kuendigen). */}
        {istInhaber && sub && !sub.cancelAtPeriodEnd && KUENDBARE_STATUS.includes(sub.status) && (
          <SectionCard title={t('abo.cancel.section.title')} subtitle={t('abo.cancel.section.subtitle')}>
            {!cancelOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-chrome-400">{t('abo.cancel.dataKeptNote')}</p>
                <button className="btn-ghost" onClick={() => setCancelOpen(true)}>
                  {t('abo.cancel.start')}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Halte-Angebot: EIN Gratismonat – nur solange nie genutzt */}
                {sub.halteangebotVerfuegbar && (
                  <div className="rounded-2xl border border-copper/30 bg-copper-soft/20 p-5">
                    <p className="font-display text-lg font-semibold text-chrome-50">
                      {t('abo.cancel.retention.title')}
                    </p>
                    <p className="mt-1.5 text-sm text-chrome-300">{t('abo.cancel.retention.desc')}</p>
                    <p className="mt-1 text-xs text-chrome-500">{t('abo.cancel.retention.onceNote')}</p>
                    <button
                      className="btn-primary mt-4"
                      onClick={gratismonatAnnehmen}
                      disabled={retentionBusy}
                    >
                      {retentionBusy && <BtnSpin />}
                      {retentionBusy ? t('abo.cancel.retention.accepting') : t('abo.cancel.retention.accept')}
                    </button>
                  </div>
                )}

                {/* Grund erfassen – FREIWILLIG (kein Pflichtfeld) */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-chrome-200">{t('abo.cancel.reason.title')}</p>
                  <div>
                    <label className="mb-1 block text-xs text-chrome-400">
                      {t('abo.cancel.reason.categoryLabel')}
                    </label>
                    <select
                      className="input w-full"
                      value={grundKategorie}
                      onChange={(e) => setGrundKategorie(e.target.value)}
                    >
                      <option value="">{t('abo.cancel.reason.categoryNone')}</option>
                      {KUENDIGUNG_GRUND_KATEGORIEN.map((k) => (
                        <option key={k} value={k}>
                          {t(`abo.cancel.reason.cat.${k}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-chrome-400">
                      {t('abo.cancel.reason.textLabel')}
                    </label>
                    <textarea
                      className="input w-full"
                      rows={3}
                      maxLength={2000}
                      placeholder={t('abo.cancel.reason.textPlaceholder')}
                      value={grundText}
                      onChange={(e) => setGrundText(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-2.5 text-sm text-chrome-300">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={alsSupport}
                      onChange={(e) => setAlsSupport(e.target.checked)}
                    />
                    <span>{t('abo.cancel.reason.supportLabel')}</span>
                  </label>
                </div>

                <p className="text-xs text-chrome-500">{t('abo.cancel.dataKeptNote')}</p>

                {/* Aktionen: Kuendigen und Zurueck – klar und gleichrangig sichtbar */}
                <div className="flex flex-wrap gap-3">
                  <button className="btn-danger" onClick={() => setConfirmOpen(true)} disabled={cancelBusy}>
                    {t('abo.cancel.proceed')}
                  </button>
                  <button className="btn-ghost" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>
                    {t('abo.cancel.back')}
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {!istInhaber && (
          <div className="rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-chrome-300">
            {t('abo.ownerOnly')}
          </div>
        )}

        {/* Gewerke-Empfehlung: dezenter Hinweis auf das passende Bundle.
            Kein Zwang – markiert unten nur die empfohlene Karte. */}
        {bundle && (
          <div className="rounded-2xl border border-copper/25 bg-copper-soft/20 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-copper-300">
              {t('abo.bundle.title')}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-lg font-semibold text-chrome-50">{t(bundle.nameKey)}</span>
              <span className="text-sm font-medium text-copper-200">{t(bundle.priceKey)}</span>
            </div>
            <p className="mt-1.5 text-sm text-chrome-300">{t(bundle.descKey)}</p>
            {bundle.addonKey && (
              <p className="mt-1.5 text-xs text-chrome-400">{t(bundle.addonKey)}</p>
            )}
            {bundle.upsellKey && (
              <p className="mt-1.5 text-xs text-chrome-400">{t(bundle.upsellKey)}</p>
            )}
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
            // Empfohlene Karte fuer das erkannte Gewerk (nur markieren, kein Zwang).
            const empfohlen = !!bundle && bundle.slug === plan.slug && !aktuell;
            const jahrespreis =
              plan.preisJaehrlich != null && plan.preisJaehrlich !== ''
                ? Number(plan.preisJaehrlich)
                : Number(plan.preisMonatlich) * 10;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-5 ${
                  aktuell
                    ? 'border-copper/60 bg-copper-soft/40'
                    : empfohlen
                      ? 'border-copper/40 bg-ink-850'
                      : 'border-ink-700 bg-ink-850'
                }`}
              >
                {empfohlen && (
                  <span className="badge-copper mb-2 self-start text-[11px]">
                    {t('abo.bundle.recommendedBadge', { gewerk: gewerkLabel })}
                  </span>
                )}
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

        {/* Zubuchbare Erweiterungen (à-la-carte Add-ons). Buchung laeuft – wie die
            Tarife – ueber Stripe; solange keine Price-ID hinterlegt ist, dient die
            Karte der Darstellung/Transparenz. Im 14-Tage-Test ist das Add-on aktiv. */}
        <div className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-chrome-50">{t('abo.addon.title')}</h2>
            <p className="text-sm text-chrome-400">{t('abo.addon.subtitle')}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-display text-base font-semibold text-chrome-50">
                  {t('abo.addon.folierungPpf.name')}
                </span>
                {folierungAktiv ? (
                  <span className="badge-positive">{t('abo.addon.active')}</span>
                ) : (
                  <span className="badge-neutral">{t('abo.addon.bookable')}</span>
                )}
              </div>
              <p className="text-sm text-chrome-300">{t('abo.addon.folierungPpf.desc')}</p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="font-display text-xl font-bold text-chrome-50">{t('abo.addon.folierungPpf.price')}</p>
              <p className="text-xs text-chrome-500">
                {folierungAktiv ? t('abo.addon.includedTrial') : t('abo.addon.soon')}
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-chrome-500">
          {t('abo.stripeNote')}
        </p>
      </div>

      {/* Bestaetigung vor der endgueltigen Kuendigung (Projektstandard ConfirmDialog). */}
      <ConfirmDialog
        open={confirmOpen}
        title={t('abo.cancel.confirm.title')}
        message={t('abo.cancel.confirm.message')}
        confirmLabel={t('abo.cancel.confirm.btn')}
        cancelLabel={t('abo.cancel.back')}
        variant="danger"
        busy={cancelBusy}
        onConfirm={kuendigen}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
