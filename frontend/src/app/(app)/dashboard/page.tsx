'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { eur } from '@/lib/format';
import { ORDER_STATUS_COLOR } from '@/lib/labels';
import type {
  DashboardStats,
  DashboardAppointment,
  TopLeistung,
  ServiceItem,
} from '@/lib/types';
import { ErrorBox, Empty, Badge, SectionCard, StatCard } from '@/components/ui';
import { ChartExportMenu } from '@/components/ChartExportMenu';
import { downloadCsv, svgToPng, csvNum, jahrMonat } from '@/lib/chart-export';
import { DashboardChart, DashboardBriefing, type DashboardChartHandle } from '@/components/dashboard/DashboardExperience';
import { OnboardingChecklist, type OnboardingStep } from '@/components/OnboardingChecklist';
import { DashboardCustomizePanel, type CustomizeItem } from '@/components/dashboard/DashboardCustomizePanel';
import { useDashboardLayout } from '@/components/dashboard/useDashboardLayout';
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
// Anpassbares Dashboard-Layout (Welle 3-B)
// ---------------------------------------------------------------------------
// Ids der anordbaren/ein-ausblendbaren Kacheln. Die Reihenfolge dieses Arrays
// ist das Default-Layout und entspricht 1:1 der bisherigen Seitenreihenfolge –
// so gibt es beim ersten Aufruf keinen Bruch. Der Gruss (Hero) und die
// Setup-Checkliste bleiben bewusst feste Ankerpunkte oben und sind nicht
// anordbar.
type WidgetId =
  | 'briefing'
  | 'kleinunternehmer'
  | 'kpis'
  | 'revenue'
  | 'appointments'
  | 'lowStock'
  | 'openOrders';

const DASHBOARD_WIDGET_ORDER: readonly WidgetId[] = [
  'briefing',
  'kleinunternehmer',
  'kpis',
  'revenue',
  'appointments',
  'lowStock',
  'openOrders',
] as const;

// Auftritts-Choreografie: nur diese Kacheln steigen gestaffelt herein (wie
// bisher – Briefing als Block, KPIs mit interner 60-ms-Kaskade). Der Wert ist
// der Delay-Vorschub, den die Kachel dem gemeinsamen Cursor hinzufuegt; so
// folgt die Staffelung IMMER der aktuellen (ggf. umsortierten) Reihenfolge.
// Kacheln ohne Eintrag erscheinen ohne Reveal (unveraendert zum Ist-Stand).
const REVEAL_ADVANCE: Partial<Record<WidgetId, number>> = {
  briefing: 80,
  kpis: 320,
};
const REVEAL_START = 140;

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
              (text-2xl -> sm:text-3xl statt der fixen 1.75rem der .display-xl).
              Der Gruss steigt Wort fuer Wort aus der Maske (.hero-word, reused
              von der Landing) – bei reduzierter Bewegung sofort sichtbar (CSS). */}
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-chrome-50 sm:text-3xl">
            {`${t(begruessungKey())}${name ? `, ${name}` : ''}`.split(' ').map((word, i) => (
              <Fragment key={`${word}-${i}`}>
                <span className="hero-line">
                  <span className="hero-word" style={{ animationDelay: `${i * 85}ms` }}>
                    {word}
                  </span>
                </span>{' '}
              </Fragment>
            ))}
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
// Sequenz-Reveal: fade+rise beim Sichtwerden (staffelbar via delayMs). Reused
// fuer die Briefing-Card und die KPI-Karten. Bewegung wird komplett per CSS
// neutralisiert (prefers-reduced-motion / .dl-reduce-motion -> sofort sichtbar).
// ---------------------------------------------------------------------------

function Reveal({
  children,
  delayMs = 0,
  className = '',
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('is-visible');
            io.unobserve(el);
          }
        }),
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delayMs}ms`, transitionDuration: '360ms' }}>
      {children}
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
  // Handle auf das Umsatz-Chart fuer den PNG-Export (aus der SectionCard-Kopfzeile).
  // Vor dem Serialisieren wird der Endzustand erzwungen (ensureDrawn), damit ein
  // nie in den Viewport gescrolltes Chart nicht leer exportiert wird.
  const chartRef = useRef<DashboardChartHandle>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  // Onboarding-Kriterien: Leistungen-Anzahl + Betriebsprofil. Beide Zusatz-
  // Calls sind entkoppelt vom Dashboard-Fehlerpfad – schlagen sie fehl, gilt
  // das jeweilige Kriterium schlicht als "offen" (Checkliste bleibt sinnvoll).
  const [hatLeistungen, setHatLeistungen] = useState(false);
  const [profil, setProfil] = useState<ProfilCheck | null>(null);
  // Anpassen-Modus + persoenliches Kachel-Layout (Reihenfolge + versteckt).
  const [editMode, setEditMode] = useState(false);
  const layout = useDashboardLayout<WidgetId>(user?.id, DASHBOARD_WIDGET_ORDER);

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

  // -------------------------------------------------------------------------
  // Kachel-Definitionen. Sichtbarkeit (Recht/Daten), Meta (Anpassen-Liste) und
  // Render sind pro Kachel gekapselt. Die Render-Funktionen liefern EXAKT die
  // bisherige Kachel-JSX – nur eingebettet in das anordbare/ausblendbare Layout.
  // -------------------------------------------------------------------------
  const widgetAvailable: Record<WidgetId, boolean> = {
    briefing: true,
    // §19-Waechter ist rechte-/tarifgebunden -> ohne Recht gar nicht anordbar
    // (taucht nicht in der Anpassen-Liste auf).
    kleinunternehmer: zeigeKlein,
    kpis: true,
    revenue: true,
    appointments: true,
    // Nachbestell-Hinweis nur bei tatsaechlichem Bedarf.
    lowStock: !!stats.niedrigerBestand && stats.niedrigerBestand.anzahl > 0,
    openOrders: true,
  };

  const widgetMeta: Record<WidgetId, { icon: JSX.Element; title: string; desc: string }> = {
    briefing: { icon: ICON_PATHS.analytics, title: t('dashboard.widget.briefing.title'), desc: t('dashboard.widget.briefing.desc') },
    kleinunternehmer: { icon: ICON_PATHS.invoices, title: t('dashboard.widget.kleinunternehmer.title'), desc: t('dashboard.widget.kleinunternehmer.desc') },
    kpis: { icon: ICON_PATHS.dashboard, title: t('dashboard.widget.kpis.title'), desc: t('dashboard.widget.kpis.desc') },
    revenue: { icon: ICON_PATHS.revenue, title: t('dashboard.widget.revenue.title'), desc: t('dashboard.widget.revenue.desc') },
    appointments: { icon: ICON_PATHS.calendar, title: t('dashboard.widget.appointments.title'), desc: t('dashboard.widget.appointments.desc') },
    lowStock: { icon: ICON_PATHS.box, title: t('dashboard.widget.lowStock.title'), desc: t('dashboard.widget.lowStock.desc') },
    openOrders: { icon: ICON_PATHS.orders, title: t('dashboard.widget.openOrders.title'), desc: t('dashboard.widget.openOrders.desc') },
  };

  const widgetRender: Record<WidgetId, (baseDelay?: number) => React.ReactNode> = {
    // Tages-Briefing: regelbasierte Zusammenfassung, steigt nach dem Gruss herein.
    briefing: (baseDelay) => (
      <Reveal delayMs={baseDelay ?? 0}>
        <DashboardBriefing stats={stats} />
      </Reveal>
    ),

    // §19-Umsatzgrenzen-Waechter (nur Kleinunternehmer + Leitung).
    kleinunternehmer: () => <Kleinunternehmer19Card />,

    // KPI-Karten – gestaffelt (60ms-Schritte) fade+rise nach dem Gruss; der
    // bestehende CountUp laeuft sichtbar mit. h-full sichert gleiche Kartenhoehen
    // trotz Reveal-Wrapper (Grid-Stretch greift sonst nur auf den Wrapper). Der
    // Basis-Delay folgt der Kachel-Position -> Kaskade bleibt reihenfolgetreu.
    kpis: (baseDelay) => {
      const b = baseDelay ?? REVEAL_START;
      return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Reveal delayMs={b} className="h-full [&>*]:h-full">
            <StatCard icon={ICON_PATHS.orders} label={t('dashboard.kpi.openOrders')} value={stats.offeneAuftraege} href="/auftraege" />
          </Reveal>
          <Reveal delayMs={b + 60} className="h-full [&>*]:h-full">
            <StatCard icon={ICON_PATHS.calendar} label={t('dashboard.kpi.appointmentsToday')} value={stats.termineHeute} href="/plantafel" />
          </Reveal>
          <Reveal delayMs={b + 120} className="h-full [&>*]:h-full">
            <StatCard
              icon={ICON_PATHS.revenue}
              label={t('dashboard.kpi.revenueMonth')}
              value={eur(stats.umsatzMonat)}
              delta={stats.umsatzDeltaProzent}
              hint={t('dashboard.kpi.revenueHint')}
              href="/rechnungen"
            />
          </Reveal>
          <Reveal delayMs={b + 180} className="h-full [&>*]:h-full">
            <StatCard
              icon={ICON_PATHS.invoices}
              label={t('dashboard.kpi.openInvoices')}
              value={eur(stats.offeneRechnungenSumme)}
              hint={t('dashboard.kpi.invoicesHint', { count: stats.offeneRechnungenAnzahl })}
              href="/rechnungen"
            />
          </Reveal>
          <Reveal delayMs={b + 240} className="h-full [&>*]:h-full">
            <StatCard icon={ICON_PATHS.customers} label={t('dashboard.kpi.customersTotal')} value={stats.kundenGesamt} href="/kunden" />
          </Reveal>
        </div>
      );
    },

    // Umsatztrend + Top-Leistungen.
    revenue: () => (
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
                  // Endzustand erzwingen, dann im naechsten Frame serialisieren:
                  // svgToPng klont die Inline-Styles -> nach ensureDrawn traegt der
                  // Klon Linie/Flaeche/Punkte vollstaendig (auch bei nie sichtbarem Chart).
                  chartRef.current?.ensureDrawn();
                  requestAnimationFrame(() => {
                    const svg = chartRef.current?.svg();
                    if (svg) void svgToPng(svg, `detailly-umsatz-${jahrMonat()}.png`);
                  });
                }}
              />
            ) : undefined
          }
        >
          <DashboardChart ref={chartRef} data={stats.umsatzTrend} />
        </SectionCard>
        <SectionCard title={t('dashboard.section.top.title')} subtitle={t('dashboard.section.top.subtitle')}>
          <TopLeistungen data={stats.topLeistungen} />
        </SectionCard>
      </div>
    ),

    // Termine heute + naechste 7 Tage.
    appointments: () => (
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
    ),

    // Nachbestell-Hinweis: Produkte unter Mindestbestand (nur wenn vorhanden).
    lowStock: () =>
      stats.niedrigerBestand && stats.niedrigerBestand.anzahl > 0 ? (
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
      ) : null,

    // Offene Auftraege.
    openOrders: () => (
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
    ),
  };

  // Sichtbare Kacheln in aktueller Reihenfolge. Der Auftritts-Delay laeuft ueber
  // einen gemeinsamen Cursor -> die gestaffelte Choreografie folgt IMMER der
  // (ggf. umsortierten) Reihenfolge. Reduced-motion neutralisiert alles per CSS.
  const visibleWidgets = layout.order.filter((id) => widgetAvailable[id] && !layout.hidden.has(id));
  let delayCursor = REVEAL_START;
  const renderedWidgets = visibleWidgets.map((id) => {
    let baseDelay: number | undefined;
    const advance = REVEAL_ADVANCE[id];
    if (advance != null) {
      baseDelay = delayCursor;
      delayCursor += advance;
    }
    return <Fragment key={id}>{widgetRender[id](baseDelay)}</Fragment>;
  });

  // Anpassen-Liste: alle rechte-/datenseitig verfuegbaren Kacheln in Reihenfolge
  // (versteckte-per-Recht erscheinen bewusst nicht als anordbar).
  const customizeItems: CustomizeItem[] = layout.order
    .filter((id) => widgetAvailable[id])
    .map((id) => ({
      id,
      icon: widgetMeta[id].icon,
      title: widgetMeta[id].title,
      desc: widgetMeta[id].desc,
      hidden: layout.hidden.has(id),
    }));

  return (
    <div className="space-y-6">
      <Hero name={vorname} />

      {/* Setup-Checkliste: fester Anker oben, verwaltet ihre Sichtbarkeit selbst. */}
      <OnboardingChecklist steps={onboardingSteps} tenantId={user?.tenantId} />

      {editMode ? (
        <DashboardCustomizePanel
          items={customizeItems}
          // Panel arbeitet mit string-Ids; die Ids stammen aus layout.order
          // (WidgetId[]) -> Ruecknarrowing ist hier sicher.
          onSwap={(a, b) => layout.swap(a as WidgetId, b as WidgetId)}
          onToggleHidden={(id) => layout.toggleHidden(id as WidgetId)}
          onReset={layout.reset}
          onDone={() => setEditMode(false)}
        />
      ) : (
        <>
          {/* Anpassen-Leiste: dezenter Einstieg in den Layout-Modus. */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="btn-ghost btn-sm"
            >
              <Icon className="h-4 w-4">{ICON_PATHS.settings}</Icon>
              {t('dashboard.anpassen.button')}
            </button>
          </div>
          {renderedWidgets}
        </>
      )}
    </div>
  );
}
