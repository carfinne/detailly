import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Produktbewertung durch einen BETRIEB (nicht Endkunden) mit Kaufnachweis:
 * nur Tenants mit einer nicht-stornierten Bestellung des Produkts duerfen
 * bewerten (Service-Guard). Eine Bewertung je Produkt+Tenant (unique) -
 * erneutes Bewerten aktualisiert. Nach jedem Schreiben werden die
 * denormalisierten Aggregate am Produkt (bewertungSchnitt/-Anzahl) neu
 * berechnet. Anzeige anonymisiert (kein Betriebs-/Nutzername im Katalog).
 */
@Index(['productId', 'tenantId'], { unique: true })
@Entity('marketplace_reviews')
export class MarketplaceReview {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column()
  productId: string;

  @Column() tenantId: string;

  /** Nutzer, der zuletzt bewertet hat (Audit; nicht oeffentlich). */
  @Column() userId: string;

  /** 1-5 Sterne. */
  @Column({ type: 'int' }) sterne: number;

  @Column({ type: 'text', nullable: true }) kommentar: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
