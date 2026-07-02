import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum MarketplaceOrderStatus {
  EINGEGANGEN = 'eingegangen',
  BESTAETIGT = 'bestaetigt',
  VERSENDET = 'versendet',
  STORNIERT = 'storniert',
}

/**
 * In-App-Bestellung eines Betriebs im Marktplatz. Eine Bestellung gehoert
 * genau EINEM Haendler (der Warenkorb wird beim Absenden je Haendler
 * aufgeteilt) - so kann jeder Haendler seine Bestellungen eigenstaendig ueber
 * das Token-Portal abwickeln und die Provisions-Auswertung braucht keine
 * Positions-Splits.
 *
 * Kontakt-/Lieferdaten liegen als SNAPSHOT am Beleg (nicht als Referenz), damit
 * der Haendler versenden kann, ohne Zugriff auf Tenant-Stammdaten zu haben.
 *
 * ZAHLUNG: bewusst NICHT Teil dieses MVP - Abwicklung/Rechnung laeuft direkt
 * zwischen Haendler und Betrieb; Detailly rechnet die Provision separat ab
 * (dokumentierte Produktentscheidung).
 */
@Index(['tenantId', 'createdAt'])
@Index(['dealerId', 'status'])
@Entity('marketplace_orders')
export class MarketplaceOrder {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Fortlaufende Belegnummer MP-<Jahr>-<lfd> (plattformweit, unique). */
  @Index({ unique: true })
  @Column()
  nummer: string;

  /** Bestellender Betrieb (Mandant). */
  @Index()
  @Column()
  tenantId: string;

  /** Haendler, der diese Bestellung beliefert. */
  @Column() dealerId: string;

  /** User, der die Bestellung ausgeloest hat (Nachvollziehbarkeit). */
  @Column() createdByUserId: string;

  // --- Kontakt/Lieferung (Snapshot fuer den Haendler) ---
  @Column() kontaktName: string;
  @Column() kontaktEmail: string;
  @Column({ nullable: true }) kontaktTelefon: string;
  @Column({ nullable: true }) lieferFirma: string;
  @Column({ nullable: true }) lieferStrasse: string;
  @Column({ nullable: true }) lieferPlz: string;
  @Column({ nullable: true }) lieferOrt: string;
  @Column({ default: 'DE' }) lieferLand: string;
  @Column({ type: 'text', nullable: true }) notiz: string;

  @Column({
    type: enumColumnType(),
    enum: MarketplaceOrderStatus,
    default: MarketplaceOrderStatus.EINGEGANGEN,
  })
  status: MarketplaceOrderStatus;

  /** Bruttosumme aller Positionen (Snapshot-Preise). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) summeBrutto: number;

  /** Aggregierte Betreiber-Provision (Marge fuer Finn) ueber alle Positionen. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) summeProvision: number;

  // --- Statusverfolgung (wann welcher Schritt passierte) ---
  @Column({ type: timestampColumnType(), nullable: true }) bestaetigtAm: Date;
  @Column({ type: timestampColumnType(), nullable: true }) versendetAm: Date;
  @Column({ type: timestampColumnType(), nullable: true }) storniertAm: Date;

  /** Sendungsverfolgung, vom Haendler beim Versand hinterlegt. */
  @Column({ nullable: true }) trackingNummer: string;
  @Column({ nullable: true }) trackingUrl: string;

  /**
   * Provisionsabrechnung, in der dieser Beleg erfasst wurde (null = noch
   * offen). Gesetzt beim Erstellen einer MarketplaceSettlement -> verhindert
   * Doppelabrechnung.
   */
  @Index()
  @Column({ nullable: true })
  abrechnungId: string;

  /**
   * Wann die Positionen ins MANDANTEN-Lager gebucht wurden (ZUGANG-Movements
   * im Shop-Modul). null = noch nicht eingelagert; gesetzt = Button weg,
   * keine Doppelbuchung. Haendler fuehren KEIN Lager in Detailly.
   */
  @Column({ type: timestampColumnType(), nullable: true }) eingelagertAm: Date;

  // --- Haendler-Benachrichtigung (Mail ist fire-and-forget, aber nachvollziehbar) ---
  /** Wann die Bestell-Mail an den Haendler erfolgreich uebergeben wurde. */
  @Column({ type: timestampColumnType(), nullable: true }) haendlerBenachrichtigtAm: Date;
  /** Letzter Fehler beim Zustellversuch (null = kein Fehler); Basis fuer "Erneut senden". */
  @Column({ type: 'text', nullable: true }) benachrichtigungFehler: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
