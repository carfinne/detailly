'use client';

// ---------------------------------------------------------------------------
// Zeitraster der Plantafel (Tag / Woche / 2 Wochen).
//
// Kalender 2.0: Das Raster zeigt NUR das Arbeitszeitfenster des Betriebs
// (kalenderStartStunde..kalenderEndStunde, Default 7–19) statt 0–24. Termine
// ausserhalb des Fensters werden an den Rand GEKLEMMT und tragen einen
// "+n frueher/spaeter"-Hinweis – nichts darf unsichtbar werden. Zusaetzlich:
// Auslastungs-Balken im Tageskopf (nur Leitung), gedimmte inaktive Tage,
// Arbeitszeit-Schattierung je Wochentag, Mitarbeiter-Initialen auf der Karte
// und Kunde+Fahrzeug IMMER sichtbar (Verwechslungsschutz).
// ---------------------------------------------------------------------------
import { useRef, useState } from 'react';
import type { Appointment, Customer, Employee, Vehicle } from '@/lib/types';
import { kundenName } from '@/lib/format';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';
import {
  Arbeitszeit,
  TerminStil,
  DAY_MS,
  HOUR_H,
  SNAP,
  fmtDauerKurz,
  fmtZeit,
  geburtstagsNamen,
  hhmmZuMinuten,
  initialen,
  layoutDay,
  minsIntoDay,
  sameDay,
  stundenLabel,
  terminTitel,
} from './plantafel-lib';

/** Dezenter Geburtstags-Marker am Tageskopf (reine Erinnerung, kein Klick-Ziel). */
export function BirthdayMarker({ names }: { names: string[] }) {
  const t = useT();
  if (names.length === 0) return null;
  const label =
    t('plantafel.geburtstag.label', { name: names[0] }) +
    (names.length > 1 ? ` +${names.length - 1}` : '');
  return (
    <div
      title={t('plantafel.geburtstag.tooltip', { names: names.join(', ') })}
      className="mx-auto mt-1 flex max-w-full items-center justify-center gap-1 rounded-full bg-copper-soft px-2 py-0.5 text-[10px] font-medium text-copper-300 ring-1 ring-copper/30"
    >
      <Icon className="h-3 w-3 shrink-0">{ICON_PATHS.gift}</Icon>
      <span className="truncate">{label}</span>
    </div>
  );
}

export function TimeGrid({
  days,
  appts,
  custMap,
  vehMap,
  empMap,
  employees,
  fensterStart,
  fensterEnde,
  zeitformat,
  arbeitszeitFuer,
  stilFuer,
  leistungFuer,
  auslastungFuer,
  kompakt,
  colsRef,
  colW,
  nowTick,
  onCreate,
  onEdit,
  onMove,
}: {
  days: Date[];
  appts: Appointment[];
  custMap: Record<string, Customer>;
  vehMap: Record<string, Vehicle>;
  empMap: Record<string, Employee>;
  employees: Employee[];
  /** Sichtbares Arbeitszeitfenster in vollen Stunden (z. B. 7..19). */
  fensterStart: number;
  fensterEnde: number;
  zeitformat: '24h' | '12h';
  arbeitszeitFuer: (day: Date) => Arbeitszeit;
  stilFuer: (a: Appointment) => TerminStil;
  leistungFuer: (a: Appointment) => string | undefined;
  /** null = kein Balken fuer diesen Tag; undefined = Chef-Layer aus (keine Leitung). */
  auslastungFuer?: (day: Date) => number | null;
  kompakt: boolean;
  colsRef: React.RefObject<HTMLDivElement>;
  colW: number;
  nowTick: number;
  onCreate: (p: { start: Date; ende: Date }) => void;
  onEdit: (a: Appointment) => void;
  onMove: (id: string, start: Date, ende: Date) => void;
}) {
  const t = useT();
  const fsMin = fensterStart * 60;
  const feMin = fensterEnde * 60;
  const gridH = ((feMin - fsMin) / 60) * HOUR_H;
  const hours = Array.from({ length: fensterEnde - fensterStart }, (_, i) => fensterStart + i);
  const [drag, setDrag] = useState<null | { id: string; mode: 'move' | 'resize'; offDays: number; offMin: number }>(null);
  const di = useRef<null | { id: string; mode: 'move' | 'resize'; sx: number; sy: number; os: number; oe: number; moved: boolean }>(null);
  const now = new Date(nowTick);

  function down(e: React.PointerEvent, a: Appointment, mode: 'move' | 'resize') {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    di.current = { id: a.id, mode, sx: e.clientX, sy: e.clientY, os: new Date(a.start).getTime(), oe: new Date(a.ende).getTime(), moved: false };
  }
  function move(e: React.PointerEvent, a: Appointment) {
    const d = di.current; if (!d || d.id !== a.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const offMin = Math.round((dy / HOUR_H * 60) / SNAP) * SNAP;
    const offDays = d.mode === 'move' && colW ? Math.round(dx / colW) : 0;
    setDrag({ id: a.id, mode: d.mode, offDays, offMin });
  }
  function up(e: React.PointerEvent, a: Appointment) {
    const d = di.current; di.current = null;
    const cur = drag; setDrag(null);
    if (!d || d.id !== a.id) return;
    if (!d.moved) { onEdit(a); return; }
    const offMin = cur?.offMin ?? 0, offDays = cur?.offDays ?? 0;
    if (d.mode === 'move') {
      const shift = offDays * DAY_MS + offMin * 60_000;
      onMove(a.id, new Date(d.os + shift), new Date(d.oe + shift));
    } else {
      const ne = Math.max(d.oe + offMin * 60_000, d.os + SNAP * 60_000);
      onMove(a.id, new Date(d.os), new Date(ne));
    }
  }

  function createAt(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let mins = fsMin + Math.round((y / HOUR_H * 60) / 30) * 30;
    mins = Math.max(fsMin, Math.min(mins, feMin - 60));
    const s = new Date(day); s.setHours(0, mins, 0, 0);
    onCreate({ start: s, ende: new Date(s.getTime() + 60 * 60_000) });
  }

  return (
    <div className="animate-fade-in overflow-x-auto rounded-2xl border border-ink-700/70 bg-ink-850">
      <div className={kompakt ? 'min-w-[1240px]' : 'min-w-[680px]'}>
        {/* Kopf */}
        <div className="flex border-b border-ink-700/70">
          <div className="w-14 shrink-0" />
          {days.map((d) => {
            const today = sameDay(d, now);
            const az = arbeitszeitFuer(d);
            const auslastung = auslastungFuer ? auslastungFuer(d) : undefined;
            return (
              <div key={d.toISOString()} className={`flex-1 px-1 py-2.5 text-center ${az.aktiv ? '' : 'opacity-55'}`}>
                <div className="kpi-label">{d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                <div className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${today ? 'bg-copper text-ink-950' : 'text-chrome-100'}`}>{d.getDate()}</div>
                {/* Chef-Layer: Auslastung des Tages relativ zum Arbeitszeitfenster (nur Leitung). */}
                {auslastung != null && (
                  <div
                    className="mx-auto mt-1.5 h-1 w-4/5 max-w-[72px] overflow-hidden rounded-full bg-ink-700"
                    role="img"
                    aria-label={t('plantafel.auslastung', { prozent: String(auslastung) })}
                    title={t('plantafel.auslastung', { prozent: String(auslastung) })}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-220 ease-emphasized ${auslastung >= 100 ? 'bg-danger' : auslastung > 85 ? 'bg-caution' : 'bg-copper'}`}
                      style={{ width: `${Math.min(100, auslastung)}%` }}
                    />
                  </div>
                )}
                {!kompakt && <BirthdayMarker names={geburtstagsNamen(employees, d)} />}
              </div>
            );
          })}
        </div>
        {/* Koerper */}
        <div className="flex">
          {/* Stunden-Gutter */}
          <div className="w-14 shrink-0">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_H }}>
                <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-chrome-600">{stundenLabel(h, zeitformat)}</span>
              </div>
            ))}
          </div>
          {/* Spalten */}
          <div ref={colsRef} className="relative flex flex-1">
            {days.map((day) => {
              const list = appts.filter((a) => sameDay(new Date(a.start), day));
              const lay = layoutDay(list);
              const today = sameDay(day, now);
              const az = arbeitszeitFuer(day);
              const azVon = az.aktiv ? hhmmZuMinuten(az.von) : null;
              const azBis = az.aktiv ? hhmmZuMinuten(az.bis) : null;
              return (
                <div key={day.toISOString()}
                  className={`relative flex-1 border-l border-ink-700/40 ${today ? 'bg-copper-soft/10' : az.aktiv ? '' : 'bg-ink-900/50'}`}
                  style={{ height: gridH, backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_H - 1}px, var(--grid-line) ${HOUR_H - 1}px, var(--grid-line) ${HOUR_H}px)` }}
                  onClick={(e) => createAt(day, e)}>
                  {/* Arbeitszeit-Schattierung: Bereich VOR Arbeitsbeginn / NACH Feierabend leicht dimmen. */}
                  {az.aktiv && azVon != null && azVon > fsMin && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 bg-ink-900/45" style={{ height: ((Math.min(azVon, feMin) - fsMin) / 60) * HOUR_H }} />
                  )}
                  {az.aktiv && azBis != null && azBis < feMin && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink-900/45" style={{ height: ((feMin - Math.max(azBis, fsMin)) / 60) * HOUR_H }} />
                  )}
                  {list.map((a) => {
                    const startMin = minsIntoDay(a.start);
                    const dur = (new Date(a.ende).getTime() - new Date(a.start).getTime()) / 60_000;
                    const endMin = startMin + dur;
                    // Klemmen an das Arbeitszeitfenster: sichtbarer Ausschnitt + Hinweis,
                    // wie viel des Termins frueher/spaeter liegt. NIE unsichtbar.
                    const cutFrueher = Math.max(0, fsMin - startMin);
                    const cutSpaeter = Math.max(0, endMin - feMin);
                    const visStart = Math.min(Math.max(startMin, fsMin), feMin);
                    const visEnd = Math.max(Math.min(endMin, feMin), fsMin);
                    const top = ((visStart - fsMin) / 60) * HOUR_H;
                    const h = Math.max(22, ((visEnd - visStart) / 60) * HOUR_H);
                    // Komplett ausserhalb -> 22px-Pin am Rand.
                    const pinnedTop = endMin <= fsMin;
                    const pinnedBottom = startMin >= feMin;
                    const topFinal = pinnedTop ? 0 : pinnedBottom ? gridH - 22 : top;
                    const pos = lay.get(a.id) ?? { col: 0, cols: 1 };
                    const w = 100 / pos.cols;
                    const st = stilFuer(a);
                    const isDrag = drag?.id === a.id;
                    const tx = isDrag ? (drag!.offDays * colW) : 0;
                    const ty = isDrag ? (drag!.offMin / 60 * HOUR_H) : 0;
                    const rh = isDrag && drag!.mode === 'resize' ? Math.max(22, h + drag!.offMin / 60 * HOUR_H) : (pinnedTop || pinnedBottom ? 22 : h);
                    const emp = a.assignedUserId ? empMap[a.assignedUserId] : undefined;
                    const kunde = a.customerId ? kundenName(custMap[a.customerId]) : '';
                    const veh = a.vehicleId ? vehMap[a.vehicleId] : undefined;
                    const fahrzeug = veh ? `${veh.make} ${veh.model}`.trim() : '';
                    const titel = terminTitel(a, custMap, leistungFuer(a), t('plantafel.ohneTitel'));
                    const tooltip = [
                      `${fmtZeit(a.start, zeitformat)}–${fmtZeit(a.ende, zeitformat)} ${titel}`,
                      kunde,
                      fahrzeug,
                      emp ? `${emp.firstName} ${emp.lastName}` : '',
                    ].filter(Boolean).join('\n');
                    return (
                      <div key={a.id}
                        onPointerDown={(e) => down(e, a, 'move')}
                        onPointerMove={(e) => move(e, a)}
                        onPointerUp={(e) => up(e, a)}
                        title={tooltip}
                        className={`group absolute overflow-hidden rounded-lg ring-1 ${st.chip} cursor-grab touch-none select-none ${isDrag ? 'z-20 cursor-grabbing opacity-90 shadow-pop' : 'z-10'}`}
                        style={{ top: topFinal, height: rh, left: `calc(${pos.col * w}% + 2px)`, width: `calc(${w}% - 4px)`, transform: `translate(${tx}px, ${ty}px)` }}>
                        <span className={`absolute left-0 top-0 h-full w-1 ${st.bar}`} />
                        {emp && (
                          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink-950/40 px-0.5 text-[8px] font-bold leading-none ring-1 ring-ink-950/30">
                            {initialen(emp)}
                          </span>
                        )}
                        <div className={`px-2 py-1 pl-3 ${emp ? 'pr-6' : ''}`}>
                          <div className={`truncate font-semibold leading-tight ${kompakt ? 'text-[10px]' : 'text-[11px]'}`}>{titel}</div>
                          <div className="flex items-center gap-1 truncate text-[10px] opacity-80">
                            <span className="tabular-nums">{fmtZeit(a.start, zeitformat)}–{fmtZeit(a.ende, zeitformat)}</span>
                            {cutFrueher > 0 && (
                              <span className="whitespace-nowrap rounded bg-ink-950/30 px-1 leading-tight">
                                ↑ {t('plantafel.clip.frueher', { dauer: fmtDauerKurz(cutFrueher) })}
                              </span>
                            )}
                            {cutSpaeter > 0 && (
                              <span className="whitespace-nowrap rounded bg-ink-950/30 px-1 leading-tight">
                                ↓ {t('plantafel.clip.spaeter', { dauer: fmtDauerKurz(cutSpaeter) })}
                              </span>
                            )}
                          </div>
                          {/* Kunde + Fahrzeug IMMER auf der Karte (Verwechslungsschutz). */}
                          {(kunde || fahrzeug) && (
                            <div className="truncate text-[10px] opacity-70">
                              {kunde}
                              {kunde && fahrzeug ? ' · ' : ''}
                              {fahrzeug}
                            </div>
                          )}
                        </div>
                        <span onPointerDown={(e) => down(e, a, 'resize')} onPointerMove={(e) => move(e, a)} onPointerUp={(e) => up(e, a)}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100" />
                      </div>
                    );
                  })}
                  {/* Jetzt-Linie (nur innerhalb des sichtbaren Fensters) */}
                  {today && minsIntoDay(now) >= fsMin && minsIntoDay(now) <= feMin && (
                    <div className="pointer-events-none absolute inset-x-0 z-30 flex items-center" style={{ top: ((minsIntoDay(now) - fsMin) / 60) * HOUR_H }}>
                      <span className="h-2 w-2 -ml-1 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger/70" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
