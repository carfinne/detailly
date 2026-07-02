import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Produkt im B2B-Marktplatz (plattform-weit). Zwei Vertriebswege je Produkt:
 * - `affiliateUrl` gesetzt: Kauf BEIM HAENDLER via Affiliate-Link (`klicks`
 *   ist der denormalisierte Zaehler; Einzelklicks als MarketplaceClick).
 * - `bestellbar`: direkte In-App-Bestellung (MarketplaceOrder) mit Provision
 *   fuer den Betreiber. Braucht einen gesetzten `preis`.
 * Mindestens einer der beiden Wege muss aktiv sein (Service-Validierung).
 */
@Index(['aktiv', 'kategorie'])
@Entity('marketplace_products')
export class MarketplaceProduct {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() dealerId: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) beschreibung: string;

  /** Freie Kategorie (z. B. "Folien", "PPF", "Chemie", "Werkzeug"). */
  @Column() kategorie: string;

  /** Anzeigepreis (z. B. "ab 289 €"); null = Preis beim Haendler. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) preis: number;

  /** Optionaler Zusatz zum Preis (z. B. "pro Rolle", "ab"). */
  @Column({ nullable: true }) preisHinweis: string;

  @Column({ nullable: true }) bildUrl: string;

  /** Detailly-Affiliate-Link zum Haendler-Shop (optional bei bestellbaren Produkten). */
  @Column({ nullable: true }) affiliateUrl: string;

  /** Direkt in der App bestellbar (setzt einen gesetzten preis voraus). */
  @Column({ default: false }) bestellbar: boolean;

  @Column({ default: true }) aktiv: boolean;

  /** Denormalisierter Klick-Zaehler (atomar inkrementiert). */
  @Column({ default: 0 }) klicks: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
