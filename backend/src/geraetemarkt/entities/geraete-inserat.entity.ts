import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Geraete-Inserat auf dem Gebrauchtmarkt (Werkstatt verkauft Ausruestung an
 * andere Werkstaetten). Tenant-getrennt: `tenantId` = Verkaeufer-Betrieb.
 *
 * Wertespalten (kategorie/zustand/preisModus/status/moderationStatus) sind
 * BEWUSST varchar + Code-Konstante (geraetemarkt.constants.ts), KEIN DB-Enum –
 * so erzwingen neue Werte keine Enum-Migration/keinen Reseed. Es werden KEINE
 * Kontaktdaten (E-Mail/Telefon/genaue Adresse) gespeichert; Standort nur grob
 * (2-stellige PLZ-Region + grober Ort). Kontakt-Reveal folgt in PR3.
 */
@Index(['moderationStatus', 'status', 'createdAt'])
@Entity('geraete_inserate')
export class GeraeteInserat {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Verkaeufer-Betrieb (Mandantentrennung). Jede Mutation ist hierauf gescoped. */
  @Index() @Column() tenantId: string;

  /** Anlegender Nutzer (aus dem JWT, nie aus dem Body). */
  @Column() userId: string;

  @Column() titel: string;

  @Column({ type: 'text' }) beschreibung: string;

  /**
   * Richtung: siehe INSERAT_ART (angebot/gesuch). DEFAULT 'angebot' – jedes
   * Bestandsinserat (reiner Geraete-Verkauf) IST ein Angebot und laeuft ohne
   * Neubefuellung unveraendert weiter.
   */
  @Column({ default: 'angebot' }) art: string;

  /** Siehe ALLE_KATEGORIEN (Geraete + Nachbarschaftshilfe, KEINE Chemie). */
  @Index() @Column() kategorie: string;

  /** Siehe INSERAT_ZUSTAND (neu/gebraucht/defekt). */
  @Column() zustand: string;

  /** Preis in EUR. NULL bei preisModus='anfrage'. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  preis: number | null;

  /** Siehe PREIS_MODUS (fest/vb/anfrage). */
  @Column() preisModus: string;

  /** Nur 2-stellige PLZ-Region (grober Standort, KEINE Strasse). */
  @Column({ nullable: true }) plzRegion: string | null;

  /** Grober Ort (optional). */
  @Column({ nullable: true }) ort: string | null;

  /** Siehe INSERAT_STATUS (vom Verkaeufer gesteuert). */
  @Column({ default: 'aktiv' }) status: string;

  /** Siehe MODERATION_STATUS (vom Betreiber gesteuert – Melde-Logik = PR3). */
  @Column({ default: 'ok' }) moderationStatus: string;

  /** Ablaufzeitpunkt – nach Ablauf nicht mehr im Browse sichtbar. */
  @Column({ type: timestampColumnType(), nullable: true }) ablaufAm: Date | null;

  /**
   * Gebuehren-NAHT (siehe INSERAT_GEBUEHR_AKTIV): ob fuer dieses Inserat eine
   * Gebuehr faellig ist. Solange der zentrale Schalter AUS ist, wird beim Anlegen
   * IMMER false gesetzt -> keine Gebuehr, blockt nichts. NICHT in der oeffentlichen
   * Projektion (internes Abrechnungs-Feld).
   */
  @Column({ default: false }) kostenpflichtig: boolean;

  /** Gebuehren-NAHT: ob die Gebuehr beglichen wurde. Default false. Internes Feld. */
  @Column({ default: false }) bezahlt: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
