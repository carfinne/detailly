import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Bestellposition. Alle preis-/provisionsrelevanten Werte sind SNAPSHOTS zum
 * Bestellzeitpunkt (Produktname, Einzelpreis, Provisionssatz), damit spaetere
 * Aenderungen am Produkt oder am Haendler-Satz historische Belege nicht
 * ruehren. `dealerId` liegt bewusst redundant auf der Position, damit die
 * Provisions-Auswertung je Haendler ohne Join auf (evtl. geloeschte) Produkte
 * oder Bestellungen auskommt.
 */
@Entity('marketplace_order_items')
export class MarketplaceOrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column()
  orderId: string;

  @Index()
  @Column()
  dealerId: string;

  @Column() productId: string;

  @Column() produktName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) einzelpreis: number;
  @Column({ type: 'int', default: 1 }) menge: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) zeilenSumme: number;

  /** Provisionssatz (%) als Snapshot vom Haendler zum Bestellzeitpunkt. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) provisionSatz: number;
  /** Provisionsbetrag = zeilenSumme * provisionSatz/100, kaufmaennisch gerundet. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) provisionBetrag: number;

  @CreateDateColumn() createdAt: Date;
}
