import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';
import { Order } from './order.entity';

export enum OrderItemType {
  LEISTUNG = 'leistung',
  MATERIAL = 'material',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  // Index: Positionen werden immer ueber orderId geladen (Detail/Join).
  @Index() @Column() orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column() beschreibung: string;

  @Column({ type: enumColumnType(), enum: OrderItemType, default: OrderItemType.LEISTUNG })
  typ: OrderItemType;

  /** Menge bzw. bei qm-Positionen die Flaeche in qm. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 }) menge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) einzelpreis: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gesamtpreis: number;

  /**
   * Geplante Dauer dieser Position in Minuten (Soll). Wie einzelpreis/beschreibung
   * ein SNAPSHOT beim Anlegen (aus dem Leistungskatalog uebernommen), damit
   * historische Auftraege stabil bleiben, wenn sich der Katalog spaeter aendert.
   * Nullable -> manuelle Freitext-Positionen ohne Dauer zaehlen als 0.
   */
  @Column({ type: 'int', nullable: true }) geplanteDauerMinuten: number | null;
}
