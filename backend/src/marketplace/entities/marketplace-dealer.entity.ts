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
 * Haendler/Produkte. Verdienst laeuft ueber Affiliate-Links der Produkte.
 */
@Entity('marketplace_dealers')
export class MarketplaceDealer {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) beschreibung: string;

  @Column({ nullable: true }) logoUrl: string;

  @Column({ nullable: true }) webseite: string;

  @Column({ default: true }) aktiv: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
