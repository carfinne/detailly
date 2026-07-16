// Normprofile + Ampel-Logik fuer das Schichtdicken-Messprotokoll (Client).
// Spiegelt bewusst 1:1 die reine Backend-Logik
// (backend/src/schichtdicke/layer-norm-profiles.ts) – beide klein + rein; die
// Grenzwerte MUESSEN deckungsgleich bleiben. Die maszgeblichen Tests liegen im
// Backend. Zusaetzlich hier: UI-Farb-Token + i18n-Label-Keys je Status.
//
// WICHTIG (Haftung): die µm-Bereiche sind herstellerabhaengige RICHTWERTE, kein
// Gutachten – nur ein Hinweis (Ampel) auf moegliche Vorlackierung/Spachtel.

import { canonicalPartId } from './vehicle-parts';

export type AmpelStatus =
  | 'unbemessen'
  | 'duenn'
  | 'normal'
  | 'erhoeht'
  | 'verdacht'
  | 'nicht_metall';

export interface NormBand {
  status: Exclude<AmpelStatus, 'unbemessen' | 'nicht_metall'>;
  bisUm: number;
}
export interface NormProfil {
  key: string;
  labelKey: string;
  baender: NormBand[];
}

export const DEFAULT_NORM_PROFILE_KEY = 'serienlack_stahl';

// Grenzwert-Konvention (konservativ): 80/150/250 gehoeren zum niedrigeren Band,
// Eskalation strikt darueber (79 duenn · 80..150 normal · 151..250 erhoeht · >250 verdacht).
export const NORM_PROFILE: Record<string, NormProfil> = {
  serienlack_stahl: {
    key: 'serienlack_stahl',
    labelKey: 'schicht.profil.serienlack_stahl',
    baender: [
      { status: 'duenn', bisUm: 80 },
      { status: 'normal', bisUm: 151 },
      { status: 'erhoeht', bisUm: 251 },
      { status: 'verdacht', bisUm: Infinity },
    ],
  },
};

/** Kunststoff-/nicht-metallische Bauteile (kanonische partIds). */
export const NICHT_METALL_PARTS: ReadonlySet<string> = new Set([
  'stossfaenger_vorne',
  'stossfaenger_hinten',
  'aussenspiegel_l',
  'aussenspiegel_r',
]);

export function resolveNormProfil(key?: string | null): NormProfil {
  return (key && NORM_PROFILE[key]) || NORM_PROFILE[DEFAULT_NORM_PROFILE_KEY];
}

export interface SchichtMessung {
  wertUm: number;
  erfasstAm?: string;
}

function gueltigeWerte(readings: SchichtMessung[] | undefined): number[] {
  return (readings ?? [])
    .map((r) => r?.wertUm)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

export function punktMittelUm(readings: SchichtMessung[] | undefined): number | null {
  const werte = gueltigeWerte(readings);
  if (werte.length === 0) return null;
  return werte.reduce((s, n) => s + n, 0) / werte.length;
}

export interface BauteilStatistik {
  count: number;
  punkte: number;
  minUm: number;
  maxUm: number;
  meanUm: number;
  repraesentativUm: number;
}

/** Aggregiert die readings mehrerer Punkte eines Bauteils. */
export function bauteilStatistik(punkteReadings: (SchichtMessung[] | undefined)[]): BauteilStatistik | null {
  const alleWerte: number[] = [];
  const punktMittel: number[] = [];
  let punkteMitWert = 0;
  for (const readings of punkteReadings) {
    const werte = gueltigeWerte(readings);
    if (werte.length === 0) continue;
    punkteMitWert += 1;
    alleWerte.push(...werte);
    punktMittel.push(werte.reduce((s, n) => s + n, 0) / werte.length);
  }
  if (alleWerte.length === 0) return null;
  return {
    count: alleWerte.length,
    punkte: punkteMitWert,
    minUm: Math.min(...alleWerte),
    maxUm: Math.max(...alleWerte),
    meanUm: alleWerte.reduce((s, n) => s + n, 0) / alleWerte.length,
    repraesentativUm: Math.max(...punktMittel),
  };
}

export function bewerteWert(wertUm: number, profileKey?: string | null): AmpelStatus {
  const profil = resolveNormProfil(profileKey);
  for (const band of profil.baender) {
    if (wertUm < band.bisUm) return band.status;
  }
  return profil.baender[profil.baender.length - 1].status;
}

export function bewerteBauteil(
  partId: string,
  repraesentativUm: number | null | undefined,
  profileKey?: string | null,
): AmpelStatus {
  if (NICHT_METALL_PARTS.has(canonicalPartId(partId))) return 'nicht_metall';
  if (repraesentativUm === null || repraesentativUm === undefined) return 'unbemessen';
  return bewerteWert(repraesentativUm, profileKey);
}

export function istAuffaellig(status: AmpelStatus): boolean {
  return status === 'verdacht';
}

/** CSS-Farb-Token (rgb-Triple-Variable) je Status – folgt dem Branchen-Theme. */
export const AMPEL_TOKEN: Record<AmpelStatus, string> = {
  unbemessen: '--ink-600',
  duenn: '--info',
  normal: '--positive',
  erhoeht: '--caution',
  verdacht: '--danger',
  nicht_metall: '--ink-500',
};

/** i18n-Label-Key je Status. */
export const AMPEL_LABEL_KEY: Record<AmpelStatus, string> = {
  unbemessen: 'schicht.status.unbemessen',
  duenn: 'schicht.status.duenn',
  normal: 'schicht.status.normal',
  erhoeht: 'schicht.status.erhoeht',
  verdacht: 'schicht.status.verdacht',
  nicht_metall: 'schicht.status.nicht_metall',
};

/** Anzeige-Reihenfolge der Legende. */
export const AMPEL_LEGENDE: AmpelStatus[] = [
  'normal',
  'duenn',
  'erhoeht',
  'verdacht',
  'nicht_metall',
  'unbemessen',
];
