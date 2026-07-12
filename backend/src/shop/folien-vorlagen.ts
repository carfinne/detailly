/**
 * Kuratierter Vorlagen-Katalog fuer die Folien-Bibliothek (Folierer-Welle 2).
 *
 * Reine Struktur-Konstante, BEWUSST OHNE PREISE: EK-/VK-Preise pflegt jeder
 * Betrieb selbst (Einkaufskonditionen unterscheiden sich pro Haendler). Die
 * Standard-Rollenbreiten (152 cm bei Wrap-Cast-Folien, 61/91/152 cm bei PPF)
 * sind branchenueblich. Kein Anspruch auf Vollstaendigkeit — die Liste deckt die
 * gaengigsten Serien ab und dient als Startpunkt; Betriebe legen weitere Folien
 * regulaer als Produkt (kategorie 'folie') an.
 *
 * Marken-/Serienbezeichnungen sind Herstellerbegriffe und werden nicht uebersetzt.
 */

export interface FolienVorlage {
  hersteller: string;
  serie: string;
  /** Verfuegbare Finishes der Serie; der Import legt je Finish ein Produkt an. */
  finishes: string[];
  /** Standard-Rollenbreite in cm. */
  breiteCm: number;
  /** Verkaufs-/Verbrauchseinheit: laufende Meter. */
  einheit: 'lfm';
  kategorie: 'folie';
}

const WRAP_FINISHES = ['Gloss', 'Matt', 'Satin', 'Metallic', 'Struktur'];

export const FOLIEN_VORLAGEN: readonly FolienVorlage[] = [
  // --- Cast-Wrapping-Folien (Vollverklebung), Standard-Rollenbreite 152 cm ---
  { hersteller: '3M', serie: 'Wrap Film 2080', finishes: WRAP_FINISHES, breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: '3M', serie: 'Wrap Film 1080', finishes: WRAP_FINISHES, breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'Avery Dennison', serie: 'Supreme Wrapping Film', finishes: WRAP_FINISHES, breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'KPMF', serie: 'K75000er', finishes: WRAP_FINISHES, breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'Oracal', serie: '970RA', finishes: ['Gloss', 'Matt', 'Metallic', 'Struktur'], breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'Oracal', serie: '975', finishes: ['Struktur'], breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'Hexis', serie: 'Skintac HX20000', finishes: WRAP_FINISHES, breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },

  // --- Lackschutzfolien (PPF), gaengige Rollenbreiten 61 / 91 / 152 cm ---
  { hersteller: 'XPEL', serie: 'Ultimate Plus', finishes: ['Gloss'], breiteCm: 61, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'XPEL', serie: 'Ultimate Plus', finishes: ['Gloss'], breiteCm: 91, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'XPEL', serie: 'Ultimate Plus', finishes: ['Gloss'], breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'XPEL', serie: 'Stealth', finishes: ['Matt'], breiteCm: 61, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'XPEL', serie: 'Stealth', finishes: ['Matt'], breiteCm: 91, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: 'XPEL', serie: 'Stealth', finishes: ['Matt'], breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: '3M', serie: 'Scotchgard Pro Series PPF', finishes: ['Gloss'], breiteCm: 61, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: '3M', serie: 'Scotchgard Pro Series PPF', finishes: ['Gloss'], breiteCm: 91, einheit: 'lfm', kategorie: 'folie' },
  { hersteller: '3M', serie: 'Scotchgard Pro Series PPF', finishes: ['Gloss'], breiteCm: 152, einheit: 'lfm', kategorie: 'folie' },
];
