/**
 * Zeitzonen-Helfer fuer das Kassenbuch – FEST Europe/Berlin (Projekt-Konvention,
 * vgl. mailer/kunden-mail.ts). Ein Prod-Server laeuft typischerweise auf UTC;
 * mit getDate()/getHours() (Serverzeit) fielen Buchungen um Mitternacht in den
 * FALSCHEN Tag/Monat und das GoBD-Belegdatum waere um 1–2 h verschoben. Deshalb
 * werden Tages-/Monatsgrenzen UND das Anzeige-Datum immer in Berliner Wanduhrzeit
 * gebildet – DST-sicher via Intl.DateTimeFormat.
 */

export const BERLIN_TZ = 'Europe/Berlin';

const BERLIN_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: BERLIN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const BERLIN_DATUM = new Intl.DateTimeFormat('de-DE', {
  timeZone: BERLIN_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const BERLIN_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: BERLIN_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface BerlinYMD {
  y: number;
  m: number;
  day: number;
}

/** UTC-Offset (ms) der Zone Europe/Berlin zum Instant `d` (DST-sicher). */
function berlinOffsetMs(d: Date): number {
  const p: Record<string, string> = {};
  for (const part of BERLIN_PARTS.formatToParts(d)) p[part.type] = part.value;
  // Berliner Wanduhr als-ob-UTC minus echter Instant = Offset zur UTC. Der
  // Intl-Formatter liefert nur ganze Sekunden -> die Sub-Sekunden von `d` gingen
  // sonst verloren. Da TZ-Offsets immer ganze Minuten sind, auf die naechste
  // Minute runden (entfernt den Millisekunden-Drift, DST bleibt korrekt).
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - d.getTime()) / 60000) * 60000;
}

/**
 * UTC-Instant fuer eine Berliner Wanduhrzeit (y-m-d h:mm:ss.mmm). Zwei-Schritt-
 * Verfeinerung, damit auch DST-Kanten (Uhrumstellung) korrekt aufgeloest werden.
 */
export function berlinWallToUtc(
  y: number,
  m: number,
  day: number,
  h = 0,
  min = 0,
  s = 0,
  ms = 0,
): Date {
  const naive = Date.UTC(y, m - 1, day, h, min, s, ms);
  let guess = new Date(naive - berlinOffsetMs(new Date(naive)));
  guess = new Date(naive - berlinOffsetMs(guess));
  return guess;
}

/** Kalender-Y/M/D (Berlin) des Instants `d`. */
export function berlinYMDvonInstant(d: Date): BerlinYMD {
  const p: Record<string, string> = {};
  for (const part of BERLIN_YMD.formatToParts(d)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, day: +p.day };
}

/** Parst 'YYYY-MM-DD' zu Y/M/D; null bei ungueltigem Format/Datum. */
export function berlinYMDvonString(s: string): BerlinYMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? '').trim());
  if (!match) return null;
  const y = +match[1];
  const m = +match[2];
  const day = +match[3];
  if (m < 1 || m > 12 || day < 1 || day > 31) return null;
  return { y, m, day };
}

/** Berliner Tagesgrenzen [00:00:00.000, 23:59:59.999] als UTC-Instants. */
export function berlinTagesGrenzen(ymd: BerlinYMD): { von: Date; bis: Date } {
  return {
    von: berlinWallToUtc(ymd.y, ymd.m, ymd.day, 0, 0, 0, 0),
    bis: berlinWallToUtc(ymd.y, ymd.m, ymd.day, 23, 59, 59, 999),
  };
}

/** Berliner Monatsgrenzen [1. 00:00:00.000, letzter Tag 23:59:59.999] als UTC. */
export function berlinMonatsGrenzen(ymd: BerlinYMD): { von: Date; bis: Date } {
  const von = berlinWallToUtc(ymd.y, ymd.m, 1, 0, 0, 0, 0);
  const naechsterMonat = ymd.m === 12 ? { y: ymd.y + 1, m: 1 } : { y: ymd.y, m: ymd.m + 1 };
  const bis = new Date(berlinWallToUtc(naechsterMonat.y, naechsterMonat.m, 1, 0, 0, 0, 0).getTime() - 1);
  return { von, bis };
}

/** Anzeige-Datum 'DD.MM.YYYY' in Berliner Wanduhrzeit. */
export function berlinDatumDe(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return BERLIN_DATUM.format(date);
}
