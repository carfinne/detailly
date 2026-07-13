import {
  Arbeitszeiten,
  KalenderConfig,
  WOCHENTAGE,
  Wochentag,
  resolveKalender,
} from './kalender-config';
import { BuchungConfig } from './buchung-config';

/**
 * Freie-Slots-Berechnung fuer das oeffentliche Buchungsportal (Kalender 2.0, W2).
 *
 * PURE Funktionen ohne DB-Zugriff: die belegten Zeitraeume werden hereingereicht,
 * damit die Logik vollstaendig unit-testbar ist. Welle-2-Modell: der Betrieb ist
 * EINE Kapazitaets-Ressource (betriebsweite Belegung, ohne Mitarbeiter-Dimension)
 * – konsistent zum betriebsweiten Kollisionscheck beim Annehmen einer Anfrage.
 * W3 verfeinert auf Mitarbeiter-Kapazitaet.
 *
 * ZEITZONEN-ANNAHME: Alle Rechnungen laufen in SERVER-Lokalzeit (Prod:
 * Europe/Berlin) – dieselbe Konvention wie die Plantafel. Arbeitszeiten
 * ('HH:MM') werden als lokale Uhrzeiten des angefragten Datums interpretiert;
 * die Slot-Antwort enthaelt lokale 'HH:MM'-Strings (PII-frei, keine IDs/Titel).
 */

/** Belegter Zeitraum eines bestehenden Termins (nur Zeiten, bewusst PII-frei). */
export interface BelegtZeitraum {
  start: Date;
  ende: Date;
}

/** JS getDay() (0=So..6=Sa) -> Wochentag-Schluessel der Arbeitszeiten. */
const GETDAY_ZU_WOCHENTAG: Wochentag[] = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];

/**
 * Striktes Datums-Parsing fuer den oeffentlichen Slots-Endpoint: exakt
 * 'YYYY-MM-DD' UND ein real existierender Kalendertag (2026-02-31 -> null).
 * Liefert die Komponenten fuer die lokale Datumskonstruktion oder null.
 */
export function parseDatumStrikt(
  datum: string,
): { jahr: number; monat: number; tag: number } | null {
  if (typeof datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
  const [jahr, monat, tag] = datum.split('-').map((x) => parseInt(x, 10));
  // Roundtrip-Pruefung faengt Nicht-Tage (31.02., Monat 13) ab – Date "korrigiert"
  // solche Werte sonst still in den Folgemonat.
  const d = new Date(jahr, monat - 1, tag);
  if (d.getFullYear() !== jahr || d.getMonth() !== monat - 1 || d.getDate() !== tag) return null;
  return { jahr, monat, tag };
}

/**
 * Portal-Modus (CEO-Entscheidung, W2): AUTOMATISCH aktiv, sobald der Betrieb
 * seine Arbeitszeiten GEPFLEGT hat (settings.kalender.arbeitszeiten existiert)
 * UND mindestens ein Wochentag aktiv ist. Wichtig: NICHT die aufgeloesten
 * Defaults pruefen – resolveKalender liefert immer Mo–Fr aktiv, damit waere der
 * Freitext-Fallback toter Code. "Gepflegt" heisst: der Block wurde mindestens
 * einmal gespeichert (der Arbeitszeiten-Editor in den Einstellungen tut das).
 */
export function istSlotModusAktiv(rawKalender: unknown): boolean {
  const o =
    rawKalender && typeof rawKalender === 'object'
      ? (rawKalender as Record<string, unknown>)
      : {};
  const az = o.arbeitszeiten;
  const gepflegt =
    !!az && typeof az === 'object' && WOCHENTAGE.some((t) => (az as Record<string, unknown>)[t]);
  if (!gepflegt) return false;
  const resolved = resolveKalender(rawKalender);
  return WOCHENTAGE.some((t) => resolved.arbeitszeiten[t].aktiv);
}

/** 'HH:MM' -> Minuten seit Mitternacht (Eingabe ist durch resolveKalender validiert). */
function zuMinuten(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function formatHHMM(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Arbeitszeit-Fenster des Wochentags eines lokalen Datums (oder null wenn inaktiv). */
export function arbeitszeitFuerDatum(
  arbeitszeiten: Arbeitszeiten,
  jahr: number,
  monat: number,
  tag: number,
): { vonMin: number; bisMin: number } | null {
  const wt = GETDAY_ZU_WOCHENTAG[new Date(jahr, monat - 1, tag).getDay()];
  const az = arbeitszeiten[wt];
  if (!az.aktiv) return null;
  const vonMin = zuMinuten(az.von);
  const bisMin = zuMinuten(az.bis);
  // Defensiv: leeres/negatives Fenster (bis <= von) liefert keine Slots.
  if (bisMin <= vonMin) return null;
  return { vonMin, bisMin };
}

/**
 * Berechnet die freien Slots eines Tages als 'HH:MM'-Liste (lokale Zeit):
 *  - Raster: aktive Arbeitszeit des Wochentags in slotDauerMin-Schritten; ein
 *    Slot muss VOLLSTAENDIG ins Fenster passen (letzter Slot endet <= bis).
 *  - Belegung: ein Slot faellt weg, wenn er einen belegten Zeitraum inkl.
 *    beidseitigem pufferMin schneidet (Overlap-Muster: start < ende && ende > start).
 *  - Vorlauf: Slots vor `jetzt + vorlaufMinStunden` und nach
 *    `jetzt + vorlaufMaxTage` fallen weg (deckt auch die Vergangenheit ab).
 */
export function berechneFreieSlots(
  datum: { jahr: number; monat: number; tag: number },
  kalender: KalenderConfig,
  buchung: BuchungConfig,
  belegt: BelegtZeitraum[],
  jetzt: Date,
): string[] {
  const fenster = arbeitszeitFuerDatum(kalender.arbeitszeiten, datum.jahr, datum.monat, datum.tag);
  if (!fenster) return [];

  const slotDauerMs = kalender.slotDauerMin * 60_000;
  const pufferMs = kalender.pufferMin * 60_000;
  const fruehestens = jetzt.getTime() + buchung.vorlaufMinStunden * 3_600_000;
  const spaetestens = jetzt.getTime() + buchung.vorlaufMaxTage * 24 * 3_600_000;
  const tagesanfang = new Date(datum.jahr, datum.monat - 1, datum.tag, 0, 0, 0, 0).getTime();

  const frei: string[] = [];
  for (
    let min = fenster.vonMin;
    min + kalender.slotDauerMin <= fenster.bisMin;
    min += kalender.slotDauerMin
  ) {
    const slotStart = tagesanfang + min * 60_000;
    const slotEnde = slotStart + slotDauerMs;
    if (slotStart < fruehestens || slotStart > spaetestens) continue;
    const kollidiert = belegt.some(
      (b) => b.start.getTime() - pufferMs < slotEnde && b.ende.getTime() + pufferMs > slotStart,
    );
    if (kollidiert) continue;
    frei.push(formatHHMM(min));
  }
  return frei;
}
