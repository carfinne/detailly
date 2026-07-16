'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { eur } from '@/lib/format';
import { ORDER_STATUS_COLOR } from '@/lib/labels';
import type {
  DashboardStats,
  DashboardAppointment,
  TopLeistung,
  UmsatzTrendPunkt,
  ServiceItem,
} from '@/lib/types';
import { ErrorBox, Empty, Badge, SectionCard, StatCard } from '@/components/ui';
import { ChartExportMenu } from '@/components/ChartExportMenu';
import { downloadCsv, svgToPng, csvNum, jahrMonat } from '@/lib/chart-export';
import { OnboardingChecklist, type OnboardingStep } from '@/components/OnboardingChecklist';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';
import { useSteuer } from '@/lib/entitlements';
import { LEITUNG_ROLLEN } from '@/lib/rollen';

// Ausschnitt des Betriebsprofils (GET /tenants/me), der fuer die Setup-
// Checkliste ausreicht – vollstaendiges Profil siehe einstellungen/page.tsx.
type ProfilCheck = { steuernummer?: string; ustId?: string; iban?: string };

// Enum->i18n-Key (Rohwert-Fallback via t()). Die geteilte labels.ts bleibt
// unangetastet; Status-/Leistungsart-Labels werden lokal im Seiten-Namespace
// gefuehrt. Die Farbklassen (ORDER_STATUS_COLOR) bleiben importiert.
const STATUS_KEY: Record<string, string> = {
  angefragt: 'dashboard.status.angefragt',
  kalkuliert: 'dashboard.status.kalkuliert',
  bestaetigt: 'dashboard.status.bestaetigt',
  in_arbeit: 'dashboard.status.in_arbeit',
  qualitaetskontrolle: 'dashboard.status.qualitaetskontrolle',
  fertig: 'dashboard.status.fertig',
  abgerechnet: 'dashboard.status.abgerechnet',
  storniert: 'dashboard.status.storniert',
};
const ART_KEY: Record<string, string> = {
  aufbereitung: 'dashboard.art.aufbereitung',
  folierung: 'dashboard.art.folierung',
  ppf: 'dashboard.art.ppf',
  sonstiges: 'dashboard.art.sonstiges',
};

// ---------------------------------------------------------------------------
// kleine Helfer
// ---------------------------------------------------------------------------

// Uhrzeit aus ISO-String (HH:MM).
function uhrzeit(value?: string): string {
  if (!value) return '–';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Kurzes Tagesdatum (z.B. "Mo 23.06.").
function tagDatum(value?: string): string {
  if (!value) return '–';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// Tageszeit-abhaengiger i18n-Key fuer die Begruessung (Aufloesung via t()).
function begruessungKey(): string {
  const h = new Date().getHours();
  if (h < 11) return 'dashboard.hero.morning';
  if (h < 18) return 'dashboard.hero.day';
  return 'dashboard.hero.evening';
}

// ---------------------------------------------------------------------------
// Hero / Begruessung
// ---------------------------------------------------------------------------

function Hero({ name }: { name: string }) {
  const t = useT();
  const heute = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="card relative overflow-hidden">
      {/* dezenter Akzent-Schein */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-copper/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-copper-300">{heute}</p>
          {/* Bewusst groesser als .display-xl: der Dashboard-Gruss ist der eine
              Hero-Moment der App und darf staerker willkommen heissen
              (text-2xl -> sm:text-3xl statt der fixen 1.75rem der .display-xl). */}
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-chrome-50 sm:text-3xl">
            {t(begruessungKey())}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1.5 text-sm text-chrome-400">
            {t('dashboard.hero.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/fahrzeugannahme" className="btn-primary btn-sm">
            <Icon className="h-4 w-4">{ICON_PATHS.plus}</Icon>
            {t('dashboard.hero.intake')}
          </Link>
          <Link href="/auftraege" className="btn-ghost btn-sm">
            {t('dashboard.hero.newOrder')}
          </Link>
          <Link href="/kunden" className="btn-ghost btn-sm">
            {t('dashboard.hero.newCustomer')}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Umsatz-Diagramm (eigenes, leichtes SVG-freies Balkendiagramm)
// ---------------------------------------------------------------------------

function UmsatzAreaChart({ data, svgRef }: { data: UmsatzTrendPunkt[]; svgRef?: React.Ref<SVGSVGElement> }) {
  const t = useT();
  const pts = data ?? [];
  const max = Math.max(1, ...pts.map((d) => d.umsatz));
  const total = pts.reduce((s, d) => s + d.umsatz, 0);
  const letzter = pts[pts.length - 1];

  // SVG-Koordinaten (viewBox-Einheiten); per w-full + Seitenverhaeltnis responsiv.
  const W = 600;
  const H = 190;
  const padX = 12;
  const padTop = 20;
  const padBot = 12;
  const n = pts.length;
  const xx = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - 2 * padX));
  const yy = (v: number) => padTop + (1 - v / max) * (H - padTop - padBot);
  const line = pts.map((d, i) => `${i ? 'L' : 'M'}${xx(i).toFixed(1)} ${yy(d.umsatz).toFixed(1)}`).join(' ');
  const area = `${line} L${xx(n - 1).toFixed(1)} ${H - padBot} L${xx(0).toFixed(1)} ${H - padBot} Z`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-2xl font-bold tabular-nums text-chrome-50">{eur(total)}</span>
        <span className="text-xs text-chrome-400">{t('dashboard.chart.total')}</span>
        {letzter && letzter.umsatz > 0 && (
          <span className="ml-auto text-xs text-chrome-400">
            {letzter.label}: <span className="font-semibold text-copper-200">{eur(letzter.umsatz)}</span>
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex h-[190px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-850 text-chrome-600">
            <Icon>{ICON_PATHS.revenue}</Icon>
          </span>
          <p className="text-sm text-chrome-400">{t('dashboard.chart.emptyTitle')}</p>
          <p className="text-xs text-chrome-600">{t('dashboard.chart.emptyHint')}</p>
        </div>
      ) : (
        <>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${W} / ${H}` }}>
            <defs>
              <linearGradient id="umsArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'rgb(var(--copper-500))' }} stopOpacity="0.42" />
                <stop offset="1" style={{ stopColor: 'rgb(var(--copper-500))' }} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Gitterlinien */}
            {[0, 1, 2, 3].map((i) => {
              const y = padTop + (i / 3) * (H - padTop - padBot);
              return <line key={i} x1={padX} y1={y} x2={W - padX} y2={y} style={{ stroke: 'var(--grid-line)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />;
            })}
            <path d={area} fill="url(#umsArea)" />
            <path d={line} fill="none" style={{ stroke: 'rgb(var(--copper-500))' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {pts.map((d, i) => (
              <circle key={i} cx={xx(i)} cy={yy(d.umsatz)} r={i === n - 1 ? 4.5 : 3.5} style={{ fill: 'rgb(var(--ink-850))', stroke: 'rgb(var(--copper-500))' }} strokeWidth="2" vectorEffect="non-scaling-stroke">
                <title>{d.label}: {eur(d.umsatz)}</title>
              </circle>
            ))}
          </svg>
          {/* Monatslabels */}
          <div className="mt-2 flex justify-between gap-2">
            {pts.map((d, i) => (
              <span key={i} className={`flex-1 text-center text-[11px] capitalize ${i === n - 1 ? 'font-semibold text-chrome-200' : 'text-chrome-400'}`}>
                {d.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-Leistungen
// ---------------------------------------------------------------------------

function TopLeistungen({ data }: { data: TopLeistung[] }) {
  const t = useT();
  const items = data ?? [];
  if (items.length === 0) return <Empty text={t('dashboard.top.empty')} />;
  const max = Math.max(1, ...items.map((d) => d.umsatz));
  return (
    <div className="space-y-3.5">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-ink-750 text-[11px] font-bold text-chrome-300">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-chrome-200">{d.name}</span>
              <span className="shrink-0 text-xs text-chrome-400">
                {t('dashboard.top.count', { count: d.anzahl, sum: eur(d.umsatz) })}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-copper-grad"
                style={{ width: `${Math.round((d.umsatz / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Termin-Zeile
// ---------------------------------------------------------------------------

function TerminZeile({ termin, mitTag }: { termin: DashboardAppointment; mitTag?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid w-16 shrink-0 place-items-center rounded-lg bg-copper-soft py-1 text-xs font-semibold text-copper">
        {mitTag ? tagDatum(termin.start) : uhrzeit(termin.start)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-chrome-100">{termin.titel}</p>
        <p className="truncate text-xs text-chrome-400">
          {termin.kunde} · {termin.fahrzeug}
        </p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Lade-Skeleton (dashboard-foermig statt generisch)
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §19-Umsatzgrenzen-Waechter (nur Kleinunternehmer + Leitung)
// ---------------------------------------------------------------------------

type KleinStatus = {
  istKleinunternehmer: boolean;
  jahr?: number;
  umsatzLaufend?: number;
  grenze?: number;
  warnstufe?: 'ok' | 'nah' | 'kritisch' | 'ueberschritten';
};

// Ampel je Warnstufe: ok grün / nah amber / kritisch+überschritten rot.
const WARN_STYLE: Record<string, { bar: string; badge: string }> = {
  ok: { bar: 'bg-positive', badge: 'badge-positive' },
  nah: { bar: 'bg-caution', badge: 'badge-caution' },
  kritisch: { bar: 'bg-danger', badge: 'badge-danger' },
  ueberschritten: { bar: 'bg-danger', badge: 'badge-danger' },
};

function Kleinunternehmer19Card() {
  const t = useT();
  const [status, setStatus] = useState<KleinStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let aktiv = true;
    api
      .get<KleinStatus>('/invoices/kleinunternehmer-status')
      .then((d) => {
        if (aktiv) setStatus(d);
      })
      .catch(() => {
        // Fehler/Endpoint fehlt -> Karte still ausblenden (kein Dashboard-Bruch).
        if (aktiv) setFailed(true);
      });
    return () => {
      aktiv = false;
    };
  }, []);

  if (failed) return null;
  if (!status) return <div className="skeleton h-32 w-full rounded-2xl" />;
  if (!status.istKleinunternehmer) return null;

  const grenze = status.grenze ?? 100000;
  const umsatz = status.umsatzLaufend ?? 0;
  const warn = status.warnstufe ?? 'ok';
  const style = WARN_STYLE[warn] ?? WARN_STYLE.ok;
  const anteil = Math.round((umsatz / grenze) * 100);
  const balken = Math.max(2, Math.min(100, anteil));
  const laut = warn === 'kritisch' || warn === 'ueberschritten';
  const jahr = status.jahr ?? new Date().getFullYear();

  return (
    <SectionCard
      title={t('dashboard.klein.title')}
      subtitle={t('dashboard.klein.subtitle', { jahr: String(jahr) })}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-chrome-200">
          {t('dashboard.klein.text', { umsatz: eur(umsatz), grenze: eur(grenze) })}
        </p>
        <span className={`${style.badge} shrink-0 tabular-nums`}>{anteil}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full ${style.bar} transition-[width] duration-500`}
          style={{ width: `${balken}%` }}
        />
      </div>
      {laut && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-soft p-3">
          <p className="text-sm font-medium text-danger">{t('dashboard.klein.warnAdvice')}</p>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-chrome-500">
        {t('dashboard.klein.disclaimer')}
      </p>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const steuer = useSteuer();
  // Ref auf das Umsatz-SVG fuer den PNG-Export (aus der SectionCard-Kopfzeile).
  const umsatzSvgRef = useRef<SVGSVGElement>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  // Onboarding-Kriterien: Leistungen-Anzahl + Betriebsprofil. Beide Zusatz-
  // Calls sind entkoppelt vom Dashboard-Fehlerpfad – schlagen sie fehl, gilt
  // das jeweilige Kriterium schlicht als "offen" (Checkliste bleibt sinnvoll).
  const [hatLeistungen, setHatLeistungen] = useState(false);
  const [profil, setProfil] = useState<ProfilCheck | null>(null);

  useEffect(() => {
    let aktiv = true;
    api
      .get<DashboardStats>('/dashboard/stats')
      .then((d) => {
        if (aktiv) setStats(d);
      })
      .catch((e) => {
        if (aktiv) setError(e instanceof Error ? e.message : t('dashboard.error.load'));
      });
    // Leichte Zusatz-Calls fuer die Setup-Checkliste (je einmalig, kein N+1).
    api
      .get<ServiceItem[]>('/services')
      .then((s) => {
        if (aktiv) setHatLeistungen(Array.isArray(s) && s.length > 0);
      })
      .catch(() => {
        /* Kriterium bleibt offen. */
      });
    api
      .get<ProfilCheck>('/tenants/me')
      .then((p) => {
        if (aktiv) setProfil(p);
      })
      .catch(() => {
        /* Kriterium bleibt offen. */
      });
    return () => {
      aktiv = false;
    };
  }, [t]);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <DashboardSkeleton />;

  const vorname = user?.firstName ?? '';
  // §19-Widget nur fuer Kleinunternehmer UND Leitung (enthaelt Betriebs-Umsatz).
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);
  const zeigeKlein = steuer.kleinunternehmer && istLeitung;
  const offeneAuftraege = stats.offeneAuftragsListe ?? [];
  const termineHeute = stats.termineHeuteListe ?? [];
  const kommendeTermine = stats.kommendeTermine ?? [];
  // Umsatztrend: Export (CSV/PNG) nur anbieten, wenn es echte Daten gibt
  // (bei 0 zeigt das Chart den Leerzustand ohne SVG).
  const umsatzTrend = stats.umsatzTrend ?? [];
  const umsatzGesamt = umsatzTrend.reduce((s, d) => s + d.umsatz, 0);

  // Setup-Kriterien aus vorhandenen Daten ableiten (kein eigener Endpoint).
  const profilGefuellt = !!profil && !!(profil.steuernummer || profil.ustId) && !!profil.iban;
  const onboardingSteps: OnboardingStep[] = [
    { key: 'kunden', label: t('dashboard.onboarding.customer'), done: stats.kundenGesamt > 0, href: '/kunden' },
    { key: 'leistungen', label: t('dashboard.onboarding.services'), done: hatLeistungen, href: '/leistungen' },
    { key: 'profil', label: t('dashboard.onboarding.profile'), done: profilGefuellt, href: '/einstellungen' },
    { key: 'auftrag', label: t('dashboard.onboarding.order'), done: stats.offeneAuftraege > 0 || stats.umsatzBezahlt > 0, href: '/fahrzeugannahme' },
  ];

  return (
    <div className="space-y-6">
      <Hero name={vorname} />

      <OnboardingChecklist steps={onboardingSteps} tenantId={user?.tenantId} />

      {/* §19-Umsatzgrenzen-Waechter (nur Kleinunternehmer + Leitung) */}
      {zeigeKlein && <Kleinunternehmer19Card />}

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={ICON_PATHS.orders} label={t('dashboard.kpi.openOrders')} value={stats.offeneAuftraege} href="/auftraege" />
        <StatCard icon={ICON_PATHS.calendar} label={t('dashboard.kpi.appointmentsToday')} value={stats.termineHeute} href="/plantafel" />
        <StatCard
          icon={ICON_PATHS.revenue}
          label={t('dashboard.kpi.revenueMonth')}
          value={eur(stats.umsatzMonat)}
          delta={stats.umsatzDeltaProzent}
          hint={t('dashboard.kpi.revenueHint')}
          href="/rechnungen"
        />
        <StatCard
          icon={ICON_PATHS.invoices}
          label={t('dashboard.kpi.openInvoices')}
          value={eur(stats.offeneRechnungenSumme)}
          hint={t('dashboard.kpi.invoicesHint', { count: stats.offeneRechnungenAnzahl })}
          href="/rechnungen"
        />
        <StatCard icon={ICON_PATHS.customers} label={t('dashboard.kpi.customersTotal')} value={stats.kundenGesamt} href="/kunden" />
      </div>

      {/* Umsatztrend + Top-Leistungen */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title={t('dashboard.section.revenue.title')}
          subtitle={t('dashboard.section.revenue.subtitle')}
          className="lg:col-span-2"
          action={
            umsatzGesamt > 0 ? (
              <ChartExportMenu
                onCsv={() =>
                  downloadCsv(
                    `detailly-umsatz-${jahrMonat()}.csv`,
                    ['Monat', 'Umsatz (EUR)'],
                    umsatzTrend.map((d) => [d.label, csvNum(d.umsatz, 2)]),
                  )
                }
                onPng={() => {
                  if (umsatzSvgRef.current) void svgToPng(umsatzSvgRef.current, `detailly-umsatz-${jahrMonat()}.png`);
                }}
              />
            ) : undefined
          }
        >
          <UmsatzAreaChart data={stats.umsatzTrend} svgRef={umsatzSvgRef} />
        </SectionCard>
        <SectionCard title={t('dashboard.section.top.title')} subtitle={t('dashboard.section.top.subtitle')}>
          <TopLeistungen data={stats.topLeistungen} />
        </SectionCard>
      </div>

      {/* Termine heute + naechste 7 Tage */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title={t('dashboard.section.today.title')}>
          {termineHeute.length === 0 ? (
            <Empty
              text={t('dashboard.today.empty')}
              action={
                <Link href="/plantafel" className="btn-ghost btn-sm">
                  {t('dashboard.today.toPlanboard')}
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {termineHeute.map((termin) => (
                <TerminZeile key={termin.id} termin={termin} />
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title={t('dashboard.section.upcoming.title')} subtitle={t('dashboard.section.upcoming.subtitle')}>
          {kommendeTermine.length === 0 ? (
            <Empty text={t('dashboard.upcoming.empty')} />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {kommendeTermine.map((termin) => (
                <TerminZeile key={termin.id} termin={termin} mitTag />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Nachbestell-Hinweis: Produkte unter Mindestbestand (nur wenn vorhanden) */}
      {stats.niedrigerBestand && stats.niedrigerBestand.anzahl > 0 && (
        <SectionCard
          title={t('dashboard.lowStock.title')}
          subtitle={
            stats.niedrigerBestand.anzahl === 1
              ? t('dashboard.lowStock.subtitleOne', { count: stats.niedrigerBestand.anzahl })
              : t('dashboard.lowStock.subtitleMany', { count: stats.niedrigerBestand.anzahl })
          }
          action={
            <Link href="/shop" className="btn-ghost btn-sm">
              {t('dashboard.lowStock.toShop')}
            </Link>
          }
        >
          <ul className="divide-y divide-ink-700/60">
            {stats.niedrigerBestand.produkte.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge className="badge-danger shrink-0">{t('dashboard.lowStock.badge')}</Badge>
                  <span className="truncate text-sm text-chrome-100">{p.name}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="font-medium text-danger">{p.bestand}</span>
                  <span className="text-chrome-500"> / {p.mindestbestand} {p.einheit}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Offene Auftraege */}
      <SectionCard
        title={t('dashboard.section.openOrders.title')}
        subtitle={t('dashboard.section.openOrders.subtitle')}
        action={
          <Link href="/auftraege" className="link-action inline-flex items-center gap-1 text-sm">
            {t('dashboard.openOrders.viewAll')}
            <Icon className="h-3.5 w-3.5">{ICON_PATHS.arrow}</Icon>
          </Link>
        }
      >
        {offeneAuftraege.length === 0 ? (
          <Empty
            text={t('dashboard.openOrders.empty')}
            action={
              <Link href="/fahrzeugannahme" className="btn-primary btn-sm">
                <Icon className="h-4 w-4">{ICON_PATHS.plus}</Icon>
                {t('dashboard.openOrders.intake')}
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('dashboard.col.nummer')}</th>
                  <th>{t('dashboard.col.kunde')}</th>
                  <th>{t('dashboard.col.fahrzeug')}</th>
                  <th>{t('dashboard.col.leistung')}</th>
                  <th>{t('dashboard.col.status')}</th>
                  <th className="text-right">{t('dashboard.col.gesamt')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offeneAuftraege.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-chrome-100">{o.auftragsnummer}</td>
                    <td>{o.kunde}</td>
                    <td>{o.fahrzeug}</td>
                    <td>{ART_KEY[o.art] ? t(ART_KEY[o.art]) : o.art}</td>
                    <td>
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {STATUS_KEY[o.status] ? t(STATUS_KEY[o.status]) : o.status}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums">{eur(o.gesamtpreis)}</td>
                    <td className="text-right">
                      <Link
                        href={`/auftraege/detail/?id=${o.id}`}
                        className="link-action"
                      >
                        {t('dashboard.openOrders.open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
