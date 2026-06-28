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
} from '@/lib/types';
import { ErrorBox, Empty, Badge, SectionCard } from '@/components/ui';

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

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? 'h-[18px] w-[18px]'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  orders: <path d="M9 5h6m-6 4h6m-6 4h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />,
  calendar: <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  revenue: <path d="M3 17l6-6 4 4 8-8M21 7h-4M21 7v4" />,
  invoice: <path d="M9 7h6m-6 4h6m-6 4h4M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />,
  customers: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

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
            <Icon className="h-4 w-4">{ICONS.plus}</Icon>
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
// KPI-Karte mit Icon + optionalem Delta
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value,
  delta,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delta?: number | null;
  hint?: string;
  href?: string;
}) {
  const hatFuss = (delta !== undefined && delta !== null) || !!hint;
  const cls = 'card group block transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-600';
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="kpi-label">{label}</span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-copper-soft text-copper ring-1 ring-copper/20 transition-transform duration-150 group-hover:scale-105">
          <Icon>{icon}</Icon>
        </span>
      </div>
      <div className="kpi-value mt-3">{value}</div>
      {hatFuss && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {delta !== undefined && delta !== null && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                delta >= 0 ? 'text-positive' : 'text-danger'
              }`}
            >
              <Icon className="h-3 w-3">
                {delta >= 0 ? <path d="m5 15 7-7 7 7" /> : <path d="m5 9 7 7 7-7" />}
              </Icon>
              {Math.abs(delta)} %
            </span>
          )}
          {hint && <span className="text-chrome-400">{hint}</span>}
        </div>
      )}
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
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
            <Icon>{ICONS.revenue}</Icon>
          </span>
          <p className="text-sm text-chrome-400">Noch keine Umsätze</p>
          <p className="text-xs text-chrome-600">Sobald Rechnungen bezahlt sind, erscheinen sie hier.</p>
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${W} / ${H}` }}>
            <defs>
              <linearGradient id="umsArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e8923b" stopOpacity="0.42" />
                <stop offset="1" stopColor="#e8923b" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Gitterlinien */}
            {[0, 1, 2, 3].map((i) => {
              const y = padTop + (i / 3) * (H - padTop - padBot);
              return <line key={i} x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
            })}
            <path d={area} fill="url(#umsArea)" />
            <path d={line} fill="none" stroke="#e8923b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {pts.map((d, i) => (
              <circle key={i} cx={xx(i)} cy={yy(d.umsatz)} r={i === n - 1 ? 4.5 : 3.5} fill="#0b0e14" stroke="#e8923b" strokeWidth="2" vectorEffect="non-scaling-stroke">
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

  return (
    <div className="space-y-6">
      <Hero name={vorname} />

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={ICONS.orders} label="Offene Aufträge" value={stats.offeneAuftraege} href="/auftraege" />
        <KpiCard icon={ICONS.calendar} label="Termine heute" value={stats.termineHeute} href="/plantafel" />
        <KpiCard
          icon={ICONS.revenue}
          label="Umsatz Monat"
          value={eur(stats.umsatzMonat)}
          delta={stats.umsatzDeltaProzent}
          hint="ggü. Vormonat"
          href="/rechnungen"
        />
        <KpiCard
          icon={ICONS.invoice}
          label="Offene Rechnungen"
          value={eur(stats.offeneRechnungenSumme)}
          hint={`${stats.offeneRechnungenAnzahl} Stück`}
          href="/rechnungen"
        />
        <KpiCard icon={ICONS.customers} label="Kunden gesamt" value={stats.kundenGesamt} href="/kunden" />
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

      {/* Offene Auftraege */}
      <SectionCard
        title="Offene Aufträge"
        subtitle="Zuletzt angelegt"
        action={
          <Link href="/auftraege" className="inline-flex items-center gap-1 text-sm text-copper hover:underline">
            Alle ansehen
            <Icon className="h-3.5 w-3.5">{ICONS.arrow}</Icon>
          </Link>
        }
      >
        {offeneAuftraege.length === 0 ? (
          <Empty
            text="Keine offenen Aufträge – alles erledigt!"
            action={
              <Link href="/fahrzeugannahme" className="btn-primary btn-sm">
                <Icon className="h-4 w-4">{ICONS.plus}</Icon>
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
                        className="text-copper hover:underline"
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
