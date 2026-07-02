import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Produkt im B2B-Marktplatz (plattform-weit, Detailly-kuratiert). Der Kauf
 * passiert BEIM HAENDLER: `affiliateUrl` ist der Detailly-Affiliate-Link;
 * `klicks` ist ein denormalisierter Zaehler fuer schnelle Top-Listen (die
 * Einzelklicks liegen als MarketplaceClick fuer die Auswertung vor).
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

  /** Detailly-Affiliate-Link zum Haendler-Shop (Pflicht). */
  @Column() affiliateUrl: string;

  @Column({ default: true }) aktiv: boolean;

  /** Denormalisierter Klick-Zaehler (atomar inkrementiert). */
  @Column({ default: 0 }) klicks: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
