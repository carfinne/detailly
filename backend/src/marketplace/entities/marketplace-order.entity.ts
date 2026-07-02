import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

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

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
