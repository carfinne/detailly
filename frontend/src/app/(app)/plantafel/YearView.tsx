'use client';

// ---------------------------------------------------------------------------
// Jahresuebersicht der Plantafel: 12 Mini-Monate, ein Punkt je Tag. Groesse und
// Kupfer-Intensitaet kodieren die Terminanzahl; Klick auf einen Tag springt in
// die Wochenansicht dieser Woche. Bewusst reine Dichte-Uebersicht (Chef-Blick
// "wann ist viel los"), keine Termindetails.
//
// Chef-Layer (nur Leitung): Mit `umsatzByTag` kodieren die Punkte stattdessen
// den TAGES-UMSATZ aus dem Server-Aggregat (GET /appointments/umsatz) – das ist
// praeziser als die Terminanzahl, weil die Terminliste des Jahres bei 1000
// gekappt sein kann, das Aggregat aber serverseitig vollstaendig summiert.
// ---------------------------------------------------------------------------
import { useMemo } from 'react';
import type { Appointment } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { UmsatzTag, eurGanz, sameDay, startOfWeek, tagKey } from './plantafel-lib';

/** Punkt-Stufen: Anzahl -> Groesse + Kupfer-Intensitaet (Design-Token, keine neuen Hex). */
function dotClass(count: number): string {
  if (count <= 0) return 'h-1 w-1 bg-ink-700';
  if (count === 1) return 'h-1.5 w-1.5 bg-copper/45';
  if (count <= 3) return 'h-2 w-2 bg-copper/70';
  if (count <= 6) return 'h-2.5 w-2.5 bg-copper';
  return 'h-3 w-3 bg-copper shadow-glow';
}

/** Punkt-Stufen im Umsatz-Modus: Tagessumme RELATIV zum Jahres-Spitzentag. */
function umsatzDotClass(summe: number, max: number): string {
  if (summe <= 0 || !(max > 0)) return 'h-1 w-1 bg-ink-700';
  const q = summe / max;
  if (q <= 0.25) return 'h-1.5 w-1.5 bg-copper/45';
  if (q <= 0.5) return 'h-2 w-2 bg-copper/70';
  if (q <= 0.75) return 'h-2.5 w-2.5 bg-copper';
  return 'h-3 w-3 bg-copper shadow-glow';
}

export function YearView({
  year,
  appts,
  wochenstart,
  umsatzByTag,
  onDay,
}: {
  year: number;
  appts: Appointment[];
  wochenstart: 'montag' | 'sonntag';
  /** Umsatz-Modus (Chef-Layer): 'YYYY-MM-DD' -> Tages-Aggregat; undefined = Termin-Dichte. */
  umsatzByTag?: Record<string, UmsatzTag>;
  onDay: (d: Date) => void;
}) {
  const t = useT();
  const today = new Date();

  // Spitzenwert des Jahres als Bezugsgroesse der Umsatz-Intensitaet.
  const maxTagesUmsatz = useMemo(() => {
    if (!umsatzByTag) return 0;
    let max = 0;
    for (const tag of Object.values(umsatzByTag)) if (tag.summe > max) max = tag.summe;
    return max;
  }, [umsatzByTag]);

  // Terminanzahl je Tag (Schluessel: Monat*100+Tag, Jahr ist fix).
  const countByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of appts) {
      const d = new Date(a.start);
      if (d.getFullYear() !== year) continue;
      const key = (d.getMonth() + 1) * 100 + d.getDate();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appts, year]);

  // Wochentags-Initialen in Darstellungs-Reihenfolge (Mo- oder So-Start).
  const initialenKeys = useMemo(() => {
    const moSo = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
    const reihe = wochenstart === 'sonntag' ? ['so', ...moSo.slice(0, 6)] : moSo;
    return reihe.map((k) => `plantafel.weekday.${k}`);
  }, [wochenstart]);

  return (
    <div className="animate-fade-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        // Leerzellen vor dem 1. des Monats (relativ zum eingestellten Wochenstart).
        const lead = wochenstart === 'sonntag' ? first.getDay() : (first.getDay() + 6) % 7;
        return (
          <section key={m} className="rounded-2xl border border-ink-700/70 bg-ink-850 p-3.5">
            <h3 className="mb-2 font-display text-sm font-semibold capitalize text-chrome-100">
              {first.toLocaleDateString('de-DE', { month: 'long' })}
            </h3>
            <div className="grid grid-cols-7 gap-0.5">
              {initialenKeys.map((k, i) => (
                <div key={`${k}-${i}`} className="grid h-5 place-items-center text-[9px] font-medium uppercase text-chrome-600">
                  {t(k).charAt(0)}
                </div>
              ))}
              {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} className="h-6" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = new Date(year, m, i + 1);
                const count = countByDay.get((m + 1) * 100 + (i + 1)) ?? 0;
                const isToday = sameDay(d, today);
                const summe = umsatzByTag ? (umsatzByTag[tagKey(d)]?.summe ?? 0) : 0;
                const datumLabel = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
                const label = umsatzByTag
                  ? `${datumLabel} – ${t('plantafel.umsatz.tagTooltip', { betrag: eurGanz(summe) })}`
                  : `${datumLabel} – ${t('plantafel.jahr.termine', { count })}`;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onDay(startOfWeek(d, wochenstart))}
                    title={label}
                    aria-label={label}
                    className={`grid h-6 w-full place-items-center rounded-md transition-colors duration-120 hover:bg-ink-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 ${isToday ? 'ring-1 ring-copper/60' : ''}`}
                  >
                    <span className={`rounded-full ${umsatzByTag ? umsatzDotClass(summe, maxTagesUmsatz) : dotClass(count)}`} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
