// ---------------------------------------------------------------------------
// Plantafel 2.0 – geteilte Helfer (Datum, Layout, Farben, Einstellungen).
// Reine Funktionen/Konstanten ohne React-State: von page.tsx, TimeGrid,
// MonthGrid, YearView und AnfragenPanel gemeinsam genutzt.
// ---------------------------------------------------------------------------
import type { Appointment, Customer, Employee } from '@/lib/types';
import { kundenName } from '@/lib/format';

export type View = 'tag' | 'woche' | 'zweiwochen' | 'monat' | 'jahr';
export type Farbmodus = 'status' | 'mitarbeiter' | 'leistung';

export const HOUR_H = 52; // px pro Stunde im Zeitraster
export const SNAP = 15; // Minuten-Raster beim Ziehen
export const DAY_MS = 86_400_000;

// --- Kalender-Einstellungen (Spiegel der Backend-Defaults, defensiv) --------

export type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
export const WOCHENTAGE: Wochentag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

export interface Arbeitszeit {
  von: string; // 'HH:MM'
  bis: string;
  aktiv: boolean;
}

export interface KalenderEinstellungen {
  kalender: {
    arbeitszeiten: Record<Wochentag, Arbeitszeit>;
    konfliktverhalten: 'warnen' | 'blockieren';
    standortKonflikt: boolean;
    slotDauerMin: number;
    pufferMin: number;
  };
  darstellung: {
    wochenstart: 'montag' | 'sonntag';
    zeitformat: '24h' | '12h';
    kalenderStartStunde: number;
    kalenderEndStunde: number;
  };
}

const WERKTAG: Arbeitszeit = { von: '08:00', bis: '18:00', aktiv: true };
const FREI: Arbeitszeit = { von: '08:00', bis: '18:00', aktiv: false };

/** Fallback, solange (oder falls) der Einstellungs-Endpoint nicht antwortet: 7–19 Uhr. */
export const EINSTELLUNGEN_DEFAULTS: KalenderEinstellungen = {
  kalender: {
    arbeitszeiten: { mo: WERKTAG, di: WERKTAG, mi: WERKTAG, do: WERKTAG, fr: WERKTAG, sa: FREI, so: FREI },
    konfliktverhalten: 'warnen',
    standortKonflikt: false,
    slotDauerMin: 30,
    pufferMin: 0,
  },
  darstellung: { wochenstart: 'montag', zeitformat: '24h', kalenderStartStunde: 7, kalenderEndStunde: 19 },
};

// --- Datums-Helfer -----------------------------------------------------------

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const minsIntoDay = (d: string | Date) => { const x = new Date(d); return x.getHours() * 60 + x.getMinutes(); };

/** Wochenanfang gemaess Betriebs-Einstellung (Montag Default, optional Sonntag). */
export function startOfWeek(d: Date, wochenstart: 'montag' | 'sonntag' = 'montag'): Date {
  const x = startOfDay(d);
  const offset = wochenstart === 'sonntag' ? x.getDay() : (x.getDay() + 6) % 7;
  return addDays(x, -offset);
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

/** JS-getDay() (0=So) -> Wochentag-Kuerzel der Einstellungen. */
export function wochentagVon(d: Date): Wochentag {
  return (['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'] as Wochentag[])[d.getDay()];
}

/** 'HH:MM' -> Minuten seit Mitternacht (defensiv, ungueltig -> null). */
export function hhmmZuMinuten(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(mins) ? mins : null;
}

/** Uhrzeit eines Termins gemaess Zeitformat-Einstellung (nur Kartenzeiten/Gutter). */
export function fmtZeit(d: string | Date, zeitformat: '24h' | '12h' = '24h'): string {
  return new Date(d).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: zeitformat === '12h',
  });
}

/** Beschriftung einer vollen Stunde im Gutter (07:00 bzw. 7 AM). */
export function stundenLabel(h: number, zeitformat: '24h' | '12h' = '24h'): string {
  if (zeitformat === '24h') return `${String(h).padStart(2, '0')}:00`;
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${am ? 'AM' : 'PM'}`;
}

/** Kompakte Dauer fuer die "+n frueher/spaeter"-Hinweise: 45 min / 2 h / 1,5 h. */
export function fmtDauerKurz(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${h.toLocaleString('de-DE')} h`;
}

// --- Farbsystem (nur vorhandene Token-Familien, keine neuen Hex) --------------

export interface TerminStil {
  /** Linke Farbleiste der Terminkarte. */
  bar: string;
  /** Kartenflaeche/Chip (Hintergrund + Text + Ring). */
  chip: string;
  /** Kleiner Farbpunkt (Filter-Chips, Legende). */
  dot: string;
}

const STIL = {
  copper: { bar: 'bg-copper', chip: 'bg-copper-soft text-copper-300 ring-copper/30', dot: 'bg-copper' },
  positive: { bar: 'bg-positive', chip: 'bg-positive-soft text-positive ring-positive/30', dot: 'bg-positive' },
  info: { bar: 'bg-info', chip: 'bg-info-soft text-info ring-info/30', dot: 'bg-info' },
  caution: { bar: 'bg-caution', chip: 'bg-caution-soft text-caution ring-caution/30', dot: 'bg-caution' },
  danger: { bar: 'bg-danger', chip: 'bg-danger-soft text-danger ring-danger/30', dot: 'bg-danger' },
  neutral: { bar: 'bg-chrome-600', chip: 'bg-ink-700/50 text-chrome-400 ring-ink-600', dot: 'bg-chrome-600' },
} satisfies Record<string, TerminStil>;

/** Status -> Stil. `laeuft` (neu, W1-Backend) bewusst eigenstaendig in der Caution-Familie. */
export const STATUS_STYLE: Record<string, TerminStil> = {
  geplant: STIL.copper,
  bestaetigt: STIL.positive,
  laeuft: STIL.caution,
  abgeschlossen: STIL.info,
  abgesagt: STIL.neutral,
};

/**
 * Deterministische Mitarbeiter-Palette: Reihenfolge fest, Zuordnung ueber die
 * Position der Mitarbeiter-ID in der SORTIERTEN ID-Liste (stabil ueber Renders
 * und Sessions, unabhaengig von der API-Reihenfolge).
 */
const MITARBEITER_PALETTE: TerminStil[] = [STIL.copper, STIL.info, STIL.positive, STIL.caution, STIL.danger];

export function mitarbeiterStil(userId: string | null | undefined, sortierteIds: string[]): TerminStil {
  if (!userId) return STIL.neutral;
  const idx = sortierteIds.indexOf(userId);
  if (idx < 0) return STIL.neutral;
  return MITARBEITER_PALETTE[idx % MITARBEITER_PALETTE.length];
}

/** Leistungsart (order.serviceType) -> feste Familie; ohne Auftrag neutral. */
export const LEISTUNG_STIL: Record<string, TerminStil> = {
  aufbereitung: STIL.info,
  folierung: STIL.copper,
  ppf: STIL.positive,
  sonstiges: STIL.caution,
};

export const NEUTRAL_STIL: TerminStil = STIL.neutral;

export const statusStil = (s: string): TerminStil => STATUS_STYLE[s] ?? STATUS_STYLE.geplant;

// --- Anzeige-Helfer ------------------------------------------------------------

/** Initialen eines Mitarbeiters fuer den Karten-Chip ("Max Muster" -> "MM"). */
export function initialen(e: { firstName?: string; lastName?: string } | undefined): string {
  if (!e) return '?';
  return `${(e.firstName ?? '').charAt(0)}${(e.lastName ?? '').charAt(0)}`.toUpperCase() || '?';
}

/**
 * Anzeigetitel eines Termins: `titel` ist seit Kalender 2.0 optional – ohne Titel
 * faellt die Anzeige auf "Kunde – Leistung" (bzw. nur Kunde) zurueck. Der Aufrufer
 * liefert den i18n-Fallback fuer Termine ganz ohne Kontext.
 */
export function terminTitel(
  a: Appointment,
  custMap: Record<string, Customer>,
  leistung: string | undefined,
  fallback: string,
): string {
  const titel = (a.titel ?? '').trim();
  if (titel) return titel;
  const kunde = a.customerId ? kundenName(custMap[a.customerId]) : '';
  if (kunde && leistung) return `${kunde} – ${leistung}`;
  return kunde || leistung || fallback;
}

// --- Lane-Packing (ueberlappende Termine eines Tages in Spalten) ---------------

export function layoutDay(items: Appointment[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime() || new Date(b.ende).getTime() - new Date(a.ende).getTime(),
  );
  const result = new Map<string, { col: number; cols: number }>();
  let cluster: Appointment[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes: number[] = [];
    const colOf = new Map<string, number>();
    for (const a of cluster) {
      const s = new Date(a.start).getTime();
      const e = new Date(a.ende).getTime();
      let placed = -1;
      for (let i = 0; i < lanes.length; i++) if (lanes[i] <= s) { lanes[i] = e; placed = i; break; }
      if (placed < 0) { lanes.push(e); placed = lanes.length - 1; }
      colOf.set(a.id, placed);
    }
    for (const a of cluster) result.set(a.id, { col: colOf.get(a.id)!, cols: lanes.length });
    cluster = [];
    clusterEnd = 0;
  };
  for (const a of sorted) {
    const s = new Date(a.start).getTime();
    if (cluster.length && s >= clusterEnd) flush();
    cluster.push(a);
    clusterEnd = Math.max(clusterEnd, new Date(a.ende).getTime());
  }
  flush();
  return result;
}

// --- Auslastung (Chef-Layer, rein clientseitig) --------------------------------

/**
 * Auslastung eines Tages in Prozent: belegte Minuten (Vereinigungsmenge der
 * nicht-abgesagten Termine, auf das Arbeitszeitfenster geclippt) geteilt durch
 * die Fensterdauer. Ueberlappende Termine zaehlen NICHT doppelt (Intervall-Merge).
 * Inaktiver Tag oder unlesbares Fenster -> null (kein Balken).
 */
export function auslastungProzent(appts: Appointment[], day: Date, az: Arbeitszeit): number | null {
  if (!az.aktiv) return null;
  const von = hhmmZuMinuten(az.von);
  const bis = hhmmZuMinuten(az.bis);
  if (von == null || bis == null || bis <= von) return null;
  const intervalle: [number, number][] = [];
  for (const a of appts) {
    if (a.status === 'abgesagt') continue;
    const s = new Date(a.start);
    const e = new Date(a.ende);
    // Auf den Tag beziehen (Termine koennen theoretisch ueber Mitternacht gehen).
    const tagStart = startOfDay(day).getTime();
    const sMin = Math.max(0, (s.getTime() - tagStart) / 60_000);
    const eMin = Math.min(1440, (e.getTime() - tagStart) / 60_000);
    const von2 = Math.max(sMin, von);
    const bis2 = Math.min(eMin, bis);
    if (bis2 > von2) intervalle.push([von2, bis2]);
  }
  if (intervalle.length === 0) return 0;
  intervalle.sort((a, b) => a[0] - b[0]);
  let belegt = 0;
  let [curS, curE] = intervalle[0];
  for (let i = 1; i < intervalle.length; i++) {
    const [s, e] = intervalle[i];
    if (s <= curE) curE = Math.max(curE, e);
    else { belegt += curE - curS; [curS, curE] = [s, e]; }
  }
  belegt += curE - curS;
  return Math.round((belegt / (bis - von)) * 100);
}

// --- Geburtstage (bestehendes Feature, unveraendert uebernommen) ---------------

/**
 * Geburtstags-Namen fuer einen Tag (jaehrlich wiederkehrend: nur Monat+Tag zaehlt).
 * Das ISO-Datum wird als TEXT geparst ('YYYY-MM-DD'), NICHT via new Date() –
 * so gibt es keine Zeitzonen-Verschiebung um einen Tag.
 */
export function geburtstagsNamen(employees: Employee[], day: Date): string[] {
  const mm = day.getMonth() + 1;
  const dd = day.getDate();
  return employees
    .filter((e) => e.isActive !== false && !!e.geburtstag)
    .filter((e) => {
      const [, m, d] = e.geburtstag!.slice(0, 10).split('-');
      return Number(m) === mm && Number(d) === dd;
    })
    .map((e) => `${e.firstName} ${e.lastName}`.trim());
}
