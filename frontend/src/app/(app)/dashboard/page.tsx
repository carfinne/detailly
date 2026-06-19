'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR, SERVICE_TYPE_LABEL } from '@/lib/labels';
import type {
  DashboardStats,
  DashboardAppointment,
  TopLeistung,
  UmsatzTrendPunkt,
} from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, SectionCard } from '@/components/ui';

// Uhrzeit aus ISO-String (HH:MM) – fuer die Termin-Widgets.
function uhrzeit(value?: string): string {
  if (!value) return '–';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Kurzes Tagesdatum (z.B. "Mo 23.06.") fuer kommende Termine.
function tagDatum(value?: string): string {
  if (!value) return '–';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// KPI-Karte mit optionalem Delta-Indikator (Vergleich zum Vormonat).
function Kpi({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mt-2">{value}</div>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              delta >= 0 ? 'text-positive' : 'text-danger'
            }`}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} %
          </span>
        )}
        {hint && <span className="text-chrome-400">{hint}</span>}
      </div>
    </div>
  );
}

// Eigenes leichtes SVG-Balkendiagramm fuer den 6-Monats-Umsatztrend.
function UmsatzBalken({ data }: { data: UmsatzTrendPunkt[] }) {
  const max = Math.max(1, ...data.map((d) => d.umsatz));
  return (
    <div className="flex items-end justify-between gap-3 pt-2" style={{ height: 180 }}>
      {data.map((d, i) => {
        const hoehe = Math.round((d.umsatz / max) * 130);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[10px] font-medium text-chrome-400">
              {d.umsatz > 0 ? eur(d.umsatz).replace(/\s?€/, ' €') : ''}
            </span>
            <div className="flex w-full justify-center">
              <div
                className="w-full max-w-[42px] rounded-t-md bg-copper-grad transition-all"
                style={{ height: Math.max(hoehe, 3) }}
                title={eur(d.umsatz)}
              />
            </div>
            <span className="text-[11px] capitalize text-chrome-400">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Horizontaler Balken je Leistung, relativ zum Umsatz-Maximum.
function TopLeistungen({ data }: { data: TopLeistung[] }) {
  if (data.length === 0) return <Empty text="Noch keine Leistungen erfasst." />;
  const max = Math.max(1, ...data.map((d) => d.umsatz));
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-chrome-200">{d.name}</span>
            <span className="shrink-0 text-chrome-400">
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
      ))}
    </div>
  );
}

// Termin-Zeile fuer beide Termin-Widgets.
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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<DashboardStats>('/dashboard/stats')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <Loading />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Überblick über den Betrieb" />

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Offene Aufträge" value={stats.offeneAuftraege} />
        <Kpi label="Termine heute" value={stats.termineHeute} />
        <Kpi
          label="Umsatz Monat"
          value={eur(stats.umsatzMonat)}
          delta={stats.umsatzDeltaProzent}
          hint="ggü. Vormonat"
        />
        <Kpi
          label="Offene Rechnungen"
          value={eur(stats.offeneRechnungenSumme)}
          hint={`${stats.offeneRechnungenAnzahl} Stück`}
        />
        <Kpi label="Kunden gesamt" value={stats.kundenGesamt} />
      </div>

      {/* Umsatztrend + Top-Leistungen */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Umsatz – letzte 6 Monate"
          subtitle="Bezahlte Rechnungen je Monat"
          className="lg:col-span-2"
        >
          <UmsatzBalken data={stats.umsatzTrend} />
        </SectionCard>
        <SectionCard title="Top-Leistungen" subtitle="Nach Umsatz">
          <TopLeistungen data={stats.topLeistungen} />
        </SectionCard>
      </div>

      {/* Termine heute + naechste 7 Tage */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Termine heute">
          {stats.termineHeuteListe.length === 0 ? (
            <Empty text="Heute keine Termine." />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {stats.termineHeuteListe.map((t) => (
                <TerminZeile key={t.id} t={t} />
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Nächste Termine" subtitle="Kommende 7 Tage">
          {stats.kommendeTermine.length === 0 ? (
            <Empty text="Keine anstehenden Termine." />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {stats.kommendeTermine.map((t) => (
                <TerminZeile key={t.id} t={t} mitTag />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Offene Auftraege */}
      <div className="mt-6">
        <SectionCard title="Offene Aufträge">
          {stats.offeneAuftragsListe.length === 0 ? (
            <Empty text="Keine offenen Aufträge." />
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
                  {stats.offeneAuftragsListe.map((o) => (
                    <tr key={o.id}>
                      <td className="font-medium">{o.auftragsnummer}</td>
                      <td>{o.kunde}</td>
                      <td>{o.fahrzeug}</td>
                      <td>{SERVICE_TYPE_LABEL[o.art] ?? o.art}</td>
                      <td>
                        <Badge className={ORDER_STATUS_COLOR[o.status]}>
                          {ORDER_STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </td>
                      <td className="text-right">{eur(o.gesamtpreis)}</td>
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
    </div>
  );
}
