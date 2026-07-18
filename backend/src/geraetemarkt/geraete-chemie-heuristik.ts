/**
 * Weiche Stichwort-Heuristik gegen den (auf dem Geraetemarkt unerwuenschten)
 * Weiterverkauf von Chemie/Verbrauchsstoffen. BEWUSST KEIN Hard-Block: Titel +
 * Beschreibung eines neu angelegten Inserats werden nur gegen eine Stichwortliste
 * geprueft; bei Treffer wird das Inserat zur Betreiber-Pruefung vorgemerkt (eine
 * offene System-Meldung), NICHT abgelehnt. False-Positive-tolerant – die
 * Entscheidung trifft immer ein Mensch (Betreiber-Moderation).
 *
 * Reine, seiteneffektfreie Funktion -> unabhaengig unit-testbar.
 */

/**
 * Chemie-/Verbrauchsstoff-Stichworte (lowercase Substrings). Bewusst KURATIERT,
 * um Kollisionen mit legitimen GERAETE-Namen zu vermeiden (z. B. „Dampfreiniger"
 * enthaelt KEIN Stichwort aus dieser Liste; „Poliermaschine" nicht „politur").
 */
export const CHEMIE_STICHWORTE: readonly string[] = [
  'versiegelung',
  'versiegeler',
  'keramikversiegel',
  'nanoversiegel',
  'politur',
  'wachs',
  'shampoo',
  'entfetter',
  'isopropanol',
  'lösemittel',
  'loesemittel',
  'sealant',
  'coating',
  'detailer',
  'knetmasse',
  'reinigungsknete',
  'felgenreiniger',
  'lackreiniger',
  'insektenentferner',
  'teerentferner',
  'allesreiniger',
  'chemie',
  'chemikal',
  'gebinde',
  'kanister',
  'liter',
];

/**
 * Volumenangabe wie „500ml", „5 l", „1 liter", „2 ltr" – ein typisches Signal
 * fuer Gebinde/Fluessig-Chemie (Geraete werden nicht in Litern angeboten).
 */
const VOLUMEN_RE = /\d+\s?(ml|milliliter|liter|ltr|l)\b/i;

/**
 * Liefert die gefundenen Chemie-Signale (Stichworte + ggf. „volumenangabe").
 * Leeres Array = kein Verdacht.
 */
export function findeChemieTreffer(titel: string, beschreibung: string): string[] {
  const text = `${titel ?? ''} ${beschreibung ?? ''}`.toLowerCase();
  const treffer = CHEMIE_STICHWORTE.filter((kw) => text.includes(kw));
  if (VOLUMEN_RE.test(text)) treffer.push('volumenangabe');
  return treffer;
}
