'use client';

// ---------------------------------------------------------------------------
// Monatsraster der Plantafel. Kalender 2.0: Wochenstart (Mo/So) aus den
// Betriebs-Einstellungen, Farbmodus-faehig (stilFuer), Fallback-Titel fuer
// Termine ohne Titel, inaktive Tage (Wochenende) gedimmt.
// ---------------------------------------------------------------------------
import type { Appointment, Customer, Employee } from '@/lib/types';
import { useT } from '@/lib/i18n';
import {
  Arbeitszeit,
  TerminStil,
  fmtZeit,
  geburtstagsNamen,
  sameDay,
  terminTitel,
} from './plantafel-lib';
import { BirthdayMarker } from './TimeGrid';

// Statische Wochentags-Kuerzel als i18n-Keys in Mo-So-Reihenfolge; bei
// Wochenstart Sonntag wird rotiert.
const WEEKDAY_KEYS = [
  'plantafel.weekday.mo',
  'plantafel.weekday.di',
  'plantafel.weekday.mi',
  'plantafel.weekday.do',
  'plantafel.weekday.fr',
  'plantafel.weekday.sa',
  'plantafel.weekday.so',
];

export function MonthGrid({
  days,
  month,
  appts,
  custMap,
  employees,
  wochenstart,
  zeitformat,
  arbeitszeitFuer,
  stilFuer,
  leistungFuer,
  onDay,
  onAppt,
}: {
  days: Date[];
  month: number;
  appts: Appointment[];
  custMap: Record<string, Customer>;
  employees: Employee[];
  wochenstart: 'montag' | 'sonntag';
  zeitformat: '24h' | '12h';
  arbeitszeitFuer: (day: Date) => Arbeitszeit;
  stilFuer: (a: Appointment) => TerminStil;
  leistungFuer: (a: Appointment) => string | undefined;
  onDay: (d: Date) => void;
  onAppt: (a: Appointment) => void;
}) {
  const t = useT();
  const today = new Date();
  const headerKeys =
    wochenstart === 'sonntag' ? [WEEKDAY_KEYS[6], ...WEEKDAY_KEYS.slice(0, 6)] : WEEKDAY_KEYS;
  return (
    <div className="animate-fade-in overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850">
      <div className="grid grid-cols-7 border-b border-ink-700/70 text-center kpi-label">
        {headerKeys.map((wk) => <div key={wk} className="py-2">{t(wk)}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = d.getMonth() === month;
          const list = appts
            .filter((a) => sameDay(new Date(a.start), d))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          const isToday = sameDay(d, today);
          const inaktiv = !arbeitszeitFuer(d).aktiv;
          return (
            <div key={d.toISOString()}
              className={`min-h-[104px] cursor-pointer border-b border-l border-ink-700/40 p-1.5 transition-colors hover:bg-ink-800/60 ${inMonth ? (inaktiv ? 'bg-ink-900/50' : '') : 'bg-ink-900/40'}`}
              onClick={() => onDay(d)}>
              <div className={`mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday ? 'bg-copper text-ink-950' : inMonth ? (inaktiv ? 'text-chrome-500' : 'text-chrome-200') : 'text-chrome-600'}`}>{d.getDate()}</div>
              {inMonth && <BirthdayMarker names={geburtstagsNamen(employees, d)} />}
              <div className="space-y-1">
                {list.slice(0, 3).map((a) => {
                  const st = stilFuer(a);
                  return (
                    <button key={a.id} onClick={(e) => { e.stopPropagation(); onAppt(a); }}
                      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] ring-1 ${st.chip}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.bar}`} />
                      <span className="tabular-nums opacity-80">{fmtZeit(a.start, zeitformat)}</span>
                      <span className="truncate font-medium">{terminTitel(a, custMap, leistungFuer(a), t('plantafel.ohneTitel'))}</span>
                    </button>
                  );
                })}
                {list.length > 3 && <div className="px-1 text-[10px] text-chrome-500">{t('plantafel.more', { count: list.length - 3 })}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
