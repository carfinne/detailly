'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { eur } from '@/lib/format';
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, SERVICE_TYPE_LABEL } from '@/lib/labels';
import type {
  DashboardStats,
  DashboardAppointment,
  TopLeistung,
  UmsatzTrendPunkt,
  ServiceItem,
} from '@/lib/types';
import { ErrorBox, Empty, Badge, SectionCard, StatCard } from '@/components/ui';
import { OnboardingChecklist, type OnboardingStep } from '@/components/OnboardingChecklist';
import { Icon, ICON_PATHS } from '@/lib/icons';

// Ausschnitt des Betriebsprofils (GET /tenants/me), der fuer die Setup-
// Checkliste ausreicht – vollstaendiges Profil siehe einstellungen/page.tsx.
type ProfilCheck = { steuernummer?: string; ustId?: string; iban?: string };

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

function begruessung(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

// ---------------------------------------------------------------------------
// Hero / Begruessung
// ---------------------------------------------------------------------------

function Hero({ name }: { name: string }) {
  const heute = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-800/80 p-6 shadow-card backdrop-blur-sm">
      {/* dezenter Akzent-Schein */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-copper/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-copper-300">{heute}</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-chrome-50 sm:text-3xl">
            {begruessung()}
            {name ? `, ${name}` : ''} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1.5 text-sm text-chrome-400">
            Hier ist dein Überblick für den Betrieb.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/fahrzeugannahme" className="btn-primary btn-sm">
            <Icon className="h-4 w-4">{ICON_PATHS.plus}</Icon>
            Fahrzeugannahme
          </Link>
          <Link href="/auftraege" className="btn-ghost btn-sm">
            Neuer Auftrag
          </Link>
          <Link href="/kunden" className="btn-ghost btn-sm">
            Neuer Kunde
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Umsatz-Diagramm (eigenes, leichtes SVG-freies Balkendiagramm)
// ---------------------------------------------------------------------------

function UmsatzAreaChart({ data }: { data: UmsatzTrendPunkt[] }) {
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
        <span className="text-xs text-chrome-400">gesamt · letzte 6 Monate</span>
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
          <p className="text-sm text-chrome-400">Noch keine Umsätze</p>
          <p className="text-xs text-chrome-600">Sobald Rechnungen bezahlt sind, erscheinen sie hier.</p>
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${W} / ${H}` }}>
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
  const items = data ?? [];
  if (items.length === 0) return <Empty text="Noch keine Leistungen erfasst." />;
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
                {d.anzahl}× · {eur(d.umsatz)}
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

function TerminZeile({ t, mitTag }: { t: DashboardAppointment; mitTag?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid w-16 shrink-0 place-items-center rounded-lg bg-copper-soft py-1 text-xs font-semibold text-copper">
        {mitTag ? tagDatum(t.start) : uhrzeit(t.start)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-chrome-100">{t.titel}</p>
        <p className="truncate text-xs text-chrome-400">
          {t.kunde} · {t.fahrzeug}
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
// Seite
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
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
        if (aktiv) setError(e instanceof Error ? e.message : 'Dashboard konnte nicht geladen werden');
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
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <DashboardSkeleton />;

  const vorname = user?.firstName ?? '';
  const offeneAuftraege = stats.offeneAuftragsListe ?? [];
  const termineHeute = stats.termineHeuteListe ?? [];
  const kommendeTermine = stats.kommendeTermine ?? [];

  // Setup-Kriterien aus vorhandenen Daten ableiten (kein eigener Endpoint).
  const profilGefuellt = !!profil && !!(profil.steuernummer || profil.ustId) && !!profil.iban;
  const onboardingSteps: OnboardingStep[] = [
    { key: 'kunden', label: 'Ersten Kunden anlegen', done: stats.kundenGesamt > 0, href: '/kunden' },
    { key: 'leistungen', label: 'Leistungskatalog befüllen', done: hatLeistungen, href: '/leistungen' },
    { key: 'profil', label: 'Betriebsprofil vervollständigen (Steuer & Bank)', done: profilGefuellt, href: '/einstellungen' },
    { key: 'auftrag', label: 'Ersten Auftrag erfassen', done: stats.offeneAuftraege > 0 || stats.umsatzBezahlt > 0, href: '/fahrzeugannahme' },
  ];

  return (
    <div className="space-y-6">
      <Hero name={vorname} />

      <OnboardingChecklist steps={onboardingSteps} tenantId={user?.tenantId} />

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={ICON_PATHS.orders} label="Offene Aufträge" value={stats.offeneAuftraege} href="/auftraege" />
        <StatCard icon={ICON_PATHS.calendar} label="Termine heute" value={stats.termineHeute} href="/plantafel" />
        <StatCard
          icon={ICON_PATHS.revenue}
          label="Umsatz Monat"
          value={eur(stats.umsatzMonat)}
          delta={stats.umsatzDeltaProzent}
          hint="ggü. Vormonat"
          href="/rechnungen"
        />
        <StatCard
          icon={ICON_PATHS.invoices}
          label="Offene Rechnungen"
          value={eur(stats.offeneRechnungenSumme)}
          hint={`${stats.offeneRechnungenAnzahl} Stück`}
          href="/rechnungen"
        />
        <StatCard icon={ICON_PATHS.customers} label="Kunden gesamt" value={stats.kundenGesamt} href="/kunden" />
      </div>

      {/* Umsatztrend + Top-Leistungen */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Umsatzentwicklung"
          subtitle="Bezahlte Rechnungen je Monat"
          className="lg:col-span-2"
        >
          <UmsatzAreaChart data={stats.umsatzTrend} />
        </SectionCard>
        <SectionCard title="Top-Leistungen" subtitle="Nach Umsatz">
          <TopLeistungen data={stats.topLeistungen} />
        </SectionCard>
      </div>

      {/* Termine heute + naechste 7 Tage */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Termine heute">
          {termineHeute.length === 0 ? (
            <Empty
              text="Heute keine Termine."
              action={
                <Link href="/plantafel" className="btn-ghost btn-sm">
                  Zur Plantafel
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {termineHeute.map((t) => (
                <TerminZeile key={t.id} t={t} />
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Nächste Termine" subtitle="Kommende 7 Tage">
          {kommendeTermine.length === 0 ? (
            <Empty text="Keine anstehenden Termine." />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {kommendeTermine.map((t) => (
                <TerminZeile key={t.id} t={t} mitTag />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Nachbestell-Hinweis: Produkte unter Mindestbestand (nur wenn vorhanden) */}
      {stats.niedrigerBestand && stats.niedrigerBestand.anzahl > 0 && (
        <SectionCard
          title="Material wird knapp"
          subtitle={`${stats.niedrigerBestand.anzahl} ${stats.niedrigerBestand.anzahl === 1 ? 'Produkt' : 'Produkte'} unter Mindestbestand`}
          action={
            <Link href="/shop" className="btn-ghost btn-sm">
              Zum Lager
            </Link>
          }
        >
          <ul className="divide-y divide-ink-700/60">
            {stats.niedrigerBestand.produkte.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge className="badge-danger shrink-0">knapp</Badge>
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
        title="Offene Aufträge"
        subtitle="Zuletzt angelegt"
        action={
          <Link href="/auftraege" className="link-action inline-flex items-center gap-1 text-sm">
            Alle ansehen
            <Icon className="h-3.5 w-3.5">{ICON_PATHS.arrow}</Icon>
          </Link>
        }
      >
        {offeneAuftraege.length === 0 ? (
          <Empty
            text="Keine offenen Aufträge – alles erledigt!"
            action={
              <Link href="/fahrzeugannahme" className="btn-primary btn-sm">
                <Icon className="h-4 w-4">{ICON_PATHS.plus}</Icon>
                Fahrzeug annehmen
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nummer</th>
                  <th>Kunde</th>
                  <th>Fahrzeug</th>
                  <th>Leistung</th>
                  <th>Status</th>
                  <th className="text-right">Gesamt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offeneAuftraege.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-chrome-100">{o.auftragsnummer}</td>
                    <td>{o.kunde}</td>
                    <td>{o.fahrzeug}</td>
                    <td>{SERVICE_TYPE_LABEL[o.art] ?? o.art}</td>
                    <td>
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums">{eur(o.gesamtpreis)}</td>
                    <td className="text-right">
                      <Link
                        href={`/auftraege/detail/?id=${o.id}`}
                        className="link-action"
                      >
                        Öffnen
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
