'use client';

// ===========================================================================
// Dashboard-Erlebnis (Welle 4, Paket B) – NUR Darstellung/Animation + Briefing.
// ---------------------------------------------------------------------------
// Entlastet dashboard/page.tsx um die zwei „schweren" Bausteine:
//   • DashboardChart  – Umsatz-Chart mit Einzeichnen (stroke-dashoffset) +
//                       Flaechen-Clip-Reveal (IntersectionObserver-getriggert,
//                       reduced-motion-sicher) UND Cursor-Fadenkreuz.
//   • DashboardBriefing – rein regelbasierte Tages-Briefing-Card aus bereits
//                       vorhandenen Daten (stats) + best-effort Wochen-
//                       Auslastung (Owner-gated, wiederverwendet aus plantafel-lib).
// Keine neuen Pakete, nur transform/opacity-Animationen, bestehende Tokens.
// ===========================================================================

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { motionOk } from '@/lib/motion';
import { eur } from '@/lib/format';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { INHABER_ROLLEN } from '@/lib/rollen';
import type { Appointment, DashboardStats, UmsatzTrendPunkt } from '@/lib/types';
import {
  type Arbeitszeit,
  type Wochentag,
  WOCHENTAGE,
  addDays,
  startOfWeek,
  wochenAuslastung,
} from '@/app/(app)/plantafel/plantafel-lib';

// ---------------------------------------------------------------------------
// Umsatz-Chart: Einzeichnen + Flaechen-Clip-Reveal + Cursor-Fadenkreuz
// ---------------------------------------------------------------------------

export interface DashboardChartHandle {
  /** Aktuelles Chart-SVG (fuer den PNG-Export). */
  svg: () => SVGSVGElement | null;
  /** Erzwingt den Endzustand (Linie/Flaeche/Punkte vollstaendig) vor dem Export,
   *  damit ein nie zu 25 % sichtbares Chart nicht leer serialisiert wird. */
  ensureDrawn: () => void;
}

export const DashboardChart = forwardRef<DashboardChartHandle, { data: UmsatzTrendPunkt[] }>(
  function DashboardChart({ data }, ref) {
  const t = useT();
  const svgEl = useRef<SVGSVGElement>(null);
  const rawId = useId();
  const uid = rawId.replace(/:/g, ''); // useId() liefert Doppelpunkte -> ungueltig als SVG-id/url()
  const areaId = `umsArea-${uid}`;
  const clipId = `umsClip-${uid}`;

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

  // Einzeichnen: bei erlaubter Bewegung verborgen starten und beim Sichtwerden
  // zeichnen; bei reduzierter Bewegung sofort vollstaendig (kein Frame verborgen).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<boolean>(() => (typeof window === 'undefined' ? true : !motionOk()));
  useEffect(() => {
    const el = wrapRef.current;
    if (!motionOk()) {
      setDrawn(true);
      return;
    }
    if (!el || typeof IntersectionObserver === 'undefined') {
      setDrawn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setDrawn(true);
            io.disconnect();
          }
        }),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Export-Bruecke: der Export-Handler in page.tsx erzwingt vor dem Serialisieren
  // den Endzustand (svgToPng klont die Inline-Styles -> setDrawn(true) genuegt).
  useImperativeHandle(
    ref,
    () => ({
      svg: () => svgEl.current,
      ensureDrawn: () => setDrawn(true),
    }),
    [],
  );

  // Cursor-Fadenkreuz: auf den naechsten Datenpunkt einrasten (diskret) – nur
  // wenige Re-Renders, kein Canvas, reine Pointer-Mathematik ueber der x-Achse.
  const [hover, setHover] = useState<number | null>(null);
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || n === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  }
  function onLeave() {
    setHover(null);
  }

  const hi = hover != null && hover >= 0 && hover < n ? hover : null;
  const hx = hi != null ? xx(hi) : 0;
  const hy = hi != null ? yy(pts[hi].umsatz) : 0;
  // Label horizontal an der Cursor-Spalte, an den Raendern eingefangen.
  const labelLeft = hi != null ? Math.min(90, Math.max(10, (hx / W) * 100)) : 50;

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
          <div ref={wrapRef} className="relative">
            <svg
              ref={svgEl}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              preserveAspectRatio="xMidYMid meet"
              style={{ aspectRatio: `${W} / ${H}` }}
              onPointerMove={onMove}
              onPointerLeave={onLeave}
              onPointerCancel={onLeave}
            >
              <defs>
                <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'rgb(var(--copper-500))' }} stopOpacity="0.42" />
                  <stop offset="1" style={{ stopColor: 'rgb(var(--copper-500))' }} stopOpacity="0" />
                </linearGradient>
                {/* Clip-Reveal fuer die Flaeche: waechst von links (transform-box:fill-box). */}
                <clipPath id={clipId}>
                  <rect
                    x={0}
                    y={0}
                    width={W}
                    height={H}
                    style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'left center',
                      transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
                      transition: 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
                    }}
                  />
                </clipPath>
              </defs>

              {/* Gitterlinien (statisch) */}
              {[0, 1, 2, 3].map((i) => {
                const y = padTop + (i / 3) * (H - padTop - padBot);
                return (
                  <line
                    key={i}
                    x1={padX}
                    y1={y}
                    x2={W - padX}
                    y2={y}
                    style={{ stroke: 'var(--grid-line)' }}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

              {/* Flaeche – per Clip aufgezogen */}
              <g clipPath={`url(#${clipId})`}>
                <path d={area} fill={`url(#${areaId})`} />
              </g>

              {/* Linie – per stroke-dashoffset eingezeichnet */}
              <path
                d={line}
                fill="none"
                pathLength={1}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{
                  stroke: 'rgb(var(--copper-500))',
                  strokeDasharray: 1,
                  strokeDashoffset: drawn ? 0 : 1,
                  transition: 'stroke-dashoffset 0.95s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
                }}
              />

              {/* Datenpunkte – blenden nach dem Einzeichnen dezent ein */}
              {pts.map((d, i) => (
                <circle
                  key={i}
                  cx={xx(i)}
                  cy={yy(d.umsatz)}
                  r={i === n - 1 ? 4.5 : 3.5}
                  style={{
                    fill: 'rgb(var(--ink-850))',
                    stroke: 'rgb(var(--copper-500))',
                    opacity: drawn ? 1 : 0,
                    transition: 'opacity 0.4s ease 0.7s',
                  }}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {d.label}: {eur(d.umsatz)}
                  </title>
                </circle>
              ))}

              {/* Cursor-Fadenkreuz: vertikale Copper-Hairline + Punkt-Highlight */}
              {hi != null && (
                <g pointerEvents="none">
                  <line
                    x1={hx}
                    y1={padTop - 4}
                    x2={hx}
                    y2={H - padBot}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    style={{ stroke: 'rgb(var(--copper-400))', opacity: 0.55 }}
                  />
                  <circle cx={hx} cy={hy} r={7} style={{ fill: 'rgb(var(--copper-500))', opacity: 0.16 }} />
                  <circle
                    cx={hx}
                    cy={hy}
                    r={4.5}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    style={{ fill: 'rgb(var(--ink-850))', stroke: 'rgb(var(--copper-400))' }}
                  />
                </g>
              )}
            </svg>

            {/* Wert-Label (HTML-Overlay) folgt der Cursor-Spalte */}
            {hi != null && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-700 bg-ink-850/95 px-2.5 py-1 shadow-pop"
                style={{ left: `${labelLeft}%` }}
              >
                <span className="mr-1.5 text-[11px] capitalize text-chrome-400">{pts[hi].label}</span>
                <span className="text-xs font-semibold tabular-nums text-copper-200">{eur(pts[hi].umsatz)}</span>
              </div>
            )}
          </div>

          {/* Monatslabels */}
          <div className="mt-2 flex justify-between gap-2">
            {pts.map((d, i) => (
              <span
                key={i}
                className={`flex-1 text-center text-[11px] capitalize ${
                  hi === i
                    ? 'font-semibold text-copper-200'
                    : i === n - 1
                      ? 'font-semibold text-chrome-200'
                      : 'text-chrome-400'
                }`}
              >
                {d.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Tages-Briefing-Card: regelbasiert aus stats + best-effort Wochen-Auslastung
// ---------------------------------------------------------------------------

interface KalenderProfil {
  kalender?: { arbeitszeiten?: Record<Wochentag, Arbeitszeit> };
  darstellung?: { wochenstart?: 'montag' | 'sonntag' };
}

export function DashboardBriefing({ stats }: { stats: DashboardStats }) {
  const t = useT();
  const { user } = useAuth();
  // Wochen-Auslastung (0..100) – nur best-effort fuer den Inhaber, sonst weggelassen.
  const [auslastung, setAuslastung] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !INHABER_ROLLEN.includes(user.role)) {
      setAuslastung(null);
      return;
    }
    let aktiv = true;
    (async () => {
      try {
        // /tenants/me liefert Arbeitszeiten + Wochenstart mit (identische Quelle
        // wie die Glocke). Ein Termin-Fetch der laufenden Woche, dann die
        // Plantafel-Formel `wochenAuslastung` (DRY, keine neue Route).
        const profil = await api.get<KalenderProfil>('/tenants/me');
        if (!aktiv) return;
        const az = profil.kalender?.arbeitszeiten;
        if (!az || !WOCHENTAGE.some((d) => az[d]?.aktiv)) return;
        const wochenstart = profil.darstellung?.wochenstart ?? 'montag';
        const start = startOfWeek(new Date(), wochenstart);
        const von = start.toISOString();
        const bis = addDays(start, 7).toISOString();
        const appts = await api.get<Appointment[]>(`/appointments?from=${von}&to=${bis}`);
        if (!aktiv) return;
        const wa = wochenAuslastung(appts, start, az);
        if (wa.prozent != null) setAuslastung(wa.prozent);
      } catch {
        /* fehlende Rechte / Endpoint -> Auslastungs-Zeile still weglassen */
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [user]);

  // 1–3 konkrete Hinweise aus bereits geladenen Kennzahlen.
  const hints: string[] = [];
  if (stats.termineHeute > 0) hints.push(t('dashboard.briefing.appointmentsToday', { count: stats.termineHeute }));
  if (stats.offeneRechnungenAnzahl > 0)
    hints.push(t('dashboard.briefing.openInvoices', { count: stats.offeneRechnungenAnzahl }));

  return (
    <div className="card">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-copper-soft text-copper ring-1 ring-copper/20">
          <Icon className="h-4 w-4">{ICON_PATHS.calendar}</Icon>
        </span>
        <h2 className="font-display text-base font-semibold text-chrome-50">{t('dashboard.briefing.title')}</h2>
      </div>

      {/* Kein Gruss hier – der grosse Hero-Gruss steht direkt darueber. Die Card
          startet mit dem Inhalt: Auslastung (falls vorhanden), sonst die Hinweise. */}
      {auslastung != null && (
        <p className="mt-3 text-sm text-chrome-300">
          <span className="font-medium text-copper-200">
            {t('dashboard.briefing.utilization', { prozent: auslastung })}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {hints.length > 0 ? (
          hints.map((h, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850/60 px-3 py-1 text-xs text-chrome-200"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-copper" />
              {h}
            </span>
          ))
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850/60 px-3 py-1 text-xs text-chrome-300">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
            {t('dashboard.briefing.allClear')}
          </span>
        )}
      </div>
    </div>
  );
}
