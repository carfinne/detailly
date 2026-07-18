import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Zusatz-Bild eines Marktplatz-Produkts (Galerie). Das PRIMAER-Bild bleibt am
 * Produkt (`bildUrl`); diese Child-Zeilen sind die weiteren Ansichten. `datei`
 * ist der logische Bild-Pfad, `sortIndex` die Galerie-Reihenfolge (aufsteigend).
 * Plattform-weiter Katalog-Inhalt (kein tenantId).
 */
@Entity('marketplace_product_images')
export class MarketplaceProductImage {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() productId: string;

  /** Logischer Bild-Pfad/URL. */
  @Column({ type: 'text' }) datei: string;

  /** Galerie-Reihenfolge (aufsteigend). */
  @Column({ type: 'int', default: 0 }) sortIndex: number;

  @CreateDateColumn() createdAt: Date;
}
