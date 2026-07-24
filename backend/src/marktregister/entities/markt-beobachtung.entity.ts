import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * MARKTRECHERCHE-REGISTER (Plattform-intern, NICHT mandantenscoped).
 *
 * NEUTRALITAET ist der Kern dieses Registers: Erfasst werden ausschliesslich
 * OEFFENTLICH beobachtbare, SACHLICHE Fakten ueber Wettbewerber (Name, ein
 * beobachtetes Feature/Preis/Merkmal, Quelle-URL, Beobachtungsdatum) sowie die
 * daraus vom Betreiber SELBST abgeleitete eigene „besser machen"-Idee fuer
 * Detailly. Es gibt bewusst KEIN Feld zur Bewertung/Herabsetzung eines
 * Wettbewerbers, keine gescrapten Fremdinhalte und keine Kundendaten. Der
 * Freitext bleibt Freitext – der Betreiber traegt selbst ein, es wird nichts
 * automatisch generiert.
 *
 * Mandantentrennung: Diese Tabelle traegt BEWUSST KEIN `tenantId`. Das Register
 * ist plattformweit (eine einzige interne Sicht des Detailly-Betreibers). Der
 * Zugriff wird ausschliesslich ueber die Plattform-Rolle (PLATFORM_ADMIN) im
 * Controller/RolesGuard geschuetzt – kein Kunden-/Endnutzer-Feature.
 *
 * Wertespalten (kategorie/status/prioritaet) sind bewusst varchar + Code-
 * Konstante/@IsIn (KEIN Postgres-`enum`, vgl. showcase/geraetemarkt): neue Werte
 * erfordern dann keinen Enum-Reseed.
 */

/** Beobachtungs-Kategorie (fachliche Einordnung der Beobachtung). */
export type MarktKategorie = 'preis' | 'feature' | 'ux' | 'marketing' | 'sonstiges';
export const MARKT_KATEGORIEN: readonly MarktKategorie[] = [
  'preis',
  'feature',
  'ux',
  'marketing',
  'sonstiges',
];

/** Arbeitsstatus der abgeleiteten eigenen Verbesserungsidee. */
export type MarktStatus = 'neu' | 'geprueft' | 'eingeplant' | 'umgesetzt' | 'verworfen';
export const MARKT_STATUS: readonly MarktStatus[] = [
  'neu',
  'geprueft',
  'eingeplant',
  'umgesetzt',
  'verworfen',
];

/** Prioritaet der abgeleiteten eigenen Verbesserungsidee. */
export type MarktPrioritaet = 'hoch' | 'mittel' | 'niedrig';
export const MARKT_PRIORITAETEN: readonly MarktPrioritaet[] = ['hoch', 'mittel', 'niedrig'];

@Entity('markt_beobachtungen')
@Index(['status'])
@Index(['createdAt'])
export class MarktBeobachtung {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Name des beobachteten Wettbewerbers (sachlich, wie oeffentlich gefuehrt). */
  @Column() wettbewerber: string;

  /** 'preis' | 'feature' | 'ux' | 'marketing' | 'sonstiges' – varchar + @IsIn. */
  @Column({ default: 'sonstiges' }) kategorie: MarktKategorie;

  /** Die sachliche, oeffentlich beobachtbare Beobachtung (Freitext). */
  @Column({ type: 'text' }) beobachtung: string;

  /** Optionale Quelle (nur http/https – Nachweis der oeffentlichen Beobachtung). */
  @Column({ nullable: true }) quelleUrl: string | null;

  /** Datum der Beobachtung (ISO-Datum YYYY-MM-DD). */
  @Column({ type: 'date' }) beobachtetAm: string;

  /** Unsere daraus abgeleitete eigene „besser machen"-Idee (Freitext). */
  @Column({ type: 'text' }) abgeleiteteIdee: string;

  /** Arbeitsstatus der eigenen Idee – NICHT eine Bewertung des Wettbewerbers. */
  @Column({ default: 'neu' }) status: MarktStatus;

  /** Prioritaet der eigenen Idee. */
  @Column({ default: 'mittel' }) prioritaet: MarktPrioritaet;

  /** Plattform-Nutzer, der den Eintrag angelegt hat (Rechenschaft). */
  @Column({ nullable: true }) erstelltVonUserId: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
