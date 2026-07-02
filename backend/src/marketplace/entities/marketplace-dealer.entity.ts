import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Haendler im B2B-Marktplatz. PLATTFORM-WEITER Inhalt (bewusst OHNE tenantId):
 * Detailly kuratiert den Katalog zentral, alle Betriebe sehen dieselben
 * Haendler/Produkte. Verdienst laeuft ueber Affiliate-Links der Produkte UND
 * ueber die Provision auf In-App-Bestellungen (provisionSatz).
 */
@Entity('marketplace_dealers')
export class MarketplaceDealer {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) beschreibung: string;

  @Column({ nullable: true }) logoUrl: string;

  @Column({ nullable: true }) webseite: string;

  /** Kontakt fuer Bestell-Benachrichtigungen an den Haendler. */
  @Column({ nullable: true }) kontaktEmail: string;

  /**
   * Provisions-Satz in PROZENT, den der Betreiber (Finn) je In-App-Bestellung
   * dieses Haendlers erhaelt. Wird auf jeder Bestellposition als Snapshot
   * eingefroren -> spaetere Satz-Aenderungen ruehren alte Belege nicht.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  provisionSatz: number;

  /**
   * Geheimer Token fuer das Haendler-Portal (/haendler/<token>): eigene
   * Produkte pflegen + Bestellungen abwickeln. Capability-URL wie Kalender-/
   * Freigabe-Token, bewusst OHNE eigenes Login-System (kleine Angriffsflaeche).
   * Klartext (muss per WHERE auffindbar sein) + select:false; bei Leck
   * regenerierbar.
   */
  @Column({ nullable: true, select: false })
  uploadToken: string;

  @Column({ default: true }) aktiv: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
