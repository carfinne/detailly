/**
 * Normprofile + Auffaelligkeits-Logik fuer das Schichtdicken-Messprotokoll
 * (Lackschichtdicke). REINE Funktionen, keine DB/Nest-Abhaengigkeit – dieselbe
 * Ableitung nutzen Service, PDF-Bericht UND die Tests. Das Frontend spiegelt
 * diese Logik 1:1 in `frontend/src/lib/layer-norm-profiles.ts` (bewusst dupliziert,
 * beide klein + rein; Grenzwerte muessen deckungsgleich bleiben).
 *
 * WICHTIG (Haftung): Die µm-Bereiche sind HERSTELLERABHAENGIGE RICHTWERTE, kein
 * Gutachten. Sie geben nur einen Hinweis (Ampel) auf moegliche Vorlackierung/
 * Spachtel. Der Bericht traegt einen prominenten Haftungshinweis; per-Betrieb
 * konfigurierbare Schwellen kommen in Welle 2.
 */

/** Ampel-/Bewertungsstatus eines Wertes bzw. eines ganzen Bauteils. */
export type AmpelStatus =
  | 'unbemessen' // kein Messwert vorhanden -> neutral/grau
  | 'duenn' // < Serienbereich (Info: ggf. durchpoliert/angeschliffen)
  | 'normal' // typischer Serienlack (gruen)
  | 'erhoeht' // ueber Serie (gelb: beobachten)
  | 'verdacht' // deutlich ueber Serie (rot: Nachlack-/Spachtel-Verdacht)
  | 'nicht_metall'; // Kunststoff-Bauteil -> magn.-induktiv unzuverlaessig (Info)

/**
 * Ein Normprofil beschreibt die eskalierenden µm-Baender ueber die exklusiven
 * Obergrenzen `bisUm`. Ein Wert faellt in das ERSTE Band, dessen `bisUm` er
 * unterschreitet; das letzte Band ist offen (`bisUm: Infinity`).
 *
 * Grenzwert-Konvention (bewusst konservativ, weniger Fehlalarme): die runden
 * Grenzwerte 80/150/250 gehoeren zum jeweils NIEDRIGEREN Band, die Eskalation
 * geschieht STRIKT darueber. Beispiel serienlack_stahl:
 *   79 -> duenn · 80..150 -> normal · 151..250 -> erhoeht · >250 -> verdacht.
 */
export interface NormBand {
  status: Exclude<AmpelStatus, 'unbemessen' | 'nicht_metall'>;
  bisUm: number;
}
export interface NormProfil {
  key: string;
  label: string;
  baender: NormBand[];
}

/** Default-Profilschluessel (Serienlack auf Stahlblech). */
export const DEFAULT_NORM_PROFILE_KEY = 'serienlack_stahl';

/**
 * Katalog der Normprofile. Welle 1 fuehrt nur den Stahl-Serienlack; die
 * Registry-Form erlaubt spaeter Alu/andere Profile ohne Aufrufer-Aenderung.
 */
export const NORM_PROFILE: Record<string, NormProfil> = {
  serienlack_stahl: {
    key: 'serienlack_stahl',
    label: 'Serienlack (Stahl)',
    baender: [
      { status: 'duenn', bisUm: 80 }, // < 80
      { status: 'normal', bisUm: 151 }, // 80..150
      { status: 'erhoeht', bisUm: 251 }, // 151..250
      { status: 'verdacht', bisUm: Infinity }, // > 250
    ],
  },
};

/**
 * Kunststoff-/nicht-metallische Bauteile (kanonische partIds). Magnetisch-
 * induktive Schichtdickenmessgeraete messen dort unzuverlaessig -> Ergebnis rein
 * informativ, NIE als Verdacht (rot) markieren.
 */
export const NICHT_METALL_PARTS: ReadonlySet<string> = new Set([
  'stossfaenger_vorne',
  'stossfaenger_hinten',
  'aussenspiegel_l',
  'aussenspiegel_r',
]);

/** Loest einen (evtl. unbekannten) Profilschluessel auf; Fallback = Default. */
export function resolveNormProfil(key?: string | null): NormProfil {
  return (key && NORM_PROFILE[key]) || NORM_PROFILE[DEFAULT_NORM_PROFILE_KEY];
}

/** Ein einzelner µm-Messwert an einem Punkt (mit optionalem Zeitstempel). */
export interface SchichtMessung {
  wertUm: number;
  erfasstAm?: string;
}
/** Ein Messpunkt an einem Bauteil mit seinen Einzelmessungen. */
export interface SchichtPunkt {
  partId: string;
  readings: SchichtMessung[];
}

/** Gueltige (endliche, >= 0) µm-Werte eines Punktes. */
function gueltigeWerte(readings: SchichtMessung[] | undefined): number[] {
  return (readings ?? [])
    .map((r) => r?.wertUm)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

/** Arithmetisches Mittel der Messungen eines Punktes; null bei keinen Werten. */
export function punktMittelUm(readings: SchichtMessung[] | undefined): number | null {
  const werte = gueltigeWerte(readings);
  if (werte.length === 0) return null;
  return werte.reduce((s, n) => s + n, 0) / werte.length;
}

/** Statistik-Aggregat je Bauteil ueber ALLE Messungen seiner Punkte. */
export interface BauteilStatistik {
  count: number; // Anzahl Einzelmessungen
  punkte: number; // Anzahl Punkte mit >= 1 Messung
  minUm: number;
  maxUm: number;
  meanUm: number;
  /** Repraesentativwert fuer die Ampel = Maximum der Punkt-Mittel. */
  repraesentativUm: number;
}

/**
 * Aggregiert die Punkte eines Bauteils. `null`, wenn keinerlei Messwerte
 * vorliegen (dann Status `unbemessen`). Repraesentativwert = Max der Punkt-Mittel
 * (glaettet Messrauschen innerhalb eines Punktes, faengt aber einen dauerhaft
 * hohen Einzelpunkt = lokaler Spachtel).
 */
export function bauteilStatistik(punkte: SchichtPunkt[]): BauteilStatistik | null {
  const alleWerte: number[] = [];
  const punktMittel: number[] = [];
  let punkteMitWert = 0;
  for (const p of punkte) {
    const werte = gueltigeWerte(p.readings);
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

/** Reine Band-Zuordnung eines µm-Wertes gegen ein Profil (ohne Bauteil-Kontext). */
export function bewerteWert(wertUm: number, profileKey?: string | null): AmpelStatus {
  const profil = resolveNormProfil(profileKey);
  for (const band of profil.baender) {
    if (wertUm < band.bisUm) return band.status;
  }
  // Unerreichbar (letztes Band = Infinity), defensiv:
  return profil.baender[profil.baender.length - 1].status;
}

/**
 * Bewertet ein ganzes Bauteil: beruecksichtigt Kunststoff (nicht_metall),
 * fehlende Messwerte (unbemessen) und sonst den Repraesentativwert gegen das
 * Profil. `partId` sollte bereits kanonisch sein.
 */
export function bewerteBauteil(
  partId: string,
  repraesentativUm: number | null | undefined,
  profileKey?: string | null,
): AmpelStatus {
  if (NICHT_METALL_PARTS.has(partId)) return 'nicht_metall';
  if (repraesentativUm === null || repraesentativUm === undefined) return 'unbemessen';
  return bewerteWert(repraesentativUm, profileKey);
}

/** Nur `verdacht` gilt in Welle 1 als auffaellig (rot). */
export function istAuffaellig(status: AmpelStatus): boolean {
  return status === 'verdacht';
}
