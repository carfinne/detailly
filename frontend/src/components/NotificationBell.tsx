'use client';

// Glocke in der Topbar: kompakte Hinweise (ueberfaellige Rechnungen, Termine
// heute, knappes Material). Laedt /reminders bei Login + jedem Routenwechsel,
// damit der Zaehler nach dem Bearbeiten sinkt. Dropdown nach dem Profilmenue-
// Muster (Klick ausserhalb / Escape schliessen).
//
// Zusaetzlich (Welle 1: Ziele & Erinnerungen) client-seitige NUDGES – nur fuer
// den Inhaber, additiv zu /reminders und ohne neue Backend-Route:
//  - Steuer-Termine (settings.ziele) mit naechstem Vorkommen ≤ 14 Tage.
//  - §19-Umsatzgrenzen-Warnung (wiederverwendeter §19-Waechter, wenn Schalter an
//    UND Kleinunternehmer aktiv).
//  - „Später erinnern" (Snooze) via localStorage blendet einen Nudge bis Ablauf aus.
// Jeder Steuer-Hinweis traegt IMMER den Haftungshinweis (keine Steuerberatung).
//
// Welle 2: Auslastungs-Nudge (nur wenn settings.ziele.auslastungAktiv) – vergleicht
// die reale Wochen-Auslastung der laufenden Woche (EIN /appointments-Fetch Mo–So,
// gerechnet mit der Plantafel-Formel `wochenAuslastung`/`auslastungProzent`) mit dem
// Zielwert und verlinkt zur Plantafel. Ohne gepflegte Arbeitszeiten stattdessen ein
// dezenter Pflege-Hinweis. Snooze wochenbasiert (`auslastung:<isoWoche>`).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { INHABER_ROLLEN } from '@/lib/rollen';
import type { Appointment } from '@/lib/types';
import {
  type Arbeitszeit,
  type Wochentag,
  WOCHENTAGE,
  addDays,
  startOfWeek,
  wochenAuslastung,
  freieTerminSchaetzung,
  isoWeekId,
} from '@/app/(app)/plantafel/plantafel-lib';

interface ReminderItem {
  key: string;
  anzahl: number;
  label: string;
  href: string;
  severity: 'danger' | 'caution' | 'info';
}
interface Reminders {
  total: number;
  items: ReminderItem[];
}

type Severity = 'danger' | 'caution' | 'info';
const DOT: Record<string, string> = { danger: 'bg-danger', caution: 'bg-caution', info: 'bg-info' };

// --- Ziele-/Erinnerungs-Nudges (client-seitig) -----------------------------
// `id`: stabile, inhaltsunabhaengige Kennung -> Snooze bleibt bestehen, auch wenn
// der Inhaber Art/Datum editiert. Altbestand ohne id faellt auf einen
// inhaltsbasierten Schluessel zurueck (kein Bruch).
interface SteuerTermin { id?: string; art: string; datum: string; wiederkehrend: boolean; aktiv: boolean; }
interface ZieleConfig {
  auslastungAktiv: boolean;
  auslastungZielProzent: number;
  par19WarnungAktiv: boolean;
  steuerTermine: SteuerTermin[];
}
interface KalenderPart {
  arbeitszeiten?: Record<Wochentag, Arbeitszeit>;
  slotDauerMin?: number;
}
interface ProfilPart {
  ziele?: ZieleConfig;
  steuer?: { kleinunternehmer?: boolean };
  // Welle 2: Arbeitszeiten + Slot-Raster kommen im selben /tenants/me-Response mit
  // (kein Extra-Fetch); `darstellung.wochenstart` bestimmt den Mo/So-Wochenanfang.
  kalender?: KalenderPart;
  darstellung?: { wochenstart?: 'montag' | 'sonntag' };
}
/**
 * Ergebnis der Auslastungs-Auswertung (Welle 2): `unter` = unter Ziel (Nudge zur
 * Plantafel), `keineAz` = keine Arbeitszeiten gepflegt (dezenter Pflege-Hinweis),
 * null = kein Hinweis (Ziel erreicht / nicht berechenbar / inaktiv).
 */
type AuslastungResult =
  | { kind: 'unter'; prozent: number; ziel: number; n: number; woche: string }
  | { kind: 'keineAz' }
  | null;
interface KleinStatus {
  istKleinunternehmer: boolean;
  jahr?: number;
  umsatzLaufend?: number;
  grenze?: number;
  warnstufe?: 'ok' | 'nah' | 'kritisch' | 'ueberschritten';
}
interface Nudge { id: string; label: string; disclaimer?: string; severity: Severity; href?: string }
type TFn = (key: string, params?: Record<string, string | number>) => string;

const MS_TAG = 86_400_000;
const SNOOZE_TAGE = 3;
const NUDGE_VORLAUF_TAGE = 14;

function heuteMitternacht(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Naechstes Vorkommen eines Termins als Mitternachts-Date (null = unbrauchbar).
 * Wiederkehrend: Monat/Tag auf das naechste Jahr-Vorkommen rechnen (MM-TT ODER die
 * Monat/Tag-Anteile von YYYY-MM-TT). Einmalig: das exakte YYYY-MM-TT-Datum.
 */
function naechstesVorkommen(datum: string, wiederkehrend: boolean, heute: Date): Date | null {
  const s = (datum || '').trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const short = /^(\d{2})-(\d{2})$/.exec(s);
  if (full && !wiederkehrend) {
    const d = new Date(+full[1], +full[2] - 1, +full[3]);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  let mm: number;
  let tt: number;
  if (short) { mm = +short[1]; tt = +short[2]; }
  else if (full) { mm = +full[2]; tt = +full[3]; }
  else return null;
  if (mm < 1 || mm > 12 || tt < 1 || tt > 31) return null;
  const jahr = heute.getFullYear();
  let d = new Date(jahr, mm - 1, tt);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < heute.getTime()) {
    d = new Date(jahr + 1, mm - 1, tt);
    d.setHours(0, 0, 0, 0);
  }
  return isNaN(d.getTime()) ? null : d;
}

function snoozeKey(id: string): string {
  return `detailly.nudge.snooze.${id}`;
}
function istGesnoozed(id: string): boolean {
  try {
    const raw = localStorage.getItem(snoozeKey(id));
    if (!raw) return false;
    const bis = parseInt(raw, 10);
    return Number.isFinite(bis) && bis > Date.now();
  } catch {
    return false;
  }
}
function snoozeNudge(id: string): void {
  try {
    localStorage.setItem(snoozeKey(id), String(Date.now() + SNOOZE_TAGE * MS_TAG));
  } catch {
    /* Speicher gesperrt -> Snooze entfaellt still */
  }
}
/** Raeumt abgelaufene Snooze-Keys auf (verhindert Verwaisen alter/geaenderter Termine). */
function cleanupSnoozeKeys(): void {
  try {
    const prefix = 'detailly.nudge.snooze.';
    const jetzt = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const bis = parseInt(localStorage.getItem(k) ?? '', 10);
      if (!Number.isFinite(bis) || bis <= jetzt) localStorage.removeItem(k);
    }
  } catch {
    /* Speicher gesperrt -> Aufraeumen entfaellt still */
  }
}

/** Baut die Nudge-Liste aus Ziele-Konfig + §19-Status (reine Anzeige-Logik). */
function computeNudges(ziele: ZieleConfig | null, status: KleinStatus | null, t: TFn): Nudge[] {
  const out: Nudge[] = [];
  const heute = heuteMitternacht();
  for (const tm of ziele?.steuerTermine ?? []) {
    if (!tm || tm.aktiv === false) continue;
    const vor = naechstesVorkommen(tm.datum, tm.wiederkehrend === true, heute);
    if (!vor) continue;
    const diff = Math.round((vor.getTime() - heute.getTime()) / MS_TAG);
    if (diff < 0 || diff > NUDGE_VORLAUF_TAGE) continue;
    const datumStr = vor.toLocaleDateString();
    const art = (tm.art || '').trim() || t('settings.ziele.termine.title');
    const label =
      diff === 0
        ? t('nudge.steuertermin.heute', { art, datum: datumStr })
        : diff === 1
          ? t('nudge.steuertermin.morgen', { art, datum: datumStr })
          : t('nudge.steuertermin.tage', { art, datum: datumStr, tage: diff });
    // Stabile id bevorzugen; Altbestand ohne id -> inhaltsbasierter Fallback.
    const nid = tm.id && tm.id.trim() ? `steuer:${tm.id.trim()}` : `steuer:${art}:${tm.datum}`;
    out.push({
      id: nid,
      label,
      disclaimer: t('nudge.steuer.disclaimer'),
      severity: 'caution',
      href: '/einstellungen/?tab=ziele',
    });
  }
  if (status?.istKleinunternehmer && status.warnstufe && status.warnstufe !== 'ok') {
    const grenze = status.grenze ?? 100000;
    const umsatz = status.umsatzLaufend ?? 0;
    const prozent = Math.round((umsatz / grenze) * 100);
    const severity: Severity = status.warnstufe === 'nah' ? 'caution' : 'danger';
    out.push({
      id: `par19:${status.warnstufe}`,
      label: t(`nudge.par19.${status.warnstufe}`, { prozent }),
      disclaimer: t('nudge.steuer.disclaimer'),
      severity,
      href: '/rechnungen/',
    });
  }
  return out;
}

export function NotificationBell() {
  const { user } = useAuth();
  const t = useT();
  const pathname = usePathname();
  const [data, setData] = useState<Reminders>({ total: 0, items: [] });
  const [nudgeData, setNudgeData] = useState<{
    ziele: ZieleConfig | null;
    status: KleinStatus | null;
    kalender: KalenderPart | null;
    wochenstart: 'montag' | 'sonntag';
  }>({ ziele: null, status: null, kalender: null, wochenstart: 'montag' });
  // Welle 2: Ergebnis der Wochen-Auslastung (eigener /appointments-Fetch, s. u.).
  const [auslastung, setAuslastung] = useState<AuslastungResult>(null);
  // Reines Re-Render nach dem Snoozen (die Sichtbarkeit liest localStorage frisch).
  const [, setSnoozeTick] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Einmalig abgelaufene Snooze-Keys aufraeumen (kein Verwaisen alter Termine).
  useEffect(() => {
    cleanupSnoozeKeys();
  }, []);

  useEffect(() => {
    if (!user) {
      setData({ total: 0, items: [] });
      return;
    }
    let aktiv = true;
    api
      .get<Reminders>('/reminders')
      .then((r) => aktiv && setData(r))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, [user, pathname]);

  // Nudge-Daten nur fuer den Inhaber laden (Ziele-/§19-/Auslastungs-Quellen sind
  // Owner-gated: /tenants/me ist @Roles(OWNER)). Der eine Response liefert bereits
  // ziele + kalender.arbeitszeiten + slotDauerMin + darstellung.wochenstart – kein
  // zweiter Konfig-Fetch fuer den Auslastungs-Nudge noetig.
  useEffect(() => {
    if (!user || !INHABER_ROLLEN.includes(user.role)) {
      setNudgeData({ ziele: null, status: null, kalender: null, wochenstart: 'montag' });
      return;
    }
    let aktiv = true;
    (async () => {
      try {
        const profile = await api.get<ProfilPart>('/tenants/me');
        if (!aktiv) return;
        const ziele = profile.ziele ?? null;
        const klein = profile.steuer?.kleinunternehmer === true;
        let status: KleinStatus | null = null;
        // §19-Waechter nur konsumieren, wenn Schalter an UND Kleinunternehmer aktiv.
        if (ziele?.par19WarnungAktiv && klein) {
          try {
            status = await api.get<KleinStatus>('/invoices/kleinunternehmer-status');
          } catch {
            status = null;
          }
        }
        if (aktiv)
          setNudgeData({
            ziele,
            status,
            kalender: profile.kalender ?? null,
            wochenstart: profile.darstellung?.wochenstart ?? 'montag',
          });
      } catch {
        if (aktiv) setNudgeData({ ziele: null, status: null, kalender: null, wochenstart: 'montag' });
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [user]);

  // Welle 2: Wochen-Auslastung. NUR wenn Inhaber UND auslastungAktiv – sonst gar
  // kein Termin-Fetch (kein 403-Spam, kein Polling). Ohne gepflegte Arbeitszeiten
  // ein dezenter Pflege-Hinweis statt Rechnung. EIN Fetch der laufenden Woche
  // (Mo–So, wie die Plantafel), dann Vergleich mit dem Zielwert.
  useEffect(() => {
    const ziele = nudgeData.ziele;
    const kalender = nudgeData.kalender;
    if (!user || !INHABER_ROLLEN.includes(user.role) || !ziele?.auslastungAktiv) {
      setAuslastung(null);
      return;
    }
    const arbeitszeiten = kalender?.arbeitszeiten;
    const hatAktiveTage = arbeitszeiten
      ? WOCHENTAGE.some((tag) => arbeitszeiten[tag]?.aktiv)
      : false;
    if (!arbeitszeiten || !hatAktiveTage) {
      setAuslastung({ kind: 'keineAz' });
      return;
    }
    let aktiv = true;
    const heute = new Date();
    const wochenStart = startOfWeek(heute, nudgeData.wochenstart);
    const von = wochenStart.toISOString();
    const bis = addDays(wochenStart, 7).toISOString();
    (async () => {
      try {
        const appts = await api.get<Appointment[]>(`/appointments?from=${von}&to=${bis}`);
        if (!aktiv) return;
        const wa = wochenAuslastung(appts, wochenStart, arbeitszeiten);
        const ziel = ziele.auslastungZielProzent;
        if (wa.prozent == null || wa.prozent >= ziel) {
          setAuslastung(null);
          return;
        }
        const n = freieTerminSchaetzung(wa.prozent, ziel, wa.arbeitsMinuten, kalender?.slotDauerMin ?? 60);
        setAuslastung({ kind: 'unter', prozent: wa.prozent, ziel, n, woche: isoWeekId(heute) });
      } catch {
        if (aktiv) setAuslastung(null);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [user, nudgeData.ziele, nudgeData.kalender, nudgeData.wochenstart]);

  // Auslastungs-Nudge (Welle 2) aus dem Rechenergebnis + i18n bauen (reaktiv zur
  // Sprache). Singular sauber getrennt (kein „~1 Termine"). Kein Disclaimer (keine
  // Steuer-/Rechtsaussage), dezente info-Severity, CTA zur Plantafel.
  const auslastungNudge = useMemo<Nudge | null>(() => {
    if (!auslastung) return null;
    if (auslastung.kind === 'keineAz') {
      return {
        id: 'auslastung:keine-arbeitszeiten',
        label: t('nudge.auslastung.keineArbeitszeiten'),
        severity: 'info',
        href: '/einstellungen/?tab=betrieb',
      };
    }
    const { prozent, ziel, n, woche } = auslastung;
    const key = n === 1 ? 'nudge.auslastung.unterEin' : 'nudge.auslastung.unter';
    return {
      id: `auslastung:${woche}`,
      label: t(key, { prozent, ziel, n }),
      severity: 'info',
      href: '/plantafel/',
    };
  }, [auslastung, t]);

  const alleNudges = useMemo(() => {
    const base = computeNudges(nudgeData.ziele, nudgeData.status, t);
    return auslastungNudge ? [...base, auslastungNudge] : base;
  }, [nudgeData, auslastungNudge, t]);
  const sichtbareNudges = alleNudges.filter((n) => !istGesnoozed(n.id));

  function onSnooze(id: string) {
    snoozeNudge(id);
    setSnoozeTick((x) => x + 1);
  }

  const total = data.total + sichtbareNudges.length;
  const leer = data.items.length === 0 && sichtbareNudges.length === 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('ui.notifications.title')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-ink-700/70 bg-ink-850/60 text-chrome-400 transition-colors hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-copper px-1 text-[10px] font-bold text-ink-950">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-pop animate-fade-in">
          <div className="border-b border-ink-700/70 px-4 py-2.5 text-sm font-semibold text-chrome-50">{t('ui.notifications.title')}</div>
          {leer ? (
            <p className="px-4 py-6 text-center text-sm text-chrome-500">{t('ui.notifications.empty')}</p>
          ) : (
            <div className="p-1.5">
              {data.items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-chrome-200 transition-colors hover:bg-ink-750"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[it.severity] ?? 'bg-chrome-500'}`} />
                  <span className="flex-1">{it.label}</span>
                  <span aria-hidden className="text-chrome-500">→</span>
                </Link>
              ))}
              {sichtbareNudges.map((n) => (
                <div key={n.id} className="rounded-lg px-3 py-2 transition-colors hover:bg-ink-750">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[n.severity] ?? 'bg-chrome-500'}`} />
                    {n.href ? (
                      <Link
                        href={n.href}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="flex-1 text-sm text-chrome-200 transition-colors hover:text-chrome-50"
                      >
                        {n.label}
                      </Link>
                    ) : (
                      <span className="flex-1 text-sm text-chrome-200">{n.label}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onSnooze(n.id)}
                      title={t('nudge.snooze.title')}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-chrome-500 transition-colors hover:text-copper"
                    >
                      {t('nudge.snooze')}
                    </button>
                  </div>
                  {n.disclaimer && (
                    <p className="mt-1 pl-[18px] text-[11px] leading-snug text-chrome-500">{n.disclaimer}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
