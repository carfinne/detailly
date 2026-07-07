import { BadRequestException } from '@nestjs/common';

/**
 * Mahnwesen-Konfiguration je Betrieb (C1-C). Wird im verschluesselten JSON
 * `tenant.settings` unter dem Schluessel `mahnwesen` abgelegt und ueber den
 * bestehenden Settings-GET/PATCH gelesen/geschrieben.
 *
 * Stufen-Semantik (identisch zu Invoice.mahnstufe):
 *   0 = keine, 1 = Erinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung.
 * Die Fristen sind Tage NACH Faelligkeit, ab denen die jeweilige Stufe faellig wird.
 */
export interface MahnwesenFristen {
  /** Tage nach Faelligkeit fuer die Zahlungserinnerung (Stufe 1). */
  erinnerung: number;
  /** Tage nach Faelligkeit fuer die 1. Mahnung (Stufe 2). */
  mahnung1: number;
  /** Tage nach Faelligkeit fuer die 2. Mahnung (Stufe 3). */
  mahnung2: number;
}

export interface MahnwesenGebuehr {
  /** Mahngebuehr (EUR) fuer die 1. Mahnung. */
  mahnung1: number;
  /** Mahngebuehr (EUR) fuer die 2. Mahnung. */
  mahnung2: number;
}

export interface MahnwesenConfig {
  /** Automatisches Mahnen an/aus (Default AUS). */
  autoMahnen: boolean;
  fristen: MahnwesenFristen;
  gebuehr: MahnwesenGebuehr;
}

/** Betreiber-Defaults (verbindlich): Erinnerung T+7, 1. Mahnung T+14, 2. Mahnung T+28. */
export const MAHNWESEN_DEFAULTS: MahnwesenConfig = {
  autoMahnen: false,
  fristen: { erinnerung: 7, mahnung1: 14, mahnung2: 28 },
  gebuehr: { mahnung1: 0, mahnung2: 0 },
};

/** Plausible Ober-/Untergrenzen (auch in der DTO-Validierung gespiegelt). */
export const FRIST_MIN = 1;
export const FRIST_MAX = 365;
export const GEBUEHR_MIN = 0;
export const GEBUEHR_MAX = 999;

function toFrist(v: unknown, def: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.min(FRIST_MAX, Math.max(FRIST_MIN, i));
}

function toGebuehr(v: unknown, def: number): number {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  if (!Number.isFinite(n)) return def;
  const g = Math.round(n * 100) / 100; // auf Cent normalisieren
  return Math.min(GEBUEHR_MAX, Math.max(GEBUEHR_MIN, g));
}

/**
 * Liest die Mahnwesen-Konfiguration DEFENSIV aus dem Rohwert (tenant.settings.mahnwesen).
 * Fehlende/ungueltige Keys fallen auf die Defaults zurueck; wirft NIE (Lese-Pfad,
 * auch fuer Altbestand/verunreinigte Daten robust). `autoMahnen` gilt nur bei
 * exakt `true` als aktiv (fail-safe: alles andere => AUS).
 */
export function resolveMahnwesenConfig(raw: unknown): MahnwesenConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const f = o.fristen && typeof o.fristen === 'object' ? (o.fristen as Record<string, unknown>) : {};
  const g = o.gebuehr && typeof o.gebuehr === 'object' ? (o.gebuehr as Record<string, unknown>) : {};
  const D = MAHNWESEN_DEFAULTS;
  return {
    autoMahnen: o.autoMahnen === true,
    fristen: {
      erinnerung: toFrist(f.erinnerung, D.fristen.erinnerung),
      mahnung1: toFrist(f.mahnung1, D.fristen.mahnung1),
      mahnung2: toFrist(f.mahnung2, D.fristen.mahnung2),
    },
    gebuehr: {
      mahnung1: toGebuehr(g.mahnung1, D.gebuehr.mahnung1),
      mahnung2: toGebuehr(g.mahnung2, D.gebuehr.mahnung2),
    },
  };
}

/** Form des eingehenden PATCH-Teilobjekts (alle Felder optional). */
export interface MahnwesenPatch {
  autoMahnen?: boolean;
  fristen?: Partial<MahnwesenFristen>;
  gebuehr?: Partial<MahnwesenGebuehr>;
}

/**
 * Legt ein PATCH-Teilobjekt ueber eine bestehende (aufgeloeste) Konfiguration.
 * Nicht angegebene Felder bleiben unveraendert -> echtes Teil-Update.
 */
export function mergeMahnwesen(base: MahnwesenConfig, patch: MahnwesenPatch): MahnwesenConfig {
  const num = (v: unknown, def: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : def;
  return {
    autoMahnen: typeof patch.autoMahnen === 'boolean' ? patch.autoMahnen : base.autoMahnen,
    fristen: {
      erinnerung: num(patch.fristen?.erinnerung, base.fristen.erinnerung),
      mahnung1: num(patch.fristen?.mahnung1, base.fristen.mahnung1),
      mahnung2: num(patch.fristen?.mahnung2, base.fristen.mahnung2),
    },
    gebuehr: {
      mahnung1: num(patch.gebuehr?.mahnung1, base.gebuehr.mahnung1),
      mahnung2: num(patch.gebuehr?.mahnung2, base.gebuehr.mahnung2),
    },
  };
}

/**
 * Validiert eine Mahnwesen-Konfiguration fuer den SCHREIB-Pfad (PATCH): Fristen
 * ganzzahlig >= 1 und STRENG aufsteigend (Erinnerung < 1. Mahnung < 2. Mahnung),
 * Gebuehren nicht negativ. Wirft BadRequestException mit klarer Meldung.
 */
export function assertMahnwesenValid(cfg: MahnwesenConfig): void {
  const { erinnerung, mahnung1, mahnung2 } = cfg.fristen;
  const fristen = [erinnerung, mahnung1, mahnung2];
  if (!fristen.every((n) => Number.isInteger(n) && n >= FRIST_MIN && n <= FRIST_MAX)) {
    throw new BadRequestException(
      `Mahnfristen muessen ganze Zahlen zwischen ${FRIST_MIN} und ${FRIST_MAX} Tagen sein.`,
    );
  }
  if (!(erinnerung < mahnung1 && mahnung1 < mahnung2)) {
    throw new BadRequestException(
      'Mahnfristen muessen aufsteigend sein (Erinnerung < 1. Mahnung < 2. Mahnung).',
    );
  }
  if (cfg.gebuehr.mahnung1 < GEBUEHR_MIN || cfg.gebuehr.mahnung2 < GEBUEHR_MIN) {
    throw new BadRequestException('Mahngebuehren duerfen nicht negativ sein.');
  }
}

/**
 * Bestimmt die anhand der Ueberfaelligkeit FAELLIGE Mahnstufe (0..3) fuer die
 * gegebenen Fristen. Reine Funktion – Kern der Auto-Eskalation.
 */
export function faelligeStufe(tageUeberfaellig: number, fristen: MahnwesenFristen): number {
  if (tageUeberfaellig >= fristen.mahnung2) return 3;
  if (tageUeberfaellig >= fristen.mahnung1) return 2;
  if (tageUeberfaellig >= fristen.erinnerung) return 1;
  return 0;
}
